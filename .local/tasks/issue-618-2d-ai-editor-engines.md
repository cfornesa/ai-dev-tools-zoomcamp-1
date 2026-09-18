## Goal

Integrate p5.js, C2.js, C2.js Interactive, and SVG into the existing 2D AI
editor route without coercing their source into Canvas2D scene JSON.

## Fixed entry point and fixture

Use the authenticated owner workflow at `/art-pieces` with one disposable
fixture per engine and the repository fake AI provider. Each fixture has a
stable engine ID, one persisted current version, and a source-only preview
boundary where layers are not structurally inspectable.

## Acceptance criteria

- The 2D editor catalog exposes exactly `svg`, `p5js`, `c2js`, and
  `c2js-interactive` as distinct engine IDs and routes each to its matching
  source/runtime adapter without display-label selection or silent coercion.
- Prompt/create, preview, inspect/revise, accept/reject, immutable save, and
  invalid/unsafe-output recovery preserve the selected engine and current
  version contract; unsupported layer inspection is labeled source-only.
- Persisted capability booleans are displayed and enforced consistently with
  the public regular runtime; unavailable immersive/embed/download controls
  are not enabled by the editor.
- Owner authorization, quota/provider failure, stale draft recovery, and
  privacy boundaries are covered for one flat engine and one interactive C2
  engine at 1280x900 and 375x812 with rendered screenshots.

## Verification and evidence boundary

```sh
cd backend && UV_CACHE_DIR=/tmp/codex-uv-cache uv run pytest tests/test_art_piece_provider.py tests/test_art_piece_persistence.py tests/test_ai_runs.py
cd frontend && npm test -- --run src/pages/ArtPieceStudio.test.tsx src/generative/artPieceEngineRuntime.test.ts
UV_CACHE_DIR=/tmp/codex-uv-cache make check
```

Closure additionally requires focused Chromium create/edit/accept/recovery
evidence on the authenticated disposable stack at both fixed viewports. No
Replit or production database writes are in scope.

## Out of scope

3D editor routing is [#619](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/619),
public/immersive/embed/download runtime parity is #607–#609, slug routes are
#600/#616, and the parent reconciliation issue is #610.

## Routing

Stage 2b implementation-complex: authenticated editor state, AI/provider
contracts, persisted versions, source-runtime selection, and recovery logic
cross data and business logic.
