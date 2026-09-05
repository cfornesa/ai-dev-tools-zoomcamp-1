"""Trivial bootstrap tests.

These only prove the Django project loads and routes a request; they do
not exercise any product feature. No network, credentials, database
server, or camera access is required — pytest-django uses an in-memory
SQLite database created and torn down automatically.
"""

import django
import pytest
from django.conf import settings
from django.test import override_settings
from django.urls import reverse


def test_settings_load():
    """Django settings module imports and configures cleanly."""
    assert settings.configured
    assert settings.ROOT_URLCONF == "backend.urls"


def test_django_is_set_up():
    """Django itself initializes without error."""
    assert django.VERSION[0] >= 6


@pytest.mark.django_db
def test_health_endpoint_returns_200(client):
    """The health endpoint reports the app and database as available."""
    response = client.get(reverse("health"))
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok", "cache": "ok"}


@pytest.mark.django_db
@override_settings(DEBUG=False)
def test_production_health_includes_shared_cache_check(client):
    response = client.get(reverse("health"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok", "cache": "ok"}


@pytest.mark.django_db
@override_settings(DEBUG=False)
def test_production_health_fails_readiness_when_cache_is_unavailable(client, monkeypatch):
    from backend import views

    def unavailable(*args, **kwargs):
        raise RuntimeError("cache unavailable")

    monkeypatch.setattr(views.cache, "set", unavailable)

    response = client.get(reverse("health"))

    assert response.status_code == 503
    assert response.json() == {
        "status": "error",
        "database": "ok",
        "cache": "unavailable",
    }
