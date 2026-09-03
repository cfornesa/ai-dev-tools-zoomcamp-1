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
