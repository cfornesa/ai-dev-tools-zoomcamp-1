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

Both users get a verified, primary `allauth.account.models.EmailAddress`
record in addition to `User.email` — `ACCOUNT_LOGIN_METHODS = {'email'}`
(`config/settings.py`) makes allauth's own login form authenticate by
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
from django.db import transaction

# Fixed, non-secret credentials -- these users only ever exist against a
# throwaway/dev PostgreSQL database for the lifetime of one E2E run, never
# against a real deployment (see the module docstring and AGENTS.md's
# "no PostgreSQL server in this environment" constraint this suite is
# built around).
E2E_PASSWORD = "e2e-playwright-fixture-pw-1!"  # noqa: S105 - not a real secret

# (username, email) pairs. "other" is used for the non-owner/authorization
# scenario; it must never be the owner of any fixture project.
E2E_USERS = {
    "owner": ("e2e_owner", "e2e-owner@example.test"),
    "other": ("e2e_other", "e2e-other@example.test"),
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
        "Creates or removes the deterministic 'e2e_owner'/'e2e_other' users "
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

        payload = {
            "available": True,
            "password": E2E_PASSWORD,
            "owner": {"username": owner.username, "email": owner.email},
            "other": {"username": other.username, "email": other.email},
        }

        if as_json:
            # Exactly one line, nothing else on stdout -- global-setup.ts
            # parses stdout as JSON directly.
            self.stdout.write(json.dumps(payload))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Created/reset E2E fixture users: {owner.username}, {other.username}"
                )
            )

    def _cleanup(self, as_json: bool):
        User = get_user_model()
        usernames = [username for username, _email in E2E_USERS.values()]
        # CASCADE on Project.owner (scenes/models.py) removes every
        # project/version/draft/activity row these users own along with
        # the users themselves -- see this file's module docstring.
        deleted_count, _ = User.objects.filter(username__in=usernames).delete()

        if as_json:
            self.stdout.write(json.dumps({"deleted": deleted_count}))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Deleted E2E fixture users and their data ({deleted_count} row(s))."
                )
            )
