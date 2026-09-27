import json
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.urls import reverse

from scenes.models import ApplicationAdmin, ArtPiece, Plan
from scenes.storage_usage import estimate_transfer


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="storage_owner", password="x")


@pytest.fixture
def admin(db):
    user = get_user_model().objects.create_user(username="storage_admin", password="x")
    ApplicationAdmin.objects.create(user=user)
    return user


@pytest.fixture(autouse=True)
def plan(db):
    Plan.objects.update_or_create(
        plan_key="free",
        defaults={
            "daily_ai_requests": 5,
            "feature_keys": [],
            "active": True,
            "cloud_storage_bytes": 100,
            "cloud_storage_files": 2,
            "public_storage_bytes": 200,
            "public_storage_files": 3,
        },
    )


@pytest.mark.django_db
def test_estimate_is_read_only_and_reports_separate_caps(owner):
    before = Plan.objects.get(plan_key="free").revision
    result = estimate_transfer(owner, piece_bytes=10, media_bytes=20, piece_files=1, media_files=1)
    assert result["quotas"] == {
        "private": {"bytes": 100, "files": 2},
        "public": {"bytes": 200, "files": 3},
    }
    assert result["estimate"]["bytes"] == 30
    assert Plan.objects.get(plan_key="free").revision == before


@pytest.mark.django_db
def test_estimate_endpoint_requires_auth_and_owner_scope(client, owner):
    url = reverse("account-storage-estimate")
    assert client.get(url).status_code == 401
    client.force_login(owner)
    assert client.get(f"{url}?piece_id={uuid4()}").status_code == 404
    response = client.get(f"{url}?piece_bytes=10&media_bytes=5&piece_files=1&media_files=1")
    assert response.status_code == 200
    assert response.json()["estimate"]["bytes"] == 15


@pytest.mark.django_db
def test_report_command_is_read_only_and_emits_json(admin, capsys):
    ArtPiece.objects.create(
        owner=admin,
        title="Measured",
        prompt="fixture",
        engine=ArtPiece.Engine.SVG,
    )
    before = ArtPiece.objects.count()
    call_command("report_storage_usage")
    report = json.loads(capsys.readouterr().out)
    assert report["piece_count"] == 0
    assert ArtPiece.objects.count() == before
