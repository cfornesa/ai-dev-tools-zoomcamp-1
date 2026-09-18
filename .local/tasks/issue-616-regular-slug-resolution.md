## Goal

Make one published generated art piece resolve through the canonical regular
route `/users/@<handle>/pieces/<slug>` with a normalized, owner-scoped,
collision-safe user slug and a backward-compatible legacy resolver.

## Fixed fixture

Use one published `ArtPiece` owned by a disposable test user whose profile
handle is `@cfornesa` (or an equivalent fixture handle), with `public_slug`
set through the supported API and a persisted current version. Do not write
Replit, production, or shared databases.

## Acceptance criteria

- A slug submitted through the supported mutation path is normalized using the
  repository's documented slug rules and is rejected when it collides with a
  different published piece for the same owner.
- The canonical regular route resolves the current published version by
  owner handle plus slug and returns the same public data as the existing
  generated-piece viewer without exposing prompt, drafts, owner fields, or
  unpublished versions.
- The existing UUID/public-id regular route remains a backward-compatible
  shim: it resolves the same piece and does not silently create a second
  slug or version. The redirect/shim and rollback policy is documented in
  `docs/api.md` before endpoint changes.
- Anonymous, another-user, draft, archived, and missing-slug requests do not
  confirm the existence of a private piece; tests cover each boundary.
- API/link serialization for this regular surface emits the canonical slug
  URL. Immersive, editor, embed, studio-card, thumbnail, and engine-runtime
  consumers remain out of scope.

## Verification

```sh
cd backend && UV_CACHE_DIR=/tmp/codex-uv-cache uv run pytest tests/test_canonical_piece.py tests/test_canonical_piece_slug_race.py tests/test_art_piece_persistence.py
cd frontend && npm test -- --run src/pages/CanonicalPublicPiece.test.tsx src/api/artPieces.test.ts
UV_CACHE_DIR=/tmp/codex-uv-cache make check
```

The closure evidence boundary is a disposable PostgreSQL-backed API test plus
the regular route at 1280x900 and 375x812 in Chromium. No Replit or production
write is authorized by this issue.

## Dependencies and out of scope

Parent context: [#600](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1). The
owner editor route is [#601](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/601),
cards are [#602](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/602),
[#603](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/603),
[#604](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/604), and
[#605](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/605), and
immersive/embed/runtime consumers remain #606–#609.

## Routing

Stage 2b implementation-complex: public URL compatibility, persistence,
uniqueness, privacy, and API serialization are coupled. URL changes require
the redirect/shim and rollback plan before implementation.
