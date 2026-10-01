"""Focused owner-privacy and bounded-pagination coverage for #1133."""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from scenes.models import Project, ProjectActivity, SceneVersion


@pytest.fixture
def activity_context(db):
    user_model = get_user_model()
    owner = user_model.objects.create_user(username="activity-owner", email="owner@example.test")
    outsider = user_model.objects.create_user(username="activity-outsider")
    private = Project.objects.create(owner=owner, title="Private history")
    public = Project.objects.create(
        owner=owner, title="Public history", visibility=Project.Visibility.PUBLIC
    )
    foreign = Project.objects.create(owner=outsider, title="Foreign history")
    deleted = Project.objects.create(
        owner=owner, title="Retained history", is_deleted=True, deleted_at=timezone.now()
    )
    first_time = timezone.now() - timedelta(minutes=2)
    second_time = timezone.now() - timedelta(minutes=1)
    first = ProjectActivity.objects.create(
        project=private,
        actor=owner,
        action_type=ProjectActivity.ActionType.VERSION_SAVED,
        metadata={
            "sequence": 4,
            "origin": "manual",
            "private_note": "must not escape",
        },
    )
    second = ProjectActivity.objects.create(
        project=private,
        actor=None,
        action_type=ProjectActivity.ActionType.AI_PROPOSAL_REJECTED,
        metadata={"reason": "discarded", "unknown": {"private_note": "hidden"}},
    )
    ProjectActivity.objects.filter(pk=first.pk).update(created_at=first_time)
    ProjectActivity.objects.filter(pk=second.pk).update(created_at=second_time)
    foreign_event = ProjectActivity.objects.create(
        project=foreign,
        actor=outsider,
        action_type=ProjectActivity.ActionType.PROJECT_CREATED,
    )
    deleted_event = ProjectActivity.objects.create(
        project=deleted,
        actor=owner,
        action_type=ProjectActivity.ActionType.VERSION_DELETED,
        metadata={"sequence": 9},
    )
    owner_client = APIClient()
    owner_client.force_authenticate(owner)
    outsider_client = APIClient()
    outsider_client.force_authenticate(outsider)
    return {
        "owner": owner,
        "outsider": outsider,
        "owner_client": owner_client,
        "outsider_client": outsider_client,
        "private": private,
        "public": public,
        "foreign": foreign,
        "deleted": deleted,
        "first": first,
        "second": second,
        "foreign_event": foreign_event,
        "deleted_event": deleted_event,
    }


def _activity_url(project):
    return f"/api/projects/{project.public_id}/activity/"


@pytest.mark.django_db
def test_activity_projection_is_exact_and_allowlisted(activity_context):
    data = activity_context
    response = data["owner_client"].get(_activity_url(data["private"]))

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"results", "next_cursor"}
    assert body["next_cursor"] is None
    assert [result["id"] for result in body["results"]] == [
        data["second"].pk,
        data["first"].pk,
    ]
    second, first = body["results"]
    assert set(first) == {
        "id",
        "action_type",
        "label",
        "actor_display",
        "created_at",
        "details",
    }
    assert first["action_type"] == ProjectActivity.ActionType.VERSION_SAVED
    assert (
        first["label"]
        == ProjectActivity(
            action_type=ProjectActivity.ActionType.VERSION_SAVED
        ).get_action_type_display()
    )
    assert first["actor_display"] == data["owner"].username
    assert first["details"] == {"sequence": 4, "origin": "manual"}
    assert second["action_type"] == ProjectActivity.ActionType.AI_PROPOSAL_REJECTED
    assert (
        second["label"]
        == ProjectActivity(
            action_type=ProjectActivity.ActionType.AI_PROPOSAL_REJECTED
        ).get_action_type_display()
    )
    assert second["actor_display"] is None
    assert second["details"] == {"reason": "discarded"}
    assert "email" not in str(body)
    assert "project_id" not in str(body)
    assert "private_note" not in str(body)
    assert "unknown" not in str(body)


@pytest.mark.django_db
def test_every_declared_action_uses_model_display_label(activity_context):
    data = activity_context
    timestamp = timezone.now() - timedelta(days=1)
    events = [
        ProjectActivity.objects.create(
            project=data["private"],
            actor=data["owner"],
            action_type=action,
        )
        for action, _label in ProjectActivity.ActionType.choices
    ]
    ProjectActivity.objects.filter(pk__in=[event.pk for event in events]).update(
        created_at=timestamp
    )

    response = data["owner_client"].get(_activity_url(data["private"]))

    assert response.status_code == 200
    returned = {row["action_type"]: row["label"] for row in response.json()["results"]}
    assert returned == {action: label for action, label in ProjectActivity.ActionType.choices}


@pytest.mark.django_db
def test_owner_can_read_public_and_soft_deleted_project_activity(activity_context):
    data = activity_context
    public_event = ProjectActivity.objects.create(
        project=data["public"],
        actor=data["owner"],
        action_type=ProjectActivity.ActionType.VERSION_SAVED,
    )

    public_response = data["owner_client"].get(_activity_url(data["public"]))
    deleted_response = data["owner_client"].get(_activity_url(data["deleted"]))

    assert public_response.status_code == 200
    assert [row["id"] for row in public_response.json()["results"]] == [public_event.pk]
    assert deleted_response.status_code == 200
    assert [row["id"] for row in deleted_response.json()["results"]] == [data["deleted_event"].pk]


@pytest.mark.django_db
def test_anonymous_and_non_owner_are_masked_for_private_public_and_missing_ids(
    activity_context,
):
    data = activity_context
    anonymous = APIClient()
    nonexistent = "00000000-0000-0000-0000-000000000000"

    for project in (data["private"], data["public"]):
        anon_response = anonymous.get(_activity_url(project))
        other_response = data["outsider_client"].get(_activity_url(project))
        missing_response = anonymous.get(f"/api/projects/{nonexistent}/activity/")
        assert anon_response.status_code == other_response.status_code == 404
        assert anon_response.status_code == missing_response.status_code
        assert anon_response.json() == other_response.json() == missing_response.json()

    owner_missing = data["owner_client"].get(f"/api/projects/{nonexistent}/activity/")
    assert owner_missing.status_code == 404


@pytest.mark.django_db
def test_owner_activity_and_cursor_are_bound_to_project_public_uuid(activity_context):
    data = activity_context
    rows = [
        ProjectActivity.objects.create(
            project=data["private"], actor=data["owner"], action_type="version_saved"
        )
        for _ in range(3)
    ]
    ProjectActivity.objects.filter(pk__in=[row.pk for row in rows]).update(
        created_at=timezone.now() - timedelta(hours=1)
    )
    first = data["owner_client"].get(_activity_url(data["private"]), {"limit": 2})
    cursor = first.json()["next_cursor"]

    assert cursor
    assert data["owner_client"].get(_activity_url(data["public"]), {"cursor": cursor}).json() == {
        "errors": {"cursor": ["Invalid cursor."]}
    }
    assert data["owner_client"].get(
        _activity_url(data["private"]), {"cursor": "not-a-valid-cursor"}
    ).json() == {"errors": {"cursor": ["Invalid cursor."]}}


@pytest.mark.django_db
def test_tied_timestamps_paginate_without_duplicate_or_skipped_rows(activity_context):
    data = activity_context
    timestamp = timezone.now() - timedelta(days=3)
    [
        ProjectActivity.objects.create(
            project=data["private"], actor=data["owner"], action_type="version_saved"
        )
        for _ in range(8)
    ]
    ProjectActivity.objects.filter(project=data["private"]).update(created_at=timestamp)
    expected = list(
        ProjectActivity.objects.filter(project=data["private"])
        .order_by("-created_at", "-id")
        .values_list("id", flat=True)
    )
    seen = []
    cursor = None
    while True:
        params = {"limit": 3}
        if cursor is not None:
            params["cursor"] = cursor
        page = data["owner_client"].get(_activity_url(data["private"]), params)
        assert page.status_code == 200
        seen.extend(row["id"] for row in page.json()["results"])
        cursor = page.json()["next_cursor"]
        if cursor is None:
            break

    assert seen == expected
    assert len(seen) == len(set(seen))


@pytest.mark.parametrize("limit", ["", "abc", "0", "-1", "101", "1.5", " 2"])
@pytest.mark.django_db
def test_invalid_limit_returns_exact_validation_error(activity_context, limit):
    response = activity_context["owner_client"].get(
        _activity_url(activity_context["private"]), {"limit": limit}
    )

    assert response.status_code == 400
    assert response.json() == {"errors": {"limit": ["Must be an integer from 1 to 100."]}}


@pytest.mark.django_db
def test_limit_defaults_to_25_and_caps_returned_rows(activity_context):
    data = activity_context
    ProjectActivity.objects.bulk_create(
        [
            ProjectActivity(
                project=data["private"],
                actor=data["owner"],
                action_type=ProjectActivity.ActionType.VERSION_SAVED,
            )
            for _ in range(30)
        ]
    )

    default_response = data["owner_client"].get(_activity_url(data["private"]))
    max_response = data["owner_client"].get(_activity_url(data["private"]), {"limit": 100})

    assert len(default_response.json()["results"]) == 25
    assert default_response.json()["next_cursor"] is not None
    assert len(max_response.json()["results"]) == 32
    assert max_response.json()["next_cursor"] is None


@pytest.mark.django_db
def test_public_project_payload_stays_unchanged_and_no_public_activity_route(activity_context):
    data = activity_context
    version = SceneVersion.objects.create(
        project=data["public"],
        sequence=1,
        scene_json={},
        created_by=data["owner"],
    )
    data["public"].current_version = version
    data["public"].published_at = timezone.now()
    data["public"].save(update_fields=["current_version", "published_at"])
    ProjectActivity.objects.create(
        project=data["public"],
        actor=data["owner"],
        action_type=ProjectActivity.ActionType.PROJECT_CREATED,
    )
    public_response = APIClient().get(f"/api/public/projects/{data['public'].public_id}/")
    assert public_response.status_code == 200
    assert "activity" not in public_response.json()
    owner_response = data["owner_client"].get(f"/api/projects/{data['public'].public_id}/")
    assert owner_response.status_code == 200
    assert "activity" not in owner_response.json()
    public_activity_response = APIClient().get(
        f"/api/public/projects/{data['public'].public_id}/activity/"
    )
    assert public_activity_response.status_code == 404


@pytest.mark.django_db
def test_ten_thousand_event_page_is_bounded_and_uses_two_selects(activity_context):
    data = activity_context
    ProjectActivity.objects.bulk_create(
        [
            ProjectActivity(
                project=data["private"],
                actor=data["owner"],
                action_type=ProjectActivity.ActionType.VERSION_SAVED,
                metadata={"sequence": index},
            )
            for index in range(10_000)
        ],
        batch_size=1_000,
    )

    with CaptureQueriesContext(connection) as captured:
        response = data["owner_client"].get(_activity_url(data["private"]), {"limit": 100})

    selects = [
        query["sql"] for query in captured if query["sql"].lstrip().upper().startswith("SELECT")
    ]
    assert response.status_code == 200
    assert len(response.json()["results"]) == 100
    assert len(selects) <= 2
    activity_selects = [sql for sql in selects if "scenes_projectactivity" in sql]
    assert len(activity_selects) == 1
    assert "JOIN" in activity_selects[0].upper()
    assert "LIMIT 101" in activity_selects[0].upper()
