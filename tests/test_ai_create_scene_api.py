"""Tests for POST /api/projects/<id>/ai/create-scene/ (Task 46/47).

Every test mocks Mistral entirely via `scenes.ai_api.get_ai_provider`
(monkeypatched to return a `FakeAISceneProvider` or a
`MistralSceneProvider(client=<fake>)`) -- none of them open a socket or
require a real `MISTRAL_API_KEY`. Covers: success returns an unsaved
draft (no `SceneVersion` created, `current_version` untouched),
schema-invalid/oversized/over-limit output rejected before any preview
response, each explicit rate/quota/size/timeout/provider-failure
response, authentication/ownership requirements, and that logs contain
only the documented minimal metadata -- no prompt, no key.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import httpx
import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

import scenes.ai_api as ai_api
from ai_provider.fake_provider import FakeAIProviderScenario, FakeAISceneProvider
from ai_provider.mistral_provider import MAX_RAW_RESPONSE_BYTES, MistralSceneProvider
from scenes.models import Project, SceneVersion

_FIXTURE_PATH = (
    Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
)
BLANK_SCENE = json.loads(_FIXTURE_PATH.read_text())


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="alice")


@pytest.fixture
def other_user(db):
    return get_user_model().objects.create_user(username="bob")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.fixture
def other_client(other_user):
    client = APIClient()
    client.force_authenticate(other_user)
    return client


@pytest.fixture
def project(owner):
    return Project.objects.create(owner=owner)


def _url(project):
    return f"/api/projects/{project.public_id}/ai/create-scene/"


def _use_provider(monkeypatch, provider):
    monkeypatch.setattr(ai_api, "get_ai_provider", lambda: provider)


class _FakeChat:
    def __init__(self, handler):
        self._handler = handler

    def complete(self, **kwargs):
        return self._handler(**kwargs)


class _FakeClient:
    def __init__(self, handler):
        self.chat = _FakeChat(handler)


def _mistral_provider_returning(content: str) -> MistralSceneProvider:
    from types import SimpleNamespace

    def handler(**kwargs):
        return SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=10, completion_tokens=20),
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        )

    return MistralSceneProvider(client=_FakeClient(handler))


# --- Success: unsaved draft, no version created ---------------------------


@pytest.mark.django_db
def test_success_returns_a_draft_and_creates_no_version(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, FakeAISceneProvider(FakeAIProviderScenario.SUCCESS))

    response = owner_client.post(
        _url(project), {"prompt": "a calm field of teal circles"}, format="json"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["draft"] is True
    assert body["scene"]["schemaVersion"] == 1
    assert "usage" in body
    assert set(body["usage"]) == {
        "prompt_tokens",
        "completion_tokens",
        "total_tokens",
        "estimated_cost_usd",
    }

    project.refresh_from_db()
    assert project.current_version is None
    assert SceneVersion.objects.filter(project=project).count() == 0


@pytest.mark.django_db
def test_success_with_real_mistral_response_shape(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(json.dumps(BLANK_SCENE)))

    response = owner_client.post(_url(project), {"prompt": "a scene"}, format="json")

    assert response.status_code == 200
    assert response.json()["scene"] == BLANK_SCENE
    assert SceneVersion.objects.filter(project=project).count() == 0


# --- Schema-invalid / oversized / over-limit rejected before any preview --


@pytest.mark.django_db
def test_schema_invalid_output_is_rejected_with_422_and_no_version(
    owner_client, project, monkeypatch
):
    _use_provider(
        monkeypatch, FakeAISceneProvider(FakeAIProviderScenario.INVALID_STRUCTURED_OUTPUT)
    )

    response = owner_client.post(_url(project), {"prompt": "anything"}, format="json")

    assert response.status_code == 422
    assert response.json()["error"] == "invalid_structured_output"
    assert "scene" not in response.json()
    project.refresh_from_db()
    assert project.current_version is None
    assert SceneVersion.objects.filter(project=project).count() == 0


@pytest.mark.django_db
def test_unsupported_schema_version_is_rejected(owner_client, project, monkeypatch):
    bad_version_scene = {**BLANK_SCENE, "schemaVersion": 2}
    _use_provider(monkeypatch, _mistral_provider_returning(json.dumps(bad_version_scene)))

    response = owner_client.post(_url(project), {"prompt": "anything"}, format="json")

    assert response.status_code == 422
    assert response.json()["error"] == "invalid_structured_output"


@pytest.mark.django_db
def test_oversized_raw_response_is_rejected_with_413(owner_client, project, monkeypatch):
    huge = "x" * (MAX_RAW_RESPONSE_BYTES + 1)
    _use_provider(monkeypatch, _mistral_provider_returning(huge))

    response = owner_client.post(_url(project), {"prompt": "anything"}, format="json")

    assert response.status_code == 413
    assert response.json()["error"] == "response_too_large"
    assert SceneVersion.objects.filter(project=project).count() == 0


# --- Explicit, distinct rate/quota/size/timeout/provider-failure ----------


@pytest.mark.django_db
def test_prompt_too_long_is_rejected_with_400(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, FakeAISceneProvider(FakeAIProviderScenario.SUCCESS))
    too_long = "x" * (ai_api.MAX_PROMPT_CHARS + 1)

    response = owner_client.post(_url(project), {"prompt": too_long}, format="json")

    assert response.status_code == 400
    assert response.json()["error"] == "prompt_invalid"


@pytest.mark.django_db
def test_blank_prompt_is_rejected_with_400(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, FakeAISceneProvider(FakeAIProviderScenario.SUCCESS))

    response = owner_client.post(_url(project), {"prompt": ""}, format="json")

    assert response.status_code == 400
    assert response.json()["error"] == "prompt_invalid"


@pytest.mark.django_db
def test_timeout_is_rejected_with_504(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, FakeAISceneProvider(FakeAIProviderScenario.TIMEOUT))

    response = owner_client.post(_url(project), {"prompt": "anything"}, format="json")

    assert response.status_code == 504
    assert response.json()["error"] == "timeout"


@pytest.mark.django_db
def test_provider_quota_exceeded_is_rejected_with_429(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, FakeAISceneProvider(FakeAIProviderScenario.QUOTA_EXCEEDED))

    response = owner_client.post(_url(project), {"prompt": "anything"}, format="json")

    assert response.status_code == 429
    assert response.json()["error"] == "provider_quota_exceeded"


@pytest.mark.django_db
def test_provider_rejection_maps_to_502(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, FakeAISceneProvider(FakeAIProviderScenario.PROVIDER_REJECTION))

    response = owner_client.post(_url(project), {"prompt": "anything"}, format="json")

    assert response.status_code == 502
    assert response.json()["error"] == "provider_failure"


@pytest.mark.django_db
def test_provider_failure_via_network_error_maps_to_502(owner_client, project, monkeypatch):
    def handler(**kwargs):
        raise httpx.ConnectError("connection refused")

    provider = MistralSceneProvider(client=_FakeClient(handler))
    _use_provider(monkeypatch, provider)

    response = owner_client.post(_url(project), {"prompt": "anything"}, format="json")

    assert response.status_code == 502
    assert response.json()["error"] == "provider_failure"


@pytest.mark.django_db
def test_own_request_rate_limit_returns_429(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, FakeAISceneProvider(FakeAIProviderScenario.SUCCESS))

    for _ in range(ai_api.RATE_LIMIT_MAX_ATTEMPTS):
        response = owner_client.post(_url(project), {"prompt": "anything"}, format="json")
        assert response.status_code == 200

    response = owner_client.post(_url(project), {"prompt": "one too many"}, format="json")

    assert response.status_code == 429
    assert response.json()["error"] == "rate_limited"


@pytest.mark.django_db
def test_own_daily_quota_returns_429_and_only_counts_successes(owner_client, project, monkeypatch):
    # Failures never consume the daily quota (retry-safety): fill up the
    # rate-limit-sized batch of *failed* attempts across several windows
    # worth of cache resets isn't needed here -- we directly seed the
    # quota counter to simulate "already at the daily limit" and confirm
    # a fresh request is rejected without calling the provider at all.
    cache.set(
        ai_api._quota_cache_key(project.owner_id, operation="create"),
        ai_api.DAILY_QUOTA_MAX_SUCCESSES,
    )

    def handler(**kwargs):  # pragma: no cover -- must never be called
        raise AssertionError("the provider must not be called once quota is exhausted")

    _use_provider(monkeypatch, MistralSceneProvider(client=_FakeClient(handler)))

    response = owner_client.post(_url(project), {"prompt": "anything"}, format="json")

    assert response.status_code == 429
    assert response.json()["error"] == "quota_exceeded"


@pytest.mark.django_db
def test_failed_attempts_do_not_consume_the_daily_quota(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, FakeAISceneProvider(FakeAIProviderScenario.PROVIDER_REJECTION))

    for _ in range(3):
        response = owner_client.post(_url(project), {"prompt": "anything"}, format="json")
        assert response.status_code == 502

    key = ai_api._quota_cache_key(project.owner_id, operation="create")
    assert cache.get(key, 0) == 0


# --- Authentication / ownership --------------------------------------------


@pytest.mark.django_db
def test_anonymous_request_is_rejected(project):
    client = APIClient()
    response = client.post(_url(project), {"prompt": "anything"}, format="json")
    assert response.status_code in (401, 404)


@pytest.mark.django_db
def test_non_owner_gets_404_not_403(other_client, project, monkeypatch):
    _use_provider(monkeypatch, FakeAISceneProvider(FakeAIProviderScenario.SUCCESS))
    response = other_client.post(_url(project), {"prompt": "anything"}, format="json")
    assert response.status_code == 404


@pytest.mark.django_db
def test_nonexistent_project_returns_404(owner_client):
    response = owner_client.post(
        "/api/projects/00000000-0000-0000-0000-000000000000/ai/create-scene/",
        {"prompt": "anything"},
        format="json",
    )
    assert response.status_code == 404


# --- Logging: minimal metadata only, no prompt, no key --------------------


@pytest.mark.django_db
def test_logs_contain_only_minimal_metadata_no_prompt_no_key(
    owner_client, project, monkeypatch, caplog
):
    monkeypatch.setenv("MISTRAL_API_KEY", "sk-super-secret-should-never-be-logged")
    _use_provider(monkeypatch, FakeAISceneProvider(FakeAIProviderScenario.SUCCESS))
    secret_prompt = "a very specific and identifiable prompt about spirals"

    with caplog.at_level(logging.INFO, logger="ai_provider"):
        response = owner_client.post(_url(project), {"prompt": secret_prompt}, format="json")

    assert response.status_code == 200
    assert len(caplog.records) == 1
    record = caplog.records[0].ai_provider
    assert set(record) == {
        "operation",
        "timestamp",
        "success",
        "error_category",
        "prompt_tokens",
        "completion_tokens",
        "total_tokens",
        "estimated_cost_usd",
    }
    assert secret_prompt not in repr(record)
    assert "sk-super-secret-should-never-be-logged" not in repr(record)
    for r in caplog.records:
        assert secret_prompt not in r.getMessage()
        assert "sk-super-secret-should-never-be-logged" not in r.getMessage()


@pytest.mark.django_db
def test_logs_omit_prompt_and_key_on_failure_too(owner_client, project, monkeypatch, caplog):
    monkeypatch.setenv("MISTRAL_API_KEY", "sk-super-secret-should-never-be-logged")
    _use_provider(monkeypatch, FakeAISceneProvider(FakeAIProviderScenario.PROVIDER_REJECTION))
    secret_prompt = "another very identifiable prompt"

    with caplog.at_level(logging.INFO, logger="ai_provider"):
        response = owner_client.post(_url(project), {"prompt": secret_prompt}, format="json")

    assert response.status_code == 502
    record = caplog.records[0].ai_provider
    assert "prompt" not in record
    assert secret_prompt not in repr(record)
    assert "sk-super-secret-should-never-be-logged" not in repr(record)
