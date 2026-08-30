"""Issue #243: the 3D counterpart of `scenes/thumbnail_generation.py` --
same seam, same `transaction.on_commit` scheduling discipline, same
idempotent-retry/never-raises contract. Read that module's docstring
first; only the differences are documented here.

## Unconditional generation (the one deliberate difference)

`maybe_schedule_thumbnail_generation` (2D) only schedules generation for
*public* projects, because a private project's scene must never be
rendered through any trigger (`Project.visibility` gates it). `Project3D`
has no `visibility` field at all yet (#212 deferred it, noted again in
#243's own scope discussion) -- there is no public/private distinction to
gate on, and the only place a 3D thumbnail is ever served is the
owner-gated `Project3DThumbnailView` (mirroring `ProjectThumbnailView`,
never a public-facing route). So `maybe_schedule_thumbnail_generation3d`
below schedules generation for every version save unconditionally. If a
later issue adds `Project3D.visibility` and a public-facing 3D route,
that route should gate on it the same way `PublicProjectThumbnailView`
does -- this function's unconditional scheduling would then need the same
`visibility == PUBLIC` guard 2D already has.
"""

from __future__ import annotations

from django.db import transaction

from scenes.models import Project3D, SceneVersion3D, Thumbnail3D
from scenes.thumbnails import CARD_HEIGHT, CARD_WIDTH, FALLBACK_PNG_BYTES
from scenes.thumbnails3d import Thumbnail3DRenderError, render_card_thumbnail3d_png


def ensure_thumbnail_for_version3d(scene_version_id: int) -> Thumbnail3D | None:
    """Generates (or re-renders, if the stored row is a fallback) and
    stores the thumbnail for one `SceneVersion3D`, idempotently. Mirrors
    `ensure_thumbnail_for_version`'s contract exactly -- see that
    function's docstring."""
    try:
        version = SceneVersion3D.objects.get(pk=scene_version_id)
    except SceneVersion3D.DoesNotExist:
        return None

    try:
        image_data = render_card_thumbnail3d_png(version.scene_json)
        is_fallback = False
    except Thumbnail3DRenderError:
        image_data = FALLBACK_PNG_BYTES
        is_fallback = True

    thumbnail, _created = Thumbnail3D.objects.update_or_create(
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


def maybe_schedule_thumbnail_generation3d(project: Project3D) -> None:
    """Call this after `project.current_version` changes. Schedules
    `ensure_thumbnail_for_version3d` for the current version as a
    post-commit follow-up, unless a matching non-fallback thumbnail
    already exists -- see the module docstring for why this has no
    visibility gate, unlike the 2D version."""
    version_id = project.current_version_id
    if version_id is None:
        return
    if Thumbnail3D.objects.filter(scene_version_id=version_id, is_fallback=False).exists():
        return

    def _run() -> None:
        ensure_thumbnail_for_version3d(version_id)

    transaction.on_commit(_run)
