"""Security and provider-selection coverage for personal Mistral credentials."""

from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db.models.query import QuerySet
from django.test import override_settings
from rest_framework.test import APIClient

import scenes.ai_api as ai_api
from ai_provider.credentials import encrypt_mistral_key
from ai_provider.fake_provider import FakeAISceneProvider
from scenes.models import MistralCredential, Project

URL = "/api/account/mistral-credential/"


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="credential-owner")


@pytest.fixture
def other(db):
    return get_user_model().objects.create_user(username="credential-other")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.fixture
def other_client(other):
    client = APIClient()
    client.force_authenticate(other)
    return client


@pytest.mark.django_db
def test_status_and_saved_key_never_expose_plaintext(owner_client, owner):
    key = "sk-personal-key-that-must-not-leak"
    assert owner_client.get(URL).json() == {"configured": False}

    response = owner_client.put(URL, {"key": key}, format="json")
    assert response.status_code == 200
    assert response.json() == {"configured": True}
    credential = MistralCredential.objects.get(user=owner)
    assert bytes(credential.encrypted_key) != key.encode()
    assert key.encode() not in bytes(credential.encrypted_key)
    assert owner_client.get(URL).json() == {"configured": True}
    assert key not in response.content.decode()


@pytest.mark.django_db
def test_replace_delete_and_other_user_isolation(owner_client, other_client, owner):
    owner_client.put(URL, {"key": "sk-owner-key-11111"}, format="json")
    old_ciphertext = bytes(MistralCredential.objects.get(user=owner).encrypted_key)

    assert other_client.get(URL).json() == {"configured": False}
    assert other_client.delete(URL).status_code == 204
    assert MistralCredential.objects.filter(user=owner).exists()

    owner_client.put(URL, {"key": "sk-owner-key-22222"}, format="json")
    assert bytes(MistralCredential.objects.get(user=owner).encrypted_key) != old_ciphertext
    assert owner_client.delete(URL).status_code == 204
    assert not MistralCredential.objects.filter(user=owner).exists()


@pytest.mark.django_db
def test_missing_key_rejects_ai_before_provider_creation(owner_client, owner, monkeypatch):
    project = Project.objects.create(owner=owner)
    called = False

    class ShouldNotConstruct:
        def __init__(self, **kwargs):
            nonlocal called
            called = True

    monkeypatch.setattr(ai_api, "MistralSceneProvider", ShouldNotConstruct)
    response = owner_client.post(
        f"/api/projects/{project.public_id}/ai/create-scene/",
        {"prompt": "draw teal circles"},
        format="json",
    )
    assert response.status_code == 424
    assert response.json()["error"] == "personal_key_required"
    assert called is False


@pytest.mark.django_db
def test_owner_key_is_selected_for_real_provider(owner, monkeypatch):
    credential = MistralCredential(user=owner)
    credential.set_key("sk-owner-only-key-12345")
    credential.save()
    captured = {}

    class CapturingProvider:
        def __init__(self, *, api_key):
            captured["api_key"] = api_key

    monkeypatch.setattr(ai_api, "MistralSceneProvider", CapturingProvider)
    ai_api._provider_for_user(owner)
    assert captured == {"api_key": "sk-owner-only-key-12345"}


@pytest.mark.django_db
def test_fake_provider_does_not_require_a_personal_key(owner, monkeypatch):
    monkeypatch.setattr(ai_api, "use_fake_ai_provider", lambda: True)
    monkeypatch.setattr(ai_api, "build_e2e_provider", lambda scenario: None, raising=False)
    provider = ai_api._provider_for_user(owner)
    assert isinstance(provider, FakeAISceneProvider) is False


@pytest.mark.django_db
def test_previous_rotation_key_can_be_reencrypted_to_primary(owner):
    old_key = "qIyk0jXwtVILr2fiNQ6ENyotYN6dCUh-22uIxi5-Uy0="
    active_key = "sQ4uXAFoZOPNskTNgoat6I_t0WBquxBEbcLaI1Cqf_Q="
    with override_settings(
        MISTRAL_CREDENTIAL_ENCRYPTION_KEY=active_key,
        MISTRAL_CREDENTIAL_PREVIOUS_ENCRYPTION_KEYS=[old_key],
    ):
        credential = MistralCredential(
            user=owner, encrypted_key=encrypt_mistral_key("sk-rotation-test-key")
        )
        # Store ciphertext made with the old root, then use the key ring to
        # run the controlled command and re-encrypt it with the active root.
        with override_settings(
            MISTRAL_CREDENTIAL_ENCRYPTION_KEY=old_key,
            MISTRAL_CREDENTIAL_PREVIOUS_ENCRYPTION_KEYS=[],
        ):
            credential.encrypted_key = encrypt_mistral_key("sk-rotation-test-key")
        credential.save()
        call_command("reencrypt_mistral_credentials", stdout=StringIO())
        credential.refresh_from_db()

    with override_settings(
        MISTRAL_CREDENTIAL_ENCRYPTION_KEY=active_key,
        MISTRAL_CREDENTIAL_PREVIOUS_ENCRYPTION_KEYS=[],
    ):
        assert credential.get_key() == "sk-rotation-test-key"


@pytest.mark.django_db
def test_rotation_skips_a_record_deleted_between_enumeration_and_lock(owner, other, monkeypatch):
    deleted = MistralCredential(user=owner)
    deleted.set_key("sk-key-being-deleted")
    deleted.save()
    retained = MistralCredential(user=other)
    retained.set_key("sk-key-that-stays")
    retained.save()
    original_get = QuerySet.get

    def get_with_deleted_row(self, *args, **kwargs):
        if kwargs.get("pk") == deleted.pk:
            raise MistralCredential.DoesNotExist
        return original_get(self, *args, **kwargs)

    monkeypatch.setattr(QuerySet, "get", get_with_deleted_row)
    output = StringIO()
    call_command("reencrypt_mistral_credentials", stdout=output)

    assert "was deleted during rotation" in output.getvalue()
    retained.refresh_from_db()
    assert retained.get_key() == "sk-key-that-stays"
