"""Task 54: thumbnail storage, generation trigger, and the regeneration/
invalidation policy.

`scenes/thumbnails.py` only knows how to turn a scene document into PNG
bytes; it has no idea about `Project`/`SceneVersion`, transactions, or
when generation should happen. This module is the seam between the two.

## Decoupled from the version-creation transaction (documented choice)

Every place a project's `current_version` changes
(`SceneVersionListCreateView.post`, `SceneVersionRestoreView.post`,
`AIAcceptProposalView.post`, `ProjectPublishView.post`) does so inside its
own `select_for_update()`-locked `transaction.atomic()` block, matching
the rest of this codebase's "one save is one transaction" pattern (see
`scenes/models.py`'s module docstring and each of those views' own
docstrings). Rendering a thumbnail is comparatively slow (image
composition, PNG encoding) and entirely unrelated to what that lock is
protecting (sequence-number/current_version race safety) -- running it
*inside* that lock would hold the project row locked for longer than
necessary and couple two unrelated concerns for no correctness benefit.

Instead, `maybe_schedule_thumbnail_generation(project)` is called from
inside the same request right after the version-advancing block, but the
actual generation work is registered with `transaction.on_commit(...)` --
Django guarantees this only runs after the enclosing transaction commits
successfully, so a request that rolls back (a rejected stale-base accept,
a validation failure, a concurrent soft-delete) never triggers generation
for a version that was never actually saved, but a genuinely committed
save still gets its thumbnail scheduled as a synchronous follow-up step
within the same request/response cycle -- not queued to a separate
worker, since `docs/plan.md`'s "Background work: use an async worker
only where needed for thumbnails..." explicitly anticipates this could
become a background job later without saying it must be one for V1, and
no task queue exists anywhere in this project yet.

## Regeneration/invalidation policy (explicit, per the acceptance criteria)

- A `Thumbnail` is keyed uniquely by `scene_version` (one row per
  version, `SceneVersion.thumbnail` OneToOne). Because `SceneVersion`
  snapshots are immutable (`scenes/models.py`'s own invariant, enforced by
  a PostgreSQL trigger), a version's thumbnail never needs to be
  invalidated by content changing out from under it -- there is nothing
  to invalidate.
- **Visibility change (private -> public):** publishing schedules
  thumbnail generation for the project's current version, if it doesn't
  already have one. Going public never regenerates an *existing*
  thumbnail for the same version (nothing to regenerate -- the version
  hasn't changed).
- **Visibility change (public -> private):** no thumbnail rows are
  deleted or touched. `Thumbnail` rows are cheap, immutable-scene-derived
  artifacts, not private data themselves (they contain only what the
  scene's own shapes render as, per `scenes/thumbnails.py`'s "artwork
  only" guarantee) -- keeping them around means republishing the same
  version is instant. What *does* change is servability:
  `PublicProjectThumbnailView` (`scenes/api.py`) re-checks
  `project.visibility == PUBLIC` on every request, exactly like
  `PublicProjectDetailView` -- the instant a project goes private, its
  thumbnail (regardless of whether a row exists) stops being reachable
  through any public-facing URL, matching this project's existing
  publish/unpublish gating convention.
- **New version saved while public (manual save, AI-accept, restore):**
  matches Task 49's own "resolve `current_version` fresh, no snapshot
  pinning" philosophy (see `ProjectPublishView`'s docstring) -- the
  thumbnail follows the current version, not the version that was current
  at publish time. Every one of those endpoints calls
  `maybe_schedule_thumbnail_generation` after advancing
  `current_version`, so a public project's thumbnail always reflects
  whatever `current_version` is *right now*, the same way
  `PublicProjectDetailView` always reflects whatever `current_version` is
  right now.
- **New version saved while private:** `maybe_schedule_thumbnail_generation`
  checks `project.visibility == PUBLIC` before scheduling anything, so
  nothing is generated. This is also the content-source-boundary
  guarantee: a private project's scene is never rendered via any
  public-facing trigger, because every trigger site is gated on
  `visibility == PUBLIC` before it does anything.
- **Lazy fallback at serve time:** if a public project's current version
  somehow has no `Thumbnail` row yet (e.g. a request lands in the small
  window before `transaction.on_commit`'s callback has run, or an older
  version created before this feature existed), `PublicProjectThumbnailView`
  generates one synchronously on that request rather than 404ing or
  serving nothing -- see that view's docstring.

## Idempotent retries, no duplicate records (acceptance criterion 4)

`ensure_thumbnail_for_version` always resolves through
`Thumbnail.objects.update_or_create(scene_version=version, ...)`, keyed
on `scene_version`'s DB-level `OneToOneField` uniqueness. Calling it
twice for the same version -- whether both calls see rendering succeed,
both see it fail, or one of each -- always leaves exactly one row: a
second call updates the first row's `image_data`/`is_fallback` in place.
A failed render's fallback row is exactly this: a real row (never a
missing/half-written one), explicitly marked `is_fallback=True`, that a
later retry (another call to `ensure_thumbnail_for_version` for the same
version, e.g. from a management command or the lazy serve-time path
above) can replace with a successful render without ever creating a
second row for that version.
"""

from __future__ import annotations

from django.db import transaction

from scenes.models import Project, SceneVersion, Thumbnail
from scenes.thumbnails import (
    CARD_HEIGHT,
    CARD_WIDTH,
    FALLBACK_PNG_BYTES,
    ThumbnailRenderError,
    render_card_thumbnail_png,
)


def ensure_thumbnail_for_version(scene_version_id: int) -> Thumbnail | None:
    """Generates (or re-renders, if the stored row is a fallback) and stores
    the thumbnail for one `SceneVersion`, idempotently.

    Returns `None` only if the version no longer exists (e.g. deleted
    between scheduling and running -- soft-delete never removes the row,
    but nothing stops a test or a future hard-delete path from doing so).
    Never raises: a render failure is caught here and stored as the
    documented safe fallback (`scenes.thumbnails.FALLBACK_PNG_BYTES`)
    instead of propagating, so a caller running this from
    `transaction.on_commit` never turns a successful save into a crashed
    background callback.
    """
    try:
        version = SceneVersion.objects.get(pk=scene_version_id)
    except SceneVersion.DoesNotExist:
        return None

    try:
        image_data = render_card_thumbnail_png(version.scene_json)
        is_fallback = False
    except ThumbnailRenderError:
        image_data = FALLBACK_PNG_BYTES
        is_fallback = True

    thumbnail, _created = Thumbnail.objects.update_or_create(
        scene_version=version,
        defaults={
            "image_data": image_data,
            "content_type": "image/png",
            "width": CARD_WIDTH,
            "height": CARD_HEIGHT,
            "is_fallback": is_fallback,
        },
    )
    return thumbnail


def maybe_schedule_thumbnail_generation(project: Project) -> None:
    """Call this after `project.current_version` changes (or after
    publishing). Schedules `ensure_thumbnail_for_version` for the current
    version as a post-commit follow-up, but only when `project` is
    public and a matching, non-fallback thumbnail doesn't already exist --
    see the module docstring's regeneration/invalidation policy.

    Safe to call unconditionally from every version-advancing endpoint
    (including ones that only ever create private projects, like
    `BlankProjectCreateView`/`TemplateCloneView`): a private project's
    call is a no-op, checked before anything else runs.
    """
    if project.visibility != Project.Visibility.PUBLIC:
        return
    version_id = project.current_version_id
    if version_id is None:
        return
    if Thumbnail.objects.filter(scene_version_id=version_id, is_fallback=False).exists():
        return

    def _run() -> None:
        ensure_thumbnail_for_version(version_id)

    transaction.on_commit(_run)
