"""Tests for the admin AI provider/model catalog (issue #523): the
service layer (`scenes.ai_catalog`), its admin API
(`/api/admin/ai-models/`), and the `scenes.ai_runs.start_run` gate that
consults it before any provider call.
"""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from scenes import ai_catalog, ai_runs
from scenes.models import AIProviderModel, ApplicationAdmin, Project


@pytest.fixture
def admin_a():
    user = get_user_model().objects.create_user(username="catalog_admin", password="not-used")
    ApplicationAdmin.objects.create(user=user)
    return user


@pytest.fixture
def user_b():
    return get_user_model().objects.create_user(username="catalog_user_b", password="not-used")


# --- service layer ---


@pytest.mark.django_db
class TestCreateModel:
    def test_creates_valid_entry(self, admin_a):
        view = ai_catalog.create_model(
            actor=admin_a,
            vendor="gemini",
            model_slug="gemini-2.5-flash-test",
            display_label="Gemini test",
            task_kinds=["agent_2d"],
            agentic_supported=True,
        )
        assert view.vendor == "gemini"
        assert view.agentic_supported is True
        assert view.revision == 1

    def test_rejects_unknown_provider(self, admin_a):
        with pytest.raises(ai_catalog.ValidationFailed):
            ai_catalog.create_model(
                actor=admin_a,
                vendor="not-a-real-vendor",
                model_slug="whatever",
                display_label="X",
                task_kinds=["agent_2d"],
            )

    def test_rejects_blank_slug(self, admin_a):
        with pytest.raises(ai_catalog.ValidationFailed):
            ai_catalog.create_model(
                actor=admin_a,
                vendor="mistral",
                model_slug="   ",
                display_label="X",
                task_kinds=["agent_2d"],
            )

    def test_rejects_overlong_slug(self, admin_a):
        with pytest.raises(ai_catalog.ValidationFailed):
            ai_catalog.create_model(
                actor=admin_a,
                vendor="mistral",
                model_slug="x" * 201,
                display_label="X",
                task_kinds=["agent_2d"],
            )

    def test_rejects_unsupported_task_kind(self, admin_a):
        with pytest.raises(ai_catalog.ValidationFailed):
            ai_catalog.create_model(
                actor=admin_a,
                vendor="mistral",
                model_slug="mistral-test",
                display_label="X",
                task_kinds=["not_a_real_task_kind"],
            )

    def test_rejects_duplicate_active_pair(self, admin_a):
        ai_catalog.create_model(
            actor=admin_a,
            vendor="mistral",
            model_slug="dup-model",
            display_label="X",
            task_kinds=["one_shot_2d"],
        )
        with pytest.raises(ai_catalog.ValidationFailed):
            ai_catalog.create_model(
                actor=admin_a,
                vendor="mistral",
                model_slug="dup-model",
                display_label="Y",
                task_kinds=["one_shot_2d"],
            )

    def test_rejects_agentic_without_agent_task_kind(self, admin_a):
        with pytest.raises(ai_catalog.ValidationFailed):
            ai_catalog.create_model(
                actor=admin_a,
                vendor="mistral",
                model_slug="one-shot-only",
                display_label="X",
                task_kinds=["one_shot_2d"],
                agentic_supported=True,
            )


@pytest.mark.django_db
class TestUpdateModel:
    def test_updates_and_bumps_revision(self, admin_a):
        row = ai_catalog.create_model(
            actor=admin_a,
            vendor="mistral",
            model_slug="update-me",
            display_label="Original",
            task_kinds=["one_shot_2d"],
        )
        updated = ai_catalog.update_model(
            actor=admin_a,
            model_id=row.id,
            expected_revision=row.revision,
            display_label="Updated",
        )
        assert updated.display_label == "Updated"
        assert updated.revision == row.revision + 1

    def test_stale_revision_conflicts(self, admin_a):
        row = ai_catalog.create_model(
            actor=admin_a,
            vendor="mistral",
            model_slug="stale-test",
            display_label="Original",
            task_kinds=["one_shot_2d"],
        )
        with pytest.raises(ai_catalog.RevisionConflict):
            ai_catalog.update_model(
                actor=admin_a,
                model_id=row.id,
                expected_revision=row.revision + 1,
                display_label="Updated",
            )

    def test_deactivate_allows_reuse_of_pair(self, admin_a):
        row = ai_catalog.create_model(
            actor=admin_a,
            vendor="mistral",
            model_slug="reuse-pair",
            display_label="Original",
            task_kinds=["one_shot_2d"],
        )
        deactivated = ai_catalog.update_model(
            actor=admin_a, model_id=row.id, expected_revision=row.revision, active=False
        )
        assert deactivated.active is False
        recreated = ai_catalog.create_model(
            actor=admin_a,
            vendor="mistral",
            model_slug="reuse-pair",
            display_label="New",
            task_kinds=["one_shot_2d"],
        )
        assert recreated.active is True

    def test_reactivating_into_a_clash_is_rejected(self, admin_a):
        first = ai_catalog.create_model(
            actor=admin_a,
            vendor="mistral",
            model_slug="clash-pair",
            display_label="First",
            task_kinds=["one_shot_2d"],
        )
        deactivated = ai_catalog.update_model(
            actor=admin_a, model_id=first.id, expected_revision=first.revision, active=False
        )
        ai_catalog.create_model(
            actor=admin_a,
            vendor="mistral",
            model_slug="clash-pair",
            display_label="Second",
            task_kinds=["one_shot_2d"],
        )
        with pytest.raises(ai_catalog.ValidationFailed):
            ai_catalog.update_model(
                actor=admin_a,
                model_id=deactivated.id,
                expected_revision=deactivated.revision,
                active=True,
            )

    def test_not_found(self, admin_a):
        with pytest.raises(ai_catalog.NotFound):
            ai_catalog.update_model(
                actor=admin_a, model_id=999999, expected_revision=1, display_label="X"
            )


@pytest.mark.django_db
class TestDeleteModel:
    def test_deletes_with_correct_revision(self, admin_a):
        row = ai_catalog.create_model(
            actor=admin_a,
            vendor="mistral",
            model_slug="delete-me",
            display_label="X",
            task_kinds=["one_shot_2d"],
        )
        ai_catalog.delete_model(model_id=row.id, expected_revision=row.revision)
        assert not AIProviderModel.objects.filter(pk=row.id).exists()

    def test_stale_revision_conflicts(self, admin_a):
        row = ai_catalog.create_model(
            actor=admin_a,
            vendor="mistral",
            model_slug="delete-stale",
            display_label="X",
            task_kinds=["one_shot_2d"],
        )
        with pytest.raises(ai_catalog.RevisionConflict):
            ai_catalog.delete_model(model_id=row.id, expected_revision=row.revision + 1)


@pytest.mark.django_db
def test_is_agentic_supported_fails_closed_for_unknown_pair():
    assert (
        ai_catalog.is_agentic_supported(
            vendor="mistral", model_slug="never-configured", task_kind="agent_2d"
        )
        is False
    )


@pytest.mark.django_db
def test_is_agentic_supported_true_for_seeded_default():
    assert (
        ai_catalog.is_agentic_supported(
            vendor="mistral", model_slug="mistral-small-latest", task_kind="agent_2d"
        )
        is True
    )


@pytest.mark.django_db
def test_list_models_include_inactive_flag(admin_a):
    row = ai_catalog.create_model(
        actor=admin_a,
        vendor="mistral",
        model_slug="inactive-listing",
        display_label="X",
        task_kinds=["one_shot_2d"],
    )
    ai_catalog.update_model(
        actor=admin_a, model_id=row.id, expected_revision=row.revision, active=False
    )
    all_slugs = {m.model_slug for m in ai_catalog.list_models(include_inactive=True)}
    active_slugs = {m.model_slug for m in ai_catalog.list_models(include_inactive=False)}
    assert "inactive-listing" in all_slugs
    assert "inactive-listing" not in active_slugs


# --- admin API authorization + behavior ---


@pytest.mark.django_db
class TestAdminAIModelsAPI:
    def test_anonymous_is_401(self, client):
        response = client.get(reverse("admin-ai-models"))
        assert response.status_code == 401

    def test_non_admin_is_403(self, client, user_b):
        client.force_login(user_b)
        response = client.get(reverse("admin-ai-models"))
        assert response.status_code == 403

    def test_admin_can_create_list_edit_delete(self, client, admin_a):
        client.force_login(admin_a)
        create_response = client.post(
            reverse("admin-ai-models"),
            data={
                "vendor": "gemini",
                "model_slug": "gemini-api-test",
                "display_label": "Gemini API test",
                "task_kinds": ["agent_2d"],
                "agentic_supported": True,
            },
            content_type="application/json",
        )
        assert create_response.status_code == 201
        model_id = create_response.json()["id"]

        list_response = client.get(reverse("admin-ai-models"))
        assert list_response.status_code == 200
        assert any(row["id"] == model_id for row in list_response.json())

        patch_response = client.patch(
            reverse("admin-ai-model-detail", args=[model_id]),
            data={"revision": 1, "display_label": "Renamed"},
            content_type="application/json",
        )
        assert patch_response.status_code == 200
        assert patch_response.json()["display_label"] == "Renamed"
        assert patch_response.json()["revision"] == 2

        delete_response = client.delete(
            reverse("admin-ai-model-detail", args=[model_id]),
            data={"revision": 2},
            content_type="application/json",
        )
        assert delete_response.status_code == 204
        assert not AIProviderModel.objects.filter(pk=model_id).exists()

    def test_unknown_field_rejected(self, client, admin_a):
        client.force_login(admin_a)
        response = client.post(
            reverse("admin-ai-models"),
            data={
                "vendor": "gemini",
                "model_slug": "x",
                "display_label": "X",
                "task_kinds": ["one_shot_2d"],
                "not_a_field": True,
            },
            content_type="application/json",
        )
        assert response.status_code == 400
        assert response.json()["error"] == "unknown_fields"

    def test_stale_patch_revision_is_409(self, client, admin_a):
        client.force_login(admin_a)
        create_response = client.post(
            reverse("admin-ai-models"),
            data={
                "vendor": "gemini",
                "model_slug": "gemini-stale-test",
                "display_label": "X",
                "task_kinds": ["one_shot_2d"],
            },
            content_type="application/json",
        )
        model_id = create_response.json()["id"]
        response = client.patch(
            reverse("admin-ai-model-detail", args=[model_id]),
            data={"revision": 999, "display_label": "Y"},
            content_type="application/json",
        )
        assert response.status_code == 409


# --- start_run gate ---


@pytest.mark.django_db
class TestAgentRunGate:
    def test_start_run_rejects_model_with_no_catalog_entry(self, user_b):
        project = Project.objects.create(owner=user_b)
        with pytest.raises(ai_runs.AgenticNotSupported):
            ai_runs.start_run(
                owner=user_b,
                target_type="project",
                target=project,
                operation="create",
                prompt="Draw a circle",
                vendor="mistral",
                model_id="never-configured-for-agents",
            )

    def test_start_run_allows_seeded_default_model(self, user_b):
        project = Project.objects.create(owner=user_b, title="Gate allow test")
        run = ai_runs.start_run(
            owner=user_b,
            target_type="project",
            target=project,
            operation="create",
            prompt="Draw a circle",
            vendor="mistral",
            model_id="mistral-small-latest",
        )
        assert run.vendor == "mistral"

    def test_start_run_rejects_agentic_disabled_catalog_entry(self, admin_a, user_b):
        ai_catalog.create_model(
            actor=admin_a,
            vendor="gemini",
            model_slug="gemini-one-shot-only-test",
            display_label="One-shot only",
            task_kinds=["one_shot_2d"],
            agentic_supported=False,
        )
        project = Project.objects.create(owner=user_b, title="Gate disabled test")
        with pytest.raises(ai_runs.AgenticNotSupported):
            ai_runs.start_run(
                owner=user_b,
                target_type="project",
                target=project,
                operation="create",
                prompt="Draw a circle",
                vendor="gemini",
                model_id="gemini-one-shot-only-test",
            )
