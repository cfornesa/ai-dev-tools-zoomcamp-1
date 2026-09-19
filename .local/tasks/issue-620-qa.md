## QA: FAIL

### Criterion matrix

| Criterion | Verdict | Evidence |
|---|---|---|
| Explicit 3D AI-editor mode identifies Three.js/A-Frame without coercion | PASS (code-level) | Commit `18c9e79` derives the visible editor mode from the persisted engine capability family and displays the engine label. Existing sandbox selection remains keyed by stable engine ID. |
| Prompt/revise, preview, save-as-version, history, invalid recovery, and owner-only access preserve engine/version | PASS (existing automated support) | Existing owner-editor implementation uses `piece.engine` for generation and sandbox source, and full frontend suite passed. Route-level engine-specific browser evidence remains pending. |
| Camera/input and capability behavior | NOT VERIFIED | Source-level Three.js/A-Frame sandbox contracts exist, but authored camera/input interaction was not executable in Chromium. |
| Fixed-view Chromium evidence at 1280x900 and 375x812 plus full checks | FAIL | Frontend full suite: 2,724 passed; typecheck/lint passed; prior full backend gate: 1,434 passed, 39 skipped. `make compose-preflight` reports Docker unavailable and localhost `/health/` is unreachable. Seven relevant Chromium scenarios were listed but not executed. |

### Commands and results

- `cd frontend && npm test -- --run`: `2,724 passed` across 238 files.
- `cd frontend && npm run typecheck`: passed.
- `cd frontend && npm run lint`: warning-only with existing warnings.
- Full backend gate from the same implementation batch: `1,434 passed, 39 skipped`; backend lint/format/mypy passed.
- `make compose-preflight`: blocked because Docker daemon is unavailable.
- `curl -fsS --max-time 3 http://localhost:5000/health/`: blocked because no local stack was listening.
- `cd frontend && npx playwright test --list e2e/artPieceOwnerEditing.spec.ts e2e/artPieceCapabilities.spec.ts`: 7 Chromium scenarios listed; execution unavailable.

### Provenance and intake

- Implementation: Codex/GPT-5 substitution for the scoped #620 work; commit `18c9e79`.
- Stage 3 independent-family review: not run.
- QA: Codex/GPT-5 substitution for the rostered Claude Sonnet 5 Medium stage.
- Intake: ACCEPTED. The change is issue-scoped and no test was weakened or deleted.

### Evidence boundary and next action

This is a `verification-boundary` on the current host. Keep #620 open and
run the named owner-editor Chromium scenarios with Three.js/A-Frame fixtures at
both fixed viewports on a disposable PostgreSQL/Django/Vite or approved CI
runner, then return to QA. #619 remains the parent reconciliation container.
