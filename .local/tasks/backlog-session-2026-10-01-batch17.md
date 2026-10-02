# Backlog session — 2026-10-01 — Batch 17 continuation

## Reconciliation and execution boundary

Repository: `cfornesa/ai-dev-tools-zoomcamp-1`, one codebase with local and Replit deployment tracks. `AGENTS.md` is an adaptation over the repository's existing documentation network (Case D was previously reconciled; `docs/process.md`, `docs/plan.md`, `docs/tasks.md`, and `docs/task-template.md` remain canonical). The checkout is on `docs/backlog-reevaluation-2026-09-27`, 120 commits ahead of its remote after this batch's two issue-scoped commits. No push or workflow dispatch was authorized. `DECISIONS.md` and `.agents/memory/MEMORY.md` contain no open REVIEW REQUIRED or PENDING CONFIRMATION gate. This run uses Codex directly because the available environment exposes no rostered implementation or QA services; service substitution must be marked in stage evidence.

User-owned scope decisions carried forward: #1114 preserves 16:9 and places the rail below the stage; #1134 uses tabs; #1137 uses pairwise compare; #1108 targets the manual editor. For #1143, lifetime history must remain available; the owner selected an indexed full-history query with a hard timeout and retryable unavailable response, then asked to pause implementation while delivery/failure risk is evaluated.

## Live issue manifest (GitHub enumeration: 2026-10-01)

| Issue | Milestone | Scope / surfaces | Dependencies | Routing | Current disposition / next action |
|---|---|---|---|---|---|
| #1096 | 14 | 16-shard Linux E2E matrix and residual failure classification | #1100, #1101, all linked failure children | tracking | Open; parent only. Re-run full Linux matrix and classify every residual failure. |
| #1100 | 14 | 3D E2E fixture helper; six E2E specs | none for implementation; gate precedes #1102–#1104/#1144/#1149 | 2a | Helper committed; local macOS focused rerun passed 7/7; Linux gate unavailable here. Keep verification-boundary open. |
| #1102 | 14 | nine single-purpose 2D / one 3D call in nine E2E files | #1100 helper contract | 2a | Setup commit exists; previous 4/13 local run failed on now-closed children #1118–#1121. Re-run after their fixes; Linux still required. |
| #1103 | 14 | 45 calls across `aiAndRecovery`, `layersPanel`, `interactionRuntime`, `exportConfigDialog` | #1100 helper contract | 2a | Implemented in `f98a564d`; QA FAIL locally (11/17 pass); #1150–#1152 deferred; Linux gate open. |
| #1104 | 14 | Gallery UI lifecycle, publishing/remix, responsive 2D E2E | #1100 helper contract | 2b | Implemented in `ddd46cde`, with local-first template clone follow-up in `db3fd542`; full local batch 22 passed / 0 skipped, responsive 375px included. Linux gate open. |
| #1110 | 14 | mobile 3D drawing-plane move-handle reachability | #1111, #1114; shares 3D stage CSS / specs | 2a | Implementation committed; QA depends on completed #1111/#1114 and regression batch. |
| #1111 | 14 | mobile 3D inline stage-toolbar collision | #1114/#1103 regression evidence | 2a | Implementation committed; QA/reconciliation after the shared 2D and 3D regression batch. |
| #1112 | 14 | migrate `drawingPlaneTransform782` fixture to server-backed 3D setup | #1114; helper contract #1100 | 2a | Setup commit exists; exact test previously blocked by #1114 interception; re-run after complete toolbar batch. |
| #1114 | 14 | below-stage mobile rail for 3D plane actions; preserve 16:9 | #1103 2D regression suite; gates #1112/#1110 | 2a | Implementation committed; 3D criteria pass locally, shared 2D gate blocked by stale fixture. Re-run after #1103. |
| #1129 | 16 | owner decision: intent-note storage | — | owner | Decision-pending. Do not implement dependent #1138–#1140. |
| #1130 | 16 | owner decision: history support beyond 2D | — | owner | Decision-pending. No immediate child is in the live open set. |
| #1138 | 16 | private intent field/API/export/deletion | #1129 | 2b | Dependency-blocked on owner decision #1129. |
| #1139 | 16 | 2D private intent-note editor UI | #1138 | 2a | Dependency-blocked on #1129/#1138. |
| #1140 | 16 | disclosed, bounded intent context in 2D AI prompts | #1138, #1139 | 2b | Dependency-blocked on #1129/#1138. |
| #1143 | 16 | owner-only aggregate continuity metrics | #1131–#1133 (closed) | 2b | Owner selected indexed full-history query with hard timeout and retryable unavailable response; implementation paused at owner's request pending risk evaluation. |
| #1144 | 14 | public 3D hand-gesture guide and proportions E2E fixtures | #1100 helper contract | 2a | Owner authorized current open-issue work; criteria specify exact routes/viewports. Implement after shared helper contract; Linux gate remains. |
| #1149 | 16 | 2D and 3D persisted AI Agent E2E canonical routes | #1100 helper contract | 2a | Owner authorized current open-issue work; preserve fake-provider and distinct 2D/3D workflows. Implement after shared helper contract; Linux gate remains. |
| #1150 | 14 | 2D AI-recovery and export Save control E2E selectors | discovered during #1103 | 2a | Shared `saveScene` helper and all consumers pass expanded local command 30/30, 0 skipped; Linux gate open. |
| #1151 | 14 | interaction-runtime editor control E2E locators | discovered during #1103 | 2a | Shared control helper consumed in `aiAndRecovery` via `36a65af4`; issue choices remain pending for reduced-motion status and runtime assertion. |
| #1152 | 14 | same-layer keyboard reorder vs. canvas z-order behavior | discovered during #1103; follow-up to closed #127/#194 | 2b if behavior defect | Awaiting owner choice: change Move up/down to sibling reorder or retain layer-level behavior and separate keyboard-parity gap. |
| #1153 | 14 | publication-status selector in publishing and responsive E2E | discovered during #1104 | 2a | Local publishing/responsive batch passes 22/22 with 375px case; Linux gate open. |
| #1154 | 14 | successful fake-provider AI Agent runs on canonical 2D/3D editors | discovered during #1149 | 2b | Implemented; local QA passed. Linux Chromium/PostgreSQL issue gate remains open. |

## GitHub state audit — 2026-10-01

Fetched each of the 21 active issues listed above directly from GitHub. All 21 are `open` and have no `closed_at` timestamp. In particular, #1103 and #1104 are not closed: both have local implementation commits and QA evidence, but each currently fails local QA and lacks the required Linux/browser batch gate. The earlier closed issues referenced by this batch (#1118–#1123, #1136–#1137, #1141–#1142, #1148, #127, and #194) were separately fetched and GitHub reports them closed. State changes must be confirmed by fetching GitHub after any closure action.

## Batch impact matrix

| Surface / exact paths | Changes | Open issues referencing the surface | Collision resolution and required re-verification |
|---|---|---|---|
| `frontend/e2e/support/createProject.ts`, `createProject3d.ts` | Existing helper contract consumed (no helper change in #1103) | #1100, #1102–#1104, #1112, #1144, #1149 | Keep helper semantics fixed; all consumers use explicit server-backed helpers. Verify no stale-helper imports remain after #1104. |
| `frontend/e2e/aiAndRecovery.spec.ts`, `layersPanel.spec.ts`, `interactionRuntime.spec.ts`, `exportConfigDialog.spec.ts` | #1103 setup-only edits | #1096, #1103; #1111/#1114 indirectly depend on 2D regressions in `layersPanel`/`interactionRuntime` | Change helper imports/calls only; preserve all scenario titles and assertions/counts. Run exact four-spec Chromium command with `AI_PROVIDER=fake`; then include in batch gate. |
| `frontend/e2e/drawioPublicSurfaces.spec.ts`, `inkLayer2d.spec.ts`, `legacy2dToolset.spec.ts`, `manual2dCanvasContainment.spec.ts`, `manual2dMediaLibrary.spec.ts`, `manual2dStageChrome.spec.ts`, `public2dRouteStageChrome.spec.ts`, `savedModels.spec.ts`, `pieceSlugEdit750.spec.ts` | #1102 existing setup-only edits | #1096, #1102, #1121–#1123 (closed follow-ups) | Rerun after child fixes; preserve WebKit fullscreen case and counts. Linux gate stays separate. |
| `frontend/e2e/projectLifecycle.spec.ts`, `publishingAndRemix.spec.ts`, `responsiveShell.spec.ts` | #1104 migration | #1096, #1104 | Retain Gallery-specific user journey only where it is the scenario under test; run PostgreSQL Chromium, responsive 375px, publishing/lifecycle assertions. |
| `frontend/src/index.css` mobile inline-stage region; `inlineStageToolbarGeometry*.spec.ts`, `manual3dStageChrome.spec.ts`, `drawingPlaneAframe796.spec.ts`, `drawingPlaneTransform782.spec.ts` | Existing #1111 → #1114 → #1110 product sequence; #1112 test consumer | #1100, #1111, #1112, #1114; #1096 tracker | CSS changes already committed serially. Re-run 2D no-regression geometry and ink cases plus named 3D desktop/mobile tests after #1103. No parallel edits. |
| `frontend/e2e/handGestureGuide.spec.ts`, `public3dProportions.spec.ts` | #1144 server-backed fixture setup | #1096, #1100, #1144 | Preserve publish → anonymous public-route flow; verify both viewports and screenshots; Linux Chromium required. |
| `frontend/e2e/aiAgent2d.spec.ts`, `aiAgent3d.spec.ts` | #1149 route/fixture setup | #1096, #1100, #1135 (closed) and #1149 | Keep fixture ownership, fake provider, separate workflows/assertions; ensure executed/skipped counts show no provider self-skip. |
| `aiAndRecovery.spec.ts`, `exportConfigDialog.spec.ts` current Save action | #1150 selector repair, deferred | #1103, #1150, parent #1096 | Current accessible name is Save scene; preserve draft-clearing and historical-version assertions. |
| `interactionRuntime.spec.ts` current route controls | #1151 selector/navigation repair, deferred | #1103, #1151, #1118 (closed), parent #1096 | Reconcile playback setting and Editor actions/Save controls at canonical route; preserve graph/runtime assertions. |
| `layersPanel.spec.ts` same-layer keyboard order | #1152 behavior/test contract follow-up, deferred | #1103, #1152; closed historical #127/#194 | Reproduce and inspect implementation semantics; do not reopen historical issues or weaken z-order assertions. |
| `docs/api.md`, project metadata/model/export/deletion and sync boundaries | No current-batch implementation until D1 decision | #1129, #1138–#1140, #1143; #1131–#1133 closed | Owner decision precedes schema/API work. For #1143, user has rejected 90-day truncation; wait for bounded lifetime architecture choice before coding. |
| Admin metrics endpoint/panel and activity queries | #1143 only, no code until groomed | #1143 | Define lifetime population, metric denominator/clock, indexed bounded query strategy, privacy and sample suppression before implementation. |
| Parent full matrix workflow `.github/workflows/ci.yml` and all E2E specs | No workflow edits authorized or required | #1096; all E2E children | Linux full-matrix evidence is mandatory. No push or dispatch tool is available/authorized in this run; report boundary explicitly. |

## Ordered implementation / QA waves

1. **Wave A — E2E setup batch:** #1103 is committed as `f98a564d`; local four-spec QA is 11/17 with six out-of-scope follow-ups #1150–#1152. Re-run #1102 locally after its four QA children closed; implement #1104, #1144, and #1149 in separate issue-scoped commits using the established #1100 helper. Run focused unions after implementation. These edits are mechanically independent files but share one fixture contract and one batch gate.
2. **Wave B — 3D interaction batch:** after Wave A's 2D regression suite is green, verify #1111 → #1114 → #1110 and #1112 together against 2D regression, 3D stage geometry, exact route-level controls and screenshots. Existing implementation commits are preserved.
3. **Wave C — parent CI reconciliation:** only after child matrix can run on Linux, dispatch/re-run the full 16-shard fixed-ref matrix and classify all residual failures before reconciling #1096/#1100/#1102–#1104/#1112/#1114/#1144/#1149.

**Skipped, explicitly:** #1129 and #1130 require owner decisions; #1138–#1140 depend on #1129; #1143 implementation is paused at the owner's request after an architecture choice; #1151 and #1152 have owner choices pending. The macOS host's unavailable Docker daemon and absence of authorized remote dispatch leave all issue-specific Linux gates and the full-matrix gate unverified. No issue may close on local evidence when its live GitHub contract requires Linux.

## Wave F checkpoint — #1104/#1150/#1153 local batch gate

The exact #1104 lifecycle/publishing/responsive command passed **22/22**,
with 0 failures and 0 skips, including the 375px populated gallery. The
template-clone scenario now follows the actual `/local-projects/:id` workflow,
inspects the copied scene through the local IndexedDB repository, saves a
supported local scene-name change, and confirms a second clone has separate
project/scene records and the original baseline. `projectLifecycle.spec.ts`
expectations increased from 65 to 71; publishing and responsive expectation
counts remain at 164 and 30. Commit: `db3fd542`.

The exact expanded #1150 consumer command passed **30/30**, with 0 failures
and 0 skips; historical-version export and all scene-save consumers are
included. The only remaining exact-name `Save` locators are two admin form
controls and one theme form control. #1153's publishing and responsive
acceptance is included in the 22/22 #1104 regression batch. Frontend static
checks pass. Issue QA comments record local evidence and the still-required
Linux Chromium/PostgreSQL gates; read-after-write confirms #1104, #1150, and
#1153 remain open. #1151 awaits the reduced-motion status contract choice;
#1152 awaits the keyboard reorder contract choice.

## Wave A checkpoint — #1103

Commit `f98a564d` migrates the 45 helper call/import/definition references across the four named specs to the explicit server-backed helper, preserving the section-expansion wrappers. Per-file test/expect counts match base: 9/101, 4/55, 4/66, 4/26. Typecheck, lint (exit 0; existing warnings), formatting, and Playwright discovery pass. Against a fresh disposable local PostgreSQL database, fake-AI Django and Vite, exact Chromium batch result: 11 passed, 6 failed, 0 skipped. Failures: two current Save control locators (#1150), three interaction-runtime control locators (#1151), and one same-layer keyboard/canvas ordering mismatch (#1152). New findings are linked to #1096 and deferred under the separation-of-duties rule. #1103 stays open / QA FAIL; Linux gate unverified. Browser fixture users were cleaned by Playwright global teardown; the temporary database/services are pending cleanup at session end.

## Wave E checkpoint — #1154

`backend/scenes/ai_runs.py` now treats the root scene ID as document identity,
while target-scoped validation still rejects document-field changes and
collection reordering. The fake provider makes target-aware 2D/3D edit patches
only when the prompt declares selected IDs; its no-target 2D success patch is
byte-identical to the existing fixture. The 2D accept assertion now observes
the generated shape in the canonical Layers panel rather than the retired AI
preview. Existing run validation/retry limits and all eight scenario titles
and substantive assertions are preserved.

Verification on the disposable local PostgreSQL stack with `AI_PROVIDER=fake`:
all 8 AI Agent Chromium scenarios passed, 0 skipped; focused backend tests
passed (150 passed, 3 skipped); full `make backend-check` passed (lint,
format, typecheck, 1,946 passed / 41 skipped); frontend typecheck, lint (exit
0 with existing warnings), and format check passed. Required Linux Chromium /
PostgreSQL evidence is unavailable on this macOS host, so #1154 remains open
pending its explicit issue gate. No GitHub state transition was performed.
