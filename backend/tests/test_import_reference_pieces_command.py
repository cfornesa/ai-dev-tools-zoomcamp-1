"""Tests for the disposable reference-piece import bridge (#612)."""

from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from scenes.management.commands.import_reference_pieces import IMPORT_NAME
from scenes.models import ArtPiece, PublicProfile


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
