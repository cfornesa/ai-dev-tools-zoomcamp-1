## Goal

Integrate Three.js and A-Frame into the existing 3D AI editor route while
preserving each engine's authored source/runtime contract.

## Fixed entry point and fixture

Use the authenticated owner workflow at `/art-pieces` or the canonical 3D AI
editor entry point, with one disposable fixture per engine and the repository
fake AI provider. Each fixture has a stable engine ID and one persisted current
version.

## Acceptance criteria

- The 3D editor catalog exposes `threejs` and `aframe` as distinct engine IDs
  and routes each to its matching source/runtime adapter without display-label
  selection or silent coercion.
- Prompt/create, preview, inspect/revise, accept/reject, immutable save, and
  invalid/unsafe-output recovery preserve the selected engine and current
  version contract; A-Frame authored markup is not converted into Three.js.
- Persisted capability booleans are displayed and enforced consistently with
  the public regular runtime; immersive/embed/download controls are enabled
  only when the selected persisted capability allows them.
- Owner authorization, quota/provider failure, stale draft recovery, and
  privacy boundaries are covered at 1280x900 and 375x812 with rendered
  screenshots and an authored camera/input interaction.

## Verification and evidence boundary

```sh
cd backend && UV_CACHE_DIR=/tmp/codex-uv-cache uv run pytest tests/test_art_piece_provider.py tests/test_art_piece_persistence.py tests/test_ai_runs.py
cd frontend && npm test -- --run src/pages/ArtPieceStudio.test.tsx src/generative/artPieceSandbox.test.ts
UV_CACHE_DIR=/tmp/codex-uv-cache make check
```

Closure additionally requires focused Chromium create/edit/accept/recovery
evidence on the authenticated disposable stack at both fixed viewports. No
Replit or production database writes are in scope.

## Out of scope

2D editor routing is [#618](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/618),
public/immersive/embed/download runtime parity is #607–#609, slug routes are
#600/#616, and the parent reconciliation issue is #610.

## Routing

Stage 2b implementation-complex: authenticated editor state, AI/provider
contracts, persisted versions, source-runtime selection, and recovery logic
cross data and business logic.
