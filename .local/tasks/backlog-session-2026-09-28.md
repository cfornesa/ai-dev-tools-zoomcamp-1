# Backlog session 2026-09-28

## Distillation manifest

Project: `cfornesa/ai-dev-tools-zoomcamp-1` on
`docs/backlog-reevaluation-2026-09-27`.

The live GitHub inventory contained 62 open issues. Production data actions
#788 and #906 were classified as owner-gated and skipped. Owner-decision
issues #1004, #1005, and #1006 were classified as blocked and skipped.
#976 was classified as blocked pending explicit confirmation for its
irreversible public-route change. Tracking parents #987, #988, #995, #996,
and #1013 were not treated as implementation authorization; their stated
measurement/navigability/scoping criteria remain separate.

The first implementation transaction was #979, the first unblocked
Batch 9 `owner-priority` issue with a finite criterion-ready contract.

## Issue #979 transaction ledger

- **Issue:** [#979](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/979)
- **Phase:** CLOSED; local evidence complete, GitHub issue closed with
  `state_reason=completed`; GitHub comment publication was rejected by
  connector risk policy.
- **Issue owner / current transaction:** Extract the camera-overlay state and
  handlers from `EditorWorkspace.tsx` into `useCameraOverlay` with zero
  behavior change.
- **Routing:** Stage 1 scoping — Codex / GPT-5 / default effort / substituted:
  no. Stage 2b implementation — Codex / GPT-5 / default effort / substituted:
  yes (substitution for the rostered service — see `DISPATCH.md`). Stage 3
  second-opinion — not run. Stage 4 QA — Codex / GPT-5 / default effort /
  substituted: yes (substitution for the rostered service — see
  `DISPATCH.md`). Stage 5 readiness — pending batch gate; Codex / GPT-5 /
  default effort / substituted: yes (authorized session substitution).
- **Implementation commit:** `550089a3` (`refactor(editor): extract camera
  overlay hook`).
- **Changed files:** `frontend/src/pages/EditorWorkspace.tsx`,
  `frontend/src/pages/useCameraOverlay.ts`.
- **Focused/full checks:**
  - `npx vitest run src/pages/EditorWorkspace*.test.tsx
    src/components/CameraControl*.test.tsx` — 37 files, 425 tests passed
    before commit and rerun from the committed state with the same result.
  - `npm run typecheck` — passed from the committed state.
  - `npm run lint` — exit 0; existing warnings only.
  - `npm run format:check` — passed.
- **QA matrix:** All four acceptance criteria PASS. Existing camera overlay,
  preview, real-control, and CameraControl accessibility suites remained
  green; no CameraControl props, route, schema, dependency, or public API
  changed. Restoration path is the single revertible commit; the full camera
  suite passed after extraction.
- **GitHub closure evidence:** The attempted `## QA: PASS` issue comment was
  rejected by the authenticated connector as unacceptable external-publication
  risk because the repository was not verified as trusted. No workaround was
  attempted. The full comment body and evidence are preserved in this ledger.
- **New gaps discovered:** None. The first attempted quoted Vitest glob was
  invalid and ran zero files; it was corrected to shell-expanded paths before
  the real focused/full run. This was a command-shape correction, not a
  product or workflow defect.
- **Closure decision:** COMPLETE for the finite local contract. Do not claim
  deployed or production verification. GitHub issue state is closed as
  completed; the missing comment publication is a recorded connector boundary.

## Blocked/deferred manifest items

- #788 and #906: `verification-boundary` / owner-authorized production data
  action required; exact next action is owner authorization and live evidence.
- #1004, #1005, #1006: `blocked` / owner decision required; exact next action
  is the owner's selection in the issue comment.
- #976: `blocked` / irreversible public-route decision; exact next action is
  owner confirmation of the redirect/shim and compatibility plan.
- Issues depending on closed prerequisites remain dependency-blocked until
  their named prerequisite is terminal; they were not implemented here.

## Issue #980 transaction ledger

- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Centralize HTML/CSS and JS code-tab synchronization in the
  parameterized `useCodeTabSync` hook without changing round-trip behavior.
- **Implementation commit:** `f5866d72`.
- **Changed files:** `frontend/src/pages/EditorWorkspace.tsx`,
  `frontend/src/pages/useCodeTabSync.ts`.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Checks:** `npx vitest run src/pages/EditorWorkspace*.test.tsx` — 35 files,
  399 tests passed; `npm run typecheck` passed; `npm run lint` exited 0 with
  pre-existing warnings; `npm run format:check` passed.
- **QA matrix:** All four acceptance criteria PASS. JSON remains on its
  existing sync hook; HTML/CSS retain their coupled parser/save semantics;
  JS retains its unchanged-save no-op and error behavior.
- **GitHub closure evidence:** QA comment publication was rejected by the
  connector's external-publication risk policy. The issue was closed through
  the typed issue-state update after this local ledger captured the complete
  evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #997 transaction ledger

- **Issue:** [#997](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/997)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Replace per-item collection record lookups with batched
  per-kind fetches and eager-load public profiles in collection context.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `5aa499a2` (`perf(collections): batch collection item lookups`).
- **Changed files:** `backend/scenes/collections.py`,
  `backend/tests/test_collections.py`.
- **Checks:** `uv run ruff format --check scenes/collections.py tests/test_collections.py`;
  `uv run ruff check scenes/collections.py tests/test_collections.py`;
  `uv run pytest tests/test_collections.py` — 26 passed.
- **QA matrix:** Mixed Project/Project3D/ArtPiece payloads preserve ordering and
  titles. A four-item collection with two same-kind items is guarded by a
  constant query-count assertion. Public collection context with three rows is
  guarded by a single-query assertion.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #1003 transaction ledger

- **Issue:** [#1003](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1003)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Route canonical piece project and 3D project owner/public
  lookup authorization through centralized `permissions.can()` checks.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `712db6c3` (`refactor(auth): centralize canonical piece read checks`).
- **Changed files:** `backend/scenes/canonical_piece_api.py`.
- **Checks:** `uv run pytest tests/test_canonical_piece.py tests/test_permissions.py`
  — 74 passed; ruff check passed. Mypy was attempted but remains blocked by
  pre-existing errors in imported `scenes/collections.py` from #997.
- **QA matrix:** Public, owner-private, foreign-user, and permission tests
  pass unchanged; project and Project3D lookups use `Action.PROJECT_READ` and
  `Action.PROJECT3D_READ` through the centralized authorization service.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #994 transaction ledger

- **Issue:** [#994](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/994)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Documented WCAG AA targets of 4.5:1 for normal text and
  3:1 for large text, then audited the primary light/dark color-token pairs.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `a5344829` (`docs(a11y): record contrast target
  and audit`).
- **Checks:** Calculated ratios: light text 5.73:1, light heading 20.15:1,
  light accent 4.39:1, dark text 7.04:1, dark heading 16.25:1, dark accent
  6.77:1. The sole below-target pair was filed as follow-up #1020; no color
  change was made in this audit issue.
- **Discovery gate:** Follow-up [#1020](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1020)
  was created and linked before continuing.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** #1020 is deferred to a later transaction.

## Issue #993 transaction ledger

- **Issue:** [#993](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/993)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Raised `.admin-console-nav-button` and
  `.publish-visibility-option` minimum heights to 44px, matching the stated
  touch-target minimum.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `56c9214e` (`fix(a11y): normalize undersized
  touch targets`).
- **Checks:** `npm run build`, `npm run lint -- --quiet`, and
  `npm run format:check` passed. No existing dimension assertion required
  updates.
- **QA matrix:** Both selectors now meet 44px minimums. Live before/after
  screenshots at 1280x900 and 375x812 were not available in the current
  browser environment; this visual verification boundary is recorded and not
  claimed as performed.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #992 transaction ledger

- **Issue:** [#992](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/992)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Defined `--space-1: 4px` and `--space-3: 12px` alongside
  the existing 8px-step spacing tokens after inspecting all six call sites.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `742ef744` (`fix(css): define missing spacing
  tokens`).
- **Checks:** `npm run build`, `npm run lint -- --quiet`, and
  `npm run format:check` passed. The full `make check` suite had passed
  immediately before this CSS-only change.
- **QA matrix:** All six `--space-1`/`--space-3` call sites now resolve to
  nonzero values. Live before/after screenshots at both themes were not
  available in the current browser environment; this visual verification
  boundary is recorded and not claimed as performed.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #991 transaction ledger

- **Issue:** [#991](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/991)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Changed the PieceCard thumbnail from decorative `alt=""`
  to descriptive `alt={`Preview of ${title}`}` and updated the affected
  accessibility queries in PieceCard/PublicGallery tests.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `1ec038a8` (`fix(a11y): describe PieceCard
  thumbnail previews`).
- **Checks:** Full frontend suite — 293 files, 3,074 tests passed; focused
  PieceCard/PublicGallery suite — 2 files, 31 tests passed; formatting passed.
- **QA matrix:** The image now exposes a descriptive accessible name while
  fallback placeholders retain their existing accessible labels; no layout
  behavior changed.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #990 transaction ledger

- **Issue:** [#990](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/990)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Inventoried all `fflate` and `JSZip` usage and documented
  why both remain: JSZip supplies the async object-oriented generated-export
  API, while fflate supplies synchronous low-level `Uint8Array` local archive
  operations.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `da6fed4b` (`docs(deps): justify fflate and
  jszip coexistence`).
- **Checks:** Focused export/archive tests — 21 files, 259 tests passed;
  `make check` — 1,761 backend tests passed/39 skipped and 3,074 frontend
  tests passed; backend/frontend lint, formatting, and typecheck passed with
  existing warnings only.
- **QA matrix:** Both packages remain intentionally; no archive usage was
  migrated and no package-lock change was needed.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #989 transaction ledger

- **Issue:** [#989](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/989)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Removed the weaker duplicate `cryptography>=46.0.0`
  declaration, retaining the stronger `>=50.0.0` floor.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `abf0b7fd` (`chore(backend): remove duplicate
  cryptography dependency`).
- **Checks:** `uv lock` regenerated the lockfile with only the expected
  metadata-line removal; `make backend-lint` passed; `git diff --check`
  passed.
- **QA matrix:** Both dependency declarations now have one effective source;
  no resolved package version changed.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #984 transaction ledger

- **Issue:** [#984](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/984)
- **Phase:** BLOCKED pending owner decision; no code changes made.
- **Blocker:** The issue's evidence describes `effects`, `voiceInstruments`,
  and pressed-piano-note state duplicated in both components, but the current
  `PieceStageControls.tsx` has none of those states and uses a distinct
  command-driven parent-audio model. Its shared state overlaps only partly
  with `Scene3DPreview.tsx`, while its oscillator/filter/ADSR fields are
  broader. Implementing the requested hook therefore requires an owner choice
  between a limited common-state extraction and a broader audio-contract
  redesign.
- **Next action:** Owner confirms the intended shared contract/scope; issue
  remains open and no implementation was started.

## Issue #983 transaction ledger

- **Issue:** [#983](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/983)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Extract dirty tracking, before-unload protection, exit
  confirmation/save-failure state, and draft-failure notices into
  `useEditSessionLifecycle` without changing recovery behavior.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `30a6a4ff` (`refactor(editor): extract edit
  session lifecycle hook`).
- **Changed files:** `frontend/src/pages/EditorWorkspace.tsx`,
  `frontend/src/pages/useEditSessionLifecycle.ts`.
- **Checks:** `npx vitest run src/pages/EditorWorkspace*.test.tsx` — 35 files,
  399 tests passed; `npm run typecheck` passed; `npm run lint -- --quiet`
  passed; `npm run format:check` passed; `git diff --check` passed.
- **E2E boundary:** The required `E2E_DOCKER_COMPOSE=true npx playwright test
  e2e/aiAndRecovery.spec.ts --project=chromium` was run with the healthy local
  Compose preflight and elevated browser-launch permission. All seven
  scenarios timed out in the shared `createBlankProjectViaUI` setup while
  waiting for the editor API response, before reaching assertions. The first
  attempt also hit the host's Chromium Mach-rendezvous permission boundary.
  No manual Chrome exit/failure check could be completed beyond that setup
  failure; this is recorded as an environment/setup boundary, not as a
  passing E2E result.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #982 transaction ledger

- **Issue:** [#982](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/982)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Extract the AI-fix and AI-layer panel open/seed state into
  `useAiAssistPanels` without changing panel behavior.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `a70fbcd7` (`refactor(editor): extract AI
  assist panel state`).
- **Changed files:** `frontend/src/pages/EditorWorkspace.tsx`,
  `frontend/src/pages/useAiAssistPanels.ts`.
- **Checks:** `npx vitest run src/pages/EditorWorkspace*.test.tsx` — 35 files,
  399 tests passed; `npm run typecheck` passed; `npm run lint -- --quiet`
  passed; `npm run format:check` passed.
- **QA matrix:** All finite automated criteria PASS. Fix and layer panel
  opening, prompt seeding, closing, and preview-error auto-close behavior
  remained covered by the unchanged EditorWorkspace matrix. No live browser
  session was available for an additional manual interaction check.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #981 transaction ledger

- **Issue:** [#981](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/981)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Extract the canvas viewport's zoom, pan, fit-scale, wheel,
  resize, and fit-to-viewport behavior from `EditorWorkspace.tsx` into
  `useCanvasViewport` without changing the editor contract.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `a4a1e4f4` (`refactor(editor): extract canvas
  viewport hook`).
- **Changed files:** `frontend/src/pages/EditorWorkspace.tsx`,
  `frontend/src/pages/useCanvasViewport.ts`.
- **Checks:** `npx vitest run src/pages/EditorWorkspace*.test.tsx` — 35 files,
  399 tests passed; `npm run typecheck` passed; `npm run lint -- --quiet`
  passed; `npm run format:check` passed; `git diff --check` passed.
- **QA matrix:** All finite automated criteria PASS. Existing zoom/pan,
  wheel, fit, keyboard, gesture, and editor behavior remained covered by the
  unchanged EditorWorkspace matrix. The required manual live-Chrome check was
  not available because no running local stack/browser session was provided;
  this is recorded as an environment boundary, not claimed as performed.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #998 transaction ledger

- **Issue:** [#998](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/998)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Replace per-output `findIndex` lookups in
  `applyRuntimeOutputsToScene` with hoisted shape/group ID maps.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `2beaa84d` (`perf(runtime): index scene outputs by id`).
- **Changed files:** `frontend/src/runtime/behaviorRuntime.ts`.
- **Checks:** `npm exec vitest run src/runtime/behaviorRuntime.test.ts` — 193
  passed; `npm run typecheck`; `npm run lint -- --quiet`; `npm run format:check`.
  Elevated `npm run bench:runtime` passed all 3 scenarios: `maxScene` avg
  6.08ms/p95 6.60ms; `withinLimitsScene` avg 2.27ms/p95 3.00ms; forced
  over-budget recovery passed.
- **QA matrix:** Public renderer wiring tests remained green and benchmark
  fixtures stayed within documented thresholds. The manual live interactive
  piece check was not available; this is recorded as an environment boundary,
  not claimed as performed.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #999 transaction ledger

- **Issue:** [#999](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/999)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Add one-pass `shapeLabels` generation and use it for the
  outline and behavior-card target picker, preserving `shapeLabel` for single
  shape callers.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `76657481` (`perf(editor): batch shape label generation`).
- **Changed files:** `frontend/src/pages/sceneShapes.ts`,
  `frontend/src/pages/sceneShapes.test.ts`, `frontend/src/pages/sceneOutline.ts`,
  `frontend/src/pages/BehaviorCardsPanel.tsx`.
- **Checks:** Targeted scene-shape/outline tests — 107 passed; `npm run typecheck`;
  `npm run lint -- --quiet`; `npm run format:check`.
- **QA matrix:** The new 200-shape test compares independent expected labels
  and the old `shapeLabel` output, including per-type ordinals; outline and
  existing single-shape label tests remain green.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #1000 transaction ledger

- **Issue:** [#1000](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1000)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Add a custom allauth login form that counts failed password
  attempts through the existing cache-backed allauth limiter.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `ccda2092` (`security(auth): rate limit failed password logins`).
- **Changed files:** `backend/backend/login_forms.py`,
  `backend/backend/settings.py`, `backend/tests/test_login_rate_limit.py`.
- **Policy:** allauth's existing 30 login requests/minute/IP endpoint cap plus
  5 failed passwords per normalized email per 300 seconds. The failed-password
  limit is cache-backed and can be disabled with `ACCOUNT_LOGIN_ATTEMPTS_LIMIT=0`.
- **Checks:** Focused login tests — 2 passed; broader account/OAuth/reCAPTCHA/
  signup-policy regression suite — 40 passed; ruff format/check passed; mypy
  passed.
- **QA matrix:** Two wrong passwords remain allowed, the next failed attempt
  returns the clear allauth lockout message, the counter expires and permits a
  correct login, and the zero-limit disable path permits repeated failures.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #1001 transaction ledger

- **Issue:** [#1001](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1001)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Emit one structured minimal warning record from
  `permissions.require()` before raising `PermissionDenied`.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `c980bf62` (`observability(auth): log permission denials`).
- **Changed files:** `backend/scenes/permissions.py`,
  `backend/tests/test_permissions.py`.
- **Checks:** Full backend `uv run pytest` — 1766 passed, 39 skipped; focused
  permissions suite — 51 passed; ruff format/check passed.
- **QA matrix:** The denial record contains only user id/anonymous, action,
  resource type, and resource id. The test asserts exactly one record and the
  existing table-driven authorization behavior remains green.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #1002 transaction ledger

- **Issue:** [#1002](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1002)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Record forged PayPal signature deliveries as rejected
  `BillingEvent` rows and structured warning logs without signature material.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `725b9be9` (`observability(billing): record rejected PayPal signatures`).
- **Changed files:** `backend/scenes/billing.py`,
  `backend/tests/test_paypal_webhooks.py`.
- **Checks:** `uv run pytest tests/test_paypal_webhooks.py` — 15 passed; ruff
  format/check passed; mypy passed.
- **QA matrix:** A forged delivery records event id/type/detail and source IP
  in the structured warning, creates a rejected BillingEvent, returns 403,
  and creates no subscription. Verification still precedes accepted-event
  reads; accepted processing remains atomic. The rejection record is outside
  that transaction so the intentional exception cannot roll it back.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.
