"""Tests for the disposable reference-piece import bridge (#612)."""

from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from scenes.management.commands.import_reference_pieces import IMPORT_NAME
from scenes.models import ArtPiece, ArtPieceThumbnail, ArtPieceVersion, PublicProfile


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_reference_import_is_idempotent_owner_scoped_and_reversible():
    call_command(
        "import_reference_pieces",
        "import",
        "--username",
        "reference_owner",
        "--handle",
        "reference-owner",
        "--json",
    )
    User = get_user_model()
    owner = User.objects.get(username="reference_owner")
    first = list(
        ArtPiece.objects.filter(owner=owner).values_list("public_id", "public_slug", "engine")
    )
    assert len(first) == 6
    assert {engine for _public_id, _slug, engine in first} == {
        "svg",
        "p5js",
        "c2js",
        "c2js-interactive",
        "threejs",
        "aframe",
    }
    assert PublicProfile.objects.get(user=owner).handle == "reference-owner"
    assert all(
        piece.current_version.generation_metadata["reference_import"]["import_name"] == IMPORT_NAME
        for piece in ArtPiece.objects.filter(owner=owner)
    )
    assert all(
        piece.current_version.capabilities.get("immersive") is True
        and piece.current_version.capabilities.get("download") is True
        for piece in ArtPiece.objects.filter(owner=owner)
    )
    assert all(
        piece.current_version.thumbnail.is_fallback is False
        and bytes(piece.current_version.thumbnail.image_data).startswith(b"\x89PNG\r\n\x1a\n")
        for piece in ArtPiece.objects.filter(owner=owner)
    )
    first_thumbnails = {
        piece.public_slug: bytes(piece.current_version.thumbnail.image_data)
        for piece in ArtPiece.objects.filter(owner=owner)
    }

    call_command(
        "import_reference_pieces",
        "import",
        "--username",
        "reference_owner",
        "--handle",
        "reference-owner",
        "--json",
    )
    second = list(
        ArtPiece.objects.filter(owner=owner).values_list("public_id", "public_slug", "engine")
    )
    assert second == first
    assert ArtPieceThumbnail.objects.filter(version__piece__owner=owner).count() == 6
    assert {
        piece.public_slug: bytes(piece.current_version.thumbnail.image_data)
        for piece in ArtPiece.objects.filter(owner=owner)
    } == first_thumbnails

    call_command(
        "import_reference_pieces",
        "cleanup",
        "--username",
        "reference_owner",
        "--handle",
        "reference-owner",
        "--json",
    )
    assert not ArtPiece.objects.filter(owner=owner).exists()
    assert PublicProfile.objects.filter(user=owner).exists()


@pytest.mark.django_db
@override_settings(DEBUG=False)
def test_reference_import_refuses_non_debug_databases():
    with pytest.raises(CommandError, match="--allow-production"):
        call_command("import_reference_pieces", "import")


@pytest.mark.django_db
@override_settings(DEBUG=False)
def test_production_import_requires_explicit_opt_in():
    with pytest.raises(CommandError, match="--allow-production"):
        call_command("import_reference_pieces", "import")


@pytest.mark.django_db
@override_settings(DEBUG=False)
def test_production_dry_run_resolves_existing_owner_without_writing():
    User = get_user_model()
    owner = User.objects.create_user(
        username="christopher1", email="cfornesa@outlook.com", password="unused"
    )
    PublicProfile.objects.create(user=owner, handle="cfornesa", is_public=True)
    output = StringIO()

    call_command(
        "import_reference_pieces",
        "import",
        "--allow-production",
        "--dry-run",
        "--username",
        "christopher1",
        "--email",
        "cfornesa@outlook.com",
        "--handle",
        "cfornesa",
        "--json",
        stdout=output,
    )

    assert '"dry_run": true' in output.getvalue()
    assert '"no_write": true' in output.getvalue()
    assert '"planned_fixture_count": 6' in output.getvalue()
    assert not ArtPiece.objects.filter(owner=owner).exists()


@pytest.mark.django_db
@override_settings(DEBUG=False)
def test_production_import_is_existing_owner_scoped_and_idempotent():
    User = get_user_model()
    owner = User.objects.create_user(
        username="christopher1", email="cfornesa@outlook.com", password="unused"
    )
    PublicProfile.objects.create(user=owner, handle="cfornesa", is_public=True)

    kwargs = {
        "username": "christopher1",
        "email": "cfornesa@outlook.com",
        "handle": "cfornesa",
        "allow_production": True,
    }
    call_command("import_reference_pieces", "import", **kwargs)
    first = list(
        ArtPiece.objects.filter(owner=owner).values_list("public_id", "public_slug", "engine")
    )
    assert len(first) == 6

    call_command("import_reference_pieces", "import", **kwargs)
    second = list(
        ArtPiece.objects.filter(owner=owner).values_list("public_id", "public_slug", "engine")
    )
    assert second == first
    assert PublicProfile.objects.filter(handle="cfornesa").count() == 1


@pytest.mark.django_db
@override_settings(DEBUG=False)
def test_production_import_reconciles_changed_source_without_mutating_history():
    User = get_user_model()
    owner = User.objects.create_user(
        username="christopher1", email="cfornesa@outlook.com", password="unused"
    )
    PublicProfile.objects.create(user=owner, handle="cfornesa", is_public=True)
    kwargs = {
        "username": "christopher1",
        "email": "cfornesa@outlook.com",
        "handle": "cfornesa",
        "allow_production": True,
    }

    call_command("import_reference_pieces", "import", **kwargs)
    piece = ArtPiece.objects.get(owner=owner, public_slug="reference-c2-study")
    original_public_id = piece.public_id
    original_version = piece.current_version
    original_source = original_version.source
    ArtPieceVersion.objects.filter(pk=original_version.pk).update(
        source="legacy fixed-coordinate source"
    )

    call_command("import_reference_pieces", "import", **kwargs)

    piece.refresh_from_db()
    current = piece.current_version
    assert current.sequence == original_version.sequence + 1
    assert current.source == original_source
    assert piece.public_id == original_public_id
    assert piece.public_slug == "reference-c2-study"
    assert ArtPiece.objects.get(pk=piece.pk).versions.count() == 2
    assert piece.versions.get(sequence=1).source == "legacy fixed-coordinate source"


@pytest.mark.django_db
@override_settings(DEBUG=False)
def test_production_dry_run_reports_changed_source_update_without_writing():
    User = get_user_model()
    owner = User.objects.create_user(
        username="christopher1", email="cfornesa@outlook.com", password="unused"
    )
    PublicProfile.objects.create(user=owner, handle="cfornesa", is_public=True)
    kwargs = {
        "username": "christopher1",
        "email": "cfornesa@outlook.com",
        "handle": "cfornesa",
        "allow_production": True,
    }
    call_command("import_reference_pieces", "import", **kwargs)
    piece = ArtPiece.objects.get(owner=owner, public_slug="reference-c2-study")
    ArtPieceVersion.objects.filter(pk=piece.current_version_id).update(
        source="legacy fixed-coordinate source"
    )
    output = StringIO()

    call_command("import_reference_pieces", "import", "--dry-run", stdout=output, **kwargs)

    assert '"would_update"' in output.getvalue()
    assert '"source_id": "legacy-c2-default"' in output.getvalue()
    assert '"current_sequence": 1' in output.getvalue()
    assert '"next_sequence": 2' in output.getvalue()
    piece.refresh_from_db()
    assert piece.current_version.sequence == 1
    assert piece.current_version.source == "legacy fixed-coordinate source"


@pytest.mark.django_db
@override_settings(DEBUG=False)
def test_production_import_reports_slug_conflict_and_keeps_existing_owner():
    User = get_user_model()
    owner = User.objects.create_user(
        username="christopher1", email="cfornesa@outlook.com", password="unused"
    )
    PublicProfile.objects.create(user=owner, handle="cfornesa", is_public=True)
    ArtPiece.objects.create(owner=owner, title="Existing", public_slug="reference-svg-study")

    output = StringIO()
    call_command(
        "import_reference_pieces",
        "import",
        "--allow-production",
        "--dry-run",
        "--username",
        "christopher1",
        "--handle",
        "cfornesa",
        "--json",
        stdout=output,
    )

    assert "reference-svg-study" in output.getvalue()
    assert ArtPiece.objects.filter(owner=owner).count() == 1


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_reference_import_leaves_non_reference_piece_untouched():
    User = get_user_model()
    owner = User.objects.create_user(username="reference_owner")
    unrelated = ArtPiece.objects.create(
        owner=owner,
        title="Unrelated",
        prompt="unrelated",
        engine="svg",
        public_slug="unrelated",
    )

    call_command(
        "import_reference_pieces",
        "import",
        "--username",
        "reference_owner",
        "--handle",
        "reference-owner",
    )

    unrelated.refresh_from_db()
    assert ArtPiece.objects.filter(owner=owner).count() == 7
    assert unrelated.title == "Unrelated"
    assert unrelated.current_version_id is None
