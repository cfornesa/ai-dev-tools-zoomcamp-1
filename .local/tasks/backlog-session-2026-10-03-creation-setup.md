# Batch 14 — creation/setup E2E Wave 2B

## Session scope and constraints

- Project: `cfornesa/ai-dev-tools-zoomcamp-1`; branch `docs/backlog-reevaluation-2026-09-27`.
- Ordered issues, all open in milestone 14: #1168, #1169, #1170, #1166. #1170 shares `project3dLifecycle.spec.ts` and `frontend/e2e/support/`; one implementer, serialized issue commits.
- Do not remove or change the inert `Open piece controls menu` shim; its later migration/removal belongs to #1187 (and owner decision #1167).
- Current contract: Gallery creation is local-first, persisted in IndexedDB and routed to `/local-projects/:id` for 2D and 3D editor creation; legacy `/ai-projects*` paths redirect to the unified editor. Tests will retain or add coverage of that contract where creation is under test. Tests needing published/server-backed fixtures may use the existing server-backed helpers. No retired E? candidate will be dropped.
- Each issue commit removes only that issue's existing `frontend/e2e/known-failures.json` entries. No push, dispatch, merge, issue closure, `git add -A`, `git commit -a`, stash, reset, or discard.
- Stage 2a roster: Opencode Go / Kimi K2.5. Actual implementation: Codex / GPT-6 (effort not surfaced), substituted: yes. Stage 4 QA is rostered to Claude / Sonnet 5 / Medium; it is not run here. Local checks are implementation evidence, not Linux CI evidence.

## All-open-issue discovery (2026-10-03)

Authenticated GitHub open-issue enumeration returned **66** issues: #1096 and every issue #1160–#1224 inclusive. All issue titles/milestones were inspected from the open list; target issue bodies and the run #1126 failure map were read. GitHub open-issue body searches were made for `project3dLifecycle.spec.ts`, `createServerProject3D`, `public3dCameraOverlay728.spec.ts`, `Open piece controls menu`, `/local-projects-3d`, and `/ai-projects3d`. Repository/task searches covered those paths and helpers. Disposition for all 66:

- In this batch: #1168, #1169, #1170, #1166.
- Directly affected dependency / neighboring criteria: #1167 (owner decision about shim), #1187 (later shim removal, explicitly deferred), #1175, #1188, #1189 (public stage/phone geometry), #1181 (local Gallery creation), #1190 (shared baseline), #1194 (shared-helper documentation), and #1096 (parent tracker).
- Remaining open IDs #1160–#1224 were reviewed and remain out of scope; no changes to their contracts are proposed. No newly discovered actionable issue at analysis time.

## Batch impact analysis

| Surface | In-batch issue(s) | Other open references / collision | Decision and re-verification |
| --- | --- | --- | --- |
| `frontend/e2e/project3dLifecycle.spec.ts` | #1168, #1170 | #1096 maps the cases; GitHub body search confirms #1168 and #1170; #1175/#1188/#1189 own adjacent stage behavior | Keep the three manual/public lifecycle cases and the AI-assisted case. Preserve local-first `/local-projects/:id` where Gallery creation is under test; use `createServerProject3D` for server-backed workflows. In #1170, assert `/ai-projects3d/:id` compatibility redirect to the unified editor, then activate the current AI panel control. Re-run the complete spec plus related criteria. |
| `frontend/e2e/support/createProject.ts`, `createProject3d.ts`, other `support/` helpers | #1168, #1169, #1170 | #1194 documents exported helpers; #1096 parent; the open-issue body search found #1168, #1169, #1170, and #1194 | Reuse existing helpers first. Do not change helper semantics or introduce an export unless necessary; if helper API changes, add its consumer/documentation impact and rerun the union. Verify 2D/3D server fixture setup and AI panel access. |
| Public 3D setup/geometry specs: `public3dCameraOverlay728.spec.ts`, `public3dImmersiveCameraOverlay734.spec.ts`, `public3dToolbar730.spec.ts` | #1169 | #1175, #1188, #1189 own overlapping rendered geometry/phone behavior; #1096 maps original failures | Migrate fixture setup to the existing server-backed 3D/publish path; preserve viewport geometry assertions and screenshots. Re-run these specs and the relevant #1175 regression specs; no product CSS edits. |
| 3D lifecycle/publication fixtures: `manual3dLayoutParity.spec.ts`, `manual3dPublicationLifecycle.spec.ts`, `project3dPublicationDiscoverability.spec.ts`, `project3dThumbnailCard.spec.ts`, `project3dServerPackageExport.spec.ts`, `unpublishRetention.spec.ts` | #1168 | #1096 parent; #1173/#1174 share public publication surfaces but their assertions/specs remain untouched; #1190 owns the baseline mechanism | Correct setup only, preserve server-backed APIs, publish/restore/export/thumbnail assertions, and helpers from the existing save/publish paths. Run every listed file and relevant shared-route regressions. Issue title says 11 tests while its body acceptance enumerates 12 cases; conservatively retain/run every case named in the body. |
| AI panel / legacy AI route specs: `aiPanelLayout2d/3d.spec.ts`, `aiPlanReview2d/3d.spec.ts`, `ai2dPublication.spec.ts`, `ai2dResponsive.spec.ts`, `publicGalleryMixedPieces.spec.ts`, `aiMention3d.spec.ts` | #1170 | #1096 parent; #1194 helper documentation; #1168 shares `project3dLifecycle.spec.ts`; #1181 shares local-first Gallery creation concept | Rewrite setup to current local-first project creation when the scenario tests creation; for server-only scenarios use existing helpers. Verify the legacy AI URL redirects to the canonical editor and explicitly activate “Ask AI to improve this scene” before asserting its panel. Preserve viewport, review, publish, responsive and mention assertions. Retire none of the E? candidates. Use deterministic fake AI only if an AI request is exercised. |
| Toolbar shim locator specs: `artPieceCameraRuntime.spec.ts`, `artPieceSteeringRuntime.spec.ts`, `public3dCameraPlacement742.spec.ts`, `immersiveArtPieceToolset.spec.ts`, `publicArtPieceToolset.spec.ts`, `regularToolbarMatrix.spec.ts`, `embedToolbarOrder.spec.ts`, `drawioEditor.spec.ts`; shared component `PieceStageToolbar.tsx` | #1166 | #1167 asks owner decision; #1187 owns eventual shim removal; #1194 helper docs; #1096 parent | Fix exact accessible-name collisions and ordered visible-control collection without changing/deleting the shim or changing product component behavior. Preserve counts, order and draw.io inline-menu behavior. Re-run all eight named specs; do not migrate consumers outside this issue. |
| `frontend/e2e/known-failures.json` | all four | #1190 shared ratchet; #1096 parent; every child issue owns only its entries | Remove entries by numeric issue owner only, after its focused scenarios pass. Preserve schema and all other entries. |
| Complete open inventory | All 66 | Source: `gh issue list --state open --limit 300`; all 66 identifiers enumerated above | No other open issue body search returned the changed spec/helper/route surfaces. Keep unrelated issues unchanged; repeat path and issue search if implementation adds a touched surface. |

## Ordered issue manifest

| Issue | Focused surface | Status before engineering | Commit / baseline removal | Focused evidence and next status |
| --- | --- | --- | --- | --- |
| #1168 | Seven 3D lifecycle/publication/export/thumbnail specs; retain all cases named in issue body | GROOMED | Pending | Local Chromium: 11/11 focused #1168 cases pass; commit pending; Linux e2e-browser still required |
| #1169 | Three public 3D camera/toolbar specs | GROOMED; execute after #1168's helper choice | Pending | Pending |
| #1170 | Eight AI-related specs and the AI-assisted scenario in `project3dLifecycle.spec.ts` | GROOMED; serialized with #1168 | Pending | Pending |
| #1166 | Eight toolbar/shim collision specs | GROOMED; do not remove shim | Pending | Pending |

## Batch verification plan

- Focused issue commands: exact commands from #1168, #1169, #1170 and #1166; run their union once after the four issue commits.
- Run the full repository `make check` after the browser union.
- Recheck issue #1175's geometry-focused public stage specs because #1169 shares rendered surfaces; the requested responsive/public shell checks in the batch context are re-run if affected by test support changes. Preserve the full `project3dLifecycle.spec.ts` scenario count and all current local-first/server-backed distinctions.
- Browser/database boundary: repository-owned disposable local PostgreSQL only; report local macOS results as local. No shared or published database, production data, or secrets.
- GitHub QA comments: one `## QA` criterion matrix on each child and a batch-gate matrix on #1096; do not close issues.
- No files or issues outside the named batch are to be implemented. Record any new actionable out-of-scope finding and follow the discovery gate before declaring completion.

## Implementation notes — #1168

- The Gallery-driven 3D creation scenario now asserts its `/local-projects/:id`
  route and local-only save/download state, then uses `createServerProject3D`
  separately for server-backed editor coverage, as permitted by #1104's
  scenario-classification alternative. The test assertion count is unchanged.
- A direct attempt to cover local 3D “Make public” transfer returned HTTP 400
  after the enabled Publish action. Existing open #1174 covers the nearby
  local-transfer publication flow. No application/backend code changed; the
  #1168 scenario uses API setup for its server-backed portion.
- Focused local Chromium verification (with the separate #1170 AI case
  filtered out pending its ordered turn): 11 passed, 0 skipped. The local
  Chromium run used the disposable fixture environment and required an
  unsandboxed browser launch because the sandbox denied Chromium's macOS Mach
  port rendezvous.
