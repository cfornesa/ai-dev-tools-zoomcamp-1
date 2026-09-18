## Goal

Give Three.js and A-Frame art pieces an explicit 3D AI-editor mode while
preserving their authored source/runtime contract, instead of treating the
generic source editor as proof of 3D-editor parity.

## Fixed entry point and fixture

Use one authenticated owner-owned published art piece per engine through the
canonical owner editor route `/users/@<handle>/edit/<slug>` with a disposable
database and fake AI provider. The mode must expose the selected stable engine
ID and persisted current version.

## Acceptance criteria

- The route identifies the selected piece as a 3D AI-editor session for
  `threejs` or `aframe`; no 2D engine or Canvas2D scene editor is mounted and
  no source is silently coerced.
- Prompt/revise, sandbox preview, accept/save-as-new-version, version history,
  invalid-output recovery, and owner-only authorization preserve the selected
  engine and current version.
- Three.js camera registration and A-Frame authored camera/input behavior are
  preserved in the preview; persisted capability controls match the engine
  registry and remain disabled for unavailable surfaces.
- Authenticated Chromium evidence covers both engines at 1280x900 and
  375x812, including one authored camera/input interaction and a non-owner
  denial. Full repository checks pass.

## Verification and evidence boundary

```sh
cd backend && UV_CACHE_DIR=/tmp/codex-uv-cache uv run pytest tests/test_art_piece_api.py tests/test_art_piece_persistence.py tests/test_canonical_piece.py
cd frontend && npm test -- --run src/pages/CanonicalArtPieceEditor.test.tsx src/generative/artPieceSandbox.test.ts
UV_CACHE_DIR=/tmp/codex-uv-cache make check
```

Closure requires rendered Chromium evidence on the disposable authenticated
stack; local unit tests and the generic editor's existing tests are supporting
evidence only. No Replit or production writes are in scope.

## Out of scope

2D editor mode is #618, public/immersive/embed/download parity is #607–#609,
slug persistence is #616, and #619 remains the parent 3D integration
reconciliation container.

## Routing

Stage 2a/2b conditional: the visible mode/routing is frontend work, while
owner authorization, persisted versions, and capability translation cross the
API/data boundary.
