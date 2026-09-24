"""#750: public_slug is editable independently of the title for structured 2D and 3D pieces."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.models import Project, Project3D, PublicProfile


@pytest.fixture
def owner(db):
    user = get_user_model().objects.create_user(username="slug-owner")
    PublicProfile.objects.create(user=user, handle="slug-owner", is_public=True)
    return user


@pytest.fixture
def client(owner):
    api = APIClient()
    api.force_authenticate(owner)
    return api


FAMILIES = [("/api/projects/", Project), ("/api/projects3d/", Project3D)]


@pytest.mark.django_db
@pytest.mark.parametrize(("base", "model"), FAMILIES)
def test_title_edits_never_change_the_slug(client, base, model):
    created = client.post(base, {}, format="json").json()
    slug = created["public_slug"]
    assert slug
    renamed = client.patch(f"{base}{created['id']}/", {"title": "A Brand New Title"}, format="json")
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "A Brand New Title"
    assert renamed.json()["public_slug"] == slug


@pytest.mark.django_db
@pytest.mark.parametrize(("base", "model"), FAMILIES)
def test_slug_can_be_edited_and_is_normalised(client, base, model):
    created = client.post(base, {}, format="json").json()
    response = client.patch(
        f"{base}{created['id']}/", {"public_slug": "  My Fancy Slug! "}, format="json"
    )
    assert response.status_code == 200
    assert response.json()["public_slug"] == "my-fancy-slug"
    assert response.json()["editor_url"] == "/users/@slug-owner/edit/my-fancy-slug"


@pytest.mark.django_db
@pytest.mark.parametrize(("base", "model"), FAMILIES)
def test_slug_collisions_and_empty_slugs_are_rejected(client, base, model):
    first = client.post(base, {}, format="json").json()
    second = client.post(base, {}, format="json").json()
    taken = first["public_slug"]
    clash = client.patch(f"{base}{second['id']}/", {"public_slug": taken}, format="json")
    assert clash.status_code == 400
    assert "already in use" in str(clash.json())
    empty = client.patch(f"{base}{second['id']}/", {"public_slug": "!!!"}, format="json")
    assert empty.status_code == 400
    # Re-saving a piece's own slug is not a collision.
    same = client.patch(f"{base}{first['id']}/", {"public_slug": taken}, format="json")
    assert same.status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize(("base", "model"), FAMILIES)
def test_soft_deleted_pieces_still_reserve_their_slug(client, base, model):
    gone = client.post(base, {}, format="json").json()
    live = client.post(base, {}, format="json").json()
    client.delete(f"{base}{gone['id']}/")
    response = client.patch(
        f"{base}{live['id']}/", {"public_slug": gone["public_slug"]}, format="json"
    )
    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.parametrize(("base", "model"), FAMILIES)
def test_the_old_slug_stops_resolving_and_others_cannot_edit(client, owner, base, model):
    created = client.post(base, {}, format="json").json()
    old = created["public_slug"]
    client.patch(f"{base}{created['id']}/", {"public_slug": "fresh-slug"}, format="json")
    assert client.get(f"/api/users/@slug-owner/edit/{old}/").status_code == 404
    assert client.get("/api/users/@slug-owner/edit/fresh-slug/").status_code == 200

    stranger = APIClient()
    stranger.force_authenticate(get_user_model().objects.create_user(username="slug-stranger"))
    denied = stranger.patch(f"{base}{created['id']}/", {"public_slug": "hijack"}, format="json")
    assert denied.status_code == 404
