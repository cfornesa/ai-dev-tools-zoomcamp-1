## QA: FAIL

### Criterion matrix

| Criterion | Verdict | Evidence |
|---|---|---|
| 2D catalog exposes SVG, p5.js, C2.js, and C2.js Interactive by stable ID without coercion | PASS (code/unit) | Frontend Studio test covers p5 selection and stable API ID; backend contract/provider tests cover all three new IDs and SVG. |
| Create, preview, save, and invalid-output recovery preserve engine/version contract | PASS (code/unit) | Backend provider/API/persistence/validation suite `37 passed`; frontend Studio/runtime suite `18 passed`. Browser workflow remains unverified. |
| Capability booleans match public runtime and unsupported immersive/download controls are disabled/sanitized | PASS (code/unit) | Registry assertions, Studio control implementation, and capability sanitization are covered; p5/C2 generation is enabled while immersive/embed/download remain false. |
| Owner auth, quota/provider failures, stale drafts, privacy, and rendered 2D editor states at both fixed viewports | NOT VERIFIED | Full backend suite covers existing auth/provider/privacy behavior, but the issue requires authenticated Chromium workflow and rendered screenshots. |
| Focused Chromium and full repository checks | FAIL | Full `UV_CACHE_DIR=/tmp/codex-uv-cache make check` passed: backend `1,434 passed, 39 skipped`; frontend `2,724 passed`; lint/format/typecheck passed. `make compose-preflight` failed because Docker is unavailable and localhost `/health/` is unreachable; six relevant Chromium scenarios were listable but not executable. |

### Commands and results

- `cd backend && UV_CACHE_DIR=/tmp/codex-uv-cache uv run pytest tests/test_art_piece_api.py tests/test_art_piece_contract.py tests/test_art_piece_provider.py`: `37 passed`.
- `cd frontend && npm test -- --run src/pages/ArtPieceStudio.test.tsx src/generative/artPieceEngineRuntime.test.ts src/api/artPieceEngines.test.ts`: `18 passed`.
- `UV_CACHE_DIR=/tmp/codex-uv-cache make check`: passed; backend `1,434 passed, 39 skipped`, frontend `2,724 passed`, lint/format/typecheck passed.
- `make compose-preflight`: blocked because Docker daemon is unavailable.
- `curl -fsS --max-time 3 http://localhost:5000/health/`: blocked because no local stack was listening.
- `cd frontend && npx playwright test --list e2e/artPieceCapabilities.spec.ts e2e/artPieces.spec.ts e2e/artPieceEmbed.spec.ts`: 6 Chromium scenarios listed; execution unavailable.

### Provenance and intake

- Implementation: Codex/GPT-5 substitution for rostered Ollama Cloud `kimi-k3`; commits `cc4b10a`, `411ebfc`, and `545b57d`.
- Stage 3 independent-family review: not run.
- QA: Codex/GPT-5 substitution for rostered Claude Sonnet 5 Medium.
- Intake: ACCEPTED-WITH-FIXES. The diff was re-read against #618; mechanical lint/format corrections were made before the final check. No test was weakened or skipped.

### Evidence boundary and next action

This is a `verification-boundary` on the current host, not a product-defect
finding. Keep #618 open. Run authenticated create/preview/save/recovery
Chromium scenarios with the fake AI provider at 1280x900 and 375x812 on a
disposable PostgreSQL/Django/Vite stack or approved CI browser runner, inspect
the rendered states, then return to QA. Do not begin dependent #619 as a
substitute for closing this transaction; it is a separate child that can be
selected only after this reconciliation.
