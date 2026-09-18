"""Stable title-derived public slugs for canonical piece URLs (#578)."""

from django.db import IntegrityError, transaction
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.utils.text import slugify

from scenes.models import ArtPiece, Project, Project3D

# Issue #596: bounded retry count for the public_slug save race below.
MAX_PUBLIC_SLUG_SAVE_ATTEMPTS = 5

# Postgres' IntegrityError names the violated constraint directly (each of
# which contains "public_slug"); SQLite (the offline test suite's backend)
# instead names the column pair, e.g. "UNIQUE constraint failed:
# scenes_artpiece.owner_id, scenes_artpiece.public_slug" -- no constraint
# name at all. Matching the substring "public_slug" is the one check that's
# portable across both message formats.
_PUBLIC_SLUG_ERROR_MARKER = "public_slug"


def normalize_public_slug(value: str) -> str:
    """Return the stable user-facing slug form used by canonical routes."""

    return slugify(value)[:220]


def _next_slug(model, instance) -> str:
    base = normalize_public_slug(instance.title)[:200] or "piece"
    candidate = base
    suffix = 2
    while (
        model.objects.filter(owner=instance.owner, public_slug=candidate)
        .exclude(pk=instance.pk)
        .exists()
    ):
        candidate = f"{base[: 220 - len(str(suffix)) - 1]}-{suffix}"
        suffix += 1
    return candidate


@receiver(pre_save, sender=Project)
@receiver(pre_save, sender=Project3D)
@receiver(pre_save, sender=ArtPiece)
def assign_public_slug(sender, instance, **kwargs):
    if not instance.public_slug:
        instance.public_slug = _next_slug(sender, instance)


def save_with_public_slug_retry(instance, save_fn, *args, **kwargs):
    """Retry a canonical-piece save on a `public_slug` uniqueness race (#596).

    `assign_public_slug`'s `pre_save` handler assigns an auto-generated slug
    by checking existence and then returning a candidate for the caller's
    `INSERT`/`UPDATE` to use -- a check-then-write race. Two near-simultaneous
    saves for the same owner and title can both observe the same free slug
    and both attempt the same insert; the loser hits
    `unique_..._public_slug_per_owner` as an `IntegrityError` instead of
    succeeding with the next available slug.

    Retrying is only safe when the slug was auto-assigned (never for a
    caller-supplied slug, which must fail loudly instead of silently
    changing). Each retry re-checks existence via `_next_slug`, so it
    naturally sees the winner's now-committed row and advances past it.
    """
    auto_assigned = not instance.public_slug
    attempts = 0
    while True:
        try:
            with transaction.atomic():
                save_fn(*args, **kwargs)
            return
        except IntegrityError as exc:
            attempts += 1
            hit_slug_constraint = _PUBLIC_SLUG_ERROR_MARKER in str(exc)
            if not (auto_assigned and hit_slug_constraint):
                raise
            if attempts >= MAX_PUBLIC_SLUG_SAVE_ATTEMPTS:
                raise
            instance.public_slug = _next_slug(type(instance), instance)
