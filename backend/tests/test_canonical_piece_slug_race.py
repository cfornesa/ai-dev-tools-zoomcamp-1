"""Regression coverage for the public_slug save race fix (#596)."""

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

from scenes import canonical_piece_signals
from scenes.models import ArtPiece


@pytest.mark.django_db
def test_public_slug_save_retries_past_a_uniqueness_race(monkeypatch):
    """Two near-simultaneous auto-assigned saves must not 500.

    Simulates the race by forcing the first slug-generation attempt to
    return an already-taken candidate (as if a concurrent save had just
    committed it), then letting the retry recompute for real.
    """
    user = get_user_model().objects.create_user(username="racer")
    ArtPiece.objects.create(
        owner=user, title="Racing Piece", prompt="p", engine=ArtPiece.Engine.SVG
    )

    real_next_slug = canonical_piece_signals._next_slug
    calls = {"count": 0}

    def flaky_next_slug(model, instance):
        calls["count"] += 1
        if calls["count"] == 1:
            return "racing-piece"  # already taken -- forces the collision
        return real_next_slug(model, instance)

    monkeypatch.setattr(canonical_piece_signals, "_next_slug", flaky_next_slug)

    second = ArtPiece.objects.create(
        owner=user, title="Racing Piece", prompt="p", engine=ArtPiece.Engine.SVG
    )

    assert second.public_slug == "racing-piece-2"
    assert calls["count"] == 2


@pytest.mark.django_db
def test_public_slug_retry_gives_up_after_max_attempts():
    user = get_user_model().objects.create_user(username="giveup")
    piece = ArtPiece(owner=user, title="Giveup Piece", prompt="p", engine=ArtPiece.Engine.SVG)
    piece.public_slug = ""

    def always_fail(*args, **kwargs):
        raise IntegrityError(
            'duplicate key value violates unique constraint "unique_artpiece_public_slug_per_owner"'
        )

    with pytest.raises(IntegrityError):
        canonical_piece_signals.save_with_public_slug_retry(piece, always_fail)


@pytest.mark.django_db
def test_public_slug_retry_never_changes_a_caller_supplied_slug():
    user = get_user_model().objects.create_user(username="explicit")
    piece = ArtPiece(owner=user, title="Explicit Piece", prompt="p", engine=ArtPiece.Engine.SVG)
    piece.public_slug = "my-custom-slug"

    def fail_once(*args, **kwargs):
        raise IntegrityError(
            'duplicate key value violates unique constraint "unique_artpiece_public_slug_per_owner"'
        )

    with pytest.raises(IntegrityError):
        canonical_piece_signals.save_with_public_slug_retry(piece, fail_once)
    assert piece.public_slug == "my-custom-slug"


@pytest.mark.django_db
def test_public_slug_retry_reraises_unrelated_integrity_errors():
    user = get_user_model().objects.create_user(username="unrelated")
    piece = ArtPiece(owner=user, title="Unrelated Piece", prompt="p", engine=ArtPiece.Engine.SVG)
    piece.public_slug = ""

    def fail_unrelated(*args, **kwargs):
        raise IntegrityError(
            'duplicate key value violates unique constraint "some_other_constraint"'
        )

    with pytest.raises(IntegrityError):
        canonical_piece_signals.save_with_public_slug_retry(piece, fail_unrelated)
