"""Issue #946: one-time, owner-run grandfathering of active accounts under
the local-first/opt-in-sync model (owner decision #3, 2026-09-26).

**This command must never be run against production by an agent session.**
Codex/Claude writes and tests it against disposable fixtures only; the
owner runs `--apply` in the production console after reviewing a dry run.
See `.agents/memory/production-data-action-gap-in-self-qa.md`.

Behavior
--------
- Dry run is the default: writes nothing, prints a JSON report of exactly
  what would change.
- Free-plan (or no-plan) accounts, excluding admins: every non-deleted,
  not-already-public `Project`/`Project3D`/`ArtPiece` that passes the
  *same* validation its own publish view already enforces gets published
  (`visibility`/`status` -> public, `published_at` stamped, the new
  `unpublished_at` cleared for consistency with #944). Pieces that fail
  validation are skipped and listed with the reason -- never forced.
- Paid-plan or admin accounts: `CloudSyncPreference` is enabled with
  `consent_source="grandfathering-2026-09-25"` (distinct from the
  ordinary user-consent path in `AccountCloudSyncView`) if not already
  enabled. No existing browser-only media is uploaded by this.
- `--apply` refuses to run unless `SiteSettings.cloud_sync_enabled` is
  already true, and unless `--yes` is also passed (the confirmation flag,
  echoing back the exact account/piece counts first).
- `--apply` writes a rollback file (`--rollback-file <path>`, defaulting
  to a timestamped name in the current directory) recording every prior
  field value it changed. `--rollback <path>` restores exactly those
  fields and nothing else.
- Idempotent: a second `--apply` run with nothing changed in between
  reports zero further changes.
"""

from __future__ import annotations

import json
from datetime import datetime

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from scenes.admin_authorization import is_application_admin
from scenes.admin_settings import get_site_settings
from scenes.entitlements import DEFAULT_PLAN, get_user_plan_key
from scenes.models import ArtPiece, CloudSyncPreference, Project, Project3D
from scenes.publishing import validate_meaningful_metadata

GRANDFATHER_CONSENT_SOURCE = "grandfathering-2026-09-25"
GRANDFATHER_CONSENT_VERSION = "grandfathering-2026-09-25"
GRANDFATHER_CONSENT_TEXT = (
    "Account-level cloud sync was enabled administratively as part of the "
    "2026-09-25 grandfathering of pre-existing paid/admin accounts under "
    "the local-first/opt-in-sync model -- not through this account's own "
    "consent flow. See issue #946."
)


def _art_piece_meaningful(piece: ArtPiece) -> bool:
    # Mirrors `art_piece_persistence.py`'s private `_meaningful()` exactly
    # (title and description both non-blank) rather than importing a
    # leading-underscore symbol across modules.
    return bool(piece.title.strip() and piece.description.strip())


class Command(BaseCommand):
    help = __doc__

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Write changes.")
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Required alongside --apply: confirms the echoed-back account/piece counts.",
        )
        parser.add_argument(
            "--rollback-file",
            default=None,
            help="Path to write the rollback record (--apply only). Defaults to a timestamped "
            "filename in the current directory.",
        )
        parser.add_argument(
            "--rollback",
            default=None,
            metavar="PATH",
            help="Restore exactly the fields recorded in this rollback file, then exit.",
        )

    def handle(self, *args, **options):
        if options["rollback"]:
            self._rollback(options["rollback"])
            return

        apply_changes = options["apply"]
        if apply_changes and not get_site_settings().cloud_sync_enabled:
            raise CommandError(
                "Refusing to --apply: site cloud_sync_enabled is false. Enable it in admin "
                "settings first."
            )

        plan = self._plan()
        if apply_changes and not options["yes"]:
            raise CommandError(
                f"--apply requires --yes to confirm: this would publish "
                f"{sum(len(a['would_publish']) for a in plan['free_accounts'])} piece(s) across "
                f"{len(plan['free_accounts'])} free account(s), and enable sync for "
                f"{len(plan['sync_accounts'])} paid/admin account(s). Re-run with --apply --yes."
            )

        if not apply_changes:
            self.stdout.write(
                json.dumps({**self._json_safe(plan), "dry_run": True, "no_write": True}, indent=2)
            )
            return

        rollback_entries: list[dict] = []
        with transaction.atomic():
            for account in plan["free_accounts"]:
                for item in account["would_publish"]:
                    rollback_entries.append(self._publish(item["model"], item["kind"]))
            for account in plan["sync_accounts"]:
                if account["already_enabled"]:
                    continue
                rollback_entries.append(self._enable_sync(account["_user"]))

        rollback_path = options["rollback_file"] or (
            f"grandfather_rollback_{timezone.now().strftime('%Y%m%dT%H%M%SZ')}.json"
        )
        with open(rollback_path, "w") as handle:
            json.dump(rollback_entries, handle, indent=2)

        self.stdout.write(
            json.dumps(
                {
                    "applied": True,
                    "changes": len(rollback_entries),
                    "rollback_file": rollback_path,
                },
                indent=2,
            )
        )

    @staticmethod
    def _json_safe(plan: dict) -> dict:
        return {
            "free_accounts": [
                {
                    "owner": account["owner"],
                    "would_publish": [
                        {"kind": item["kind"], "id": str(item["model"].public_id)}
                        for item in account["would_publish"]
                    ],
                    "skipped": account["skipped"],
                }
                for account in plan["free_accounts"]
            ],
            "sync_accounts": [
                {"owner": account["owner"], "already_enabled": account["already_enabled"]}
                for account in plan["sync_accounts"]
            ],
        }

    # --- Planning (shared by dry-run and --apply) ---------------------

    def _plan(self) -> dict:
        free_accounts = []
        sync_accounts = []
        for user in get_user_model().objects.all():
            if is_application_admin(user):
                sync_accounts.append(self._sync_row(user))
                continue
            plan_key = get_user_plan_key(user)
            if plan_key == DEFAULT_PLAN:
                row = self._free_row(user)
                if row["would_publish"] or row["skipped"]:
                    free_accounts.append(row)
            else:
                sync_accounts.append(self._sync_row(user))
        return {"free_accounts": free_accounts, "sync_accounts": sync_accounts}

    def _free_row(self, user) -> dict:
        would_publish = []
        skipped = []
        for project in Project.objects.filter(owner=user, is_deleted=False).exclude(
            visibility=Project.Visibility.PUBLIC
        ):
            errors = validate_meaningful_metadata(project.title, project.description)
            if project.current_version_id is None:
                errors.setdefault("current_version", []).append("No saved version.")
            if errors:
                skipped.append({"kind": "project", "id": str(project.public_id), "reason": errors})
            else:
                would_publish.append({"kind": "project", "model": project})
        for project3d in Project3D.objects.filter(owner=user, is_deleted=False).exclude(
            visibility=Project3D.Visibility.PUBLIC
        ):
            if project3d.current_version_id is None:
                skipped.append(
                    {
                        "kind": "project3d",
                        "id": str(project3d.public_id),
                        "reason": {"current_version": ["No saved version."]},
                    }
                )
            else:
                would_publish.append({"kind": "project3d", "model": project3d})
        for piece in ArtPiece.objects.filter(owner=user, is_deleted=False).exclude(
            status=ArtPiece.Status.PUBLISHED
        ):
            if piece.current_version_id is None or not _art_piece_meaningful(piece):
                skipped.append(
                    {
                        "kind": "art_piece",
                        "id": str(piece.public_id),
                        "reason": "Missing a saved version, or a meaningful title/description.",
                    }
                )
            else:
                would_publish.append({"kind": "art_piece", "model": piece})
        return {
            "owner": user.get_username(),
            "would_publish": would_publish,
            "skipped": skipped,
        }

    def _sync_row(self, user) -> dict:
        preference = CloudSyncPreference.objects.filter(owner=user).first()
        return {
            "owner": user.get_username(),
            "already_enabled": bool(preference and preference.enabled),
            "_user": user,
        }

    # --- Mutation (--apply only) ---------------------------------------

    def _publish(self, model, kind: str) -> dict:
        if kind == "project":
            pk, prior = self._publish_project(model.pk)
        elif kind == "project3d":
            pk, prior = self._publish_project3d(model.pk)
        else:
            pk, prior = self._publish_art_piece(model.pk)
        return {
            "model": kind,
            "pk": pk,
            "existed_before": True,
            "prior_fields": {
                key: (value.isoformat() if hasattr(value, "isoformat") else value)
                for key, value in prior.items()
            },
        }

    @staticmethod
    def _publish_project(pk: int) -> tuple[int, dict]:
        locked = Project.objects.select_for_update().get(pk=pk)
        prior = {
            "visibility": locked.visibility,
            "published_at": locked.published_at,
            "unpublished_at": locked.unpublished_at,
        }
        locked.visibility = Project.Visibility.PUBLIC
        locked.published_at = timezone.now()
        locked.unpublished_at = None
        locked.save(update_fields=["visibility", "published_at", "unpublished_at"])
        return locked.pk, prior

    @staticmethod
    def _publish_project3d(pk: int) -> tuple[int, dict]:
        locked = Project3D.objects.select_for_update().get(pk=pk)
        prior = {
            "visibility": locked.visibility,
            "published_at": locked.published_at,
            "unpublished_at": locked.unpublished_at,
        }
        locked.visibility = Project3D.Visibility.PUBLIC
        locked.published_at = timezone.now()
        locked.unpublished_at = None
        locked.save(update_fields=["visibility", "published_at", "unpublished_at"])
        return locked.pk, prior

    @staticmethod
    def _publish_art_piece(pk: int) -> tuple[int, dict]:
        locked = ArtPiece.objects.select_for_update().get(pk=pk)
        prior = {
            "status": locked.status,
            "published_at": locked.published_at,
            "unpublished_at": locked.unpublished_at,
        }
        locked.status = ArtPiece.Status.PUBLISHED
        locked.published_at = timezone.now()
        locked.unpublished_at = None
        locked.save(update_fields=["status", "published_at", "unpublished_at"])
        return locked.pk, prior

    def _enable_sync(self, user) -> dict:
        preference, created = CloudSyncPreference.objects.select_for_update().get_or_create(
            owner=user
        )
        prior = {
            "enabled": preference.enabled,
            "consent_version": preference.consent_version,
            "consent_text": preference.consent_text,
            "consent_source": preference.consent_source,
            "consented_at": preference.consented_at.isoformat()
            if preference.consented_at
            else None,
        }
        preference.enabled = True
        preference.consent_version = GRANDFATHER_CONSENT_VERSION
        preference.consent_text = GRANDFATHER_CONSENT_TEXT
        preference.consent_source = GRANDFATHER_CONSENT_SOURCE
        preference.consented_at = timezone.now()
        preference.save()
        return {
            "model": "cloud_sync_preference",
            "pk": preference.pk,
            "existed_before": not created,
            "prior_fields": prior,
        }

    # --- Rollback --------------------------------------------------------

    def _rollback(self, path: str) -> None:
        with open(path) as handle:
            entries = json.load(handle)
        with transaction.atomic():
            for entry in entries:
                model_name = entry["model"]
                pk = entry["pk"]
                if model_name == "cloud_sync_preference":
                    if not entry["existed_before"]:
                        CloudSyncPreference.objects.filter(pk=pk).delete()
                        continue
                    obj = CloudSyncPreference.objects.select_for_update().get(pk=pk)
                    fields = dict(entry["prior_fields"])
                    consented_at = fields.pop("consented_at")
                    obj.consented_at = (
                        datetime.fromisoformat(consented_at) if consented_at else None
                    )
                    for key, value in fields.items():
                        setattr(obj, key, value)
                    obj.save()
                    continue
                if model_name == "project":
                    piece_obj: Project | Project3D | ArtPiece = (
                        Project.objects.select_for_update().get(pk=pk)
                    )
                elif model_name == "project3d":
                    piece_obj = Project3D.objects.select_for_update().get(pk=pk)
                else:
                    piece_obj = ArtPiece.objects.select_for_update().get(pk=pk)
                for key, value in entry["prior_fields"].items():
                    if key in ("published_at", "unpublished_at") and value is not None:
                        value = datetime.fromisoformat(value)
                    setattr(piece_obj, key, value)
                piece_obj.save()
        self.stdout.write(json.dumps({"restored": len(entries)}, indent=2))
