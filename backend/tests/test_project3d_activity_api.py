"""Owner privacy, shared projection, and schema-family guarantees for #1156."""

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APIClient

from scenes.models import Project, Project3D, ProjectActivity


@pytest.fixture
def activity_3d_context(db):
    user_model = get_user_model()
    owner = user_model.objects.create_user(username="activity-3d-owner")
    outsider = user_model.objects.create_user(username="activity-3d-outsider")
    project = Project3D.objects.create(owner=owner, title="3D history")
    deleted = Project3D.objects.create(
        owner=owner, title="Retained 3D history", is_deleted=True, deleted_at=timezone.now()
    )
    owner_client = APIClient()
    owner_client.force_authenticate(owner)
    outsider_client = APIClient()
    outsider_client.force_authenticate(outsider)
    return {
        "owner": owner,
        "outsider": outsider,
        "project": project,
        "deleted": deleted,
        "owner_client": owner_client,
        "outsider_client": outsider_client,
    }


def _url(project):
    return f"/api/projects3d/{project.public_id}/activity/"


@pytest.mark.django_db
def test_owner_activity_uses_the_shared_allowlisted_projection(activity_3d_context):
    data = activity_3d_context
    event = ProjectActivity.objects.create(
        project3d=data["project"],
        actor=data["owner"],
        action_type=ProjectActivity.ActionType.VERSION_SAVED,
        metadata={"sequence": 2, "origin": "manual", "internal_id": 123},
    )

    response = data["owner_client"].get(_url(data["project"]))

    assert response.status_code == 200
    assert response.json() == {
        "results": [
            {
                "id": event.pk,
                "action_type": "version_saved",
                "label": "Version saved",
                "actor_display": data["owner"].username,
                "created_at": event.created_at.isoformat(),
                "details": {"sequence": 2, "origin": "manual"},
            }
        ],
        "next_cursor": None,
    }
    assert b"internal_id" not in response.content
    assert b"owner@example" not in response.content


@pytest.mark.django_db
def test_owner_can_read_soft_deleted_3d_activity_but_public_payloads_do_not_include_it(
    activity_3d_context,
):
    data = activity_3d_context
    event = ProjectActivity.objects.create(
        project3d=data["deleted"],
        actor=data["owner"],
        action_type=ProjectActivity.ActionType.VERSION_SAVED,
        metadata={"sequence": 1},
    )

    response = data["owner_client"].get(_url(data["deleted"]))

    assert response.status_code == 200
    assert [row["id"] for row in response.json()["results"]] == [event.pk]

    project = data["project"]
    project.visibility = Project3D.Visibility.PUBLIC
    project.save(update_fields=["visibility"])
    public_detail = APIClient().get(f"/api/public/projects3d/{project.public_id}/")
    owner_detail = data["owner_client"].get(f"/api/projects3d/{project.public_id}/")
    assert public_detail.status_code == owner_detail.status_code == 200
    assert "activity" not in public_detail.json()
    assert "activity" not in owner_detail.json()
    public_activity = APIClient().get(f"/api/public/projects3d/{project.public_id}/activity/")
    assert public_activity.status_code == 404


@pytest.mark.django_db
def test_anonymous_non_owner_and_unknown_ids_share_the_404_boundary(activity_3d_context):
    data = activity_3d_context
    anonymous = APIClient()
    missing = "00000000-0000-0000-0000-000000000000"

    anonymous_response = anonymous.get(_url(data["project"]))
    outsider_response = data["outsider_client"].get(_url(data["project"]))
    missing_response = data["owner_client"].get(f"/api/projects3d/{missing}/activity/")

    assert anonymous_response.status_code == outsider_response.status_code == 404
    assert missing_response.status_code == 404
    assert anonymous_response.json() == outsider_response.json() == missing_response.json()


@pytest.mark.django_db
def test_cursor_is_bound_to_project_and_activity_family(activity_3d_context):
    data = activity_3d_context
    for sequence in range(2):
        ProjectActivity.objects.create(
            project3d=data["project"],
            action_type=ProjectActivity.ActionType.VERSION_SAVED,
            metadata={"sequence": sequence + 1},
        )
    first_page = data["owner_client"].get(_url(data["project"]), {"limit": 1})
    cursor = first_page.json()["next_cursor"]
    assert cursor

    two_d_project = Project.objects.create(owner=data["owner"], title="2D history")
    for sequence in range(2):
        ProjectActivity.objects.create(
            project=two_d_project,
            action_type=ProjectActivity.ActionType.VERSION_SAVED,
            metadata={"sequence": sequence + 1},
        )
    two_d_cursor = (
        data["owner_client"]
        .get(f"/api/projects/{two_d_project.public_id}/activity/", {"limit": 1})
        .json()["next_cursor"]
    )

    assert data["owner_client"].get(_url(data["project"]), {"cursor": cursor}).status_code == 200
    replay = data["owner_client"].get(_url(data["project"]), {"cursor": two_d_cursor})
    assert replay.status_code == 400
    assert replay.json() == {"errors": {"cursor": ["Invalid cursor."]}}


@pytest.mark.django_db
def test_projectactivity_requires_exactly_one_project_family(activity_3d_context):
    data = activity_3d_context
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ProjectActivity.objects.create(
                actor=data["owner"], action_type=ProjectActivity.ActionType.VERSION_SAVED
            )
    two_d = Project.objects.create(owner=data["owner"])
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ProjectActivity.objects.create(
                project=two_d,
                project3d=data["project"],
                actor=data["owner"],
                action_type=ProjectActivity.ActionType.VERSION_SAVED,
            )


@pytest.mark.django_db
def test_hard_delete_cascades_3d_activity_rows(activity_3d_context):
    project = activity_3d_context["project"]
    event = ProjectActivity.objects.create(
        project3d=project,
        action_type=ProjectActivity.ActionType.VERSION_SAVED,
        metadata={"sequence": 1},
    )

    project.delete()

    assert not ProjectActivity.objects.filter(pk=event.pk).exists()
