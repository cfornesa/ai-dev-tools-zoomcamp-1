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
| #1129 | 16 | QA: PASS; decision comment and design record verified; awaiting batch gate | GitHub QA comment posted; close only after batch gate |
| #1130 | 16 | QA: PASS; decision and split follow-ups verified; awaiting batch gate | GitHub QA comment posted; close only after batch gate |
| #1138 | 16 | QA: FAIL / docs-first chronology and Linux batch gate unverified | `d40f4a8a`; QA matrix posted; local backend criteria pass |
| #1139 | 16 | Issue QA: PASS on `46d0696d`; awaiting batch gate (remains open) | GitHub QA comment `5954588513`; run #1100 shard 12 E2E pass and inspected 1280x900 / 375x812 artifact; shared impact/full-matrix reconciliation |
| #1140 | 16 | Implemented locally; browser/CI criterion pending | `8100a4b9`; fake-provider E2E and full CI |
| #1143 | 16 | Implemented locally; batch/CI reconciliation pending | Prior batch record; fresh CI evidence pending |
| #1144 | 14 | Open; Linux/visual evidence pending | Full batch browser gate |
| #1149 | 16 | Open; local failures tracked in batch 18 | Resolve #1154 path and Linux browser gate |
| #1150 | 14 | Open; focused Linux scenarios pass; full batch gate pending | `7b13c231`; run #1082 on exact ancestor implementation |
| #1151 | 14 | Screenshot capture added; fresh Linux artifact and visual inspection pending | Focused typecheck/lint/format/discovery pass; run #1100's prior `interactionRuntime.spec.ts` 3/3 is before this test-only update |
| #1152 | 14 | QA: PASS; awaiting batch impact reconciliation | `510fcaf3`; run #1100 `layersPanel.spec.ts` 3/3; QA comment `5955170400` |
| #1153 | 14 | Open; refined follow-up | E2E and Linux gate |
| #1154 | 16 | Open; fake-provider Agent run follow-up | E2E/CI gate |
| #1155 | 14 | QA: FAIL / handed off at Linux verification boundary; current local evidence posted to GitHub | Existing guard commit; isolated `gesture_studio_test` smoke 1/1, all fixture counts zero afterward; Linux/full matrix pending |
| #1156 | 16 | QA: FAIL / docs-first chronology and Linux batch gate unverified | `e28a57a3`; QA matrix posted; current-ref full matrix pending |
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
| `frontend/e2e/interactionRuntime.spec.ts` | #1151 | #1103 migrated caller; #1111/#1114 mobile layout regressions; #1096 Linux gate | Retain desktop/mobile screenshots of both reduced and full motion toggle states as visible test artifacts; preserve the three existing scenario titles and all runtime behavior assertions. Current local preflight passes; exact Linux run required for fresh artifact inspection. |
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
issue was closed. QA comments are posted for #1100, #1129, #1130, #1138,
#1155, #1156, and #1157. No new follow-up issue was filed. #1157's refine-accept path remains eventless because
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

## #1156 Project3D activity QA — local checks pass; chronology and batch gates open

On the committed #1156 implementation (`e28a57a3`), focused regression checks
passed: 169 backend tests / 5 skipped across Project3D activity, version and AI
flows, account export, publish transitions, AI runs, continuity metrics, piece
intake, and conversion. `makemigrations --check --dry-run` reported no model
drift. Run #1082 on the parent revision also passed the backend job; its full
16-shard browser matrix failed, so the required #1096 Linux gate remains open.

The latest #1156 body explicitly says to preserve the existing retention
behavior; account-deletion tests prove soft-deleted rows remain during the
grace window and are removed at hard purge. Local criterion QA was posted in
Chrome as `## QA: FAIL`: the code, privacy, export, cursor, writer, and
regression criteria passed locally, but the `docs/api.md updated first`
chronology cannot be established because the API docs and code are in the same
implementation commit. The Linux full 16-shard gate is also pending. Keep
#1156 open; do not infer docs-first ordering from the author's report.

## Current-head batch QA — run #1085 (2026-10-02)

Pushed commit `635d1213a35a296cd8b59ef0fdc49176b847eaad` to the already-
authorized `docs/backlog-reevaluation-2026-09-27` branch and manually dispatched
the full CI workflow: [run #1085](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/actions/runs/37004726979).
The run completed with a failed overall status. Workflow validation, backend
checks, frontend checks (316 Vitest files / 3,228 tests), and disposable
published-routing smoke passed. Hosted safe-push, published URL smoke, and
staging-authenticated smoke were skipped by workflow conditions. All 16 Linux
browser shards failed their full-suite step. Shard 16 reported 19 passed, 8
failed, 5 skipped; shard 14 reported 15 passed, 5 failed, 16 skipped.

Detailed failure evidence inspected in Chrome:

- Shard 14: `publicGalleryMixedPieces` timed out waiting for the AI animation
  menu item; `publicPieceSurfaceContract744` timed out; `publicProfiles` had a
  public-profile visibility failure; both `publicShell` desktop/mobile cases
  failed. Full job:
  [shard 14](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/actions/runs/37004726979/job/110830215822).
- Shard 16: failures were in `sonicTelemetry` (ambiguous `Key` accessible
  name), `themeCustomization` (ambiguous `accent` labels), `themeToggle`
  (expected preference combobox absent), `unpublishRetention` (legacy editor
  route wait after redirect to `/local-projects/...`), `vividDesignMatrix`
  (stale color-mode combobox), `drawioEditor` (hidden piece-controls button
  intercepted by stage), and WebKit generated-piece camera/sound contracts.
  Exact log:
  [shard 16](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/actions/runs/37004726979/job/110830215984).
  Shard 16 also shows the current `versionHistoryCompare` case passing and
  both `manual2dStageChrome` cases passing.
- Targeted current-run pass: shard 3 executed
  `e2e/aiIntentNotes.spec.ts` (`#1140`) and passed its sole Linux Chromium
  case, including the disclosed note count and request-local exclusion. This
  supplements the earlier focused pass, but does not classify the adjacent AI
  failures in the same shard or satisfy #1096's batch reconciliation gate.
- Additional completed shard details inspected in Chrome: shard 1 had failures
  in `accountComponentStyles` (#1125 reduced-motion computed CSS expected
  `0s`, observed `1e-05s`) and four `accountSettings` list-count assertions
  (expected 11, observed 12); shard 2 had two keyboard section-order failures
  (#555), one reorder handle-count failure (#677), an admin theme-generation
  assertion, and two legacy 2D creation-menu route timeouts. Shard 4 failed
  three obsolete 3D AI panel layout assertions, 2D/3D plan-review route
  locators, one mobile existing-piece AI edit visibility case, and other
  generated-piece editor/runtime scenarios. Shard 5 failed two six-engine
  public iframe aspect-ratio assertions and a strict-mode `Piece controls`
  locator in a hand-steering scenario. These failures are evidence for the
  parent inventory only; most are outside the current open-issue manifest and
  need duplicate/owner reconciliation before assigning or changing them.
- These samples are not the complete 16-shard first-cause inventory. Parent
  #1096 requires every failure to be reconciled to an existing owner or a
  linked criterion-ready follow-up. Earlier #1074/#1082 records do not
  substitute for classifying each failure from #1085.

Remaining shard inventories reviewed from the #1085 GitHub Actions job logs:

- Shard 6 (`110830215837`): `artPieceThumbnailCapture` failed on missing
  revision prompt / undefined fallback bytes; `authoringOwnershipGate` failed
  against the current unavailable/redirect contract; `authoringWorkflow740`
  timed out; `authPolicy` had old shell/theme assertions. `cameraPreview3d`
  (#1100) passed in the same shard.
- Shard 7 (`110830215847`): stale `cosmicBackdropStars` z-index expectation;
  `designSchemeMatrix` expected the absent `.reduced-motion-status`; an
  immersive drawing-plane color assertion failed; `drawioEditor` clicked a
  hidden Piece-controls button intercepted by the visible stage toolbar; and
  `editOutputConsistency` used an ambiguous SVG locator.
- Shard 8 (`110830215878`): header/theme selectors, mobile header color
  combobox, CMS home-hero content, immersive art-piece controls, immersive
  collection, and injection-artifact assertions failed. The sampled log
  extraction does not establish a first cause for every item in this shard.
- Shard 9 (`110830215766`): #1111 inline 3D toolbar geometry (2/2), #1120 2D
  toolbar geometry (2/2), interaction runtime (3/3), layers panel (3/3),
  canonical legacy toolset routes, local-first 2D/3D/generated creation, and
  local-only transfer consent passed. Failures: #669 live preview timed out;
  #1087 local gallery card expected “Local card with preview” but no heading
  appeared.
- Shard 10 (`110830215866`): #943 local piece upload offer (2/2), #955 local
  template creation (2/2), durable local workspace saves (6/6), folder bridge
  (2/2), #513 media library, both #1150 manual 2D stage cases, both Mistral
  credential cases, #1113 mobile 3D panel, and #1151 interaction runtime
  assertions passed. Failures: #942 publish confirmation remained disabled;
  #1114 manual 3D layout, publication lifecycle, and generated 3D manual edit
  cases failed.
- Shard 11 (`110830215785`): offline conflict/transport/media/ownership
  scenarios, durable project lifecycle, public 2D page/route chrome, public
  3D information architecture, proportions/material warnings, #1083/#1084
  public-piece mobile layouts, #823 downloads, and #565 collection modes
  passed. Failures included generated 2D fill/runtime-error/stage sizing;
  #742 and public 3D camera overlay/immersive toolbar contracts; #690 public
  generated-piece toolset; public drawing; and #564 gallery engine selection.
- Shard 12 (`110830215870`): #799/#800 generated template parity failed
  because profile updates were rejected; #706 toolbar placement exceeded its
  expected stage boundary; #1139 intent-note E2E failed after switching to
  375px because the Details region's `Expand Details panel` disclosure stayed
  collapsed and the note field was hidden. Profile handle/photo/style flows,
  3D project lifecycle/publication/package export also failed. The #1139
  failure is a test-setup defect; `openDetailsPanel()` now opens that
  in-scope disclosure at each viewport. Focused TypeScript, lint, formatting,
  Playwright discovery (1 test), and diff checks passed locally; exact Linux
  rerun is pending.
- Shard 13 (`110830215775`): 3D project thumbnail cards, public 3D camera
  overlays/placement/toolbar, public generated-piece toolsets, public drawing,
  and gallery engine filtering failed. Public #1142 related-project cards
  timed out.
- Shard 15 (`110830215946`): #768 2D and #767 3D toolbar contracts, #823
  collection downloads, #565 collection modes, responsive shell, #553 saved
  models, and share metadata passed. Failures: atomic remix/fork setup;
  #766 generated-piece toolbar variants; #1142 related public projects. The
  reference-import case was skipped.

This completes inspection of the six previously unread shard summaries, but
not the required failure-by-failure reconciliation: shard 8 first causes and
several timeout failures remain unclassified. The active Chrome tab became
unresponsive during the requested CDP state read; GitHub connector logs were
used as the source for CI records, with no Chrome restart or process
termination attempted.

The complete local `UV_CACHE_DIR=/tmp/codex-uv-cache-batch19 make check`
finished successfully: backend Ruff check/format, mypy and pytest (2,012
passed, 44 skipped); frontend lint, format, typecheck, Vitest (316 files,
3,228 passed), and build exited successfully. Focused #1139 component tests
passed (13/13). The exact Linux `privateIntentNote.spec.ts` browser run was
attempted locally but Chromium exited before test startup due macOS
`MachPortRendezvous` permission failure; this is not an assertion result.
Active Chrome manual verification saved the note, showed `Saved.`, reloaded
the editor, and showed the note again. Public-route privacy and rendered
screenshots at 1280x900 and 375x812 remain pending. GitHub `## QA: FAIL` on
#1139 records that criterion matrix and boundary.

**Batch gate: FAIL / reconciliation incomplete. No issue was closed.** Existing
issue-level QA PASS comments do not satisfy the cross-issue gate. Next action:
inspect all 16 run #1085 shard summaries, map failures to open versus already
closed contracts, run duplicate searches for genuinely new findings under the
discovery gate, then close only criteria-complete issues with unaffected
impact rows. No merge or deployment was performed.

### 2026-10-02 — current-head run #1094 follow-up

Manual Linux workflow [#1094](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/actions/runs/37012212894) targets exact SHA `95c8e3599e3a753234b90ad52ea39f5503bf1ab8`. Backend, workflow validation, and disposable published-routing smoke passed; frontend Vitest failed its unrelated timing ceiling in `sceneDiff.test.ts` (85.87482ms vs 50ms, with 3,227/3,228 tests passing). Shard 12 confirms #1139's desktop/mobile save, reload, privacy, and geometry case passed. The uploaded artifact omitted the two screenshots because `test.info().attach({body})` writes them under a hidden path, which artifact upload excludes. The test now additionally writes visible per-test screenshot files and attaches by path; typecheck, lint (existing warnings), format, and one-test Playwright discovery passed. A fresh Linux run must upload these files before visual inspection; #1139 stays pending.

This run also confirms shared CI remains red: all 16 E2E shards ultimately failed; failure-by-failure impact reconciliation is still underway. The current batch gate remains FAIL and no GitHub issue state is changed.

The #1139 screenshots are now present in the shard-12 artifact on `e8d6b7e9` and were visually inspected. The desktop capture shows the field and helper text within the right Details panel. The initial mobile capture shows a responsive stage/tabs but is taken before scrolling to the Details field, so it does not visually prove the field's mobile layout. The test now scrolls the field into the viewport before each capture and asserts `toBeInViewport()`; typecheck/lint/format/discovery passed before this final screenshot-view adjustment. Re-run Linux CI and inspect the fresh mobile image before #1139 can receive QA PASS.

Manual Linux workflow #1098 (`37016152439`, exact SHA `b8138d1a2479dfaa89c99b843274e5039b47b4bb`) uploaded both visible per-test screenshots. Visual review confirms the private-note field/helper are in the 1280px and 375px captures and the 375px layout has no horizontal clipping. The #1139 test reaches its privacy check after save/reload and mobile geometry, but publishing returns 400 because the Details-form save clears the description previously written via API. The E2E now fills the fixture description in that same form before saving. Preflight format, lint, typecheck, and Playwright discovery passed. The targeted privacy test requires another Linux run. #1098's shared matrix remains red; failure inventory/reconciliation is incomplete, so the batch gate remains FAIL and no GitHub issue state changed.

Commit `46d0696d5fcf9a2f73fa2ef0487f1e9df1992d4a` records the #1139 fixture correction plus this evidence; it is pushed to the authorized PR branch. Manual Linux workflow #1100 (`37018043361`) was dispatched via the active Chrome session against this exact SHA. Its current status is queued; final shard results are pending. PR workflow #1099 (`37017824809`) also auto-started from the push. Keep #1139 open until the corrected privacy test and visual evidence pass on Linux. Shared batch gate remains FAIL pending current-run failure classification and the impact matrix.

Run #1100 shard 12 completed with #1139's `privateIntentNote.spec.ts` passing 1/1 in Linux Chromium/PostgreSQL (12.7s). The new artifact `11232007438` contains both expected screenshot files; visual inspection confirms the labelled field/helper at 1280×900 and 375×812 with no mobile horizontal clipping. The full Vitest job also passed 316 files / 3,228 tests. QA `PASS` criterion matrix is posted at GitHub comment `5954588513`; read-after-write confirms issue #1139 is still open. As of the latest run check, 22/23 jobs were complete; 15/16 E2E shards had failed and shard 3 remained in progress. The batch gate remains FAIL until all shards and failures are reconciled; no issue was closed.

## Final run #1100 reconciliation — 2026-10-02

The completed Linux full-matrix run #1100 (`37018043361`) targeted exact SHA
`46d0696d5fcf9a2f73fa2ef0487f1e9df1992d4a`. Backend, frontend (316 files /
3,228 tests), workflow validation, and disposable published-routing smoke
passed. All 16/16 E2E shards failed: 127 failed cases across 80 unique spec
files (125 Chromium, one Firefox, one WebKit). The shared batch gate is FAIL. A current-run `## QA: FAIL` summary was
posted to parent #1096 as comment `5954772551`; no issue was closed.

Targeted current-batch evidence: #1139 `privateIntentNote.spec.ts` passed 1/1
in shard 12. Artifact `11232007438` was inspected and confirms the private
field/helper at 1280×900 and 375×812 without mobile horizontal clipping. Its
`## QA: PASS` criterion matrix is comment `5954588513`, but #1139 remains open
pending the batch gate. #1140 `aiIntentNotes.spec.ts` passed 1/1 in shard 3.
#1100's six named 3D helper specs passed all 7 cases. These issue-level results
do not satisfy the full matrix gate.

Four #1103 scenarios failed in `aiAndRecovery.spec.ts`. The autosave debounce
scenario observed a populated IndexedDB draft at the pre-debounce assertion;
the draft was the canonical empty scene seeded when the server-backed editor
mounts, so this fixture already had local persistence before the edit under
test. The explicit-save/reopen scenario timed out at 90 seconds; two recovery
scenarios timed out at 30 seconds. Their artifact page states remained at
“Opening the canonical editor…”. These snapshots establish symptoms, not yet a
validated first-cause fix. Preserve #1103's setup-only and assertion-preserving
scope: inspect traces for the hydration stalls and isolate the initial seeded
draft at the fixture boundary before changing tests. #1103 remains QA FAIL.

Full-matrix classification is incomplete: every one of 127 failed cases across
80 unique spec files still needs first-cause mapping, existing issue or linked
follow-up, and owner/next action. Do not characterize the failures as wholly
unrelated or close any issue before reconciliation and a green batch gate.

## PR run #1101 — current-head smoke gate (2026-10-02)

PR workflow [#1101](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/actions/runs/37021439341)
ran on commit `df0146f9f65d4c4146a3a94f2496ae5e6c634ffd`. Workflow
validation, backend checks, frontend checks (316 files / 3,228 Vitest tests),
and disposable published-routing smoke passed. Its browser smoke group ran
24 tests: 21 passed and 3 failed; the full browser suite was skipped because
the smoke gate failed. The active Chrome session was used to inspect the
completed Actions run and confirm those job states.

Two failures are the old `authPolicy.spec.ts` dark-shell assertions (signup
policy copy absent; login body background computed transparent). This has no
matching open issue after duplicate search; closed #516 is historical and is
not reopened. Record as a candidate #1096 follow-up pending owner approval.
The third failure is `publishingAndRemix.spec.ts`'s atomic-fork test waiting
for `.public-project-viewer[data-project-kind="remix"]`; this remains in the
existing #1104 lifecycle/publishing scope. Do not count this run as #1104's
Linux acceptance or as a full-matrix run. The exact Linux current-head
16-shard evidence remains run #1100 at code SHA `46d0696d`; its corrected
total is 127 failures across 80 spec files (125 Chromium, one Firefox, one
WebKit).

The focused local `injectionArtifacts.spec.ts` attempt could not launch the
bundled macOS Chromium: `MachPortRendezvousServer` returned Permission denied
(1100) before test code started. CI shard 8's first cause was the helper's
script-count expectation: the exported p5 demo contains six expected script
elements (p5 loader, three JSON data blocks, runtime, toolbar runtime), while
the test expects five; pwn markers and event-handler scans were clean. This
is a stale test contract for closed #74, not evidence that hostile payloads
executed. Keep it recorded under #1096; do not edit the tracking parent or
create a new issue without owner approval.

Correction: run #1100's 125 case count was Chromium-only. One Firefox and one
WebKit case failed as well, making 127 total failures across 80 unique spec
files. GitHub QA comment `5954772551` and this local ledger now state the
correct breakdown. No issue was closed.

Additional issue-level Linux evidence from run #1100: `interactionRuntime.spec.ts`
passed 3/3 for #1151 and `layersPanel.spec.ts` passed 3/3 for #1152. #1152's
owner-retargeted scope and boundary checks satisfy its issue criteria; its
`## QA: PASS` comment `5955170400` is posted and read-after-write verified.
The #1151 acceptance also requires screenshots of the motion toggle in both
states at 1280x900 and 375x812; the run did not retain those screenshots, so
#1151 remains issue-QA incomplete. Neither issue is closed while #1096's
failure-by-failure impact reconciliation remains unfinished.
