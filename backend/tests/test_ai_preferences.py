"""Owner-isolation and CRUD coverage for saved Mistral model preferences
and AI Personas (issue #259)."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.models import AIPersona, MistralModelPreference

MODELS_URL = "/api/account/mistral-model-preferences/"
PERSONAS_URL = "/api/account/ai-personas/"


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="prefs-owner")


@pytest.fixture
def other(db):
    return get_user_model().objects.create_user(username="prefs-other")


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


# --- Anonymous access is rejected, matching MistralCredentialView -------


@pytest.mark.django_db
def test_anonymous_requests_are_rejected():
    client = APIClient()
    assert client.get(MODELS_URL).status_code == 401
    assert (
        client.post(MODELS_URL, {"slug": "mistral-small-latest"}, format="json").status_code == 401
    )
    assert client.get(PERSONAS_URL).status_code == 401
    assert (
        client.post(
            PERSONAS_URL, {"name": "Terse", "prompt_text": "Be terse."}, format="json"
        ).status_code
        == 401
    )


# --- MistralModelPreference: create, list, delete, isolation ------------


@pytest.mark.django_db
def test_model_preference_create_list_delete(owner_client, owner):
    assert owner_client.get(MODELS_URL).json() == []

    response = owner_client.post(
        MODELS_URL, {"slug": "mistral-small-latest", "label": "Small"}, format="json"
    )
    assert response.status_code == 201
    body = response.json()
    assert body["slug"] == "mistral-small-latest"
    assert body["label"] == "Small"

    listed = owner_client.get(MODELS_URL).json()
    assert len(listed) == 1
    assert listed[0]["slug"] == "mistral-small-latest"

    pk = body["id"]
    assert owner_client.delete(f"{MODELS_URL}{pk}/").status_code == 204
    assert owner_client.get(MODELS_URL).json() == []
    assert not MistralModelPreference.objects.filter(owner=owner).exists()


@pytest.mark.django_db
def test_model_preference_rejects_blank_slug(owner_client):
    response = owner_client.post(MODELS_URL, {"slug": "   ", "label": ""}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_model_preference_isolated_between_users(owner_client, other_client, owner):
    created = owner_client.post(MODELS_URL, {"slug": "mistral-large-latest"}, format="json").json()
    pk = created["id"]

    assert other_client.get(MODELS_URL).json() == []
    assert other_client.delete(f"{MODELS_URL}{pk}/").status_code == 404
    assert MistralModelPreference.objects.filter(owner=owner, pk=pk).exists()


# --- AIPersona: create, list, delete, isolation --------------------------


@pytest.mark.django_db
def test_persona_create_list_delete(owner_client, owner):
    assert owner_client.get(PERSONAS_URL).json() == []

    response = owner_client.post(
        PERSONAS_URL,
        {"name": "Playful", "prompt_text": "Prefer bright, whimsical colors and shapes."},
        format="json",
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Playful"

    listed = owner_client.get(PERSONAS_URL).json()
    assert len(listed) == 1

    pk = body["id"]
    assert owner_client.delete(f"{PERSONAS_URL}{pk}/").status_code == 204
    assert not AIPersona.objects.filter(owner=owner).exists()


@pytest.mark.django_db
def test_persona_rejects_blank_name_or_prompt(owner_client):
    assert (
        owner_client.post(
            PERSONAS_URL, {"name": "", "prompt_text": "Be bold."}, format="json"
        ).status_code
        == 400
    )
    assert (
        owner_client.post(
            PERSONAS_URL, {"name": "Bold", "prompt_text": "  "}, format="json"
        ).status_code
        == 400
    )


@pytest.mark.django_db
def test_persona_isolated_between_users(owner_client, other_client, owner):
    created = owner_client.post(
        PERSONAS_URL, {"name": "Minimal", "prompt_text": "Favor negative space."}, format="json"
    ).json()
    pk = created["id"]

    assert other_client.get(PERSONAS_URL).json() == []
    assert other_client.delete(f"{PERSONAS_URL}{pk}/").status_code == 404
    assert AIPersona.objects.filter(owner=owner, pk=pk).exists()
