"""Account-level cloud-sync preference coverage (#940)."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from scenes.models import (
    CloudBackupProject,
    CloudSyncPreference,
    CloudSyncSignupConsent,
    GlobalCapabilitySetting,
    Plan,
    Project,
    SiteSettings,
)


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username="sync-user", password="pw")


@pytest.fixture(autouse=True)
def sync_gate(db):
    SiteSettings.objects.update_or_create(pk=1, defaults={"cloud_sync_enabled": True})
    Plan.objects.update_or_create(
        plan_key="free",
        defaults={"feature_keys": ["cloud_project_sync"], "active": True},
    )
    GlobalCapabilitySetting.objects.update_or_create(
        capability_key="cloud_project_sync", defaults={"enabled": True}
    )


@pytest.mark.django_db
def test_requires_authentication(client):
    assert client.get(reverse("account-cloud-sync")).status_code == 401


@pytest.mark.django_db
def test_signup_choice_is_preselected_but_does_not_enable(client, user):
    CloudSyncSignupConsent.objects.create(owner=user, sync_enabled=True)
    client.force_login(user)
    body = client.get(reverse("account-cloud-sync")).json()
    assert body["eligible"] is True
    assert body["enabled"] is False
    assert body["signup_preselected"] is True
    assert not CloudSyncPreference.objects.filter(owner=user).exists()


@pytest.mark.django_db
def test_enable_requires_current_consent_and_records_copy(client, user):
    client.force_login(user)
    url = reverse("account-cloud-sync")
    assert client.put(url, {"enabled": True}, content_type="application/json").status_code == 400
    disclosure = client.get(url).json()
    response = client.put(
        url,
        {
            "enabled": True,
            "consent_version": disclosure["consent_version"],
            "consent_text": disclosure["consent_text"],
        },
        content_type="application/json",
    )
    assert response.status_code == 200
    preference = CloudSyncPreference.objects.get(owner=user)
    assert preference.enabled is True
    assert preference.consent_version == disclosure["consent_version"]
    assert preference.consented_at is not None


@pytest.mark.django_db
def test_site_gate_explains_disabled_reason(client, user):
    settings = SiteSettings.get_solo()
    settings.cloud_sync_enabled = False
    settings.save(update_fields=["cloud_sync_enabled"])
    client.force_login(user)
    body = client.get(reverse("account-cloud-sync")).json()
    assert body["eligible"] is False
    assert body["reason"] == "site disabled"
    assert (
        client.put(
            reverse("account-cloud-sync"),
            {"enabled": True, "consent_version": "cloud-sync-account-v1", "consent_text": "x"},
            content_type="application/json",
        ).status_code
        == 403
    )


@pytest.mark.django_db
def test_disabling_pauses_only_account_inherited_backups(client, user):
    inherited_project = Project.objects.create(owner=user, title="Inherited")
    explicit_project = Project.objects.create(owner=user, title="Explicit")
    CloudBackupProject.objects.create(
        project=inherited_project, enabled=True, account_inherited=True
    )
    CloudBackupProject.objects.create(
        project=explicit_project, enabled=True, account_inherited=False
    )
    CloudSyncPreference.objects.create(owner=user, enabled=True)
    client.force_login(user)

    response = client.put(
        reverse("account-cloud-sync"), {"enabled": False}, content_type="application/json"
    )

    assert response.status_code == 200
    assert response.json()["paused_inherited_backups"] == 1
    inherited = CloudBackupProject.objects.get(project=inherited_project)
    explicit = CloudBackupProject.objects.get(project=explicit_project)
    assert inherited.paused is True
    assert inherited.retention_state == CloudBackupProject.RetentionState.SYNC_DISABLED
    assert explicit.paused is False
