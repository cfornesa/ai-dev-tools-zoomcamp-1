# Authored pieces parity distillation — 2026-09-03

## Scope

This manifest covers only the pieces implementation represented by the
`augment-humankind` examples and its maintained `docs/piece-surface-parity.md`
contract. It is a translation into this repository's Django/Python backend
and React/TypeScript frontend. PHP and unrelated CMS features are out of
scope. This is a backlog-definition artifact: no product source or product
test was changed during this pass. Closed issues are immutable; no issue was
reopened.

## Authoritative evidence

- Reference: `../augment-humankind/docs/piece-surface-parity.md`,
  `public/app/views/partials/piece-stage.php`,
  `public/app/helpers/immersive-chrome.php`,
  `public/assets/js/piece-fullscreen.js`, and
  `public/assets/js/immersive-gallery.js`.
- Exact private editor: `https://animate.creatrweb.com/projects3d/f3863d2f-d3a5-41ad-9883-7b8441af6217`.
- Exact supplied public route: `https://animate.creatrweb.com/p/7b2ecd2b-0a46-4031-b4a2-bb6b9cd74df2`.
- Fresh browser inspection of both served `https://animate.creatrweb.com/assets/index-CecM7AFX.js`.
- The editor rendered the saved 3D scene and a hamburger. After opening it,
  the legacy bundle showed Screenshot, Download, Immersive, Sound, Piece
  controls, Steer, Guide, Editor actions, publication status, and Fullscreen,
  but some visible labels were detached or absent. The public route rendered
  the `Blank canvas` 2D fixture and permitted actions after opening its menu.
- `Logout` was present on both routes, so this is not anonymous privacy
  evidence. The public fixture is not the intended non-empty 3D example.
- Local inspection found the Full 3D export bundles MediaPipe assets but does
  not expose the React surface's named `Steer the piece` lifecycle or camera
  view composition. `ImmersiveProject3DViewer` invokes the regular generator,
  so its downloads do not preserve immersive arrow-key travel.

## Duplicate and already-covered-work report

| Finding | Existing owner | Decision |
|---|---|---|
| Stale deployed manual 3D editor, Draft/Published and authoring evidence | [#355](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/355) | Reuse; no deployment duplicate or reopening. |
| Authenticated public browser and wrong/blank fixture | [#356](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/356) | Reuse; anonymous context and intended fixture remain required. |
| Shared menu/editor local work | Closed #362, #365, #366, #367 | Immutable historical transactions; route proof stays separate. |
| Manual/public sphere projection | #349 and #360 | Reuse separate geometry contracts. |
| Public, embed, immersive route behavior | #330–#335 | Reuse one route/query issue per transaction. |
| Existing regular/2D artifact contract | Closed #363 and earlier records | Preserve; no reopening. |
| Existing Full/Non-Camera 3D artifact contract | Closed #364 | New narrower gaps are #368 and #369; #364 is not reopened. |

## Criterion-ready manifest and order

1. [#355](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1): exact
   authenticated deployed manual 3D editor route; requires reviewed asset
   publication, two fixed-view screenshots, opened controls, and
   Draft/Published interaction.
2. [#356](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1): exact
   anonymous deployed public 2D route and intended fixture; requires anonymous
   context, permitted controls, responsive screenshots/interactions, and asset
   identity.
3. [#349](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/349):
   manual 3D sphere geometry at 1280×900 and 375×812.
4. [#360](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/360):
   public 3D sphere geometry with the intended anonymous fixture.
5. [#368](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/368):
   immersive-route downloaded 3D artifacts; Full/Non-Camera immersive mode,
   arrow travel, controls, privacy, and responsive extracted-browser evidence.
6. [#369](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/369):
   superseded distillation umbrella; it is closed and must not be reopened.
7. [#370](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/370):
   Full-download opt-in steering lifecycle, camera gating, cleanup, and
   manual-navigation restoration.
8. [#371](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/371):
   Full-download camera-view visibility, opacity, and mirror composition.
9. #330–#335: each public 3D, embed, immersive, Custom, and CMS route, one
   URL/query per route transaction.
10. #339/#341: AI/manual 3D publication workflows, one owner route each.
11. #320/#324/#274: reconciliation containers only; never engineer directly.

## Blocker and follow-up triage

| Evidence | Classification | Existing/new action |
|---|---|---|
| Live exact routes serve `index-CecM7AFX.js` | Verification boundary | #355/#356; synchronize/publish, then recheck. |
| Public URL is authenticated and `Blank canvas` | Fixture/verification boundary | #356; obtain anonymous context and intended fixture. |
| Full artifact has assets but no complete steering/camera-view contract | Implementation defect | New #369. |
| Immersive consumer calls regular generator | Implementation defect | New #368. |
| #369 combined two independent Full-download behaviors | Atomicity defect | Closed as superseded; new #370/#371 own the behaviors. |
| Physical held-pinch proof | Verification boundary | Existing #344; do not block independent work. |
| Docker extracted-browser QA, when daemon is unavailable | Workflow/infrastructure boundary | Existing documented workflow; rerun distillation at handoff if blocked. |

## Handoff

Distillation and bulk grooming are complete. The next groomed issue is
**#370**, locally actionable without the stale deployment or anonymous
fixture. #371 follows. #369 is closed as a distillation umbrella and must not
be reopened. Engineering and testing must be one transaction per issue,
followed by reconciliation and permanent closure or a terminally classified
blocker before the next issue begins. Any new gap is a new linked issue; no
closed issue is reopened without explicit owner authorization naming that exact
issue.

## #372 transaction reconciliation — 2026-09-03

Testing #341 exposed a new atomic cross-browser defect: asynchronous sound
activation could reset Piece controls after the user had reopened it. #372
was created as the linked follow-up. Engineering now resets the disclosure
once, synchronously when sound toggling begins, rather than deriving reset
state from the later asynchronous `soundEnabled` commit. Focused controls and
sound tests passed 37/37, and the manual 3D browser scenario passed 3/3 in
Chromium, Firefox, and WebKit. #372 is ready for permanent closure; no closed
issue was reopened.

## #368 transaction reconciliation — 2026-09-03

- Engineering completed the immersive export option through
  `ImmersiveProject3DViewer`, the 3D ZIP generator, and the standalone runtime.
  Immersive artifacts now carry explicit surface metadata and README guidance;
  regular artifacts remain explicitly marked regular.
- QA: `BROWSER_QA_E2E_SPEC=e2e/exportArtifacts.spec.ts make browser-qa` passed
  57 scenarios across Chromium, Firefox, and WebKit. `make frontend-check`
  passed with 191 test files and 2,402 tests; lint emitted only existing
  warnings.
- Reconciliation found no new in-scope gap. Camera-steering parity in
  extracted Full artifacts remains the separately linked #369 follow-up. The
  stale published bundle remains the separately owned #355/#356 boundary.
- Closure: #368 is ready for permanent completion closure. It must not be
  reopened for #369, deployment publication, or any other follow-up.

## Current owner-report reconciliation — 2026-09-03

- Exact public URL inspection is anonymous (`Login` is present) and the
  hamburger opens the permitted public actions. Rendered inspection still
  fails the requested visual contract: action labels are detached from their
  large button rows instead of staying in cohesive labeled controls.
- Exact private editor inspection is unavailable without the owner session;
  editor parity and Draft/Published reversal remain unproven.
- Both exact routes serve `assets/index-CecM7AFX.js`, while the reviewed
  checkout is `98b5301`; the live asset is not the reviewed revision.
- Duplicate/ownership decision: #355 owns authenticated deployed editor
  verification; #356 owns anonymous public fixture/control verification. No
  new deployment duplicate is created. Closed #347–#368 remain immutable.
- Independent local artifact work remains actionable: #370 is the next
  groomed transaction, followed by #371. These do not depend on the stale
  deployment or missing editor session.

## #370 transaction reconciliation — 2026-09-03

- Full 3D downloads now expose an explicit, inactive-by-default “Steer the
  piece” lifecycle, preserve manual controls on failure, and provide “Stop
  steering” cleanup. Non-Camera downloads omit camera UI and camera assets.
- The Piece controls disclosure is wired by the exported shell, and the opened
  command drawer is bounded with scrolling confined to that opened drawer on
  short viewports.
- QA passed: `BROWSER_QA_E2E_SPEC=e2e/exportArtifacts.spec.ts make browser-qa`
  (57/57 across Chromium, Firefox, and WebKit) and `make frontend-check` (191
  test files, 2,402 tests; existing lint warnings only).
- Reconciliation found no new in-scope gap. #371 owns camera-view composition;
  #355/#356 own deployed-route verification. No closed issue was reopened.
- #370 is complete and must be permanently closed before #371 begins.

## #371 transaction reconciliation — 2026-09-03

- Full 3D downloads now expose independent Camera view, Camera opacity, and
  Mirror camera controls. Camera view is off by default, opacity defaults to
  35%, and mirror defaults on; updates only affect the local preview.
- Stopping steering releases the stream and removes the stale preview. The
  Non-Camera variant contains none of the camera-view controls or camera path.
- QA passed: browser artifact QA 57/57 across Chromium, Firefox, and WebKit;
  `make frontend-check` passed 191 files and 2,402 tests, with existing lint
  warnings only.
- Reconciliation found no new in-scope gap. #355/#356 still own deployed-route
  verification. No closed issue was reopened.
- #371 is complete and must be permanently closed; later parity work is a new
  linked issue rather than a reopening.

## Current owner-reported parity re-audit — 2026-09-03 (canonical)

Definition-only pass; no product source or tests changed. Parity covers only
the `augment-humankind` pieces implementation/examples, translated into
Django/Python and React/TypeScript; PHP is reference-only. Closed issues are
immutable and none were reopened. #355 owns authenticated manual 3D deployed
verification (anonymous inspection is access-denied). #356 owns anonymous
public 2D fixture/controls (the route is anonymous but renders `Blank canvas`
and its 375x812 menu visibly has oversized rows, detached labels, and a
detached download tooltip). #360 owns public 3D geometry; #328 and #330–#335
own remaining route verification; #339/#341 own open publication records;
#344 owns physical held-pinch evidence. #274/#320/#324 are reconciliation
containers only.

Both routes serve `assets/index-CecM7AFX.js`, not reviewed checkout
`a66c8965f4805e67c6aa1c78423df6c65bf6bab3`; local tests cannot substitute for
deployed evidence. No duplicate issue is needed, and #347–#371 remain closed.
Handoff is #355, blocked by owner authentication and republish; #356 can
proceed independently once the intended fixture is published. Engineering and
QA remain paired per issue before permanent closure.

## Revalidation evidence — 2026-09-03

- Docker Compose backend and PostgreSQL are healthy; the frontend container is
  running.
- A clean local production build emitted `index-BzFsv-7v.js` and
  `index-TvD3gX1E.css`; focused `PieceStageToolbar` and
  `StageControlsPopover` tests passed 7/7.
- The local authenticated session has no copy of the supplied project or
  public-piece fixture, so it cannot replace the deployed route evidence.
- The deployed public route still emits `index-CecM7AFX.js` and the deployed
  private route is access-denied without the owner session. This is evidence
  of a deployment/fixture/session boundary, not authorization to reopen any
  closed issue.

## #339 transaction reconciliation — 2026-09-03

The AI 3D stage-local publication implementation passed its fixed local
boundary: focused AI 3D/publication/preview tests passed 55/55, and
`BROWSER_QA_E2E_SPEC=e2e/ai3dStageChrome.spec.ts make browser-qa` passed 3/3
across Chromium, Firefox, and WebKit. The local Draft/Published disclosure,
responsive stage toolbar, and removal of the standalone bundle control were
verified. Exact deployed verification remains #328. #339 is permanently
closed; no closed issue was reopened.

## Reopened Chrome route revalidation — 2026-09-03

The authenticated Chrome session now reaches the supplied owner route. The
live compact disclosure exposes Screenshot, Download, Immersive, Sound, Piece
controls, Steer, Guide, editor actions, Publication status: Draft, and
Fullscreen. The publication disclosure exposes the private Draft explanation
and Draft/Published choices. At 375x812, a pointer-cleared rendered capture
showed the menu and publication drawer within the viewport with no horizontal
overflow. The deployed asset observed was `assets/index-CecM7AFX.js`.

The browser window cannot establish 1280x900; its maximum observed viewport is
962x865 even after requesting the larger size. Therefore #355 remains open as
a verification boundary. Its next action is the same route matrix in a
session capable of 1280x900, followed by exact deployed revision
reconciliation. No product source/tests changed, no closed issue was
reopened, and the required post-blocker distillation found no duplicate or
new implementation issue.

## Distilled follow-up #373 — 2026-09-03

The exact owner-route recheck found the compact publication confirmation below
the visible command surface: the final Publish button measured at y≈1030 in
the 1280x900 emulated viewport. Selecting Published opened the confirmation,
but the final action could not complete from the visible overlay. Existing
#355 owns deployed verification; no duplicate deployment issue is needed.
This distinct local layout/workflow gap is now criterion-ready as #373: the
publication panel must remain reachable at 1280x900 and 375x812, preserve
accessible Draft/Published states, and exercise the existing API path. #373 is
the next engineering transaction, followed by focused QA and a permanent
closure decision before any subsequent issue.

## #373 transaction reconciliation — 2026-09-03

Engineering changed the shared publication-panel CSS so the compact panel is
positioned from its trigger and opens upward. Focused tests passed 12/12;
`make frontend-check` passed 191 files and 2,404 tests (existing lint warnings
only); and `BROWSER_QA_E2E_SPEC=e2e/manual3dStageChrome.spec.ts make browser-qa`
passed 3/3 across Chromium, Firefox, and WebKit. The browser scenario now
asserts the confirmation dialog remains inside the 1280x900 route viewport.
The deployed revision/fixture boundary remains #355. No closed issue was
reopened.

## #355 transaction reconciliation — 2026-09-03

Replit synchronized and published commit `c4aae1c`; the exact authenticated
owner route served `assets/index-I1VsT0b2.js`. Post-publish rendered checks
passed at emulated 1280x900 and 375x812: the saved scene loaded, the compact
stacked stage disclosure stayed reachable, and no required control was clipped
or horizontally overflowed. The authorized Draft -> Published -> Draft round
trip passed and the fixture was restored to Draft. The earlier off-screen
confirmation was corrected by #373, which was separately QA-closed. #355 is
ready for permanent closure; public/anonymous and other route/artifact
boundaries remain separate issues. No closed issue was reopened.
