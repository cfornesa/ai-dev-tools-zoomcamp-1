# Backlog session — batch 19 (2026-10-02)

## Scope and gate

Authenticated GitHub search returned 21 open issues: #1096, #1100, #1102–#1104,
#1129–#1130, #1138–#1140, #1143–#1144, and #1149–#1157. No issue is treated
as closed based on a local commit. Batch gate: **pending**; this record is a
continuation of the active backlog session, not a declaration that the project
batch is complete.

Owner choices now resolved: #1129 selected the private server-backed 2D
`Project.brief` field; #1130 selected owner-only history for structured 3D then
generated ArtPieces, tracked by #1156 and #1157. Their comments, `DECISIONS.md`,
and `docs/ligdol-adaptation.md` agree. Decision issues remain open until batch
reconciliation.

## Current manifest

| Issue | Milestone | Current state | Commit / next gate |
|---|---:|---|---|
| #1096 | 14 | Open; CI tracking/hand-off | Full 16-shard outcome and failure reconciliation |
| #1100 | 14 | Open; implementation/QA status carried from batch 18 | Linux Chromium six-spec gate |
| #1102 | 14 | Open; implementation/QA status carried from batch 18 | Linux Chromium child gate |
| #1103 | 14 | Open; QA failures carried from batch 18 | Resolve linked failures; Linux Chromium |
| #1104 | 14 | Open; QA failures carried from batch 18 | Resolve linked failures; Linux Chromium |
| #1129 | 16 | Owner decision recorded; awaiting batch reconciliation | Close only after batch gate |
| #1130 | 16 | Owner decision and follow-ups recorded; awaiting batch reconciliation | Close only after batch gate |
| #1138 | 16 | Implemented locally; batch QA pending | `d40f4a8a`; full impact/QA gate |
| #1139 | 16 | Implemented locally; browser/screenshot QA pending | `3019c228`, `271678ea`, `6cf487d7`; disposable E2E and inspect 1280x900 / 375x812 |
| #1140 | 16 | Implemented locally; browser/CI criterion pending | `8100a4b9`; fake-provider E2E and full CI |
| #1143 | 16 | Implemented locally; batch/CI reconciliation pending | Prior batch record; fresh CI evidence pending |
| #1144 | 14 | Open; Linux/visual evidence pending | Full batch browser gate |
| #1149 | 16 | Open; local failures tracked in batch 18 | Resolve #1154 path and Linux browser gate |
| #1150 | 14 | Open; focused Linux scenarios pass; full batch gate pending | `7b13c231`; run #1082 on exact ancestor implementation |
| #1151 | 14 | Open; focused Linux scenarios pass; full batch gate pending | `bd32cae9`; run #1082 on exact ancestor implementation |
| #1152 | 14 | Open; re-scoped test implementation committed; updated boundary browser test pending | `510fcaf3`; Linux Chromium #1096 gate |
| #1153 | 14 | Open; refined follow-up | E2E and Linux gate |
| #1154 | 16 | Open; fake-provider Agent run follow-up | E2E/CI gate |
| #1155 | 14 | QA: FAIL / handed off at Linux verification boundary; current local evidence posted to GitHub | Existing guard commit; isolated `gesture_studio_test` smoke 1/1, all fixture counts zero afterward; Linux/full matrix pending |
| #1156 | 16 | Open; implementation committed; batch QA pending | `e28a57a3`; batch gate and Linux full-matrix reconciliation |
| #1157 | 16 | QA: FAIL / handed off at shared Linux batch gate; criterion matrix posted to GitHub | `6b2f9cb1`; focused union 125 passed / 4 skipped; full backend-check 2,012 passed / 44 skipped; configured PostgreSQL concurrency 1 passed |

Stage owner provenance for this continuation: stage 1 / Codex (this session) /
GPT-6 / effort not surfaced / substituted: no. Stage 2 for #1140 / rostered
Ollama Cloud / actual Codex (this session), GPT-6 / effort not surfaced /
substituted: yes. Stage 2 for #1156 / rostered Ollama Cloud / actual Codex
(this session), GPT-6 / effort not surfaced / substituted: yes. Stage 2 for
#1139 browser-coverage addition / rostered Opencode Go / actual Codex subagent,
GPT-6.1-sol / effort not surfaced / substituted: yes. Stage 2 for #1157 /
rostered Ollama Cloud / actual Codex subagent, GPT-6.1-sol / effort not
surfaced / substituted: yes. Stage 2 for #1152 / rostered
Opencode Go / actual Codex subagent, GPT-6.1-sol / effort not surfaced /
substituted: yes. #1150 and #1151 code predates the
refined issue contracts on this branch; no duplicate implementation commits
were manufactured. Stage 3:
not run (no independent-family review). Stage 4: #1157 issue-level QA PASS by
a separate Codex GPT-6 subagent (substituted for rostered Claude Sonnet 5
Medium); the other issue matrices and comments remain in progress.

## Impact matrix — intent-note surfaces against all open issues

| Surface | Issue(s) | Open-issue collisions | Resolution / required re-verification |
|---|---|---|---|
| `backend/scenes/models.py`, migrations `0110`/`0111`, `docs/api.md`, account export/deletion, serializers, backup/sync, public projections | #1138, #1140 | #1130 decision, #1143 metrics contract, #1156/#1157 shared model/export docs | Preserve owner-only 2D field and export/deletion behavior; tests assert public/package/fork/cloud exclusion. #1156/#1157 own later history schema changes; migrations serialize after `0111`. |
| `backend/scenes/ai_runs.py`, `ai_runs_api.py`, `AIRun` model, `tests/test_ai_runs.py` | #1140 | #1154 AI-run fake-provider recovery; #1149 canonical AI Agent E2E; #1156 later 3D AI activity | Reuse one prompt builder for all attempts; note snapshot only for 2D; preserve empty-note prompt/digest bytes and 3D behavior. Re-run AI runs, corpus, layer-preservation and full backend suites. |
| `frontend/src/pages/EditorDetailsPanel.tsx` / test and metadata persistence | #1139 | #1138 contract/Project shape; public canonical route privacy criterion | Note uses existing metadata save path, helper/label/counter/clear and pending-save behavior covered by component tests; screenshot review at both specified viewports still required. |
| `frontend/e2e/privateIntentNote.spec.ts` | #1139 | #1100 server-backed 2D helper; #1096 Linux browser gate | Added commit `6cf487d7`; saves/reloads, checks ARIA description and bounds at 1280x900/375x812, and verifies no private note/helper on public canonical route. Discovery and unit checks pass; actual browser and rendered evidence remain pending. |
| `frontend/e2e/support/saveScene.ts` and scene-save E2E call sites | #1150 | #1103 migration batch; #1151/#1152 assertions in `interactionRuntime`/`layersPanel`; #1096 Linux gate | Existing ancestor commit `7b13c231` scopes the canonical Save scene action. Run #1082 exact SHA includes this commit: named AI draft save passed; historical-version export passed; lifecycle save/history/restore cases passed; relevant publish setup passed. Full matrix still failed on a separate atomic-fork case in `publishingAndRemix`. |
| `frontend/e2e/interactionRuntime.spec.ts` and shared editor control helpers | #1151 | #1150 `saveScene`; #1152 Layers panel ordering stays separate; #1096 Linux gate | Existing ancestor implementation retargets the motion toggle and current editor action helpers while preserving runtime/persistence assertions. Run #1082 exact SHA passed all 3 interactionRuntime cases (Linux Chromium/PostgreSQL). The overall 16-shard matrix failed elsewhere. |
| `frontend/e2e/layersPanel.spec.ts` | #1152 | #1103 migration assertions; #1111/#1114 responsive 2D layout regression; #1150 save helper; #1151 shared current-editor controls; #1096 Linux gate | Commit `510fcaf3` adds explicit first/last layer-move enabled/disabled checks while retaining pointer+keyboard reverse, canvas/panel order, save/reload and no-duplicate assertions. Focused outline unit tests 127 passed, typecheck/lint/format/discovery passed; run #1082 passed the pre-boundary update scenario, but not the new boundary assertions. |
| `frontend/src/pages/AIProposalPanel.tsx`, `AIRunPanel.tsx`, `useAIRun.ts`, `EditorWorkspace.tsx`, `frontend/e2e/aiIntentNotes.spec.ts` | #1140 | #1149 AI route retargeting; #1154 fake-provider Agent runs | Keep note disclosure confined to server-backed 2D Agent flow; per-request checkbox state resets; isolated E2E test checks disclosure and request opt-out. `aiAgent2d.spec.ts` test and expect counts are preserved for #1149. Current-SHA Linux CI run #36977977163 is the required browser evidence. |
| Full `make check` and shared AI/backend tests | #1138–#1140 | #1143 and all other open issues | Current local union gate passed: backend lint/format/typecheck and 2,038 collected tests; frontend lint (existing warnings), format/typecheck and 3,228 Vitest tests. CI full 16-shard run completed with browser failures. |
| `ProjectActivity` family FKs/constraint/index, shared activity view/cursor, 3D lifecycle and AIRun writers, private export, API docs | #1156 | #1133/#1148 2D projection/export; #1143 metrics; #1157 shared schema/view; #1096 Linux browser gate | Serialized after actual migration leaf `0111_airun_intent_note` as `0112`; preserved 2D response bytes with a golden test; separate 3D cursor salt; package intake/conversion/initial creation remain eventless; 2D metrics and public serialization unchanged. |
| `ProjectActivity` ArtPiece FK/constraint/index, shared family API/export/deletion boundaries and API docs | #1157 | #1156 schema/view; #1138/#1148 export; #1143 remains 2D-only; packages/cloud backup/public routes must exclude logs | Commit `6b2f9cb1` adds migration `0113`, eventless initial/import/refine-accept paths, version/publish transition writers, owner-only activity and export, privacy/cursor/cascade/package/cloud tests. Focused union 125 passed / 4 skipped; full backend-check 2,012 passed / 44 skipped; migration drift clean. Separate configured PostgreSQL test DB concurrency check passed (1 passed, 5 deselected). Stage 4 criterion matrix posted as `## QA: FAIL`; Linux full-matrix gate remains pending. |

Open issue-body scan confirmed shared references: #1154 references `ai_runs.py`
and `test_ai_runs.py`; #1149 references `aiAgent2d.spec.ts`; #1138, #1143,
#1156, and #1157 reference `docs/api.md`; #1129/#1130 reference the decision
record. Other open issues remain listed in the manifest and in
`.local/tasks/backlog-session-2026-10-01-batch18.md`; no unrelated issue is
silently omitted from the batch.

## Verification and external run state

- Final frontend gate after the issue implementation commits: `make frontend-check` passed lint (exit 0 with existing repository warnings), Prettier, TypeScript build/typecheck, and Vitest (316 files, 3,228 tests passed). #1157's final-tree backend gate passed separately (`make backend-check`: 2,012 passed, 44 skipped), so both local check halves have current-tree evidence without rerunning the already completed backend suite.
- Focused backend: `uv run ruff format ...`; `uv run pytest tests/test_ai_runs.py tests/test_account_deletion.py` → 90 passed, 4 skipped.
- Migration drift: `DJANGO_SETTINGS_MODULE=backend.test_settings uv run python manage.py makemigrations --check --dry-run` → no changes detected.
- Focused frontend: `npm test -- --run src/pages/AIProposalPanel.test.tsx src/pages/EditorDetailsPanel.test.tsx` → 39 passed; typecheck and format passed; lint exited successfully with repository warnings.
- Full local `UV_CACHE_DIR=/tmp/codex-uv-cache-batch19 make check`: backend and frontend gates completed; backend collected 2,038 tests; frontend Vitest reported 316 files / 3,228 tests passed. Existing lint/deprecation/media stubs emitted warnings.
- E2E discoverability: `npx playwright test --list e2e/aiAgent2d.spec.ts` → 5 tests listed; `npx playwright test --list e2e/aiIntentNotes.spec.ts` → 1 test listed. The #1140 test is isolated so #1149's test and expect counts remain at baseline. Real E2E is not run locally because the current browser tab is anonymous and the running local stack is not verified as disposable; never run fixture setup against a shared database.
- Push of `9db8a58480bfcf5b6493623ad341b5dbe54e0dd6` to the already-authorized branch updated PR #1094; no merge was performed.
- PR run `36977203802` on `8100a4b9` was cancelled after the follow-up test relocation; manual full 16-shard run `36977291895` was superseded. Corrected full 16-shard run `36977977163` finished on SHA `9db8a58480bfcf5b6493623ad341b5dbe54e0dd6`: workflow validation, backend, frontend, and disposable published-routing smoke passed; browser shards 1–16 failed. Failing specs include the open helper-migration/retarget issues (#1100–#1104, #1144, #1149–#1153) plus additional unmapped failures. The run predates #1156 commit `e28a57a3`; dispatch a fresh current-head run after this implementation wave. No merge was performed.
- #1156: commit `e28a57a3`. `UV_CACHE_DIR=/tmp/codex-uv-cache-batch19 make backend-check` passed Ruff, formatting, mypy, and pytest (2,003 passed, 43 skipped). Focused union after adding package-import/conversion eventless regressions: 169 passed, 5 skipped. `DJANGO_SETTINGS_MODULE=backend.test_settings uv run python manage.py makemigrations --check --dry-run` → no changes detected. The issue's `tests/test_ai_api3d.py` path is stale; used current `tests/test_ai_scene3d_api.py`.
- Remaining boundaries before any #1138–#1140 QA PASS: inspect rendered #1139 screenshots at 1280x900 and 375x812; obtain #1140 fake-provider browser evidence; finish impact-matrix cross-check and review current CI results. No `## QA` comments or GitHub state changes have been made for these issues.

## Reconciliation rule

Do not close issues until the complete ready batch's QA/matrix gate passes or the
issue has a documented terminal hand-off/blocker with next owner/action. Browser
contracts requiring Linux evidence must use CI; local source, component, and
list-only E2E checks do not substitute. PR #1094 remains open and unmerged.

## QA continuation — run #1074 on current head (2026-10-02)

Run #1074 (`36980587136`, SHA `247cae26b6ebb383f812e6ab19a08367e10dadcd`)
completed on Ubuntu 24.04. Workflow validation, backend checks, frontend checks,
and disposable published-routing smoke passed. All 16 browser shards failed
their full-suite step. The failed specs include existing in-scope work and many
additional independently owned historical contracts; therefore the batch QA
gate remains FAIL and no issue closure is reconciled from this run.

Targeted current-batch evidence extracted from the completed shard logs:

- #1100's six Linux Chromium helper-migration specs all passed in the matrix:
  `cameraPreview3d`, `drawingPlaneAframe796`, `immersive3dRouteParity`,
  `manual3dOutlineSelection`, `manual3dStageChrome`, and
  `public3dRouteStageChrome`. A `## QA: PASS` criterion matrix was posted to
  GitHub issue #1100 (comment 5947955377). Its issue state remains open because
  the shared batch gate has not passed.
- #1102's `legacy2dToolset` failure in shard 9 of run #1082 was traced to its
  shared publish fixture checking `visibility-status` while the closed File
  menu hid that control. The test now opens File after reload and before the
  unchanged publication-status assertion. Commit `5ffc0577` contains only
  this #1102 setup correction and is pushed to the authorized branch. Static
  verification passed (`npm run typecheck`, `npm run lint` with existing
  warnings, `npm run format:check`, `git diff --check`). The Linux rerun is
  pending; #1102 remains open.
- #1102's `public2dRouteStageChrome` failure from the prior full-matrix run is
  resolved by `dc4cc882` and passed in shard 13 of #1082. Other listed cases
  visible in run #1082 include passing `inkLayer2d`,
  `manual2dCanvasContainment`, `manual2dMediaLibrary`, `manual2dStageChrome`,
  `savedModels`, and `pieceSlugEdit750`. The helper setup failure in
  `legacy2dToolset` is a 31.6s test timeout; `public2dRouteStageChrome` also
  timed out. This issue stays open / QA FAIL.
- #1103's four migrated files ran successfully in their applicable scenarios:
  `aiAndRecovery` (including fake-provider AI scenarios), `layersPanel`,
  `interactionRuntime`, and `exportConfigDialog`. This does not make the full
  matrix green; assertion/test-count and exact focused-command evidence still
  need to be recorded before a final issue verdict.
- #1104's lifecycle scenarios and responsive-shell cases passed, but the
  authenticated atomic-fork test in `publishingAndRemix` timed out, and
  `manual3dLayoutParity`, `manual3dPublicationLifecycle`, and `manualEdit3d`
  failed in the matrix. Issue QA remains FAIL pending cause classification.
- #1144's named public proportions and route-stage-chrome tests passed; its
  screenshot inspection criterion at 1280x900 and 375x812 is still unmet.
- #1149's current-route 2D/3D Agent flows and #1140's intent-note browser test
  passed in the full run. The eight-scenario #1154 fake-provider contract still
  needs exact per-spec executed/skipped inventory; this run also had failures
  elsewhere and does not satisfy #1096.
- #1150, #1151, and #1152 target cases passed (`aiAndRecovery`,
  `interactionRuntime`, and `layersPanel`). #1153's targeted publication path
  partly passed, but the companion fork scenario timed out. These remain
  unclosed until their complete acceptance matrices and cross-issue gate are
  reconciled.
- #1140 issue-level QA completed on 2026-10-02. Snapshot storage is the
  compatible choice: it freezes `Project.brief` at run start, keeps it
  separate from the prompt and API response, preserves retry context when the
  brief changes, and follows the existing `AIRun` settings-snapshot pattern.
  The additive bounded column is cleared on account deletion. Focused
  verification passed: `tests/test_ai_runs.py` (76 passed, 3 skipped),
  `tests -k "ai_run or prompt or corpus"` (163 passed, 3 skipped),
  `tests/test_account_deletion.py` (14 passed, 1 skipped), and
  `AIProposalPanel.test.tsx` (26 passed). The isolated Linux Chromium
  `aiIntentNotes.spec.ts` also passed in shard 3 of current-SHA run #1082
  (`dc4cc8826f1ff6355d21b3f30bfc26a6b8f9373f`). Posted issue comment
  #5950120078 with the per-criterion matrix and stage substitutions. This is
  issue-level QA PASS only; run #1082's full 16-shard matrix failed, so #1140
  remains open pending batch reconciliation.
- Owner reaffirmed the #1140 storage choice on 2026-10-02 after asking which
  option best fits persistent project notes and repo standards: snapshot the
  private project note onto `AIRun` at submission. This keeps retry context
  stable when `Project.brief` changes and follows the existing server-side run
  snapshot pattern. The private copy remains subject to the #1140 export,
  privacy, and account-deletion checks; it must not be mixed into the prompt or
  exposed in public responses.
- #1154's complete eight-case Linux browser coverage is present in run #1082
  at the current tested SHA: `aiAgent2d.spec.ts` passed 4/4 in shard 2 and
  `aiAgent3d.spec.ts` passed 4/4 in shard 3, with no skips in either file.
  Fresh focused backend tests passed (`test_ai_runs.py`,
  `test_e2e_provider_3d.py`, `test_ai_provider_matrix.py`, and
  `test_ai_drawing_plane_edit.py`: 155 passed, 3 skipped); frontend typecheck,
  lint (existing warnings), and Prettier passed. The issue's requested
  per-run diagnostics table is still absent from the original failed-run
  artifacts, so do not supersede the existing QA FAIL until that evidence
  refinement is explicitly reconciled. The full #1096 matrix is also FAIL.
- Other failing, non-batch specs include stale/mismatched route, fixture,
  locator, visual, and timeout expectations across all 16 shards. Exact
  first-cause classification and criterion-ready follow-up links required by
  #1096 are not complete. Do not claim a green or closure-ready matrix.

GitHub state after this continuation: all 21 manifest issues remain open; no
issue was closed. QA comments are posted for #1100, #1155, and #1157. No new
follow-up issue was filed. #1157's refine-accept path remains eventless because
AI proposal events are out of scope; the existing regression asserts that
behavior. This is an explicit implementation disposition, not an inferred
owner response.

Next action: finish the issue-by-issue criterion matrices and classify every
full-matrix failure, then file/reuse linked follow-ups only after owner
authorization where required. Re-dispatch the Linux matrix on the resulting
current head before any batch closure.

## Implementation continuation — browser setup corrections

Run #1074 gives reproducible first causes in current batch tests. The following
setup-only changes target those causes while preserving the product surface:

| Surface | Kind | Issue(s) | Other open issues referencing the surface | Collision / required re-verification |
|---|---|---|---|---|
| `frontend/e2e/legacy2dToolset.spec.ts` publish fixture | Change setup from footer-obstructed dialog click to existing owner publish API | #1102 | #1096 tracks matrix; no other open issue names this spec | Keep public `/p/:id` assertions intact; rerun #1102's full 9-spec Linux Chromium union. |
| `frontend/e2e/public2dRouteStageChrome.spec.ts` publish fixture | Change setup from footer-obstructed dialog click to existing owner publish API | #1102 | #1096 tracks matrix | Preserve both plain/embed route assertions; rerun #1102's full 9-spec Linux Chromium union. |
| `frontend/e2e/publishingAndRemix.spec.ts` forked public viewer navigation | Change readiness from full `load` to `domcontentloaded`; rendered viewer and provenance assertions remain | #1104 | #1153 preserves fork fixtures and the Remix scenario; #1096 tracks matrix | Rerun #1104's 3-spec union and #1153's publishing/Remix affected cases; inspect test/expect inventories. |

Stage 2a roster: Opencode Go (Kimi K2.5 frontend); actual Codex GPT-6 / effort
not surfaced; substituted: yes. Two issue-scoped commits have been created and
pushed to `docs/backlog-reevaluation-2026-09-27`, updating PR #1094:

- #1102: `1d26a2e7 test(e2e): publish route fixtures through API (#1102)`.
- #1104: `53a84a4b test(e2e): await fork viewer document readiness (#1104)`.

Local `npm run typecheck`, `npm run lint`, and `npm run format:check` passed
after these edits (lint produced the repository's existing warnings). Push
started PR run #1075 (`36983290043`) at SHA `53a84a4b`; PR pushes run shard 1
only. One manual full-matrix run, #1076 (`36983770649`), was dispatched from
the active Chrome session at that SHA. Its first shard exposed a second
`page.reload()` using Playwright's default `load` condition in #1104, so #1076
was canceled after 5/16 shards completed; it is superseded and is not a QA
verdict. Corrective commit `4a6ca237` changes the reload to
`domcontentloaded`. Replacement full-matrix run #1078 (`36984841891`) is
executing at SHA `4a6ca2378d499bf80d8421e51d3cdc2bd26895b3`. No merge was
performed.
Focused Linux browser verification and complete #1096 failure classification
remain pending.

QA intake / restoration check for this wave: source diff confirms the #1102
changes are confined to its two named E2E specs; #1104 changes only the named
forked-viewer navigation in `publishingAndRemix.spec.ts`. `test(...)` and
`expect(...)` token inventories are unchanged: #1102 `legacy2dToolset` 2/11
and `public2dRouteStageChrome` 2/25; #1104 `publishingAndRemix` 21/164 (base
and head respectively). This confirms no scenario/assertion inventory was
removed, but does not substitute for the current Linux browser run.

PR run #1075 passed workflow validation, backend, frontend (3,228 Vitest
tests), and disposable published-routing smoke. Its one browser smoke shard
failed three cases: two `authPolicy.spec.ts` background-color checks and
#1104's post-unpublish `anonPage.reload()` waiting for `load`; the other 21
passed. The #1104 failure was returned to engineering and corrected in
`4a6ca237`; the authentication failures are outside this wave and must be
mapped against the open batch before reconciliation.

Open-backlog duplicate search for the two `authPolicy.spec.ts` failures
(`authPolicy background-color`, `Google-only auth pages dark shell`, and
`signup login responsive shell`) returned no open issue. This is a candidate
new actionable cause for #1096, not yet a new issue: owner preference requires
asking before filing discrepancies discovered in CI.

PR run #1077's shard-one E2E smoke at `4a6ca237` passes the previously failing
#1104 fork/provenance scenario; 22 tests passed and only the two
`authPolicy.spec.ts` color checks failed. This is focused evidence only; the
complete #1104 Linux acceptance is still pending from run #1078.

Current replacement run #1078's shard 14 completed with five unrelated browser
failures in `publicGalleryMixedPieces.spec.ts`,
`publicPieceSurfaceContract744.spec.ts`, `publicProfiles.spec.ts`, and two
`publicShell.spec.ts` scenarios; 15 passed and 16 were skipped. The visible
mobile `publicShell` first cause is that the test expects a `Home` link after
opening the hamburger, but no such link is found. An open-issue duplicate
search found no matching issue for these named specs. They are being recorded
for #1096 root-cause mapping; do not change their assertions or open follow-ups
without owner review.

Run #1078 completed at SHA `4a6ca2378d499bf80d8421e51d3cdc2bd26895b3` with
workflow validation, backend checks, frontend checks (316 files / 3,228
Vitest tests), and disposable published-routing smoke passing. All 16/16
Linux browser shards failed their full acceptance step. Shard 1 confirms new
unmapped failures: #1125 `accountComponentStyles` expects a reduced-motion
transition duration exactly `0s` but Chromium computes `1e-05s`; #548's
`accountSettings` expects 11 account-management list items but finds 12. The
other shard outputs still need full extraction and first-cause classification
before #1096 can reconcile. This matrix is an overall FAIL; no issue is closed.

Shard 2 also failed six scenarios: `accountSettingsLayout` (2),
`accountSettingsReorder`, `adminThemeGeneration`, `ai2dPublication`, and
`ai2dResponsive`. The AI tests still navigate to the retired `/ai-projects/`
route or click the removed Gallery item “Create an AI-assisted animation”; the
recorded #1108 is instead a separate open 3D-toolbar locator issue and #1103
owns different 2D helper-migration specs. Duplicate searches for the two AI
spec names did not find a matching current open issue. These are additional
#1096 candidates requiring root-cause mapping and owner review before any new
issue is filed.

Local environment boundary: `make compose-preflight` failed because the Docker
daemon is unavailable. The active Chrome application tab is anonymous at
`http://127.0.0.1:5000/gallery?type=all`, so it cannot provide owner-editor
viewports for #1139. These criteria require an authenticated owner fixture;
they are not claimed as visually inspected. Use CI browser artifacts or
another disposable authenticated browser environment.

## Full failure inventory continuation — run #1078

Re-read the completed shard summaries in the active authenticated Chrome
session. The run remains overall FAIL: all 16/16 full-browser steps failed;
the non-browser workflow validation, backend, frontend, and disposable
published-routing smoke jobs passed. The suite failures are not a single
proven infrastructure cause. Captured failed-spec inventory (the run log's
executed tests, not a claim that these are every failure in the repository):

| Shard | Failed tests/specs observed | Batch relation / first-cause evidence |
|---|---|---|
| 1 | `accountComponentStyles`, `accountSettings` | #1125 and #548 are closed; exact mismatches were recorded earlier (reduced-motion computed `1e-05s`; expected 11 vs actual 12 list items). New corrective scope needs owner review. |
| 2 | `accountSettingsLayout` (2), `accountSettingsReorder`, `adminThemeGeneration`, `ai2dPublication`, `ai2dResponsive` | AI 2D tests still use retired route/menu entry; the rest are separate stale UI expectations. No open issue matching all these contracts was confirmed. |
| 3 | `aiAndRecovery` autosave debounce, explicit save flow, conflict recovery; `aiAuthoringSixEngine743`; `aiMention3d` (2); `aiPanelLayout2d` (3) | `aiAndRecovery` has three distinct causes; AI 3D mention/panel failures use retired routes/surfaces. Relevant shared surfaces include #1103/#1150/#1154, but these named acceptance contracts are not proven covered by those issues. |
| 4 | `aiPanelLayout3d` (3), `aiPlanReview2d`, `aiPlanReview3d`, `aiRegionTargetExisting` mobile, `artPiece2dEditor`, `artPiece3dEditor`, `artPieceCameraRuntime` (2), `artPieceFakeRefinement`, `artPieceFlatSpatial` mobile (2) | Distinct route/interaction/timeouts across older 2D/3D test contracts; no single common cause established by summary. |
| 5 | `artPieceSixEngineEmbed`, `artPieceSixEngineRegular`, `artPieceSteeringRuntime` | Two ratio assertions fail materially (differences .4367/.5136 against <.02); steering locator is ambiguous between hidden/visible “Piece controls” buttons. |
| 6 | `artPieceThumbnailCapture` (2), `authoringOwnershipGate` (2), `authoringWorkflow740`, `authPolicy` (2), `canonicalImmersiveStructuredPiece`, `canonicalStructuredPieceSlug`, `celestialStyle` | Auth, authoring, generated thumbnail and canonical viewer failures span closed historical work. Canonical route details expect `By e2e_owner`; reduced-motion selector is missing. #1125/#548 closed; do not reopen. |
| 7 | `cosmicBackdropStars` (2), `designSchemeMatrix`, `drawingPlane3d` immersive, `drawioEditor`, `editOutputConsistency`, `embedToolbarOrder`, `exportArtifacts` | `exportArtifacts` reports a rendered action button width of 40px against its 44px minimum, a concrete visual contract failure. Other causes remain individually unclassified. |
| 8 | `headerChrome` (3), `headerMobile` (2), `homeHero` (2), `immersiveArtPieceToolset` (3), `immersiveCollection` (2), `injectionArtifacts` (6) | Many historical contracts; shard suite log provided 17 failed cases. No evidence they share a single cause. |
| 9 | `inkLayerGenerated2d`, `legacy2dToolset`, `livePreview`, `localGalleryCards` | `legacy2dToolset` is in #1102 and fails its full test. The other three remain distinct; open issue coverage not confirmed. |
| 10 | `localPieceRoundTripPublish` (3), `manual3dLayoutParity`, `manual3dPublicationLifecycle`, `manualEdit3d` | The three 3D editor lifecycle suites time out while waiting for current route/response behavior and collide with #1104's local-first re-homing scope. The local-only transfer cases are separate. |
| 11 | `piece2dFill`, `pieceRuntimeErrorTemplate` | Two separate rendering/output contracts failed; no current open issue owns either named spec. |
| 12 | `pieceStageSizing`, `pieceTemplateParity2d`, `pieceTemplateParity3d`, `pieceToolbarPlacement`, `profileHandles` (2), `profilePhotoUpload` (2), `profileStyleInheritance`, `project3dLifecycle` (4), `project3dPublicationDiscoverability`, `project3dServerPackageExport` (2) | All 3D project-creation/lifecycle/export failures wait on the old editor/publication route or response and may overlap #1104/#1144; additional CSS/profile failures are independent. |
| 13 | `project3dThumbnailCard` (2), `public2dRouteStageChrome`, `public3dCameraOverlay728`, `public3dCameraPlacement742`, `public3dImmersiveCameraOverlay734`, `public3dToolbar730`, `publicArtPieceToolset` (3), `publicDraw`, `publicGalleryEngine` (2) | Exact log details: #1102's public 2D test passes API publish (HTTP 200), reloads the server-backed editor, then cannot find `visibility-status` at line 46; this conflicts with #1102's setup-only edit boundary and needs route/setup root-cause triage. 3D thumbnail fixtures wait for `/projects3d/:id` but navigate to `/local-projects/:id`; three public 3D camera/toolbar fixtures wait for `POST /api/projects3d/` after opening the current Gallery flow; public 3D camera placement has a strict-mode collision between hidden `Open piece controls menu` shim and visible `Piece controls` button. `publicGalleryEngine` reloads with an empty filter value instead of `c2js-interactive`; actionable contract outside currently open scope. |
| 14 | `publicGalleryMixedPieces`, `publicPieceSurfaceContract744`, `publicProfiles`, `publicShell` (2) | Mobile shell fails to expose expected Home link after hamburger open. No matching open issue found for these specs. |
| 15 | `publishingAndRemix` atomic fork, `regularToolbarMatrix` (4), `relatedPublicProjects` | The related-project fixture's Publish dialog button is blocked by the app-shell footer; this is a concrete test setup cause, but it is on a closed #1142 feature spec and needs an owner-approved follow-up. #1104/#1153 own related fork/publish routes; exact overlap needs check. |
| 16 | `sonicTelemetry`, `themeCustomization`, `themeToggle`, `unpublishRetention`, `vividDesignMatrix`, WebKit `drawioEditor`, WebKit `artPieceCameraRuntime` | Distinct browser-engine, feature, and visual evidence contracts. No common cause established by the summary. |

The exact residual first-cause map and one-open-child-per-actionable-cause
criteria in #1096 remain unsatisfied. At least the 40px target, gallery filter
reset, retired route selectors, footer-intercepted publication fixture,
profile/photo behavior, and closed #1142 regression need evidence-level
duplicate searches and issue-owner direction before filing. Do not edit
unrelated tests, create those issues, or close children based on this partial
inventory. #1102 is still failed in this full matrix; #1104's 3D project
creation/publication family still needs complete criteria mapping.

## #1100 canonical-editor readiness correction — d91b8eb7

Shard 13's #1102 failure showed that `public2dRouteStageChrome` reached the
canonical editor URL after publishing but immediately queried a control before
the editor's owner-data request had hydrated. The shared server-backed 2D/3D
helpers now wait for the canonical owner-editor GET, require an OK response,
and verify its loaded piece id matches the id returned from project creation
before returning. No test titles, assertions, or caller specs changed. This is
within #1100's shared helper contract and preserves #1102's setup-only boundary.

Commit `d91b8eb7` (`test(e2e): wait for server editor hydration (#1100)`) is
pushed to the authorized PR #1094 branch. `npm run typecheck`, `npm run lint`
(exit 0; existing warnings), `npm run format:check`, and `git diff --check`
passed before commit. Matching-ref CI run #1079 (`36988928786`) completed with
workflow validation, backend, frontend (316 files / 3,228 tests), and
disposable published-routing smoke passing. Its browser acceptance smoke gate
failed (21 passed, 3 failed), so the full browser suite and 16-shard matrix
were not run. The three smoke failures are two `authPolicy.spec.ts` dark-shell
background-color assertions (`rgba(0, 0, 0, 0)` instead of `rgb(22, 23, 29)`)
and `publishingAndRemix.spec.ts` atomic-fork public-viewer lookup
(`.public-project-viewer` not found). Neither is #1100/#1102. CI therefore
does not provide #1102 evidence for this commit; no GitHub issue state was
changed. Keep the batch gate open and resolve or establish a safe way to get
past these smoke blockers before using the full matrix to reconcile #1102 and
the residual failure inventory.

Manual full-matrix dispatch #1080 (`36990191585`) was then authorized and
started on the same SHA `d91b8eb7` from
`docs/backlog-reevaluation-2026-09-27`. This invokes the `workflow_dispatch`
path, so it runs the full 16-shard E2E matrix without the PR-only browser smoke
gate. It completed unsuccessfully after 14m42s: all 16 browser shard steps
failed, while workflow validation, backend, frontend (316 files / 3,228 tests),
and disposable routing smoke passed. This is the direct verification path for
the #1100 readiness change and #1102 public 2D test, and it showed the
readiness-only correction was insufficient.

## #1102 File-menu visibility setup correction — dc4cc882

Shard 13 of #1080 showed the publication API returned 200 and the server-backed
editor reloaded, but `visibility-status` was not mounted because it belongs to
the closed File menu. A one-line setup click opens File before the unchanged
status assertion in `public2dRouteStageChrome.spec.ts`. This stays within
#1102's setup-only constraint. `npm run typecheck`, `npm run lint` (exit 0;
existing warnings), `npm run format:check`, and `git diff --check` passed. Commit
`dc4cc882` was pushed to the authorized PR #1094 branch.

Manual full-matrix run #1082 (`36992138058`) was dispatched against exact SHA
`dc4cc8826f1ff6355d21b3f30bfc26a6b8f9373f`. Workflow validation, backend,
frontend (316 files / 3,228 tests), and disposable routing smoke passed. The
full 16-shard browser matrix failed overall after 13m55s. Shard 13's full suite
reported 20 passed and 12 failed; `public2dRouteStageChrome` is absent from the
failed-test inventory, so that test now passes on Linux Chromium. The remaining
issues in that shard are unrelated historical 3D/art/public-draw/gallery specs.
This verifies the previously failing public 2D case, but does not establish the
complete #1102 nine-spec union without the per-spec results across the other
shards. Thus #1102 remains open and no GitHub issue was closed from this run.

## #1155 fixture guard QA — local acceptance pass; Linux gate pending

Re-read the refined #1155 contract, including its limitation that there is no
push/dispatch/merge authorization in that issue note. Implementation intake was
accepted for the committed shared fixture resolver, backend guard, workflow
opt-in, and matching tests; no product code was changed during this QA pass.

- Backend command regressions: `UV_CACHE_DIR=/tmp/codex-uv-cache-batch19 uv
  run pytest tests/test_e2e_fixtures_command.py -q` → 41 passed. This covers
  missing/invalid opts, unsafe/mismatched database targets, cleanup/create
  rejection, and allowed disposable modes.
- Frontend guard regressions: `npm test -- --run
  src/e2e/fixtureCommand.test.ts` → 1 file / 6 tests passed.
- Frontend required checks: `npm run typecheck && npm run lint && npm run
  format:check` → passed; lint exits 0 with existing repository warnings.
- Positive local E2E: `E2E_ENV_FILE=/tmp/codex-e2e-1155-isolated.env
  E2E_FIXTURE_ENVIRONMENT=disposable-local
  E2E_BASE_URL=http://127.0.0.1:5004 npm run test:e2e --
  e2e/projectLifecycle.spec.ts --project=chromium
  --grep='blank-canvas save/reload'` → 1 passed. The app was started with
  `AI_PROVIDER=fake`, the explicit Vite proxy pointed at `127.0.0.1:8004`,
  and Django read the env file targeting the isolated PostgreSQL database
  `gesture_studio_test`. The first run surfaced the test database's missing
  `0110_project_brief`–`0113` migrations; after applying migrations only to
  that explicitly selected test DB, the same smoke passed.
- Post-teardown read-only database audit on `gesture_studio_test`: 0 fixture
  users, email/social rows, 2D projects/versions, 3D projects, ArtPieces/versions,
  activity rows, or AI runs. The normal `gesture_studio` database was not used.
- Linux Chromium and current 16-shard matrix are still pending. Existing full
  matrix evidence is failed and stale relative to current HEAD; do not claim
  this issue or the batch closed. Stage 4 actual Codex/GPT-6, substituted for
  Claude Sonnet 5 Medium; Stage 3 independent-family review not run. Exact
  next action: after explicit publication/CI authorization is reconciled,
  push the reviewed branch and run the required Linux focused and full-matrix
  gates, then record every residual first cause under #1096.

Verdict: local fixture safety, frontend resolver, explicit-database create /
test / cleanup behavior PASS; Linux acceptance and batch gate NOT VERIFIED.
Keep #1155 open.

## #1156 Project3D activity QA — focused checks pass; batch gate open

On the committed #1156 implementation (`e28a57a3`), focused regression checks
passed: 169 backend tests / 5 skipped across Project3D activity, version and AI
flows, account export, publish transitions, AI runs, continuity metrics, piece
intake, and conversion. `makemigrations --check --dry-run` reported no model
drift. Run #1082 on the parent revision also passed the backend job; its full
16-shard browser matrix failed, so the required #1096 Linux gate remains open.

The Claude refinement adds a criterion to verify account deletion removes
Project3D activity. The established #443 account-deletion contract soft-deletes
local projects and retains their history during the 30-day grace period; the
hard purge cascades the rows. `account_deletion.py` confirms that behavior for
Project3D. I asked the owner whether the refinement means immediate activity
erasure or the existing hard-purge timing. Until clarified, do not change
retention behavior or claim that criterion passed. #1156 stays open; no issue
state changed.
