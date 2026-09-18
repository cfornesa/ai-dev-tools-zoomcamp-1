"""Tests for the disposable reference-piece import bridge (#612)."""

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
    with pytest.raises(CommandError, match="DEBUG/disposable"):
        call_command("import_reference_pieces", "import")
