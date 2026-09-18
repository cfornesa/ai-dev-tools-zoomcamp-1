## QA: FAIL

### Criterion matrix

| Criterion | Verdict | Evidence |
|---|---|---|
| Six-engine regular route renders a non-fallback frame at 1280x900 and 375x812 | NOT VERIFIED | Required route-level Chromium execution could not start: `make compose-preflight` reported Docker unavailable and `curl -fsS --max-time 3 http://localhost:5000/health/` reported no listener. |
| Stable-ID runtime selection, source validation, capability negotiation, pinned assets, and sandbox security are explicit | PASS (code-level) | `24 passed` focused backend contract/validation/persistence tests; focused frontend runtime/sandbox/public tests `28 passed`; registry uses stable IDs and separate capability booleans. Route execution remains unverified. |
| Controls and permission gates match persisted capabilities | NOT VERIFIED | Registry and existing unit coverage pass, but the issue requires browser-visible controls at both fixed viewports. |
| C2 Interactive input restoration, SVG script-free behavior, and deterministic runtime error states | NOT VERIFIED | Source-shape and sandbox tests pass; no browser execution was available to observe authored pointer restoration or CDN failure states. |
| Anonymous/private/version-boundary behavior and author-only edit affordance | NOT VERIFIED | Existing backend full suite passed, but this issue requires the published regular route and owner/non-owner browser entry point. |
| Focused Chromium verification and full repository checks | FAIL | Full `UV_CACHE_DIR=/tmp/codex-uv-cache make check` passed: 1,429 backend tests passed, 39 skipped; frontend 2,723 tests passed; lint/format/typecheck passed. The required focused Chromium run was unavailable. |

### Commands and results

- `UV_CACHE_DIR=/tmp/codex-uv-cache make check`: passed (`1,429 passed, 39 skipped`; frontend `2,723 passed`; lint/format/typecheck passed).
- `cd backend && UV_CACHE_DIR=/tmp/codex-uv-cache uv run pytest tests/test_art_piece_persistence.py tests/test_art_piece_validation.py tests/test_art_piece_contract.py`: `24 passed`.
- `cd frontend && npm test -- --run src/api/artPieceEngines.test.ts src/generative/artPieceSandbox.test.ts src/generative/artPieceEngineRuntime.test.ts src/pages/CanonicalPublicPiece.test.tsx`: `28 passed`.
- `cd frontend && npm run build`: passed.
- `cd frontend && npx playwright test --list e2e/artPieceEmbed.spec.ts e2e/artPieces.spec.ts e2e/artPieceCapabilities.spec.ts`: 6 scenarios listed; execution was not attempted as the required stack was unavailable.
- `make compose-preflight`: blocked by Docker daemon unavailable.
- `curl -fsS --max-time 3 http://localhost:5000/health/`: blocked because no local stack was listening.

### Provenance and intake

- Implementation: Codex/GPT-5 substitution for the rostered implementation service, commit `5d4ab4d`.
- Stage 3 independent-family review: not run.
- QA: Codex/GPT-5 substitution for the rostered Claude Sonnet 5 Medium QA stage.
- Intake: ACCEPTED. The diff was re-read against the current issue body; no unauthorized dependency, secret, route deletion, or migration write was found in this increment. The test assertions were inspected and the capability flag change was corrected before commit.

### Evidence boundary and next action

This is a `verification-boundary` on the current host, not evidence that the regular runtime is functionally correct in a deployed route. Keep #607 open. Start the documented disposable PostgreSQL/Django/Vite stack (or run the equivalent CI browser job), execute the six-engine regular-route scenarios at 1280x900 and 375x812 with rendered inspection, then return to QA. Do not advance dependent #615 until #607 reaches a terminal QA result.
