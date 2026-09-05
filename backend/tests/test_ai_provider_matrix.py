"""Deterministic cross-vendor routing and isolation checks for issue #408."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

import scenes.ai_api as ai_api
from ai_provider.deepseek_provider import DeepSeekSceneProvider
from ai_provider.e2e_provider import build_e2e_provider
from ai_provider.gemini_provider import GeminiSceneProvider
from ai_provider.mistral_provider import MistralSceneProvider
from scenes.models import Project, ProviderCredential


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="matrix-owner")


@pytest.fixture
def project(owner):
    return Project.objects.create(owner=owner)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("vendor", "provider_type", "model"),
    [
        ("mistral", MistralSceneProvider, "mistral-small-latest"),
        ("gemini", GeminiSceneProvider, "gemini-2.5-flash"),
        ("deepseek", DeepSeekSceneProvider, "deepseek-chat"),
    ],
)
def test_selected_vendor_uses_only_its_credential(owner, vendor, provider_type, model, monkeypatch):
    for credential_vendor in ("mistral", "gemini", "deepseek"):
        credential = ProviderCredential.objects.create(owner=owner, vendor=credential_vendor)
        credential.set_key(f"{credential_vendor}-key-123456")
        credential.save(update_fields=["encrypted_key"])
    monkeypatch.setattr(ai_api, "_current_ai_user", ai_api.ContextVar("matrix_user"))
    monkeypatch.setattr(ai_api, "_current_ai_vendor", ai_api.ContextVar("matrix_vendor"))
    monkeypatch.setattr(ai_api, "_current_ai_model", ai_api.ContextVar("matrix_model"))
    ai_api._current_ai_user.set(owner)
    ai_api._current_ai_vendor.set(vendor)
    ai_api._current_ai_model.set(model)

    provider = ai_api.get_ai_provider()

    assert isinstance(provider, provider_type)
    assert provider.model == model
    if vendor == "mistral":
        assert provider._api_key == f"{vendor}-key-123456"
    else:
        assert provider._client.api_key == f"{vendor}-key-123456"


@pytest.mark.django_db
def test_missing_selected_vendor_credential_is_actionable(owner, project):
    client = APIClient()
    client.force_authenticate(owner)
    response = client.post(
        f"/api/projects/{project.public_id}/ai/create-scene/",
        {"prompt": "a scene", "vendor": "gemini"},
        format="json",
    )

    assert response.status_code == 424
    assert response.json()["error"] == "personal_key_required"
    assert "Google Gemini" in response.json()["detail"]


@pytest.mark.django_db
def test_provider_specific_model_is_rejected_before_provider_call(owner, project):
    client = APIClient()
    client.force_authenticate(owner)
    response = client.post(
        f"/api/projects/{project.public_id}/ai/create-scene/",
        {"prompt": "a scene", "vendor": "deepseek", "model": "gemini-2.5-flash"},
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["error"] == "model_invalid"


@pytest.mark.parametrize(
    ("vendor", "model"),
    [
        ("mistral", "mistral-small-latest"),
        ("gemini", "gemini-2.5-flash"),
        ("deepseek", "deepseek-chat"),
    ],
)
def test_fake_provider_keeps_selected_vendor_and_model_metadata(vendor, model):
    provider = build_e2e_provider("success", vendor=vendor, model=model)
    assert provider.vendor == vendor
    assert provider.model == model
