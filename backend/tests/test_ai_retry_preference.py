"""Owner-isolation and get/put coverage for the configurable AI auto-retry
preference (issue #266)."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.models import AIRetryPreference

URL = "/api/account/ai-retry-preference/"


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="retry-owner")


@pytest.fixture
def other(db):
    return get_user_model().objects.create_user(username="retry-other")


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
def test_anonymous_requests_are_rejected():
    client = APIClient()
    assert client.get(URL).status_code == 401
    response = client.put(URL, {"auto_retry_enabled": True, "max_retries": 5}, format="json")
    assert response.status_code == 401


@pytest.mark.django_db
def test_get_creates_default_row_off_with_three_retries(owner_client, owner):
    response = owner_client.get(URL)
    assert response.status_code == 200
    assert response.json() == {"auto_retry_enabled": False, "max_retries": 3}
    assert AIRetryPreference.objects.filter(owner=owner).count() == 1


@pytest.mark.django_db
def test_put_updates_existing_row(owner_client, owner):
    owner_client.get(URL)
    response = owner_client.put(URL, {"auto_retry_enabled": True, "max_retries": 5}, format="json")
    assert response.status_code == 200
    assert response.json() == {"auto_retry_enabled": True, "max_retries": 5}
    assert AIRetryPreference.objects.filter(owner=owner).count() == 1
    preference = AIRetryPreference.objects.get(owner=owner)
    assert preference.auto_retry_enabled is True
    assert preference.max_retries == 5


@pytest.mark.django_db
def test_put_rejects_max_retries_out_of_bounds(owner_client):
    assert (
        owner_client.put(
            URL, {"auto_retry_enabled": True, "max_retries": 0}, format="json"
        ).status_code
        == 400
    )
    assert (
        owner_client.put(
            URL, {"auto_retry_enabled": True, "max_retries": 11}, format="json"
        ).status_code
        == 400
    )


@pytest.mark.django_db
def test_preference_isolated_between_users(owner_client, other_client, owner, other):
    owner_client.put(URL, {"auto_retry_enabled": True, "max_retries": 7}, format="json")

    other_response = other_client.get(URL)
    assert other_response.json() == {"auto_retry_enabled": False, "max_retries": 3}

    owner_preference = AIRetryPreference.objects.get(owner=owner)
    other_preference = AIRetryPreference.objects.get(owner=other)
    assert owner_preference.max_retries == 7
    assert other_preference.max_retries == 3
