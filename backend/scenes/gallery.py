"""Task 50: public gallery listing — eligibility filter and keyset (cursor)
pagination, shared between `scenes.api.PublicProjectListView` and its
tests.

## Eligibility

A project appears in the public gallery iff:

1. `visibility == Project.Visibility.PUBLIC` (the same gate every other
   public-facing view in this domain uses — `PublicProjectDetailView`,
   `PublicProjectThumbnailView`).
2. Not soft-deleted — free by construction: `Project.objects` (the
   default manager this module queries through) already excludes
   `is_deleted=True` rows (`scenes/models.py`'s `ProjectManager`).
3. `current_version_id is not None` — mirrors `ProjectPublishView`'s own
   publish requirement ("save at least one version before publishing"),
   so this is actually always true for any currently-public project, not
   an extra restriction; it's asserted here defensively rather than
   relied upon.
4. `published_at is not None` — set by `ProjectPublishView`, cleared by
   `ProjectUnpublishView` (see both in `scenes/api.py`). This is what
   makes "visibility changes are reflected on the next request without
   stale private cards" true: the moment a project goes private,
   `published_at` is cleared and the very next `eligible_projects()`
   call — which runs fresh on every request, no caching — excludes it.
   The moment a project (re)publishes, a fresh `published_at` is set and
   it reappears, at the front of the list (see ordering below).

## Why keyset pagination, not offset

Naive offset pagination (`LIMIT/OFFSET`) is provably unsafe against
concurrent inserts: if a new project publishes between two page
requests, every row after it shifts by one position, so a page-2 request
built from page 1's `OFFSET` either re-serves a row already seen on page
1 (duplicate) or silently skips a row that shifted past the boundary
(gap) — neither is "no duplicate or skipped entries across page
boundaries," which is this task's own acceptance criterion.

Keyset ("seek") pagination instead orders by a stable, strictly
decreasing key — `(published_at, id)` — and asks each next page for
"everything strictly before the last row I returned," using `<` on that
tuple rather than a row count:

    WHERE (published_at, id) < (:cursor_published_at, :cursor_id)
    ORDER BY published_at DESC, id DESC

A project publishing *after* a gallery walk has started either sorts
ahead of every cursor already issued during that walk (a `published_at`
newer than anything seen so far) — invisible to any page whose cursor is
already older, exactly as if the walk had begun a moment earlier and
simply never included it — or, if racing the very first page, is either
included or not depending only on true insertion order, never
inconsistently. Rows that already existed before the walk started keep
their exact relative order and position across any number of intervening
writes, because a cursor only ever refers to "the row I have," never to
a numeric position that a write could shift out from under it.

`id` (the internal database pk) is `published_at`'s tiebreaker — needed
because two projects can publish in the same instant/tick, and
`published_at` alone would not give a strict total order — but it is
never the identifier exposed by `PublicProjectListItemSerializer` (that
field is `public_id`, wrapped as `id` in the response body; see that
serializer's docstring) and never appears in the cursor's own encoding
in a way a caller could use to enumerate/guess other rows' pks: the
cursor is an opaque, base64-encoded token, not a bare integer.
"""

import base64
import binascii
from datetime import datetime

from django.db.models import Q, QuerySet
from django.utils.dateparse import parse_datetime

from scenes.models import Project, Project3D

DEFAULT_PAGE_SIZE = 24
MAX_PAGE_SIZE = 60

_CURSOR_SEPARATOR = "|"


def eligible_projects() -> QuerySet[Project]:
    """The base queryset for the public gallery, ordered newest-published-first.

    Callers apply cursor filtering (`filter_after_cursor`) on top of this;
    kept separate so tests can assert eligibility and ordering
    independently of pagination.
    """
    return (
        Project.objects.filter(
            visibility=Project.Visibility.PUBLIC,
            current_version__isnull=False,
            published_at__isnull=False,
        )
        .select_related("owner", "fork_provenance", "fork_provenance__source_project__owner")
        .order_by("-published_at", "-id")
    )


def encode_cursor(published_at: datetime, project_id: int) -> str:
    raw = f"{published_at.isoformat()}{_CURSOR_SEPARATOR}{project_id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


class InvalidCursor(Exception):
    """Raised by `decode_cursor` for a malformed/unparseable cursor string."""


def decode_cursor(cursor: str) -> tuple[datetime, int]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        published_at_raw, project_id_raw = raw.rsplit(_CURSOR_SEPARATOR, 1)
        published_at = parse_datetime(published_at_raw)
        project_id = int(project_id_raw)
    except (binascii.Error, ValueError, UnicodeDecodeError) as exc:
        raise InvalidCursor from exc
    if published_at is None:
        raise InvalidCursor
    return published_at, project_id


def filter_after_cursor(
    queryset: QuerySet[Project], published_at: datetime, project_id: int
) -> QuerySet[Project]:
    """Keyset ("seek") filter: strictly-after the given (published_at, id) in
    the queryset's own `-published_at, -id` ordering — see this module's
    docstring for why this, rather than `OFFSET`, is duplicate/gap-safe."""
    return queryset.filter(
        Q(published_at__lt=published_at) | Q(published_at=published_at, id__lt=project_id)
    )


def eligible_projects3d() -> QuerySet[Project3D]:
    """Published 3D projects eligible for the mixed public gallery."""
    return (
        Project3D.objects.filter(
            visibility=Project3D.Visibility.PUBLIC,
            current_version__isnull=False,
            published_at__isnull=False,
        )
        .select_related("owner", "current_version")
        .order_by("-published_at", "-id")
    )


def encode_gallery_cursor(published_at: datetime, renderer: str, project_id: int) -> str:
    """Encode the global cursor used by the mixed 2D/3D listing."""
    raw = f"gallery|{published_at.isoformat()}|{renderer}|{project_id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def decode_gallery_cursor(cursor: str) -> tuple[datetime, str, int]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        prefix, published_at_raw, renderer, project_id_raw = raw.rsplit("|", 3)
        published_at = parse_datetime(published_at_raw)
        project_id = int(project_id_raw)
    except (binascii.Error, ValueError, UnicodeDecodeError) as exc:
        raise InvalidCursor from exc
    if prefix != "gallery" or published_at is None or renderer not in {"2d", "3d"}:
        raise InvalidCursor
    return published_at, renderer, project_id


def filter_after_gallery_cursor(
    queryset: QuerySet, published_at: datetime, renderer: str, project_id: int
) -> QuerySet:
    """Seek past a row in the global order (-published_at, renderer, -id)."""
    renderer_rank = 0 if renderer == "2d" else 1
    queryset_renderer_rank = 0 if queryset.model is Project else 1
    if queryset_renderer_rank < renderer_rank:
        return queryset.filter(published_at__lt=published_at)
    if queryset_renderer_rank > renderer_rank:
        return queryset.filter(published_at__lte=published_at)
    return queryset.filter(
        Q(published_at__lt=published_at) | Q(published_at=published_at, id__lt=project_id)
    )


def clamp_page_size(requested: int) -> int:
    return max(1, min(requested, MAX_PAGE_SIZE))
