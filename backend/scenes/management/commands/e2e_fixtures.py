"""Task 65 (issue #65): deterministic fixture users for the Playwright
project-lifecycle end-to-end suite (`frontend/e2e/`).

The suite drives the *real* browser UI and the real `/accounts/login/`
allauth sign-in form (never Google OAuth, which needs real third-party
credentials per `AGENTS.md`'s issue #75 note) — so it needs real,
password-authenticatable Django users to exist before any test runs, and
none of their data left behind once the run finishes. This command is the
one place that creates and removes them, invoked from
`frontend/e2e/global-setup.ts`/`global-teardown.ts` via `uv run --env-file
.env python manage.py e2e_fixtures <create|cleanup>`.

All fixture users get a verified, primary `allauth.account.models.EmailAddress`
record in addition to `User.email` — `ACCOUNT_LOGIN_METHODS = {'email'}`
(`backend/backend/settings.py`) makes allauth's own login form authenticate by
email, and its backend looks users up through `EmailAddress` first,
falling back to `User.email`. Creating both covers either lookup path
without depending on allauth's internal implementation detail.

Idempotent by design: `create` reuses an existing fixture user (and resets
its password/email-verification state) rather than erroring if it's
called twice without a `cleanup` in between — a previous run that crashed
before teardown must never block the next one. `cleanup` deletes by exact
fixture username, which cascades (`Project.owner`'s `on_delete=CASCADE`)
to every project, version, draft, and activity row the fixture users
created, so a single delete is enough to leave no cross-run residue.
"""

import json
import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

# Fixed, non-secret credentials -- these users only ever exist against a
# throwaway/dev PostgreSQL database for the lifetime of one E2E run, never
# against a real deployment (see the module docstring and AGENTS.md's
# "no PostgreSQL server in this environment" constraint this suite is
# built around).
E2E_PASSWORD = "e2e-playwright-fixture-pw-1!"  # noqa: S105 - not a real secret

# (username, email) pairs. "other" is used for the non-owner/authorization
# scenario; "empty" is reserved for tests that require a project-free gallery
# even after earlier specs have created projects for the other fixture users.
E2E_USERS = {
    "owner": ("e2e_owner", "e2e-owner@example.test"),
    "other": ("e2e_other", "e2e-other@example.test"),
    "empty": ("e2e_empty", "e2e-empty@example.test"),
}


def _get_or_create_user(username: str, email: str):
    from allauth.account.models import EmailAddress

    User = get_user_model()
    user, _created = User.objects.update_or_create(
        username=username,
        defaults={"email": email, "is_active": True},
    )
    user.set_password(E2E_PASSWORD)
    user.save(update_fields=["password"])

    EmailAddress.objects.update_or_create(
        user=user,
        email=email,
        defaults={"verified": True, "primary": True},
    )
    return user


class Command(BaseCommand):
    help = (
        "Creates or removes the deterministic Playwright fixture users "
        "the Playwright project-lifecycle suite (frontend/e2e/) signs in as. "
        "Never run against a real deployment's database."
    )

    def add_arguments(self, parser):
        parser.add_argument("action", choices=["create", "cleanup"])
        parser.add_argument(
            "--json",
            action="store_true",
            help="On 'create', print only a single JSON line of fixture "
            "credentials to stdout (no other output) for Playwright's "
            "global-setup.ts to parse.",
        )

    def handle(self, *args, **options):
        action = options["action"]
        as_json = options["json"]
        if (
            os.environ.get("E2E_FIXTURE_ENVIRONMENT") == "disposable-staging"
            and os.environ.get("STAGING_SMOKE") != "1"
        ):
            raise CommandError(
                "Disposable staging fixtures require STAGING_SMOKE=1; "
                "refusing to modify an unknown environment."
            )

        if action == "create":
            self._create(as_json)
        elif action == "cleanup":
            self._cleanup(as_json)
        else:  # pragma: no cover - argparse already restricts choices
            raise CommandError(f"Unknown action: {action}")

    def _create(self, as_json: bool):
        with transaction.atomic():
            owner = _get_or_create_user(*E2E_USERS["owner"])
            other = _get_or_create_user(*E2E_USERS["other"])
            empty = _get_or_create_user(*E2E_USERS["empty"])

        payload = {
            "available": True,
            "password": E2E_PASSWORD,
            "owner": {"username": owner.username, "email": owner.email},
            "other": {"username": other.username, "email": other.email},
            "empty": {"username": empty.username, "email": empty.email},
        }

        if as_json:
            # Exactly one line, nothing else on stdout -- global-setup.ts
            # parses stdout as JSON directly.
            self.stdout.write(json.dumps(payload))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    "Created/reset E2E fixture users: "
                    f"{owner.username}, {other.username}, {empty.username}"
                )
            )

    def _cleanup(self, as_json: bool):
        from django.db.models import Q

        from scenes.models import ForkProvenance, Project, Project3D

        User = get_user_model()
        usernames = [username for username, _email in E2E_USERS.values()]

        # CASCADE on Project.owner (scenes/models.py) removes every
        # project/version/draft/activity row these users own along with
        # the users themselves -- see this file's module docstring. Three
        # things stand in the way of that single cascading delete, none
        # of which real application code ever hits in the same way
        # (nothing else hard-deletes a SceneVersion, only soft-deletes
        # it, and nothing else deletes the *source* side of a fork):
        #
        # 0. `ForkProvenance.source_project`/`source_version` are both
        #    `on_delete=PROTECT` -- if any project (a fixture's own or
        #    someone else's) was ever forked *from* a fixture project or
        #    version, that provenance row blocks deleting the source.
        #    Delete every such row outright first; a fork's provenance
        #    record has no meaning left once its source no longer exists
        #    either way.
        # 1. `Project.current_version` is `on_delete=PROTECT` against
        #    SceneVersion, which blocks deleting a version while any
        #    project (even one being deleted in this same cascade) still
        #    points `current_version` at it. Null it first, across every
        #    project including soft-deleted ones (`all_objects`), so
        #    nothing protects the versions this cleanup is about to
        #    remove.
        # 2. Deleting a SceneVersion that another (also-being-deleted)
        #    SceneVersion still references as `parent`/`fork_source_version`,
        #    or that a deleted user still authored (`created_by`), requires
        #    Django's collector to null those FKs first (all three
        #    `on_delete=SET_NULL`) -- and that UPDATE trips
        #    `scenes_sceneversion_prevent_snapshot_mutation_trigger`
        #    (migration 0002_postgres_invariants), which treats all three as
        #    immutable snapshot fields. Rather than disabling the trigger
        #    around the delete itself (Postgres refuses `ALTER TABLE`
        #    while a transaction has pending trigger events queued, so a
        #    disable/delete/re-enable in one transaction fails with
        #    "cannot ALTER TABLE ... because it has pending trigger
        #    events"), pre-null both fields directly -- with the trigger
        #    disabled only for that plain UPDATE, then immediately
        #    re-enabled, before any delete starts. Django's own SET_NULL
        #    pass during the cascade below then writes the same NULL
        #    value the trigger already saw, which its `IS DISTINCT FROM`
        #    check treats as a no-op, not a mutation.
        #
        # PostgreSQL only for both; SQLite (offline tests) has neither
        # the trigger nor a real PROTECT-vs-CASCADE ordering conflict
        # worth guarding against here.
        with transaction.atomic():
            ForkProvenance.objects.filter(
                Q(source_project__owner__username__in=usernames)
                | Q(source_version__project__owner__username__in=usernames)
            ).delete()
            Project.all_objects.filter(owner__username__in=usernames).update(current_version=None)
            # Issue #239: Project3D.current_version is PROTECT (scenes/models.py)
            # just like Project.current_version above -- once a fixture owner has
            # any Project3D, deleting the user without nulling this first raises
            # ProtectedError during the User cascade below. Uses `all_objects`
            # (issue #242 added Project3D's soft-delete manager pair, mirroring
            # `Project.all_objects` above) so a soft-deleted fixture project still
            # gets its current_version nulled. SceneVersion3D has no
            # parent/fork_source_version/immutable-snapshot trigger (3D has no
            # fork feature), so this is a plain update with none of Project's
            # surrounding trigger complexity.
            Project3D.all_objects.filter(owner__username__in=usernames).update(current_version=None)
            if connection.vendor == "postgresql":
                with connection.cursor() as cursor:
                    cursor.execute(
                        "ALTER TABLE scenes_sceneversion "
                        "DISABLE TRIGGER scenes_sceneversion_prevent_snapshot_mutation_trigger"
                    )
                    # Null out any reference -- from *any* version, in
                    # *any* project, not just the fixture users' own --
                    # to a version that's about to be deleted (`doomed`),
                    # since a fork elsewhere could point back at a
                    # fixture version (`fork_source_version`) just as
                    # easily as a fixture version could reference another
                    # fixture version as its own `parent`. Also null
                    # `created_by` on every version any fixture user
                    # authored, `doomed` or not (e.g. an AI-accepted
                    # version's `created_by` recorded the accepting user,
                    # who need not own the project it landed in).
                    cursor.execute(
                        "WITH doomed AS ("
                        "  SELECT id FROM scenes_sceneversion WHERE project_id IN ("
                        "    SELECT id FROM scenes_project WHERE owner_id IN ("
                        "      SELECT id FROM auth_user WHERE username = ANY(%s)"
                        "    )"
                        "  )"
                        "), fixture_user_ids AS ("
                        "  SELECT id FROM auth_user WHERE username = ANY(%s)"
                        ") "
                        "UPDATE scenes_sceneversion SET "
                        "  parent_id = CASE WHEN parent_id IN (SELECT id FROM doomed) "
                        "    THEN NULL ELSE parent_id END, "
                        "  fork_source_version_id = CASE "
                        "    WHEN fork_source_version_id IN (SELECT id FROM doomed) "
                        "    THEN NULL ELSE fork_source_version_id END, "
                        "  created_by_id = CASE "
                        "    WHEN created_by_id IN (SELECT id FROM fixture_user_ids) "
                        "    THEN NULL ELSE created_by_id END "
                        "WHERE parent_id IN (SELECT id FROM doomed) "
                        "  OR fork_source_version_id IN (SELECT id FROM doomed) "
                        "  OR created_by_id IN (SELECT id FROM fixture_user_ids)",
                        [usernames, usernames],
                    )
                    cursor.execute(
                        "ALTER TABLE scenes_sceneversion "
                        "ENABLE TRIGGER scenes_sceneversion_prevent_snapshot_mutation_trigger"
                    )
            deleted_count, _ = User.objects.filter(username__in=usernames).delete()

        if as_json:
            self.stdout.write(json.dumps({"deleted": deleted_count}))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Deleted E2E fixture users and their data ({deleted_count} row(s))."
                )
            )
