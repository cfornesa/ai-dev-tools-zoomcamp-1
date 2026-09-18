## Engineering handoff: regular-view runtime increment

Implemented in commit `5d4ab4d` (Codex/GPT-5 substitution for the rostered implementation service; stage 3 second opinion not run).

Scope completed:

- Added regular-view sandbox adapters for p5.js, C2.js, and C2.js Interactive using pinned jsDelivr runtimes and trusted mount wrappers.
- Added backend engine/source-shape validation for all seven stable engine IDs.
- Persisted the regular-only capability contract for p5/C2/C2 Interactive; immersive/embed/download/generation remain false.
- Added API persistence coverage for the three newly regular-capable engines.
- Updated the parity/API contract docs to distinguish regular support from other surfaces.

Verification:

- `cd backend && UV_CACHE_DIR=/tmp/codex-uv-cache uv run pytest tests/test_art_piece_persistence.py tests/test_art_piece_validation.py tests/test_art_piece_contract.py`: 24 passed.
- Full backend suite after the source-validation increment: 1,426 passed, 39 skipped.
- `uv run ruff check .`: passed.
- `uv run ruff format --check .`: passed.
- `uv run mypy .`: passed.
- `cd frontend && npm test -- --run`: 2,723 passed across 238 files.
- `npm run build`: passed.
- Focused sandbox/engine/public-view tests: 28 passed.
- `npx playwright test --list e2e/artPieceEmbed.spec.ts e2e/artPieces.spec.ts e2e/artPieceCapabilities.spec.ts`: 6 scenarios discovered.

Verification boundary for QA:

- Route-level Chromium execution could not start because `make compose-preflight` reported Docker unavailable and `http://localhost:5000/health/` was unreachable. No local PostgreSQL/Django/Vite stack is running.
- The issue remains open pending the named Chromium scenarios at 1280x900 and 375x812 on a disposable PostgreSQL-backed stack, including rendered inspection and the six-engine runtime behavior.
