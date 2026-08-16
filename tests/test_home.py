"""Trivial bootstrap tests.

These only prove the Django project loads and routes a request; they do
not exercise any product feature. No network, credentials, database
server, or camera access is required — pytest-django uses an in-memory
SQLite database created and torn down automatically.
"""

import django
import pytest
from django.conf import settings
from django.urls import reverse


def test_settings_load():
    """Django settings module imports and configures cleanly."""
    assert settings.configured
    assert settings.ROOT_URLCONF == "config.urls"


def test_django_is_set_up():
    """Django itself initializes without error."""
    assert django.VERSION[0] >= 6


@pytest.mark.django_db
def test_health_endpoint_returns_200(client):
    """The health endpoint reports the app and database as available."""
    response = client.get(reverse("health"))
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}
