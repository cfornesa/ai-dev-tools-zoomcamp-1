import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from scenes.models import ApplicationAdmin


@pytest.mark.django_db
def test_admin_settings_api_exposes_shared_design_contract(client):
    user = get_user_model().objects.create_user(username="settings-api-admin", password="x")
    ApplicationAdmin.objects.create(user=user)
    client.force_login(user)

    response = client.get(reverse("admin-settings"))

    assert response.status_code == 200
    payload = response.json()
    assert set(payload["design_palettes"]) == {"light", "dark"}
    assert payload["presentation"]["font_family"] == "script"
