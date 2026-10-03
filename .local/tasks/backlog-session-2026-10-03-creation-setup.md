# Batch 14 — creation/setup E2E Wave 2B

## Session scope and constraints

- Project: `cfornesa/ai-dev-tools-zoomcamp-1`; branch `docs/backlog-reevaluation-2026-09-27`.
- Ordered issues, all open in milestone 14: #1168, #1169, #1170, #1166. #1170 shares `project3dLifecycle.spec.ts` and `frontend/e2e/support/`; one implementer, serialized issue commits.
- Do not remove or change the inert `Open piece controls menu` shim; its later migration/removal belongs to #1187 (and owner decision #1167).
- Current contract: Gallery creation is local-first, persisted in IndexedDB and routed to `/local-projects/:id` for 2D and 3D editor creation; legacy `/ai-projects*` paths redirect to the unified editor. Tests will retain or add coverage of that contract where creation is under test. Tests needing published/server-backed fixtures may use the existing server-backed helpers. No retired E? candidate will be dropped.
- Each issue commit removes only that issue's existing `frontend/e2e/known-failures.json` entries. No push, dispatch, merge, issue closure, `git add -A`, `git commit -a`, stash, reset, or discard.
- Stage 2a roster: Opencode Go / Kimi K2.5. Actual implementation: Codex / GPT-6 (effort not surfaced), substituted: yes. Stage 4 QA is rostered to Claude / Sonnet 5 / Medium; it is not run here. Local checks are implementation evidence, not Linux CI evidence.

## All-open-issue discovery (2026-10-03)

Authenticated GitHub open-issue enumeration returned **69** issues: #1096 and every issue #1160–#1227 inclusive. The original 66-issue discovery and run #1126 map were retained; this refinement reread the four groomed product issues #1174/#1225/#1226/#1227, and searched all open issue bodies and repository/task records for the shared shell, cosmic backdrop, structured-3D toolbar, and Goal 7 stage/toolbar surfaces. Relevant cross-hits are listed in the impact refresh below. Disposition for all 69:

- In this batch: #1168, #1169, #1170, #1166.
- Directly affected dependency / neighboring criteria: #1167 (shim decision), #1187 (explicitly deferred), #1174 (publication dialog shares the footer layer), #1175/#1176/#1177/#1178/#1188/#1189 (Goal 7 files/rules in `index.css` or their adjacent specs), #1181 (local Gallery creation), #1190 (shared baseline), #1194 (shared-helper documentation), and #1096 (parent tracker).
- The remaining open issues were reviewed for the changed selectors and routes; no new follow-up was found. Product work on #1225/#1226/#1227/#1174 is authorized by the current owner instruction and stays in this batch.

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

## Wave 2B expanded-impact refresh (written before product edits)

This refresh replaces the earlier “no product CSS edits” limitation. The owner
authorized product markup/CSS only for #1227, #1174, #1226, and #1225. Changes
remain serialized in that order before the creation/setup specs are finalized.

| Surface | Kind | Issues in batch | Open issues that reference or consume it | Collision / decision | Required re-verification |
| --- | --- | --- | --- | --- | --- |
| `frontend/src/index.css`: `.app-shell > :not(.cosmic-starfield):not(.shell-display-toggles):not(.skip-link)`, `#main-content`, `.app-shell-footer` | Product stacking and pointer hit-testing | #1227, #1174 | #1166 (`public3dCameraPlacement742.spec.ts`); #1170 (`publicGalleryMixedPieces.spec.ts`); #1177 (content-panel shell measurements); #1172 (shell display toggles); #1096 | Verify equal z-index hypothesis. Keep footer visible, place main overlays above it, preserve exclusions and all shell layout. Goal 7 issues share the stylesheet but own separate selectors; do not change their stage rules. | #742 and #1174's exact specs; `responsiveShell`, `headerMobile`, `publicShell`, `accountShell`, `accountThemeParity`; screenshots at 375x812, 768x1024, 1280x900. Check enabled and disabled Publish causes separately. |
| `frontend/src/index.css`: `.cosmic-starfield`, `.cosmic-nebula`, `.cosmic-stars`, `.cosmic-star` | Decorative fixed-background overflow | #1226 | #1170 (`aiPanelLayout2d/3d`); #1172 and #1177 are global shell consumers; #1096 | Existing `.cosmic-starfield` rule already declares `overflow: hidden`; confirm its computed containing block/scroll contribution before changing it. If needed, clip only the decorative fixed container; preserve `prefers-reduced-motion` and `data-low-power` rules exactly. | 2D/3D panel specs at 375x812, 768x1024, 1280x900 with screenshot inspection; backdrop component tests; compare reduced-motion/low-power animation computed styles. |
| `frontend/src/index.css` structured 3D preview toolbar rules; `Scene3DPreview.tsx`, `PublicProject3DViewer.tsx`, `ImmersiveProject3DViewer.tsx` | Route-scoped structured-3D control placement | #1225 | #1169 (`public3dToolbar730`, `public3dImmersiveCameraOverlay734`); Goal 7 #1175/#1188/#1189 use distinct generated-art `.public-art-piece-*` selectors; #1177/#1178 consume shell/3D canvas geometry; #1176 is generated-export-only; #1096 | Keep public structured routes separate from generated-art routes and internal editor previews. Relocate the toolbar on phones; never hide it or change generated-piece stage rules. Keep desktop fullscreen within the stage and to its right half. | Both #1225 specs at desktop/mobile; named Goal 7 stage/toolbar regressions; screenshots at 375x812, 768x1024, 1280x900 and #1225's 1440x900 criterion. |
| `frontend/e2e/localPieceRoundTripPublish.spec.ts`, `relatedPublicProjects.spec.ts`; shell dialog hit testing | #1174 test/product distinction | #1174 | #1227 shared footer-layer issue; #1166/#1170 newly exposed sibling dialog/menu interactions | First repair shared footer stacking under #1227. Then inspect disabled state/reason and `elementsFromPoint` for all four cases; update only stale test setup, otherwise retain and classify product failures without loosening assertions. | Exact two-spec #1174 command plus #942/#1142 flows, and shell regression matrix. |
| Goal 7 stylesheet consumers: `pieceStageSizing`, `pieceToolbarPlacement`, `publicArtPieceMobileLayout`, `artPieceSixEngineEmbed`, `drawingPlane3d` | Out-of-batch regression set | None | #1175 (bisect/geometry), #1176 (generated export target size), #1177 (shell/content height), #1178 (3D drawing plane pixels), #1188 (regular public route), #1189 (embed route) | Include every open Goal 7 issue that edits or relies on `index.css`. Product changes here use disjoint app-shell, cosmic, or structured-public selectors; no changes to Goal 7 generated-piece rules, export generators, or drawing-plane projection. | Run all named specs available in the repo, plus `manual3dStageChrome` and the current batch's 3D toolbar specs; inspect all screenshots at specified widths. |
| `frontend/e2e/known-failures.json` | Baseline ratchet | #1169, #1170, #1166, #1174, #1225, #1226, #1227 | #1190 and #1096 | Remove only the numeric issue entries after that issue's named scenarios pass; issue commits stay separate, each revert is its restoration path. #1168 entries were already removed in `6d0c9f0e`. | Parse/validate baseline and compare counts per owner after each issue commit; final focused union and full required check. |

Open-inventory CSS search found #1225/#1227 and Goal 7 #1175/#1177/#1188 plus
the neighboring #1172 in issue bodies; exact stylesheet consumers in task
records additionally identify #1176/#1178/#1189. Those Goal 7 contracts are
explicitly preserved and included in the batch regression run.

## Ordered issue manifest

| Issue | Focused surface | Status before engineering | Commit / baseline removal | Focused evidence and next status |
| --- | --- | --- | --- | --- |
| #1168 | Seven 3D lifecycle/publication/export/thumbnail specs; retain all cases named in issue body | GROOMED | `6d0c9f0e`; its baseline entries are removed | Local Chromium: 11/11 focused #1168 cases pass; Linux e2e-browser still required |
| #1169 | Three public 3D camera/toolbar specs | GROOMED; execute after #1168's helper choice | Pending; baseline retained | Union Chromium: 1/3 named specs pass; #734 and #730 retain blocked geometry/hit-target assertions, tracked by #1225 |
| #1170 | Eight AI-related specs and the AI-assisted scenario in `project3dLifecycle.spec.ts` | GROOMED; serialized with #1168 | Pending; baseline retained | Union Chromium: AI-assisted lifecycle and other AI cases pass except #678/#679 at 768px (6px document overflow, #1226); mixed publication setup blocked by footer interception (#1174) |
| #1166 | Eight toolbar/shim collision specs | GROOMED; do not remove shim | Pending; baseline retained | Union Chromium: toolbar/shim cases pass except #742 Full ZIP click at 375x812, intercepted by footer (#1227); no shim removal |

## Batch verification plan

- Focused issue commands: exact commands from #1168, #1169, #1170 and #1166; run their union after #1168 and the shared-helper changes. Product-blocked cases remain in the baseline and are not committed as complete issues.
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

## Implementation notes — remaining ordered issues and batch gate

- #1169, #1170, and #1166 were migrated to the current creation/setup contracts
  and run in one union command after #1168's helper decision. The inert
  `Open piece controls menu` compatibility shim remains present and was not
  edited or removed.
- Union command: `E2E_FIXTURE_ENVIRONMENT=disposable-local
  E2E_ENV_FILE=/private/tmp/codex-wave1-e2e.env
  E2E_BASE_URL=http://localhost:5000 npx playwright test` over the 26 focused
  specs listed in this ledger's plan, `--project=chromium`. Result: 45 passed,
  6 failed. Failures: #678 2D overflow at 768px; #679 3D overflow at 768px;
  #742 Full ZIP click blocked by `.app-shell-footer`; #734 D-pad click blocked
  by the preview toolbar; #730 desktop fullscreen control is outside its
  expected stage half; mixed-public-gallery 2D Publish confirmation click
  blocked by `.app-shell-footer`. The overflow pair is tracked by #1226;
  #742 by #1227; #734/#730 by #1225; publication confirmation by existing
  #1174. Original assertions and known-failure entries remain for every
  incomplete issue.
- Repository check evidence: `UV_CACHE_DIR=/private/tmp/codex-uv-cache make
  check` reached all 2,056 backend tests (2,011 passed, 44 skipped, 1 failed).
  Backend ruff lint, format check, and mypy passed; backend test failure is the
  pre-existing source-contract assertion in
  `backend/tests/test_browser_qa_configuration.py::test_ci_runs_the_full_browser_acceptance_suite_and_uploads_diagnostics`,
  which expects the literal `run: npm run test:e2e` while `ci.yml` expresses
  that run as a folded multi-line YAML command. Focused rerun: 7 passed, 1
  failed. Frontend lint, Prettier, and typecheck passed separately; Vitest
  reported 3,229 passed, 1 failed suite, because it discovers
  `frontend/scripts/e2e-ratchet.test.mjs` (written for Node's test runner) but
  finds no Vitest suite. Existing #1190 owns the ratchet test file and its
  verification path; these unrelated check failures were not changed here.
- Final batch gate: **BLOCKED**. #1168 is locally verified and committed;
  #1169/#1170/#1166 cannot remove their baseline entries or receive completion
  commits while in-scope real browser interactions/geometry still fail. No
  CI workflow was dispatched, and there is no Linux browser-matrix evidence.

## Final post-fix verification (2026-10-03)

- After the four authorized product fixes, the exact 26-spec Chromium union
  ran against the disposable Compose PostgreSQL stack:
  `E2E_FIXTURE_ENVIRONMENT=disposable-compose E2E_DOCKER_COMPOSE=true
  E2E_BASE_URL=http://127.0.0.1:5001 npx playwright test` with the 26 filenames
  listed in the batch plan. Result: **51 passed, 0 failed, 0 skipped**.
  Chromium needed host permission because the sandbox's first attempts failed
  before test execution at macOS Mach port rendezvous (`Permission denied
  (1100)`).
- The repeated #730/#734 regression was run three times per spec after
  changing the geometry helper to compare action bounds relative to the preview
  frame. Diagnostic evidence at 375×812 showed both frame and toolbar move up
  36px while `window.scrollY` remains 0; the original viewport-coordinate
  delta therefore measured a page layout translation, not toolbar reflow.
  The 1px within-frame position/size tolerance and action-count assertion are
  retained. Both specs passed 3/3; after restoring the count assertion, #730
  passed twice more.
- The required responsive-shell/header/public-shell and Goal 7 stage/toolbar
  regression run remains as recorded above: 20 passed, 4 failed on the known
  open Goal 7 issues #1175, #1178, #1188, and #1189. No Goal 7 source rule was
  changed. At 375×812, 768×1024, and 1280×900, the inspected #730 screenshots
  show the toolbar remains at the stage top, fullscreen stays at the right,
  and controls remain reachable; the mobile controls panel opens below the
  stage. The immersive #734 D-pad/zoom click assertions pass.
- Frontend `npm run typecheck`, `npm run lint`, and `npm run format:check`
  passed. Lint emitted only the repository's existing warnings. `make check`
  remains blocked by the unrelated stale backend CI-configuration test and
  Vitest discovering the Node-test-runner-only ratchet file, as recorded
  above. The focused CSS component test after restoring the shared fullscreen
  rule passed 9/9.
- #1225 follow-up commit `2a27b0c6` (`test(e2e): scope toolbar stability to
  stage geometry (#1225)`) preserves strict geometry and collection-size
  checks. Its restoration path is reverting that commit. Prior CSS follow-up
  `607fcb8c` restored generic fullscreen placement after the component test
  exposed the regression; its restoration path is reverting that commit.
- Chromium entries for #1169/#1170/#1166 pass in the final union; Firefox's
  remaining #1166 entry stays in `known-failures.json` because macOS Firefox
  cannot launch in this environment. No workflow was dispatched, so Linux
  browser-matrix evidence remains pending. The child-issue and #1096 QA
  matrices are refreshed with local evidence and the pending Linux gate.
  Final batch gate: **BLOCKED pending Linux matrix and green `make check`**.

QA comment links: [#1168](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1168#issuecomment-5973496846), [#1169](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1169#issuecomment-5973496968), [#1170](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1170#issuecomment-5973497100), [#1166](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1166#issuecomment-5973497218), [#1174](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1174#issuecomment-5973497342), [#1225](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1225#issuecomment-5973488691), [#1226](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1226#issuecomment-5973497441), [#1227](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1227#issuecomment-5973497555), [#1096](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1096#issuecomment-5973497657).
