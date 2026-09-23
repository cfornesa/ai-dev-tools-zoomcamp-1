# Backlog session — 2026-09-22 — public piece parity (#728–#738)

## Scope and provenance

Project: `cfornesa/ai-dev-tools-zoomcamp-1` (single Django/Vite application,
single published surface). Open-issue discovery used the authenticated GitHub
connector and returned exactly #728–#738. The existing distillation in
`docs/tasks.md` is retained as the PM manifest and was rechecked against live
issue bodies. Session profile: Codex / GPT-5 / medium. Stage substitutions are
recorded per transaction below; stage 3 is `not run` unless an independent
model family becomes available. User did not answer the scope question, so
this run includes every currently open issue and gives blocked items terminal
handoff status rather than omitting them.

## Dependency/order manifest

| Order | Issue | Scope | Dependencies | Routing | Status | Blocker / next action |
|---:|---|---|---|---|---|---|
| 1 | #728 | Public 3D full-stage camera overlay | — | 2a | GROOMED | — |
| 2 | #729 | Public 3D camera opacity/mirror while live | #728 | 2a | GROOMED | — |
| 3 | #730 | Public 3D stage toolbar overlay placement | — | 2a | GROOMED | — |
| 4 | #738 | Themed public piece title and top padding | — | 2a | GROOMED | — |
| 5 | #731 | Public 3D description/version API | — | 2b | GROOMED | — |
| 6 | #732 | Public 3D metadata layout | #731 | 2a | GROOMED | — |
| 7 | #733 | 3D immersive metadata below canvas | #731, #732 | 2a | GROOMED | — |
| 8 | #734 | 3D immersive camera overlay/controls | #728, #729 | 2a | GROOMED | — |
| 9 | #735 | Full ZIP 3D camera/toolset | — | 2a | GROOMED | — |
| 10 | #736 | Generated piece metadata/version layout | — | 2b | GROOMED | — |
| 11 | #737 | 2D piece metadata/version layout | — | 2b | GROOMED | — |

## Transaction ledger

Each issue must record: state, commit, changed files, focused checks, full
checks, QA verdict/comment, evidence boundary, GitHub reconciliation, stage
owners (`service / model / effort`) and substitution flags, and terminal
status. No next issue begins before the current one is terminal.

### #728 transaction ledger — QA result

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION`.
- **Stage provenance:** scoping `Codex / GPT-5 / medium`, substituted for rostered Codex/Luna: `yes`; implementation delegated subagent / GPT-5 / medium, substituted for rostered Opencode Go: `yes`; second opinion: `not run`; QA `Codex / GPT-5 / medium`, substituted for rostered Claude Sonnet 5: `yes`; readiness gate pending.
- **Commit:** `ad51231`.
- **Changed files:** `frontend/src/index.css`, `frontend/src/pages/Scene3DPreview.cameraOverlay.test.tsx`, `frontend/e2e/public3dCameraOverlay728.spec.ts`.
- **Focused/full checks:** focused Vitest 7 passed; `UV_CACHE_DIR=/tmp/codex-uv-cache-728 make check` passed backend 1508 passed/39 skipped, frontend 259 files/2805 tests, lint/format/typecheck/action-pin checks.
- **Browser evidence:** the named Chromium spec was executed and self-skipped because `/health/` was unavailable; `make compose-preflight` independently reported Docker daemon unavailable. No rendered screenshot or real/fake-camera route evidence is claimed. Classification: `workflow/infrastructure-defect` / verification boundary. Next action: rerun the exact spec against a disposable PostgreSQL-backed Django + Vite stack (Docker or CI browser runner).
- **QA verdict:** `## QA: FAIL` for the complete issue contract because the browser criteria are unverified; no product-code fix was made during QA. The issue must remain open until the browser gate runs, or be terminally dependency-blocked with owner/next action if the stack remains unavailable.
- **GitHub reconciliation:** authenticated connector exposes issue search/fetch/update but its comment operation accepts `pr_number` only; no issue comment was posted. This connector limitation is recorded as a workflow gap, not fabricated as evidence.

### #730 transaction ledger — QA result

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION`.
- **Stage provenance:** scoping `Codex / GPT-5 / medium`, substituted for rostered Codex/Luna: `yes`; implementation delegated subagent / GPT-5 / medium, substituted for rostered Opencode Go: `yes`; second opinion: `not run`; QA `Codex / GPT-5 / medium`, substituted for rostered Claude Sonnet 5: `yes`; readiness gate pending.
- **Commit:** `6fb1c6f`.
- **Changed files:** `frontend/src/components/PieceStageToolbar.tsx`, `frontend/src/components/PieceStageToolbar.test.tsx`, `frontend/src/index.css`, `frontend/e2e/public3dToolbar730.spec.ts`.
- **Focused/full checks:** focused Vitest 11 passed; `UV_CACHE_DIR=/tmp/codex-uv-cache-730 make check` passed backend 1508 passed/39 skipped, frontend 259 files/2807 tests, lint/format/typecheck/action-pin checks.
- **Browser evidence:** the named Chromium spec was executed and self-skipped because `/health/` was unavailable; `make compose-preflight` reported Docker daemon unavailable. No rendered screenshots or live route evidence are claimed. Classification: `workflow/infrastructure-defect` / verification boundary. Next action: rerun the exact spec against disposable PostgreSQL-backed Django + Vite or CI browser runner.
- **QA verdict:** `## QA: FAIL` for the complete issue contract because the browser criteria are unverified; no product-code fix was made during QA. Keep open as terminally blocked pending browser infrastructure.
- **GitHub reconciliation:** issue-comment connector accepts `pr_number` only; no issue comment was posted. The limitation is recorded rather than fabricated as evidence.

### #738 transaction ledger — QA result

- **State:** `GROOMED → ENGINEERING → QA → ENGINEERING → QA → RECONCILIATION`.
- **Stage provenance:** scoping `Codex / GPT-5 / medium`, substituted for rostered Codex/Luna: `yes`; implementation delegated subagent / GPT-5 / medium, substituted for rostered Opencode Go: `yes`; correction implementation same delegated subagent / GPT-5 / medium, substituted: `yes`; second opinion: `not run`; QA `Codex / GPT-5 / medium`, substituted for rostered Claude Sonnet 5: `yes`; readiness gate pending.
- **Commits:** `a3ba8b8` initial heading implementation; `31fed22` accessibility heading-order correction.
- **Changed files:** public viewer heading components/CSS plus focused component/CSS/a11y coverage, as recorded in the two commits.
- **Focused/full checks:** focused initial 46 passed; after QA return, focused 33 passed; full frontend `make frontend-test` passed 260 files/2811 tests; lint, Prettier, and typecheck passed.
- **Browser evidence:** `npx playwright test e2e/canonicalStructuredPieceSlug.spec.ts --project=chromium` attempted and failed before navigation because Playwright Chromium crashed at macOS `MachPortRendezvousServer ... Permission denied (1100)`. Trace retained under `frontend/test-results/`. Classification: `verification-boundary` / host browser limitation. Next action: rerun the named route matrix in the repository CI Chromium runner or another approved macOS/browser environment and inspect both viewport screenshots under at least two local theme presets.
- **QA verdict:** `## QA: FAIL` for the complete issue contract solely because the required rendered browser evidence is unavailable; the earlier implementation defect was fixed and the full frontend gate is green. No product-code change was made during QA.
- **GitHub reconciliation:** issue-comment connector accepts `pr_number` only; no issue comment was posted. Keep #738 open as terminally blocked pending approved browser evidence.

### #731 transaction ledger — QA PASS

- **State:** `GROOMED → ENGINEERING → QA → ENGINEERING → QA → RECONCILIATION → CLOSED`.
- **Stage provenance:** scoping `Codex / GPT-5 / medium`, substituted for rostered Codex/Luna: `yes`; implementation delegated subagent / GPT-5 / medium, substituted for rostered Ollama Cloud: `yes`; correction implementation same delegated subagent / GPT-5 / medium, substituted: `yes`; second opinion: `not run`; QA `Codex / GPT-5 / medium`, substituted for rostered Claude Sonnet 5: `yes`; readiness gate pending.
- **Commits:** `45354b5` API contract/implementation; `64e9671` additive fixture compatibility correction.
- **Acceptance matrix:** public 3D payload now documents and returns description plus newest-first public version summaries and count; private/unpublished behavior remains covered; serializer query prefetching avoids N+1; frontend API types and `docs/api.md` are updated before/with code.
- **Checks:** focused backend 17 passed; public-3D selection 14 passed; full backend `1512 passed, 39 skipped`; full frontend `260 files / 2811 tests`; frontend typecheck, Ruff, format, lint, action-pin checks passed.
- **QA verdict:** `## QA: PASS`; no browser evidence required by #731. No stage-3 findings to disposition.
- **GitHub reconciliation:** issue-comment connector accepts `pr_number` only, so the required top-level issue QA comment could not be posted; this is recorded as connector unavailability. The authenticated issue update operation was used to close #731 as `completed` after all criteria passed.

### #732 transaction ledger — QA result

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION`.
- **Stage provenance:** scoping `Codex / GPT-5 / medium`, substituted for rostered Codex/Luna: `yes`; implementation delegated subagent / GPT-5 / medium, substituted for rostered Opencode Go: `yes`; second opinion: `not run`; QA `Codex / GPT-5 / medium`, substituted for rostered Claude Sonnet 5: `yes`; readiness gate pending.
- **Commit:** `cfba21c`.
- **Checks:** focused Vitest 16 passed; full frontend `260 files / 2812 tests`; lint, Prettier, typecheck passed.
- **Browser evidence:** `npx playwright test e2e/public3dInfoArchitecture732.spec.ts --project=chromium` attempted and failed before navigation at the macOS Playwright MachPort boundary (`Permission denied (1100)`); no rendered screenshots claimed. Classification: `verification-boundary`. Next action: run the exact spec in CI/approved browser environment and inspect 1440×900 and 375×812 screenshots.
- **QA verdict:** `## QA: FAIL` for complete issue contract solely because required rendered route evidence is unavailable; no product-code change made during QA.
- **GitHub reconciliation:** issue-comment connector accepts `pr_number` only; no issue comment posted. Keep #732 open as terminally blocked pending browser evidence.

### #735 transaction ledger — QA result

- **State:** `GROOMED → ENGINEERING → QA → ENGINEERING → QA → RECONCILIATION`.
- **Stage provenance:** scoping `Codex / GPT-5 / medium`, substituted for rostered Codex/Luna: `yes`; implementation delegated subagent / GPT-5 / medium, substituted for rostered Opencode Go: `yes`; formatting correction same delegated subagent / GPT-5 / medium, substituted: `yes`; second opinion: `not run`; QA `Codex / GPT-5 / medium`, substituted for rostered Claude Sonnet 5: `yes`; readiness gate pending.
- **Commits:** `1cc5662` implementation; `95c6a40` Prettier correction.
- **Checks:** focused Vitest 24 passed; full frontend Vitest 260 files/2813 tests passed; lint passed; format-check and typecheck passed after correction.
- **Browser evidence:** `npx playwright test e2e/exportArtifacts.spec.ts --project=chromium` attempted; Chromium failed before launch at macOS MachPort permission boundary (`Permission denied (1100)`), and the harness emitted a secondary `generator.close()` undefined cleanup error. No runtime screenshot/ZIP browser evidence claimed. New workflow follow-up #739 created and linked for the cleanup defect. Classification: `verification-boundary` plus `workflow/infrastructure-defect`; exact next action is run #735 in approved CI/Chromium and process #739 before relying on browser failure diagnostics.
- **QA verdict:** `## QA: FAIL` for complete issue contract because extracted runtime behavior and screenshots are unverified; no product-code fix made during QA.
- **GitHub reconciliation:** issue-comment connector accepts `pr_number` only; no issue comment posted. Keep #735 open, dependency-linked to #739 for harness cleanup but not re-scoped.

## Duplicate / already-covered report

The prior distillation in `docs/tasks.md` records closed history #297/#342
(camera), #369–#371/#436/#482 (ZIP camera/steer), and #294/#432/#455 (steer).
They are not duplicates of the current owner-reported public canonical surfaces.
