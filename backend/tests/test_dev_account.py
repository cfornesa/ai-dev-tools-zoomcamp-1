"""Regression tests for the guarded persistent local account command (#1073)."""

import json
from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import override_settings

from scenes.management.commands.e2e_fixtures import E2E_USERS
from scenes.models import Project, ProviderCredential, UserEntitlementPlan


def _run(action: str) -> dict:
    output = StringIO()
    call_command("dev_account", action, stdout=output)
    return json.loads(output.getvalue())


@pytest.fixture(autouse=True)
def local_database_guard(monkeypatch):
    monkeypatch.setitem(connection.settings_dict, "HOST", "localhost")
    with override_settings(DEBUG=True):
        yield


@pytest.mark.django_db
def test_create_uses_env_password_and_is_idempotent(monkeypatch):
    monkeypatch.setenv("DEV_ACCOUNT_PASSWORD", "local-only-password")

    first = _run("create")
    user = get_user_model().objects.get(username="dev_owner")
    project = Project.objects.create(owner=user, title="Keep me")
    credential = ProviderCredential.objects.create(
        owner=user, vendor="mistral", encrypted_key=b"encrypted-test-value"
    )
    second = _run("create")

    user.refresh_from_db()
    assert first["created"] is True
    assert first["password_source"] == "DEV_ACCOUNT_PASSWORD"
    assert second["created"] is False
    assert user.check_password("local-only-password")
    assert Project.objects.filter(pk=project.pk).exists()
    assert ProviderCredential.objects.filter(pk=credential.pk).exists()
    assert (
        not get_user_model()
        .objects.filter(username__in=[username for username, _email in E2E_USERS.values()])
        .filter(username="dev_owner")
        .exists()
    )


@pytest.mark.django_db
def test_create_generated_password_is_printed_once(monkeypatch):
    monkeypatch.delenv("DEV_ACCOUNT_PASSWORD", raising=False)

    result = _run("create")

    assert result["created"] is True
    assert result["generated_password"]
    assert get_user_model().objects.get(username="dev_owner").has_usable_password()


@pytest.mark.django_db
def test_create_grants_existing_paid_plan_without_duplicates(monkeypatch):
    monkeypatch.setenv("DEV_ACCOUNT_PASSWORD", "local-only-password")

    _run("create")
    _run("create")

    user = get_user_model().objects.get(username="dev_owner")
    assert UserEntitlementPlan.objects.filter(user=user, plan_key="paid").count() == 1


@pytest.mark.django_db
def test_status_reports_credential_presence_without_key_material(monkeypatch):
    monkeypatch.setenv("DEV_ACCOUNT_PASSWORD", "secret-that-must-not-be-reported")
    _run("create")
    user = get_user_model().objects.get(username="dev_owner")
    ProviderCredential.objects.create(owner=user, vendor="mistral", encrypted_key=b"key-bytes")

    result = _run("status")

    assert result == {
        "action": "status",
        "exists": True,
        "provider_credential_configured": True,
        "username": "dev_owner",
    }
    assert "secret-that-must-not-be-reported" not in json.dumps(result)
    assert "key-bytes" not in json.dumps(result)


@pytest.mark.django_db
def test_fixture_cleanup_leaves_dev_account_and_owned_data(monkeypatch):
    monkeypatch.setenv("DEV_ACCOUNT_PASSWORD", "local-only-password")
    _run("create")
    user = get_user_model().objects.get(username="dev_owner")
    project = Project.objects.create(owner=user, title="Persistent local project")
    credential = ProviderCredential.objects.create(
        owner=user, vendor="mistral", encrypted_key=b"encrypted-test-value"
    )

    call_command("e2e_fixtures", "create", "--json")
    call_command("e2e_fixtures", "cleanup", "--json")

    assert get_user_model().objects.filter(pk=user.pk, username="dev_owner").exists()
    assert Project.objects.filter(pk=project.pk).exists()
    assert ProviderCredential.objects.filter(pk=credential.pk).exists()


@pytest.mark.django_db
def test_guard_refuses_debug_off():
    with override_settings(DEBUG=False), pytest.raises(CommandError, match="DEBUG"):
        _run("create")


@pytest.mark.django_db
def test_guard_refuses_non_local_database(monkeypatch):
    monkeypatch.setitem(connection.settings_dict, "HOST", "published-db.internal")

    with pytest.raises(CommandError, match="DATABASE_URL"):
        _run("status")
