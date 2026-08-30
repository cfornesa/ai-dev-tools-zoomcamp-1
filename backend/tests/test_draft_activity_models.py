"""Model tests for scenes.EditSessionDraft / scenes.ProjectActivity (Task 9)."""

import json
from datetime import timedelta
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from scenes.models import (
    EditSessionDraft,
    Project,
    ProjectActivity,
    ProjectActivityUnsafeMetadataError,
    SceneVersion,
)

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures"
        / "valid"
        / "blank.json"
    ).read_text()
)


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username="alice")


@pytest.fixture
def project(user):
    return Project.objects.create(owner=user)


@pytest.mark.django_db
def test_create_draft_with_defaults(project, user):
    draft = EditSessionDraft.objects.create(
        project=project, user=user, session_id="session-1", draft_json=BLANK_SCENE
    )

    assert draft.is_expired is False
    assert draft.expires_at > timezone.now()
    assert draft.last_autosaved_at is not None


@pytest.mark.django_db
def test_duplicate_active_draft_for_same_scope_rejected(project, user):
    EditSessionDraft.objects.create(
        project=project, user=user, session_id="session-1", draft_json=BLANK_SCENE
    )

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            EditSessionDraft.objects.create(
                project=project, user=user, session_id="session-1", draft_json=BLANK_SCENE
            )


@pytest.mark.django_db
def test_different_session_ids_do_not_collide(project, user):
    EditSessionDraft.objects.create(
        project=project, user=user, session_id="session-1", draft_json=BLANK_SCENE
    )
    EditSessionDraft.objects.create(
        project=project, user=user, session_id="session-2", draft_json=BLANK_SCENE
    )
    # No IntegrityError: distinct session ids are a distinct scope.


@pytest.mark.django_db
def test_invalid_draft_json_is_rejected(project, user):
    invalid = {**BLANK_SCENE, "schemaVersion": 999}

    with pytest.raises(ValidationError):
        EditSessionDraft.objects.create(
            project=project, user=user, session_id="session-1", draft_json=invalid
        )


@pytest.mark.django_db
def test_expired_and_unexpired_draft_queries(project, user):
    unexpired = EditSessionDraft.objects.create(
        project=project, user=user, session_id="session-fresh", draft_json=BLANK_SCENE
    )
    expired = EditSessionDraft.objects.create(
        project=project, user=user, session_id="session-stale", draft_json=BLANK_SCENE
    )
    EditSessionDraft.objects.filter(pk=expired.pk).update(
        expires_at=timezone.now() - timedelta(hours=1)
    )
    expired.refresh_from_db()

    assert expired.is_expired is True
    assert unexpired.is_expired is False
    assert list(EditSessionDraft.objects.active()) == [unexpired]
    assert list(EditSessionDraft.objects.expired()) == [expired]


@pytest.mark.django_db
def test_creating_or_updating_draft_does_not_create_scene_version(project, user):
    assert SceneVersion.objects.count() == 0

    draft = EditSessionDraft.objects.create(
        project=project, user=user, session_id="session-1", draft_json=BLANK_SCENE
    )
    draft.draft_json = {**BLANK_SCENE, "randomness": {"seed": 1, "enabled": True}}
    draft.save()

    assert SceneVersion.objects.count() == 0


@pytest.mark.django_db
def test_create_activity_with_defaults(project, user):
    activity = ProjectActivity.objects.create(
        project=project,
        actor=user,
        action_type=ProjectActivity.ActionType.PROJECT_CREATED,
        metadata={"title": "Untitled animation"},
    )

    assert activity.metadata == {"title": "Untitled animation"}
    assert activity.created_at is not None


@pytest.mark.django_db
@pytest.mark.parametrize(
    "bad_metadata",
    [
        {"camera_frame": "base64..."},
        {"provider_api_key": "sk-live-abc123"},
        {"nested": {"secret_token": "xyz"}},
        {"items": [{"password": "hunter2"}]},
    ],
)
def test_activity_metadata_rejects_camera_and_secret_like_keys(project, user, bad_metadata):
    with pytest.raises(ProjectActivityUnsafeMetadataError):
        ProjectActivity.objects.create(
            project=project,
            actor=user,
            action_type=ProjectActivity.ActionType.PROJECT_CREATED,
            metadata=bad_metadata,
        )


@pytest.mark.django_db
def test_activity_metadata_rejects_oversized_payload(project, user):
    with pytest.raises(ProjectActivityUnsafeMetadataError):
        ProjectActivity.objects.create(
            project=project,
            actor=user,
            action_type=ProjectActivity.ActionType.PROJECT_CREATED,
            metadata={"note": "x" * 20000},
        )


@pytest.mark.django_db
def test_activity_survives_actor_deletion(project, user):
    # actor deliberately distinct from project.owner: deleting the owner
    # would cascade-delete the project (and its activity) for an unrelated
    # reason, masking whether actor=SET_NULL actually works.
    other_actor = get_user_model().objects.create_user(username="bob")
    activity = ProjectActivity.objects.create(
        project=project, actor=other_actor, action_type=ProjectActivity.ActionType.PROJECT_CREATED
    )

    other_actor.delete()
    activity.refresh_from_db()

    assert activity.actor is None
