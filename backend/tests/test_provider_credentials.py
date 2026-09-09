"""Vendor registry and redacted owner credential coverage for issue #404,
plus rotation coverage for the generic store (issue #498)."""

from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from rest_framework.test import APIClient

from ai_provider.credentials import encrypt_provider_key
from ai_provider.registry import get_provider, validate_model
from scenes.models import ProviderCredential


@pytest.mark.django_db
def test_registry_is_finite_and_validates_extension_entries():
    assert set(__import__("ai_provider.registry", fromlist=["PROVIDERS"]).PROVIDERS) == {
        "mistral",
        "gemini",
        "deepseek",
    }
    assert get_provider(" GEMINI ").implemented is True
    assert validate_model("mistral", "mistral-large-latest") == "mistral-large-latest"
    with pytest.raises(ValueError):
        get_provider("unknown")
    with pytest.raises(ValueError):
        validate_model("mistral", "not a model")


@pytest.mark.django_db
def test_provider_credentials_are_owner_scoped_and_redacted():
    owner = get_user_model().objects.create_user(username="vendor-owner")
    other = get_user_model().objects.create_user(username="vendor-other")
    client = APIClient()
    client.force_authenticate(owner)

    response = client.put(
        "/api/account/provider-credentials/",
        {"vendor": "gemini", "key": "gemini-secret-key-123"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json() == {"vendor": "gemini", "configured": True}
    stored = ProviderCredential.objects.get(owner=owner, vendor="gemini")
    assert b"gemini-secret-key-123" not in bytes(stored.encrypted_key)

    status_response = client.get("/api/account/provider-credentials/")
    assert status_response.status_code == 200
    gemini = next(
        item for item in status_response.json()["providers"] if item["vendor"] == "gemini"
    )
    assert gemini == {
        "vendor": "gemini",
        "label": "Google Gemini",
        "implemented": True,
        "configured": True,
    }
    assert "gemini-secret-key-123" not in status_response.content.decode()

    other_client = APIClient()
    other_client.force_authenticate(other)
    other_gemini = next(
        item
        for item in other_client.get("/api/account/provider-credentials/").json()["providers"]
        if item["vendor"] == "gemini"
    )
    assert other_gemini["configured"] is False


@pytest.mark.django_db
def test_provider_credential_rejects_unknown_vendor_and_bad_key():
    user = get_user_model().objects.create_user(username="vendor-validation")
    client = APIClient()
    client.force_authenticate(user)
    assert (
        client.put(
            "/api/account/provider-credentials/",
            {"vendor": "unknown", "key": "a-valid-looking-key-123"},
            format="json",
        ).status_code
        == 400
    )
    assert (
        client.put(
            "/api/account/provider-credentials/",
            {"vendor": "mistral", "key": "bad key with spaces"},
            format="json",
        ).status_code
        == 400
    )


@pytest.mark.django_db
def test_rotation_reencrypts_every_vendor_in_the_generic_store():
    """`reencrypt_provider_credentials` operates on `ProviderCredential`
    rows of every vendor -- not only `vendor="mistral"` -- with the same
    active-plus-previous Fernet root ring as the retired legacy store."""
    owner = get_user_model().objects.create_user(username="rotation-owner")
    old_key = "qIyk0jXwtVILr2fiNQ6ENyotYN6dCUh-22uIxi5-Uy0="
    active_key = "sQ4uXAFoZOPNskTNgoat6I_t0WBquxBEbcLaI1Cqf_Q="
    with override_settings(
        MISTRAL_CREDENTIAL_ENCRYPTION_KEY=active_key,
        MISTRAL_CREDENTIAL_PREVIOUS_ENCRYPTION_KEYS=[old_key],
    ):
        for vendor, plaintext in (
            ("mistral", "sk-rotation-mistral"),
            ("gemini", "sk-rotation-gemini"),
        ):
            credential = ProviderCredential(owner=owner, vendor=vendor)
            with override_settings(
                MISTRAL_CREDENTIAL_ENCRYPTION_KEY=old_key,
                MISTRAL_CREDENTIAL_PREVIOUS_ENCRYPTION_KEYS=[],
            ):
                credential.encrypted_key = encrypt_provider_key(plaintext)
            credential.save()
        call_command("reencrypt_provider_credentials", stdout=StringIO())

        for vendor, plaintext in (
            ("mistral", "sk-rotation-mistral"),
            ("gemini", "sk-rotation-gemini"),
        ):
            credential = ProviderCredential.objects.get(owner=owner, vendor=vendor)
            # Re-encrypted to the active root: decryptable with no previous
            # roots configured at all.
            with override_settings(
                MISTRAL_CREDENTIAL_ENCRYPTION_KEY=active_key,
                MISTRAL_CREDENTIAL_PREVIOUS_ENCRYPTION_KEYS=[],
            ):
                assert credential.get_key() == plaintext
