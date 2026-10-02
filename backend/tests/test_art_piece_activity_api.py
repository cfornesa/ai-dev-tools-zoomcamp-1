"""Owner-only generated ArtPiece lifecycle history for issue #1157."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import IntegrityError, close_old_connections, connections, transaction
from rest_framework.test import APIClient

from scenes.models import ArtPiece, ArtPieceVersion, Project, Project3D, ProjectActivity
from tests._postgres_routing import close_thread_connections, route_default_to_postgres_test

SOURCE = '<svg><text>art-piece-private-source-marker</text></svg>'
ACTIVITY_URL = "/api/art-pieces/{}/activity/"
PG = "postgres_test"


@pytest.fixture
def activity_context(db):
    user_model = get_user_model()
    owner = user_model.objects.create_user(
        username="piece-history-owner", email="piece-history-email-marker@example.test"
    )
    outsider = user_model.objects.create_user(username="piece-history-outsider")
    piece = ArtPiece.objects.create(
        owner=owner,
        title="History piece",
        description="A meaningful piece.",
        prompt="art-piece-private-prompt-marker",
        engine=ArtPiece.Engine.SVG,
    )
    version = ArtPieceVersion.objects.create(piece=piece, sequence=1, source=SOURCE)
    piece.current_version = version
    piece.save(update_fields=["current_version"])
    owner_client = APIClient()
    owner_client.force_authenticate(owner)
    outsider_client = APIClient()
    outsider_client.force_authenticate(outsider)
    return {
        "owner": owner,
        "outsider": outsider,
        "piece": piece,
        "owner_client": owner_client,
        "outsider_client": outsider_client,
    }


def _activity_url(piece):
    return ACTIVITY_URL.format(piece.public_id)


@pytest.mark.django_db
def test_activity_is_owner_only_soft_delete_readable_and_family_cursor_bound(activity_context):
    data = activity_context
    piece = data["piece"]
    for sequence in range(3):
        ProjectActivity.objects.create(
            art_piece=piece,
            actor=data["owner"],
            action_type=ProjectActivity.ActionType.VERSION_SAVED,
            metadata={"sequence": sequence + 1, "origin": "manual"},
        )

    first = data["owner_client"].get(_activity_url(piece), {"limit": 2})
    assert first.status_code == 200
    assert [row["details"]["sequence"] for row in first.json()["results"]] == [3, 2]
    cursor = first.json()["next_cursor"]
    assert cursor
    second = data["owner_client"].get(_activity_url(piece), {"limit": 2, "cursor": cursor})
    assert [row["details"]["sequence"] for row in second.json()["results"]] == [1]

    two_d = Project.objects.create(owner=data["owner"], title="2D")
    three_d = Project3D.objects.create(owner=data["owner"], title="3D")
    for project in (two_d,):
        for sequence in range(2):
            ProjectActivity.objects.create(
                project=project,
                action_type=ProjectActivity.ActionType.VERSION_SAVED,
                metadata={"sequence": sequence + 1},
            )
    for sequence in range(2):
        ProjectActivity.objects.create(
            project3d=three_d,
            action_type=ProjectActivity.ActionType.VERSION_SAVED,
            metadata={"sequence": sequence + 1},
        )
    two_d_cursor = (
        data["owner_client"]
        .get(f"/api/projects/{two_d.public_id}/activity/", {"limit": 1})
        .json()["next_cursor"]
    )
    three_d_cursor = (
        data["owner_client"]
        .get(f"/api/projects3d/{three_d.public_id}/activity/", {"limit": 1})
        .json()["next_cursor"]
    )
    assert (
        data["owner_client"].get(_activity_url(piece), {"cursor": two_d_cursor}).status_code == 400
    )
    assert (
        data["owner_client"].get(_activity_url(piece), {"cursor": three_d_cursor}).status_code
        == 400
    )

    anonymous = APIClient().get(_activity_url(piece))
    foreign = data["outsider_client"].get(_activity_url(piece))
    missing = data["owner_client"].get(ACTIVITY_URL.format("00000000-0000-0000-0000-000000000000"))
    assert anonymous.status_code == foreign.status_code == missing.status_code == 404
    assert anonymous.json() == foreign.json() == missing.json()

    data["owner_client"].delete(f"/api/art-pieces/{piece.public_id}/")
    piece.refresh_from_db()
    assert piece.is_deleted
    assert data["owner_client"].get(_activity_url(piece)).status_code == 200


@pytest.mark.django_db
def test_explicit_version_saves_and_only_actual_publish_transitions_write_events(
    activity_context,
):
    data = activity_context
    piece = data["piece"]
    assert not ProjectActivity.objects.filter(art_piece=piece).exists()

    version_response = data["owner_client"].post(
        f"/api/art-pieces/{piece.public_id}/versions/", {"source": SOURCE}, format="json"
    )
    assert version_response.status_code == 201
    assert ProjectActivity.objects.filter(
        art_piece=piece,
        action_type=ProjectActivity.ActionType.VERSION_SAVED,
        metadata={"sequence": 2, "origin": "manual"},
    ).exists()

    detail_url = f"/api/art-pieces/{piece.public_id}/"
    assert (
        data["owner_client"].patch(detail_url, {"status": "published"}, format="json").status_code
        == 200
    )
    assert (
        data["owner_client"]
        .patch(detail_url, {"title": "Still published"}, format="json")
        .status_code
        == 200
    )
    assert (
        ProjectActivity.objects.filter(
            art_piece=piece, action_type=ProjectActivity.ActionType.PUBLISHED
        ).count()
        == 1
    )

    assert (
        data["owner_client"].patch(detail_url, {"status": "draft"}, format="json").status_code
        == 200
    )
    assert (
        data["owner_client"].patch(detail_url, {"status": "draft"}, format="json").status_code
        == 200
    )
    assert (
        data["owner_client"].patch(detail_url, {"status": "published"}, format="json").status_code
        == 200
    )
    events = list(ProjectActivity.objects.filter(art_piece=piece).order_by("id"))
    assert [event.action_type for event in events] == [
        ProjectActivity.ActionType.VERSION_SAVED,
        ProjectActivity.ActionType.PUBLISHED,
        ProjectActivity.ActionType.UNPUBLISHED,
        ProjectActivity.ActionType.PUBLISHED,
    ]
    assert events[1].metadata == {"sequence": 2}
    assert events[2].metadata == {}
    assert events[3].metadata == {"sequence": 2}


@pytest.mark.django_db
def test_prompt_and_source_markers_never_enter_activity_projection_or_export_entry(
    activity_context,
):
    from rest_framework.test import APIClient as AnonymousClient

    from scenes.account_export import build_account_export

    data = activity_context
    piece = data["piece"]
    event = ProjectActivity.objects.create(
        art_piece=piece,
        actor=data["owner"],
        action_type=ProjectActivity.ActionType.VERSION_SAVED,
        metadata={"sequence": 1, "origin": "manual"},
    )
    response = data["owner_client"].get(_activity_url(piece))
    exported_entry = build_account_export(data["owner"])["art_pieces"][0]
    activity_bytes = response.content + str(exported_entry["activity"]).encode()

    assert response.status_code == 200
    assert event.metadata == {"sequence": 1, "origin": "manual"}
    assert b"art-piece-private-prompt-marker" not in activity_bytes
    assert b"art-piece-private-source-marker" not in activity_bytes
    assert b"piece-history-email-marker" not in activity_bytes
    assert (
        data["owner_client"]
        .patch(f"/api/art-pieces/{piece.public_id}/", {"status": "published"}, format="json")
        .status_code
        == 200
    )
    public_response = AnonymousClient().get(f"/api/public/art-pieces/{piece.public_id}/")
    assert public_response.status_code == 200
    assert "activity" not in public_response.json()
    assert (
        AnonymousClient().get(f"/api/public/art-pieces/{piece.public_id}/activity/").status_code
        == 404
    )
    assert [row["id"] for row in exported_entry["activity"]] == [event.pk]


@pytest.mark.django_db
def test_projectactivity_constraint_requires_exactly_one_of_three_families(activity_context):
    data = activity_context
    two_d = Project.objects.create(owner=data["owner"], title="2D")
    three_d = Project3D.objects.create(owner=data["owner"], title="3D")
    kwargs = {"actor": data["owner"], "action_type": ProjectActivity.ActionType.VERSION_SAVED}
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ProjectActivity.objects.create(**kwargs)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ProjectActivity.objects.create(
                **kwargs, project=two_d, project3d=three_d, art_piece=data["piece"]
            )


@pytest.mark.skipif(
    PG not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping row-lock concurrency test.",
)
@pytest.mark.django_db(databases=["default", PG], transaction=True)
def test_concurrent_publish_requests_write_one_transition_event(django_db_blocker):
    with django_db_blocker.unblock():
        owner = (
            get_user_model()
            .objects.db_manager(PG)
            .create_user(username="piece-concurrent-publish-owner")
        )
        piece = ArtPiece.objects.using(PG).create(
            owner=owner,
            title="Concurrent publish",
            description="A meaningful piece.",
            prompt="private",
            engine=ArtPiece.Engine.SVG,
        )
        version = ArtPieceVersion.objects.using(PG).create(
            piece=piece, sequence=1, source="<svg></svg>"
        )
        piece.current_version = version
        piece.save(using=PG, update_fields=["current_version"])
    url = f"/api/art-pieces/{piece.public_id}/"

    def publish():
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(owner)
            return client.patch(url, {"status": "published"}, format="json").status_code
        finally:
            close_thread_connections()

    with route_default_to_postgres_test():
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(lambda _: publish(), range(2)))

    assert statuses == [200, 200]
    assert (
        ProjectActivity.objects.using(PG)
        .filter(art_piece_id=piece.pk, action_type=ProjectActivity.ActionType.PUBLISHED)
        .count()
        == 1
    )


@pytest.mark.django_db(transaction=True)
def test_three_family_migration_preserves_populated_rows_and_reverses_cleanly():
    """The migration replaces the live two-family constraint with a three-way check."""
    call_command("migrate", "scenes", "0112_projectactivity_project3d_and_more", verbosity=0)
    try:
        from django.db.migrations.executor import MigrationExecutor

        executor = MigrationExecutor(connection=connections["default"])
        historical = executor.loader.project_state(
            [("scenes", "0112_projectactivity_project3d_and_more")]
        ).apps
        owner = get_user_model().objects.create_user(username="piece-activity-migration-owner")
        project = historical.get_model("scenes", "Project").objects.create(
            owner_id=owner.pk, title="Existing 2D"
        )
        project3d = historical.get_model("scenes", "Project3D").objects.create(
            owner_id=owner.pk, title="Existing 3D"
        )
        piece = historical.get_model("scenes", "ArtPiece").objects.create(
            owner_id=owner.pk,
            title="Generated piece",
            description="Meaningful",
            prompt="private",
            engine="svg",
        )
        historical_activity = historical.get_model("scenes", "ProjectActivity")
        two_d_event = historical_activity.objects.create(
            project=project,
            action_type=ProjectActivity.ActionType.VERSION_SAVED,
            metadata={"sequence": 1},
        )
        three_d_event = historical_activity.objects.create(
            project3d=project3d,
            action_type=ProjectActivity.ActionType.VERSION_SAVED,
            metadata={"sequence": 1},
        )

        call_command("migrate", "scenes", verbosity=0)

        art_event = ProjectActivity.objects.create(
            art_piece_id=piece.pk,
            action_type=ProjectActivity.ActionType.PUBLISHED,
            metadata={"sequence": 1},
        )
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                ProjectActivity.objects.create(
                    action_type=ProjectActivity.ActionType.VERSION_SAVED,
                    metadata={"sequence": 2},
                )
        assert (
            ProjectActivity.objects.filter(
                pk__in=[two_d_event.pk, three_d_event.pk, art_event.pk]
            ).count()
            == 3
        )

        call_command("migrate", "scenes", "0112_projectactivity_project3d_and_more", verbosity=0)
        historical_after_reverse = (
            MigrationExecutor(connection=connections["default"])
            .loader.project_state([("scenes", "0112_projectactivity_project3d_and_more")])
            .apps
        )
        reversed_activity = historical_after_reverse.get_model("scenes", "ProjectActivity")
        assert (
            reversed_activity.objects.filter(pk__in=[two_d_event.pk, three_d_event.pk]).count() == 2
        )
        assert not reversed_activity.objects.filter(pk=art_event.pk).exists()
    finally:
        call_command("migrate", "scenes", verbosity=0)
