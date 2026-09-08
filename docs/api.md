# Public gallery API contract

This document is the canonical contract for the anonymous public gallery
listing API. It exists because the repository pre-write rule requires any
public API contract change to be documented **before** the product source
that implements it. Current contract owner: issue
[#491](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/491)
("Public gallery: unify authored and generated pieces with a visible type
filter").

## Endpoints at a glance

| Endpoint                             | Status                                                |
| ------------------------------------ | ----------------------------------------------------- |
| `GET /api/public/gallery/`           | **Canonical** unified listing (this document, #491).  |
| `GET /api/public/projects/`          | Legacy — frozen; unchanged response contract.         |
| `GET /api/public/art-pieces/`        | Legacy — frozen; unchanged response contract.         |
| `GET /art-pieces/gallery` (frontend) | Legacy route — redirect/shim to `/gallery?type=generated`. |

The two legacy API endpoints are **not** repurposed, extended, or removed by
the unified endpoint. Their existing response shapes (`results` keyset pages
for `/api/public/projects/`, an unpaginated list of public piece payloads for
`/api/public/art-pieces/`) remain stable for existing consumers; new gallery
work targets `/api/public/gallery/` only.

The legacy frontend route `/art-pieces/gallery` (currently
`PublicArtPieceGallery`) is also preserved: it must keep resolving, as a
backward-compatible redirect or shim rendering the unified gallery with its
type filter pre-set to **Generated** (`/gallery?type=generated`). The route is
never silently deleted.

## `GET /api/public/gallery/`

Anonymous-reachable paginated listing merging three kinds of published work:

- **2D** — published `Project` records (authored canonical-scene pieces),
  eligible under exactly the same gate `scenes.gallery.eligible_projects`
  applies for the legacy `/api/public/projects/` endpoint
  (`visibility == public`, not soft-deleted, has a current version, and
  `published_at is not null`).
- **3D** — published `Project3D` records, eligible under
  `scenes.gallery.eligible_projects3d` (same gate shape).
- **Generated** — published generated `ArtPiece` records, eligible under
  exactly the same publication gate `PublicArtPieceListView` (the legacy
  `/api/public/art-pieces/` endpoint) applies
  (`scenes.art_piece_persistence.eligible_art_pieces`:
  `status == ArtPiece.Status.PUBLISHED`, joined owner and current version;
  soft-deleted pieces are excluded by the model's default manager).

Anonymous and signed-in requests receive **identical** response bodies: the
view never branches on `request.user`. No private or editing fields (scene
JSON, prompts, draft/session data, tags, descriptions, owner emails,
visibility/status internals) ever appear in any item.

### Query parameters

| Parameter   | Rule                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`      | `all` (default when omitted) \| `authored` (2D + 3D only) \| `generated` (generated pieces only). Any other value → **HTTP 400**.        |
| `cursor`    | Opaque keyset token from a previous response's `next_cursor`. Malformed, or bound to a different `type` (see below) → **HTTP 400**.         |
| `page_size` | Positive integer, default `24` (`DEFAULT_PAGE_SIZE`), clamped to `60` (`MAX_PAGE_SIZE`); a non-integer value → **HTTP 400**. Same shape as the legacy `/api/public/projects/` endpoint. |

Error bodies are finite JSON. An invalid filter:

```json
{ "errors": { "type": ["Must be one of: all, authored, generated."] } }
```

An invalid cursor (malformed or reused under a different `type` than it was
issued for — see binding rule below):

```json
{ "errors": { "cursor": ["Invalid or expired cursor."] } }
```

### Response body

```json
{
  "results": [ /* gallery items, see below */ ],
  "next_cursor": "string | null",
  "has_more": true
}
```

`next_cursor` is `null` exactly when `has_more` is `false`. Clients page by
passing `next_cursor` back as `cursor` until it is `null`.

### Result items: discriminated union

Every item carries a **`kind`** discriminator with value `"2d"`, `"3d"`, or
`"generated"`. Every item includes:

| Field          | Meaning                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `id`           | Stable public id (the record's `public_id` UUID as a string). Internal database pks never appear.                 |
| `title`        | Piece title.                                                                                                      |
| `owner`        | Owner display value (username, never email).                                                                       |
| `published_at` | Publication timestamp (ISO 8601).                                                                                  |
| `thumbnail_url`| URL of the piece's gallery-card thumbnail.                                                                         |
| `viewer_url`   | Path of the piece's public viewer route: `/p/:id` (`2d`), `/p3d/:id` (`3d`), `/art-pieces/p/:id` (`generated`).    |

Generated (`"kind": "generated"`) items additionally expose **`engine`** —
the piece's engine label (`canvas2d`, `svg`, `threejs`, or `aframe`).

Example items:

```json
{
  "id": "6f9619ff-8b86-d011-b42d-00c04fc964ff",
  "kind": "2d",
  "title": "Bouncing balls",
  "owner": "alice",
  "published_at": "2026-09-08T10:00:00Z",
  "thumbnail_url": "/api/public/projects/6f9619ff-…/thumbnail.png",
  "viewer_url": "/p/6f9619ff-…"
}
```

```json
{
  "id": "7b1c2d3e-…",
  "kind": "3d",
  "title": "Orbit study",
  "owner": "alice",
  "published_at": "2026-09-08T09:30:00Z",
  "thumbnail_url": "/api/projects3d/7b1c2d3e-…/thumbnail/",
  "viewer_url": "/p3d/7b1c2d3e-…"
}
```

```json
{
  "id": "9c4d5e6f-…",
  "kind": "generated",
  "title": "Calm blue field",
  "owner": "alice",
  "published_at": "2026-09-08T09:00:00Z",
  "thumbnail_url": "/api/public/art-pieces/9c4d5e6f-…/thumbnail.png",
  "viewer_url": "/art-pieces/p/9c4d5e6f-…",
  "engine": "canvas2d"
}
```

### Global sort

All three kinds are merged into one global order, sorted by:

1. **Newest `published_at` first** (descending);
2. then a **documented stable kind rank** (`2d` before `3d` before
   `generated` — rank 0, 1, 2), applied only between rows with the exact same
   `published_at` instant;
3. then **public id descending** (the record's internal pk, used purely as a
   tiebreaker; it never appears in any response body).

### Cursor pagination and type binding

Pagination is keyset ("seek"), not offset — the same duplicate/gap-safe
strategy `scenes/gallery.py`'s module docstring documents for the legacy
endpoint: each page asks for "everything strictly after the last row I
returned" in the global order, so a piece publishing *between* page requests
never duplicates or drops rows already seen. The cursor encodes the last
row's `(published_at, kind, pk)` position plus the **`type` filter the cursor
was issued under**.

**A cursor is bound to its `type`:** a `next_cursor` issued by a
`type=generated` page is rejected with **HTTP 400** (and the
`{"errors": {"cursor": [...]}}` body above) when presented alongside any
other `type` (`all`, `authored`), and vice versa. Reusing a cursor across
filters would silently re-anchor the walk inside a different result set, so
the API refuses rather than returning ambiguous pages. Clients changing the
filter must start a fresh walk with no `cursor`.
