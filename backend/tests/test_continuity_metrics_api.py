from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from scenes.models import AIRun, ApplicationAdmin, Project, ProjectActivity


@pytest.mark.django_db
def test_continuity_metrics_is_admin_only_and_returns_only_suppressed_aggregates():
    url = reverse("admin-continuity-metrics")
    assert APIClient().get(url).status_code == 401

    user = get_user_model().objects.create_user(username="continuity-nonadmin")
    client = APIClient()
    client.force_authenticate(user)
    assert client.get(url).status_code == 403

    ApplicationAdmin.objects.create(user=user)
    response = client.get(url)
    assert response.status_code == 200
    payload = response.json()
    assert payload == {
        "cohorts": [
            {"project_position": 1, "suppressed": True, "metrics": None},
            {"project_position": 2, "suppressed": True, "metrics": None},
            {"project_position": 3, "suppressed": True, "metrics": None},
        ]
    }


@pytest.mark.django_db
def test_continuity_metrics_counts_reviewable_proposals_and_full_history():
    user_model = get_user_model()
    users = [user_model.objects.create_user(username=f"continuity-{index}") for index in range(5)]
    projects = [Project.objects.create(owner=owner) for owner in users]
    for owner, first_project in zip(users, projects, strict=True):
        for _position in (2, 3):
            Project.objects.create(
                owner=owner, created_at=first_project.created_at + timedelta(days=_position)
            )
    project = projects[0]
    now = timezone.now()

    def make_run(status, created_at):
        run = AIRun.objects.create(
            owner=users[0],
            target_type=AIRun.TargetType.PROJECT,
            project=project,
            operation=AIRun.Operation.CREATE,
            prompt="private prompt must not be returned",
            input_digest="a" * 64,
            deadline_at=now + timedelta(days=1),
            status=status,
        )
        AIRun.objects.filter(pk=run.pk).update(created_at=created_at)
        return run

    make_run(AIRun.Status.FAILED, now - timedelta(days=400))
    make_run(AIRun.Status.AWAITING_REVIEW, now - timedelta(days=300))
    accepted_run = make_run(AIRun.Status.ACCEPTED, now - timedelta(days=200))
    make_run(AIRun.Status.CANCELLED, now - timedelta(days=100))
    accepted_at = now - timedelta(days=200) + timedelta(hours=2)
    ProjectActivity.objects.create(
        project=project,
        actor=users[0],
        action_type=ProjectActivity.ActionType.AI_PROPOSAL_ACCEPTED,
        metadata={"run_id": accepted_run.pk},
    )
    ProjectActivity.objects.filter(
        project=project, action_type=ProjectActivity.ActionType.AI_PROPOSAL_ACCEPTED
    ).update(created_at=accepted_at)
    ProjectActivity.objects.create(
        project=project,
        actor=users[0],
        action_type=ProjectActivity.ActionType.AI_PROPOSAL_REJECTED,
        metadata={"run_id": 9001},
    )

    client = APIClient()
    admin = user_model.objects.create_user(username="continuity-admin")
    ApplicationAdmin.objects.create(user=admin)
    client.force_authenticate(admin)

    response = client.get(reverse("admin-continuity-metrics"))
    assert response.status_code == 200
    cohorts = response.json()["cohorts"]
    first = cohorts[0]
    assert first["suppressed"] is False
    assert first["metrics"]["proposals_per_project"] == pytest.approx(0.6)
    assert first["metrics"]["accepted_share"] == pytest.approx(1 / 3)
    assert first["metrics"]["median_time_to_accept_seconds"] == pytest.approx(
        (accepted_at - (now - timedelta(days=400))).total_seconds()
    )
    assert cohorts[1]["suppressed"] is False
    assert cohorts[1]["metrics"]["proposals_per_project"] == 0
    assert cohorts[1]["metrics"]["accepted_share"] is None
    assert cohorts[1]["metrics"]["median_time_to_accept_seconds"] is None
    assert cohorts[2]["suppressed"] is False
    serialized = response.content.decode()
    assert "continuity-0" not in serialized
    assert "private prompt" not in serialized
    assert str(project.public_id) not in serialized


@pytest.mark.django_db
def test_continuity_metrics_timeout_is_retryable(monkeypatch):
    from scenes import continuity_metrics_api

    def timeout():
        from scenes.continuity_metrics import ContinuityMetricsTimeoutError

        raise ContinuityMetricsTimeoutError

    monkeypatch.setattr(continuity_metrics_api, "get_continuity_metrics", timeout)
    admin = get_user_model().objects.create_user(username="continuity-timeout")
    ApplicationAdmin.objects.create(user=admin)
    client = APIClient()
    client.force_authenticate(admin)

    response = client.get(reverse("admin-continuity-metrics"))
    assert response.status_code == 503
    assert response.json()["retryable"] is True
