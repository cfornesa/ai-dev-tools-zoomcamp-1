"""Deterministic cross-vendor routing and isolation checks for issue #408."""

import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

import scenes.ai_api as ai_api
from ai_provider.deepseek_provider import DeepSeekSceneProvider
from ai_provider.e2e_provider import build_e2e_provider
from ai_provider.gemini_provider import GeminiSceneProvider
from ai_provider.interface import AIEditSceneRequest, AIErrorCategory
from ai_provider.mistral_provider import MistralSceneProvider
from scenes.models import Project, ProviderCredential, SceneVersion


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="matrix-owner")


@pytest.fixture
def project(owner):
    return Project.objects.create(owner=owner)


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


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


@pytest.mark.django_db
@pytest.mark.parametrize("vendor", ["mistral", "gemini", "deepseek"])
@pytest.mark.parametrize(
    ("scenario", "expected_status", "expected_error"),
    [
        ("success", 200, None),
        ("invalid_structured_output", 422, "invalid_structured_output"),
        ("quota_exceeded", 429, "provider_quota_exceeded"),
        ("timeout", 504, "timeout"),
    ],
)
def test_fake_create_matrix_is_vendor_neutral_and_never_persists(
    owner, vendor, scenario, expected_status, expected_error, monkeypatch
):
    """Exercise the same deterministic create contract for every vendor.

    The fake switch is process-local and the scenario travels only through
    the test header, so this covers routing/error normalization without
    opening a live provider connection or weakening production behavior.
    """
    monkeypatch.setenv("AI_PROVIDER", "fake")
    project = Project.objects.create(owner=owner)
    client = APIClient()
    client.force_authenticate(owner)
    response = client.post(
        f"/api/projects/{project.public_id}/ai/create-scene/",
        {"prompt": f"matrix {vendor} {scenario}", "vendor": vendor},
        format="json",
        HTTP_X_E2E_AI_SCENARIO=scenario,
    )

    assert response.status_code == expected_status
    assert response.json().get("error") == expected_error
    assert SceneVersion.objects.filter(project=project).count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize("vendor", ["mistral", "gemini", "deepseek"])
def test_missing_credential_is_consistent_for_every_vendor(owner, vendor, monkeypatch):
    monkeypatch.delenv("AI_PROVIDER", raising=False)
    project = Project.objects.create(owner=owner)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/projects/{project.public_id}/ai/create-scene/",
        {"prompt": "missing credential matrix", "vendor": vendor},
        format="json",
    )

    assert response.status_code == 424
    assert response.json()["error"] == "personal_key_required"
    expected_label = {"mistral": "Mistral", "gemini": "Google Gemini", "deepseek": "DeepSeek"}[
        vendor
    ]
    assert expected_label in response.json()["detail"]


@pytest.mark.django_db
@pytest.mark.parametrize("vendor", ["mistral", "gemini", "deepseek"])
def test_rate_limit_is_applied_before_provider_selection_for_every_vendor(owner, vendor):
    project = Project.objects.create(owner=owner)
    cache.set(
        ai_api._rate_limit_cache_key(owner.id),
        ai_api.RATE_LIMIT_MAX_ATTEMPTS,
        timeout=ai_api.RATE_LIMIT_WINDOW_SECONDS,
    )
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/projects/{project.public_id}/ai/create-scene/",
        {"prompt": "rate-limit matrix", "vendor": vendor},
        format="json",
    )

    assert response.status_code == 429
    assert response.json()["error"] == "rate_limited"


@pytest.mark.parametrize("vendor", ["mistral", "gemini", "deepseek"])
@pytest.mark.parametrize(
    ("scenario", "succeeds", "category"),
    [
        ("success", True, None),
        ("invalid_structured_output", False, AIErrorCategory.INVALID_STRUCTURED_OUTPUT),
        ("quota_exceeded", False, AIErrorCategory.QUOTA_EXCEEDED),
        ("timeout", False, AIErrorCategory.TIMEOUT),
    ],
)
def test_fake_edit_matrix_is_vendor_neutral(vendor, scenario, succeeds, category):
    fixture = Path(__file__).resolve().parents[2] / "schema/fixtures/valid/blank.json"
    scene = json.loads(fixture.read_text())
    outcome = build_e2e_provider(
        scenario, vendor=vendor, model="matrix-model"
    ).edit_scene_with_patch(AIEditSceneRequest("change the background", scene))

    assert outcome.result.success is succeeds
    if category is not None:
        assert outcome.result.error is not None
        assert outcome.result.error.category is category
