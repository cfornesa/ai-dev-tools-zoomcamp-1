"""Tests for the owner-scoped account data export (issue #442)."""

import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse

from scenes.models import (
    ArtPiece,
    ArtPieceVersion,
    MistralCredential,
    Project,
    Project3D,
    ProviderCredential,
    SceneVersion,
    SceneVersion3D,
    Subscription,
)


def _make_user(username):
    return get_user_model().objects.create_user(username=username, password="not-used")


_MINIMAL_SCENE_3D = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures3d"
        / "valid"
        / "minimal.json"
    ).read_text()
)


@pytest.mark.django_db
def test_requires_authentication(client):
    response = client.get(reverse("account-data-export"))
    assert response.status_code == 401


@pytest.mark.django_db
def test_export_includes_schema_version_and_profile():
    user = _make_user("owner")
    client = Client()
    client.force_login(user)

    response = client.get(reverse("account-data-export"))

    assert response.status_code == 200
    body = response.json()
    assert body["schema_version"] == 1
    assert body["profile"] == {"username": "owner", "email": ""}


@pytest.mark.django_db
def test_export_never_exposes_credential_key_material():
    user = _make_user("owner")
    MistralCredential.objects.create(user=user, encrypted_key=b"not-a-real-key")
    ProviderCredential.objects.create(owner=user, vendor="gemini", encrypted_key=b"also-not-real")
    client = Client()
    client.force_login(user)

    response = client.get(reverse("account-data-export"))

    body = response.json()
    assert body["ai_credentials"] == {
        "mistral_configured": True,
        "provider_credentials": ["gemini"],
    }
    # Never even the encrypted bytes, let alone anything decrypted.
    assert b"not-a-real-key" not in response.content
    assert b"also-not-real" not in response.content


@pytest.mark.django_db
def test_export_includes_owned_projects_and_versions_including_soft_deleted():
    user = _make_user("owner")
    project = Project.objects.create(owner=user, title="My animation")
    SceneVersion.objects.create(
        project=project, sequence=1, scene_json={"shapes": []}, origin=SceneVersion.Origin.MANUAL
    )
    deleted_project = Project.objects.create(owner=user, title="Deleted animation")
    deleted_project.is_deleted = True
    deleted_project.save(update_fields=["is_deleted"])

    client = Client()
    client.force_login(user)
    response = client.get(reverse("account-data-export"))

    body = response.json()
    titles = {p["title"] for p in body["projects"]}
    assert titles == {"My animation", "Deleted animation"}
    project_export = next(p for p in body["projects"] if p["title"] == "My animation")
    assert len(project_export["versions"]) == 1
    assert project_export["versions"][0]["scene_json"] == {"shapes": []}
    deleted_export = next(p for p in body["projects"] if p["title"] == "Deleted animation")
    assert deleted_export["is_deleted"] is True


@pytest.mark.django_db
def test_export_includes_owned_3d_projects_and_art_pieces():
    user = _make_user("owner")
    project3d = Project3D.objects.create(owner=user, title="My 3D scene")
    SceneVersion3D.objects.create(
        project=project3d,
        sequence=1,
        scene_json=_MINIMAL_SCENE_3D,
        origin=SceneVersion3D.Origin.MANUAL,
    )
    piece = ArtPiece.objects.create(
        owner=user,
        title="My art piece",
        prompt="a red rectangle",
        engine=ArtPiece.Engine.CANVAS2D,
    )
    ArtPieceVersion.objects.create(piece=piece, sequence=1, source="<canvas></canvas>")

    client = Client()
    client.force_login(user)
    response = client.get(reverse("account-data-export"))

    body = response.json()
    assert len(body["projects_3d"]) == 1
    assert body["projects_3d"][0]["title"] == "My 3D scene"
    assert len(body["projects_3d"][0]["versions"]) == 1
    assert len(body["art_pieces"]) == 1
    assert body["art_pieces"][0]["title"] == "My art piece"
    assert body["art_pieces"][0]["versions"][0]["source"] == "<canvas></canvas>"


@pytest.mark.django_db
def test_export_includes_subscription_status_without_payment_payload():
    user = _make_user("owner")
    Subscription.objects.create(
        user=user,
        paypal_subscription_id="I-REALSUBID123",
        plan_key="pro",
        status=Subscription.Status.ACTIVE,
    )
    client = Client()
    client.force_login(user)

    response = client.get(reverse("account-data-export"))

    body = response.json()
    assert body["subscription"] == {"status": "active", "plan_key": "pro", "paid_through": None}
    # The PayPal subscription id is not a secret, but it's not part of
    # this export's contract either -- keep the shape exactly bounded.
    assert "paypal_subscription_id" not in body["subscription"]


@pytest.mark.django_db
def test_export_never_includes_another_users_data():
    owner = _make_user("owner")
    other = _make_user("other")
    Project.objects.create(owner=other, title="Someone else's animation")
    ArtPiece.objects.create(
        owner=other, title="Someone else's art", prompt="x", engine=ArtPiece.Engine.CANVAS2D
    )

    client = Client()
    client.force_login(owner)
    response = client.get(reverse("account-data-export"))

    body = response.json()
    assert body["projects"] == []
    assert body["art_pieces"] == []
    assert b"Someone else" not in response.content


@pytest.mark.django_db
def test_export_is_a_safe_idempotent_repeat_request():
    user = _make_user("owner")
    Project.objects.create(owner=user, title="Repeatable fixture")
    client = Client()
    client.force_login(user)

    first = client.get(reverse("account-data-export"))
    second = client.get(reverse("account-data-export"))

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["projects"] == second.json()["projects"]
