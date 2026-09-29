"""Manage the persistent local owner account used for manual provider QA (#1073).

This command is deliberately narrower than ``e2e_fixtures``: the account is
not a disposable fixture and is guarded so it cannot be used against a
published database.  Existing account data and sessions are never replaced.
"""

from __future__ import annotations

import json
import os
import secrets

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import connection

DEFAULT_USERNAME = "dev_owner"
DEFAULT_EMAIL = "dev-owner@example.test"
_LOCAL_DATABASE_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", "postgres"})


def _require_local_development_environment() -> None:
    """Refuse account writes unless this is an explicitly local debug DB."""
    if not settings.DEBUG:
        raise CommandError("Refusing dev_account: DJANGO_DEBUG must be true.")

    host = str(connection.settings_dict.get("HOST") or "").strip().lower()
    if host not in _LOCAL_DATABASE_HOSTS:
        raise CommandError(
            "Refusing dev_account: DATABASE_URL must target localhost, "
            "127.0.0.1, or the Compose postgres service."
        )


def _password_for_new_account() -> tuple[str, bool]:
    configured = os.environ.get("DEV_ACCOUNT_PASSWORD")
    if configured:
        return configured, False
    return secrets.token_urlsafe(24), True


class Command(BaseCommand):
    help = "Create or report the guarded persistent local dev_owner account."

    def add_arguments(self, parser):
        parser.add_argument("action", choices=["create", "status"])
        parser.add_argument("--username", default=DEFAULT_USERNAME)

    def handle(self, *args, **options):
        _require_local_development_environment()
        username = options["username"]
        if options["action"] == "create":
            self._create(username)
        else:
            self._status(username)

    def _create(self, username: str) -> None:
        User = get_user_model()  # noqa: N806
        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": DEFAULT_EMAIL, "is_active": True},
        )
        generated = False
        if created:
            password, generated = _password_for_new_account()
            user.set_password(password)
            user.save(update_fields=["password"])
        elif not user.has_usable_password():
            password, generated = _password_for_new_account()
            user.set_password(password)
            user.save(update_fields=["password"])

        result = {"action": "create", "created": created, "username": user.username}
        if generated:
            result["generated_password"] = password
        elif created:
            result["password_source"] = "DEV_ACCOUNT_PASSWORD"
        self.stdout.write(json.dumps(result, sort_keys=True))

    def _status(self, username: str) -> None:
        from scenes.models import ProviderCredential

        User = get_user_model()  # noqa: N806
        user = User.objects.filter(username=username).first()
        configured = bool(user and ProviderCredential.objects.filter(owner=user).exists())
        self.stdout.write(
            json.dumps(
                {
                    "action": "status",
                    "exists": user is not None,
                    "provider_credential_configured": configured,
                    "username": username,
                },
                sort_keys=True,
            )
        )
