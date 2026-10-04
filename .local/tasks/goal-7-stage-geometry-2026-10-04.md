# Goal 7 — stage and toolbar geometry (2026-10-04)

- **Project / branch / base:** `ai-dev-tools-zoomcamp-1`; `docs/backlog-reevaluation-2026-09-27`; `b86cd265`.
- **Milestone / wave:** Batch 14; stage geometry wave.
- **Owner rule:** at ≥701px preserve each piece's declared `--art-piece-aspect-ratio` (16:9 fallback); at ≤700px put the toolbar below the stage; only `c2js-interactive` gets `min(70vh, 26rem)` tall-stage sizing.
- **Batch gate:** pending until every ordered issue has a focused result, `make check`, and shared-surface regressions pass. No issues close in this transaction.
- **Environment:** local macOS Chromium; repository Compose PostgreSQL is disposable (`disposable-compose` fixture mode); local Vite on 127.0.0.1:5201 proxied to Compose backend 127.0.0.1:8003. Chromium required unsandboxed because sandboxed launch failed at macOS MachPort initialization. Linux full matrix: `Linux evidence PENDING (owner dispatch)`.
- **Provenance:** issue-scoping/PM — Codex / GPT-6 (effort not exposed); implementation — Codex / GPT-6 (effort not exposed), substituted for Opencode Go on 2a and Ollama Cloud on 2b; stage 3 independent review not run; stage 4 Claude QA was not available in this execution. Local checks are recorded as implementation evidence, not independent sign-off. Track: mixed.

## Ordered manifest

| Issue | URL | Milestone | Wave | Backlog | Dependency | Scope | State | Stage owners (scoping / impl / review / QA / gate) | Substituted? | Blocker / next action |
|---|---|---:|---:|---|---|---|---|---|---|---|
| #1188 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1188 | Batch 14 | 1 | `docs/tasks.md` Goal 7 | none | Public regular phone stage CSS and drawing predicate | LOCAL PASS / QA pending | Codex / Codex / not run / pending / pending | yes (2a) | batch gate and matrix pending; Linux owner dispatch pending |
| #1189 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1189 | Batch 14 | 1 | `docs/tasks.md` Goal 7 | #1188 | Embed route behavior and screenshots | LOCAL PASS / QA pending | Codex / Codex / not run / pending / pending | yes (2a) | batch gate and matrix pending; Linux owner dispatch pending |
| #1175 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1175 | Batch 14 | 1 | `docs/tasks.md` Batch 14 map | #1188 and #1189 | Migrate four stage/toolbar E2E cases to owner two-tier contract | GROOMED | Codex / Codex / not run / pending / pending | yes (2b) | implement after product routes |
| #1177 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1177 | Batch 14 | 1 | `docs/tasks.md` Batch 14 map | serialize with #1188 shared CSS | Bisect 306px shell panel drift | GROOMED | Codex / Codex / not run / pending / pending | yes (2a; escalate on CSS regression) | measure cause before changing shell CSS |
| #1178 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1178 | Batch 14 | 1 | `docs/tasks.md` Batch 14 map | after #1175 | 3D drawing-plane pixel coverage cause | GROOMED | Codex / Codex / not run / pending / pending | yes (2a) | record canvas/projection evidence; preserve threshold intent |
| #1176 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1176 | Batch 14 | 1 | `docs/tasks.md` Batch 14 map | none; ordered here by owner | Export action 44px target defect | GROOMED | Codex / Codex / not run / pending / pending | yes (2a) | fix export output and unit test |
| #1228 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1228 | Batch 14 | 1 | `docs/tasks.md` Goal 7 | after shared CSS work | Reserve unified editor panel room for fixed shell toggles | GROOMED | Codex / Codex / not run / pending / pending | yes (2b) | route-scope; preserve #1158 behavior |

## Impact matrix

| Surface | Kind | Issue(s) | Other open issue references | Collision / invalidation | Required re-verification |
|---|---|---|---|---|---|
| `frontend/src/generative/artPieceCapabilities.ts` predicate and `PublicArtPieceViewer.tsx` stage attribute/toolbar host structure | add/change | #1188, #1189 | #1175, #1189; closed #1083 route consumer | Shared component serves canonical and embed routes; serialize route-specific product change before spec migration | `PublicArtPieceViewer` Vitest, new regular/embed geometry cases, #1083 |
| `frontend/src/index.css` public stage and toolbar region | change | #1188, #1189, #1175 | #1177 shared stylesheet; #1158 fixed-toggle placement; closed stage/toolbar consumers | Keep 2D generated surfaces separate from 3D and preserve desktop rule | all stage/toolbar specs; #1177 shell surface; `make check` |
| `frontend/e2e/artPieceSixEngineRegular.spec.ts`, `artPieceSixEngineEmbed.spec.ts`, `pieceStageSizing.spec.ts`, `pieceToolbarPlacement.spec.ts` | change | #1175 | #1188/#1189 product contracts; #1083 remains unchanged | Update only phone expectations; preserve desktop checks and case counts | four focused specs and #1083 |
| `frontend/src/index.css` shared `.content-panel` / shell shadow area | change only if bisect proves #1177 root cause | #1177 | global shell E2E consumers | Avoid changing user-visible shell geometry absent causal evidence | `contentPanelShadow`, `responsiveShell`, `headerMobile`, `publicShell`, `accountShell` |
| `frontend/e2e/drawingPlane3d.spec.ts` | change only if measured canvas regression justifies threshold form | #1178 | 3D stage geometry tests | Preserve pixel intent; do not weaken without area-normalized evidence | drawing-plane spec plus 3D stage regressions |
| export HTML generator and test | change | #1176 | #1163 script/security audit | Keep script content unchanged | `exportArtifacts` browser + export unit tests |
| editor panel display-toggle CSS and geometry spec | change | #1228 | #1158 fixed desktop placement and ≤767px in-flow rule | Scope clearance to unified editor routes only | AI panel layout and shell-toggle specs at 375, 768, 1280 |

## #1188 evidence

- **Commit:** `a4cbcf7c` (`fix(generated-art): apply interactive-only phone stage rule (#1188)`).
- **Focused browser:** `E2E_BASE_URL=http://127.0.0.1:5201 E2E_FIXTURE_ENVIRONMENT=disposable-compose E2E_DOCKER_COMPOSE=true npx playwright test e2e/publicArtPiecePhoneStage.spec.ts e2e/publicArtPieceMobileLayout.spec.ts --project=chromium` — 2 passed. Five fixtures (4:3, fallback, 21:9, 9:16, `c2js-interactive`) run at 375×812, 768×1024, and 1280×900. Fullscreen enters/exits at 768px and 1280px; all ten required 375px/1280px full-page screenshots are retained and visually inspected at `/private/tmp/goal7-playwright-1188-inspected/publicArtPiecePhoneStage-p-51c11-lace-controls-below-artwork-chromium/`.
- **Regression:** #1083's mobile drawing-control case passes in the same focused run; visitor drawing group remains outside the iframe.
- **Unit:** `npx vitest run src/generative/artPieceCapabilities.test.ts src/pages/PublicArtPieceViewer.test.tsx` — 2 files, 8 passed; full Vitest on the in-progress change — 316 files, 3,231 passed.
- **Static:** typecheck pass; lint exit 0 with existing warnings; format check pass.
- **Visual review:** phone screenshots show declared 4:3, 21:9, and 9:16 stages plus 16:9 fallback contained without horizontal overflow; interactive artwork remains on a tall stage and its 44px action/color targets wrap below it. Desktop screenshots retain ratio sizing and overlay controls; 9:16 creates a tall page stage without horizontal overflow.
- **Baseline:** no #1188-owned `known-failures.json` entries; #1175 entries remain for its later spec migration.
- **QA matrix / batch gate:** pending until whole batch gate. Linux evidence pending owner dispatch.

## #1189 evidence

- **Commit:** pending at issue-commit time.
- **Focused browser:** `E2E_BASE_URL=http://127.0.0.1:5201 E2E_FIXTURE_ENVIRONMENT=disposable-compose E2E_DOCKER_COMPOSE=true npx playwright test e2e/publicArtPieceEmbedStage.spec.ts e2e/embedToolbarOrder.spec.ts --project=chromium` — 2 passed. New anonymous embed-route coverage creates the required published 4:3 `canvas2d` and `c2js-interactive` fixtures, then runs both at 375×812 and 1280×900; all four full-page screenshots are retained and inspected under `frontend/test-results/publicArtPieceEmbedStage-c-2a079-hone-controls-below-artwork-chromium/`.
- **Observed behavior:** at 375px the ordinary 4:3 iframe and interactive tall iframe both have the toolbar row below artwork, 44px action targets, no overlap or horizontal overflow; at 1280px both remain ratio-sized with overlay controls and no app banner. Embed sandbox attributes were not changed.
- **Sequencing:** `artPieceSixEngineEmbed.spec.ts` is a #1175-owned baseline case and still contains the pre-migration fixed-ratio assertion for the interactive fixture. Preserve that entry here; rerun it after #1175 applies the approved two-tier expectation.
- **Baseline:** no #1189-owned `known-failures.json` entry; the #1175 entries remain until #1175.
- **QA matrix / batch gate:** pending until whole batch gate. Linux evidence pending owner dispatch.
