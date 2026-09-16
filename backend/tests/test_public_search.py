import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from scenes.models import PublicProfile


@pytest.mark.django_db
def test_public_gallery_search_scopes_accounts_and_rejects_malformed_queries(client):
    user = get_user_model().objects.create_user(username="artist")
    PublicProfile.objects.create(
        user=user, handle="artist", display_name="The Artist", is_public=True
    )
    hidden = get_user_model().objects.create_user(username="hidden")
    PublicProfile.objects.create(user=hidden, handle="hidden", is_public=False)

    response = client.get(reverse("public-gallery-search"), {"q": "artist", "scope": "accounts"})
    assert response.status_code == 200
    assert [item["handle"] for item in response.json()["results"]] == ["artist"]

    malformed = client.get(reverse("public-gallery-search"), {"q": "x", "scope": "invalid"})
    assert malformed.status_code == 400
