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
| 1 | #728 | Public 3D full-stage camera overlay | — | 2a | CLOSED | `f5ed998` fixes Strict Mode camera startup; focused camera 33/33 and regular-route Chromium geometry passed. |
| 2 | #729 | Public 3D camera opacity/mirror while live | #728 | 2a | CLOSED | `1fc4dc5` + `34d82c1`; focused camera 7/7 and combined regular-route Chromium scenario passed. |
| 3 | #730 | Public 3D stage toolbar overlay placement | — | 2a | CLOSED | `92cae9c`; named Docker-backed Chromium geometry/popover/screenshots passed 1/1 after correcting the close control locator to its rendered `menuitem` role. |
| 4 | #738 | Themed public piece title and top padding | — | 2a | CLOSED | Fresh Docker-backed Chromium route matrix passed. |
| 5 | #731 | Public 3D description/version API | — | 2b | GROOMED | — |
| 6 | #732 | Public 3D metadata layout | #731 | 2a | CLOSED | `b9ddb51`; targeted backend 5 passed, frontend 12 passed, named Chromium scenario passed. |
| 7 | #733 | 3D immersive metadata below canvas | #731, #732 | 2a | CLOSED | `2d37360`; focused component 7/7, full `make check` green, and named Docker-backed Chromium 1/1 at desktop/mobile viewports. |
| 8 | #734 | 3D immersive camera overlay/controls | #728, #729 | 2a | CLOSED | `7fb65f3` + `2cdf9e5`; focused camera 8/8, full `make check` green, and named Docker-backed Chromium 1/1 at desktop/mobile viewports. |
| 9 | #735 | Full ZIP 3D camera/toolset | — | 2a | CLOSED | Fresh Docker-backed Chromium: all 10 export/camera scenarios passed. |
| 10 | #736 | Generated piece metadata/version layout | — | 2b | CLOSED | `edaf51d` + `8be39c8`; canonical backend 13/13 and regular-route Chromium desktop/mobile scenario passed. |
| 11 | #737 | 2D piece metadata/version layout | — | 2b | CLOSED | `9fcbb0d` + `5d3f3ad`; serial frontend 2815/2815 and regular-route Chromium scenario passed. |
| 12 | #739 | Export E2E teardown tolerates browser launch failure | #735 | 2a | CLOSED | `18a34d7`; focused teardown 2/2 and existing 10-test Chromium export suite passed. |
| 13 | #740 | End-to-end authoring workflow for authored 2D/3D pieces | — | 2a | GROOMED | Updated with prompt/action steps, camera overlay/background modes, centered full-viewport sizing, and contextual tooltips; #741 owns secure same-origin-compatible embeds. |
| 14 | #741 | Contextual controls plus secure same-origin-compatible sandboxing | #740 | 2a/security | GROOMED | New discovery follow-up; no duplicate open issue found. |

## Transaction ledger

Each issue must record: state, commit, changed files, focused checks, full
checks, QA verdict/comment, evidence boundary, GitHub reconciliation, stage
owners (`service / model / effort`) and substitution flags, and terminal
status. No next issue begins before the current one is terminal.

### #729 transaction ledger — focused implementation

- **State:** `GROOMED → ENGINEERING → QA PENDING`; #728 is closed.
- **Stage provenance:** implementation `Codex / GPT-6 / effort not reported`, substituted for rostered Opencode Go / kimi-k3: `yes` because the delegated implementation tool was unavailable in this session; stage 3 `not run`; stage 4 pending.
- **Changed files:** `frontend/src/pages/Scene3DPreview.tsx`, `frontend/src/pages/Scene3DPreview.cameraOverlay.test.tsx`.
- **Focused checks:** camera-overlay Vitest 7/7 passed; targeted Oxlint passed with an existing Fast Refresh warning; targeted Prettier and `git diff --check` passed. A first focused Vitest run found jsdom does not advance the native range for `userEvent` ArrowRight; the test now asserts focus and range semantics, with a change event for the value update.
- **Evidence boundary:** owner directed focused implementation and commit now; full `make check` and the real-camera 1440×900 screenshot criterion have not run. Keep #729 open for stage-4 QA.

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

### #736 transaction ledger — QA result

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION`.
- **Stage provenance:** scoping `Codex / GPT-5 / medium`, substituted for rostered Codex/Luna: `yes`; implementation delegated subagent / GPT-5 / medium, substituted for rostered Ollama Cloud: `yes`; second opinion: `not run`; QA `Codex / GPT-5 / medium`, substituted for rostered Claude Sonnet 5: `yes`; readiness gate pending.
- **Commit:** `c33b006`.
- **Checks:** focused backend 12 passed; focused frontend 9 passed; full backend `1514 passed, 39 skipped`; full frontend gate passed (260 files/2813 tests at current baseline), lint/format/typecheck/action-pin checks passed.
- **Browser evidence:** `npx playwright test e2e/publicGeneratedArtPiecePage736.spec.ts --project=chromium` self-skipped because the required local health/fixture stack was unavailable; `make compose-preflight` reports Docker unavailable. No rendered screenshots claimed. Classification: `workflow/infrastructure-defect` / verification boundary. Next action: run the exact generated-piece route matrix in disposable PostgreSQL + Django/Vite or CI Chromium.
- **QA verdict:** `## QA: FAIL` for complete issue contract solely because required browser screenshots/route evidence are unavailable; no product-code fix made during QA.
- **GitHub reconciliation:** issue-comment connector accepts `pr_number` only; no issue comment posted. Keep #736 open as terminally blocked pending browser evidence.

### Fresh Docker/browser retry results (2026-09-23)

- Docker Desktop was available after rebuilding `docker compose up -d --build` from the current checkout; `make compose-preflight` passed.
- #738 named Chromium matrix passed: 1 test, desktop/mobile route evidence.
- #735 named export-artifacts Chromium suite passed: 10 tests, including camera lifecycle, Full/Non-Camera ZIP isolation, and real-browser Canvas capture.
- #737 corrected named Chromium scenario passed: 1 test with desktop/mobile screenshots.
- #736 reached the canonical generated page but its E2E action assertion selected a hidden stage toolbar group; canonical generated labeling itself is now present after `5d3f3ad`. Visible-action selector correction remains pending.
- #728 reached the published immersive route and activated steering, but no camera video mounted. This is a product camera-lifecycle failure requiring correction, not an infrastructure boundary.
- #730 setup now reaches the browser but its anonymous immersive navigation lands on the editor shell; canonical published-route fixture correction remains pending before geometry can be judged.
- #732 initially reached the canonical 3D page without the fixture description because the fixture used an unsupported top-level field; the correction aligns it with #731’s `seo_config.description` contract.
- #732 correction resolved that boundary by aligning the fixture with #731’s supported `seo_config.description` contract; targeted backend 5, frontend 12, and named Chromium 1 passed.
- #740 was expanded with prompt/action authoring steps, camera overlay/background configuration, centered full-viewport sizing, and contextual tooltips.
- #741 was created after duplicate search found no open tooltip or same-origin/sandbox issue; it owns accessible action context plus narrowly scoped `allow-same-origin`/embed security and postMessage validation.
- #728 final browser retry passed on the regular canonical public route at both viewports after `f5ed998`; camera video geometry, cover sizing, stacking, pointer-events, and toolbar layering were exercised.
- #729 combined browser retry passed: controls were absent before camera activation and visible after Steer/video activation at both viewports.
- #736 initially hit a transient generated canonical loading state and then duplicate model/current locators; the final run passed after the focused E2E corrections.
- #736 later resolved to a duplicate “E2E model”/“CURRENT” locator boundary; canonical backend 13/13 and final regular-route Chromium scenario passed after `edaf51d` and `8be39c8`.
- #730’s final retry reached the public viewer and passed the full geometry/popover scenario; the apparent blocker was a stale test locator for a rendered `menuitem` close control.

### #730 transaction ledger — QA PASS

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`.
- **Stage provenance:** implementation `Codex / GPT-5 / medium`, substituted for rostered Opencode Go: `yes`; second opinion `not run`; QA `Codex / GPT-5 / medium`, substituted for rostered Claude Sonnet 5: `yes`; readiness gate `Codex / GPT-5 / medium`, substituted for rostered Claude Pro: `yes`.
- **Commit:** `92cae9c`; changed only `frontend/e2e/public3dToolbar730.spec.ts`, correcting the close-download locator from `button` to the rendered semantic `menuitem` role. Product code was unchanged.
- **Focused checks:** `frontend/src/components/PieceStageToolbar.test.tsx` — 9/9 passed.
- **Browser evidence:** `E2E_DOCKER_COMPOSE=true npx playwright test e2e/public3dToolbar730.spec.ts --project=chromium` — 1/1 passed in 14.2s against rebuilt Docker; desktop/mobile toolbar geometry, non-reflowing Piece controls and Download popovers, fullscreen containment, and four screenshots were produced.
- **QA verdict:** `## QA: PASS`; the earlier blocker was a test locator mismatch, not a product or Docker failure. The Playwright trace showed the close control had `role="menuitem"`, so the old `button` locator could never resolve.
- **GitHub reconciliation:** top-level issue QA comment was unavailable because the connector accepts `pr_number` only; authenticated issue update closed #730 as `completed` after the evidence above.

### #733 transaction ledger — QA PASS

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`.
- **Stage provenance:** implementation `Codex / GPT-5 / medium`, substituted for rostered Opencode Go: `yes`; second opinion `not run`; QA `Codex / GPT-5 / medium`, substituted for rostered Claude Sonnet 5: `yes`; readiness gate `Codex / GPT-5 / medium`, substituted for rostered Claude Pro: `yes`.
- **Commit:** `2d37360`; immersive 3D metadata/actions now render below the stage with title, description, Share, Embed Custom/CMS, current-version context, and newest-first Versions. Added focused component and named browser coverage; no camera, security, route, schema, or dependency changes.
- **Focused checks:** `npx vitest run src/pages/ImmersiveProject3DViewer.test.tsx` — 7/7 passed; typecheck, format, and lint passed with existing warnings only.
- **Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache-733 make check` — backend 1516 passed/39 skipped; frontend 261 files/2821 tests passed; action pins, Ruff, mypy, format, lint, typecheck, and frontend tests passed.
- **Browser evidence:** `E2E_DOCKER_COMPOSE=true npx playwright test e2e/public3dImmersiveInfoArchitecture733.spec.ts --project=chromium` — 1/1 passed in 9.5s with 1440×900 and 375×812 screenshots; metadata is after the Preview region and remains visible/scrollable.
- **QA verdict:** `## QA: PASS`; the criterion matrix is satisfied. Missing `docs/testing-guidelines.md` and `docs/design-system.md` were recorded as repository process gaps, not substituted silently.
- **GitHub reconciliation:** top-level issue QA comment was unavailable because the connector accepts `pr_number` only; authenticated issue update closed #733 as `completed` after the evidence above.

### #734 transaction ledger — QA PASS

- **State:** `GROOMED → ENGINEERING → QA → ENGINEERING → QA → RECONCILIATION → CLOSED`.
- **Stage provenance:** implementation `Codex / GPT-5 / medium`, substituted for rostered Opencode Go: `yes`; QA correction `Codex / GPT-5 / medium`, substituted: `yes`; second opinion `not run`; QA `Codex / GPT-5 / medium`, substituted for rostered Claude Sonnet 5: `yes`; readiness gate `Codex / GPT-5 / medium`, substituted for rostered Claude Pro: `yes`.
- **Commits:** `7fb65f3` adds the centered/proportional immersive stage and shared camera layering/coverage; `2cdf9e5` fixes the E2E formatting and unused-variable gate findings without changing runtime behavior.
- **Focused checks:** `npx vitest run src/pages/Scene3DPreview.cameraOverlay.test.tsx` — 8/8 passed, including immersive viewport/stacking contract.
- **Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache-734-final make check` — backend 1516 passed/39 skipped; frontend 261 files/2822 tests passed; action pins, Ruff, mypy, format, lint, typecheck, and frontend tests passed.
- **Browser evidence:** `E2E_DOCKER_COMPOSE=true npx playwright test e2e/public3dImmersiveCameraOverlay734.spec.ts --project=chromium` — 1/1 passed in 15.9s with fake-camera live feed, centered full-stage video geometry, z-index checks, opacity/mirror controls, Walk/zoom interaction, and desktop/mobile screenshots.
- **QA verdict:** `## QA: PASS`; the criterion matrix is satisfied. The initial browser test discrepancy was corrected to compare against the measured preview container origin with explicit ±1px tolerance; no acceptance assertion was removed.
- **GitHub reconciliation:** top-level issue QA comment was unavailable because the connector accepts `pr_number` only; authenticated issue update closed #734 as `completed` after the evidence above.

### #739 transaction ledger — QA PASS

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION`.
- **Commit:** `18a34d7`; export-artifact teardown now guards an uninitialized generator and retains normal cleanup.
- **Checks:** focused teardown regression 2/2, format, lint, and typecheck passed; the named Chromium export suite previously passed all 10 scenarios on the same stack.
- **QA verdict:** `## QA: PASS`; no product export behavior changed.
- **GitHub reconciliation:** issue-comment connector accepts `pr_number` only, so no top-level issue QA comment could be posted; close after the focused regression and existing browser suite evidence.

### Discovery follow-up — #739 and user-requested #740

- **#739:** created during #735 QA for the reproducible export-artifact teardown error when Chromium fails before generator initialization; linked to #735 and added to the manifest. It is a criterion-ready Stage 2a workflow issue.
- **#740:** created at the user's request for an end-to-end authoring workflow proving that authored 2D/3D pieces analogous to `augment-humankind` can be created, versioned, published, rendered, and exported through supported UI workflow. It is a criterion-ready Stage 2a browser issue and is intentionally separate from viewer parity.

## Duplicate / already-covered report

The prior distillation in `docs/tasks.md` records closed history #297/#342
(camera), #369–#371/#436/#482 (ZIP camera/steer), and #294/#432/#455 (steer).
They are not duplicates of the current owner-reported public canonical surfaces.
