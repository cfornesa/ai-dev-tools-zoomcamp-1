# Authored-piece parity distillation — 2026-09-02 (re-audit)

Project: `cfornesa/ai-dev-tools-zoomcamp-1`, with `../augment-humankind`
as read-only behavioral reference.

## Authoritative findings

- Live public `/p/7b2ecd2b-0a46-4031-b4a2-bb6b9cd74df2` still renders the
  prior deployed revision: Preview has no stage toolbar and the camera/demo
  controls remain a separate always-visible region. This was re-confirmed
  from the current deployed DOM on 2026-09-02.
- Live private `/projects3d/f3863d2f-d3a5-41ad-9883-7b8441af6217` redirects to
  the anonymous access error, so editor controls and publication state are
  not verified without authentication.
- Local source now contains a shared `PieceStageToolbar` for structured 2D/3D
  surfaces, but the complete capability contract and exact deployed proof are
  still incomplete. This distinction explains why local tests can pass while
  the user’s live URLs still show the old UI: commits have not been published.
- The reference contract in `../augment-humankind/docs/piece-surface-parity.md`
  requires regular, embed, immersive, and downloaded surfaces to share
  capability behavior; Full ZIP preserves permitted controls while
  Non-Camera removes camera rendering/UI/theremin/hand tracking/MediaPipe but
  retains non-camera sound.
- The repository has no `compose.yaml` or Dockerfile. The running Docker
  project is an unrelated sibling app and must not be treated as this project.

## Complete issue manifest

| Issue | Goal / scope | Dependencies / order | Status | Blocker / next action |
| --- | --- | --- | --- | --- |
| [#320](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/320) | Shared authored Project/Project3D stage chrome and capability contract | Parent integration gate; decomposed into #295, #306, #325–#345 | `in_progress` | Process one closure-sized route/capability child at a time; close parent only after all children are terminal and reconciled |
| [#274](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/274) | Superseded authored-piece parity umbrella | Historical parent; replaced by #320 and closure-sized children | `closed_not_planned` | Historical reference only; do not use as a closure unit |
| [#123](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/123) | Native E2E default port must match Vite’s documented port | Independent workflow item | `closed_completed` | QA PASS posted and issue closed after source/default and browser-runner verification |
| [#321](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/321) | Docker browser verification must select and fingerprint the correct project | Independent workflow item; no repository Compose definition currently exists | `dependency-blocked` | `workflow/infrastructure-defect`; native runner fingerprints its own stack, but a repository Compose definition is required before Compose preflight can be implemented; do not stop sibling containers |
| [#323](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/323) | Superseded four-route publication-control implementation umbrella | Historical parent; replaced by #338–#341 | `closed_not_planned` | Do not reopen or use as a closure unit |
| [#325](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/325) | Verify manual 2D editor `/projects/:id` | Child of #320; one route/surface | `open` | Requires authenticated browser evidence |
| [#326](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/326) | Verify AI 2D editor `/ai-projects/:id` | Child of #320; one route/surface | `open` | Requires authenticated browser evidence |
| [#327](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/327) | Verify manual 3D editor `/projects3d/:id` | Child of #320; one route/surface | `open` | Requires authenticated browser evidence |
| [#328](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/328) | Verify AI 3D editor `/ai-projects3d/:id` | Child of #320; one route/surface | `open` | Requires authenticated browser evidence |
| [#329](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/329) | Verify public 2D viewer `/p/:id` | Child of #320; one route/surface | `open` | Requires deployment and anonymous browser evidence |
| [#330](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/330) | Verify public 3D viewer `/p3d/:id` | Child of #320; one route/surface | `open` | Requires deployment and anonymous browser evidence |
| [#331](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/331) | Verify embedded 2D viewer `/embed/p/:id` | Child of #320; one route/surface | `open` | Requires deployment and browser evidence |
| [#332](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/332) | Verify embedded 3D viewer `/embed/p3d/:id` | Child of #320; one route/surface | `open` | Requires deployment and browser evidence |
| [#333](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/333) | Verify regular immersive 3D `/immersive/p3d/:id` | Child of #320; one route/surface | `open` | Requires deployment and browser evidence |
| [#334](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/334) | Verify custom immersive 3D `/immersive/p3d/:id?embed=1` | Child of #320; one route/variant | `open` | Requires deployment and browser evidence |
| [#335](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/335) | Verify CMS immersive 3D `/immersive/p3d/:id?embed=1&cms=1` | Child of #320; one route/variant | `open` | Requires deployment and browser evidence |
| [#336](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/336) | Verify portable 2D download runtime | Child of #320; one artifact surface | `open` | Requires deployed download and extracted-browser evidence |
| [#337](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/337) | Verify portable 3D Full/Non-Camera downloads | Child of #320; one artifact capability | `open` | Requires deployed downloads and extracted-browser evidence |
| [#338](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/338) | Manual 2D stage-local publication parity `/projects/:id` | Child of #320; one route and capability | `open` | Route-specific implementation and Chromium evidence |
| [#339](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/339) | AI 3D stage-local publication parity `/ai-projects3d/:id` | Child of #320; one route and capability | `open` | Route-specific implementation and Chromium evidence |
| [#340](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/340) | AI 2D stage-local publication parity `/ai-projects/:id` | Child of #320; one route and capability | `open` | Route-specific implementation and Chromium evidence |
| [#341](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/341) | Manual 3D stage-local publication parity `/projects3d/:id` | Child of #320; one route and capability | `open` | Route-specific implementation and Chromium evidence |
| [#295](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/295) | Live 3D five-slide hand-gesture guide | Shared capability; portable guide remains in #337 | `open` (reopened) | Current source has 3 steps; implement exact five-slide contract and browser evidence |
| [#306](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/306) | Shared Tone.js 3D audio foundation | Foundation for sound consumers; route evidence remains #327–#337 | `open` (reopened) | Current source has no `tone` dependency; implement and test the stated graph |
| [#342](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/342) | Independent 3D camera-view toggle | Shared capability; consumers verify through #327–#337 | `open` | Implement explicit camera visibility independent of steering/theremin |
| [#343](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/343) | Immersive 3D touch d-pad travel | Immersive capability; route variants decide inclusion in #333–#335 | `open` | Implement press/release/cancel semantics and touch-browser evidence |
| [#344](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/344) | Immersive 3D hand gesture move/strafe | Depends on #295; route evidence remains #333–#335 | `open` | Implement bounded travel and safe-stop behavior, or document a linked product decision |
| [#345](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/345) | 3D per-voice instrument selectors | Depends on #306/#310; route/artifact evidence remains #327–#337 | `open` | Implement three finite selectors and isolated voice changes |

## Distillation handoff gate (2026-09-02)

This manifest is the source of truth before any further implementation. The
open children above must be groomed and QA-closed independently against their
exact route or artifact. Before engineering starts, the selected issue must
have a fixed fixture and entry URL, finite named controls/states, exact
local/CI/browser commands, a deployment evidence boundary, explicit
not-applicable controls, dependencies, and one next action written in both
the issue and this manifest. Parent #320 is a roll-up only.

The interrupted publishing browser run is captured as evidence, not a fix
authorization. It exposed selector/contract drift after the stage-local
publication relocation and must first be classified against the affected
route issues (#338–#341) during grooming. No product or test change is part
of this distillation increment.

## Execution cadence gate (2026-09-02)

Distillation and grooming are intentionally bulk activities: the complete
backlog is decomposed, deduplicated, ordered, and given closure contracts in
one manifest. Engineering and testing are not bulk activities. Backlog-session
must select exactly one groomed issue, implement only that issue, write and
run its focused tests, run its required full/browser checks, perform QA, and
reconcile its evidence and GitHub status before starting the next issue. A QA
failure keeps the same issue current until it is closed, blocked, or handed
off with a classified blocker and exact next action. No later issue may be
used as a parallel implementation queue.

## Duplicate / already-covered report

- #313–#319 are generated `ArtPiece` routes (`/art-pieces/*`) and do not
  cover structured Project/Project3D authored pieces; they are related prior
  work, not duplicates of #320.
- #285–#311 cover isolated screenshot/fullscreen/export/sound/gesture/
  immersive slices, but their closure does not prove shared structured
  regular/embed/download parity; preserve their history and do not reuse their
  closed status as evidence for #320.
- Existing camera, renderer, sandbox, and publication issues are component
  prerequisites or regression coverage, not replacements for #320.

## Cross-surface gap matrix (re-audited 2026-09-02)

| Surface / requirement | Current evidence | Classification | Existing issue / next action |
| --- | --- | --- | --- |
| Manual 2D editor | Local source now places authoring, Camera, and Demo controls in stage-local chrome; exact deployed/editor visual parity remains unverified | `implemented locally / needs browser evidence` | #325/#338; authenticate and verify the exact owner route after publish |
| AI-assisted 2D editor | Local source now uses shared stage-local toolbar and Camera/Demo disclosure with the existing preview lifecycle; exact deployed/editor visual parity remains unverified | `implemented locally / needs browser evidence` | #326/#340; authenticate and verify the exact owner route after publish |
| Public 2D viewer / embed | Local source now uses shared stage-local toolbar and Camera/Demo disclosure; deployed route still serves the old sibling-panel shell | `verification-boundary` | #329/#331; publish, then verify exact public and embed routes |
| Manual/AI 3D editors | Shared toolbar and publication control exist locally; editor-specific actions remain a separate authoring toolbar within the stage, which is acceptable only if it does not duplicate runtime chrome | `implemented locally / needs browser evidence` | #327/#328/#339/#341; verify visual hierarchy and all controls with authenticated browser |
| Public/embed/immersive 3D | Shared `Scene3DPreview` toolbar exists locally; immersive route supports Custom/CMS embed query variants and arrow-key fly | `implemented locally / needs deployed evidence` | #330/#332/#333/#334/#335; verify exact routes after publish |
| Full 3D download | Local bundle includes stage controls, hand guide, permission-gated hand tracking, microphone, camera theremin, sound, keyboard, reset, screenshot, fullscreen, and bundled MediaPipe/Wasm/model assets | `implemented locally / needs deployed evidence` | #337; verify the exact deployed download after publish; #295/#306/#342/#345 changes must be reflected before closure |
| Non-Camera downloads | Camera host/module and camera-only mic/theremin code are omitted while non-camera sound/keyboard/view controls remain; disposable-stack browser test downloads and inspects the real ZIP | `implemented locally / needs deployed evidence` | #337; verify the exact deployed download after publish |
| Draft / Published | 2D and 3D owner controls exist locally and API tests cover atomic transitions; supplied private deployed route cannot be inspected anonymously | `verification-boundary` | #320; authenticate in the owner's browser session, then verify both states on exact URLs |
| Deployed examples | Public supplied URL serves the old shell; local `main` is 61 commits ahead of `origin/main` and has not been published | `verification-boundary` | #320/#274; after implementation, obtain authorization to push/publish, then run exact-route post-deploy QA |

## Closed-issue audit (2026-09-02)

Closed issues #285–#311 were re-read against their own hard acceptance criteria
and the current source, not their historical QA labels. Their narrow behavior
may remain valid, but none proves cross-surface parity. Two were materially
false as currently implemented and were reopened: #295 (three-step guide vs
required five-step guide) and #306 (custom Web Audio vs required Tone.js).
Issues #294 and #311 retain their narrower contracts: orbit/zoom gesture
support and arrow-key immersive fly. Their descriptions explicitly left
Move/strafe and touch d-pad behavior out of scope, which is why #343 and #344
are separate. #310's instrument selectors were optional, so #345 makes that
reference capability independently closable. #297 proves only the active
steering overlay, so #342 owns the independent camera-view toggle.

## Criterion-ready definition for #320

The issue is not complete until all of these are proven against the current
implementation and exact routes:

1. Manual and AI 2D/3D editors render one compact stage-local toolbar with
   screenshot, export menu, supported immersive entry, enabled sound/control
   affordances, hand guide, and fullscreen; no duplicate bulky action row
   outside the stage.
2. `/p/:id`, `/p3d/:id`, `/embed/p/:id`, and `/embed/p3d/:id` use the same
   stage component/capability contract; camera/demo settings are stage-local
   disclosures and never auto-activate.
3. Owner editors expose actionable Draft/Published state for 2D and 3D;
   server publication remains atomic and private data is absent from public
   responses.
4. Immersive 3D uses the same permitted controls and downloaded runtime
   behavior without claiming unsupported WebXR.
5. Full and Non-Camera downloads are functionally distinct where camera or
   hand capability exists; both retain the shared runtime overlays/functions,
   and the artifact omits only the download action itself.
6. Screenshot capture preserves the active composition/aspect ratio and
   excludes editor metadata; camera pixels appear only after explicit live
   capture/permission.
7. Canvas2D, SVG, Three.js, and sandboxed generated content degrade safely;
   raw generated source never executes in the parent app.
8. Component, API, artifact, and real-browser tests cover editor/public/embed/
   immersive/downloaded, publication transitions, privacy, fullscreen,
   screenshot, and camera fallback.
9. Authenticated editor and post-publish live-route evidence is attached to
   #320 before closure.

## Verification boundaries and triage

- Anonymous access to private editor URLs is a genuine browser verification
  boundary; next action is to use the owner’s authenticated browser session.
- The deployed public route is stale relative to local commits; post-publish
  verification is a Replit/deployment boundary, not a local test substitute.
- The unrelated Docker Compose stack is a reproducible workflow defect,
  tracked by #321; do not stop or mutate it. Native `scripts/browser-qa.sh`
  remains the repository-owned disposable browser runner.
- Native fullscreen and real camera/microphone prompts require browser/OS
  permission evidence and are not proven by jsdom.
- The previous #274 closure comment incorrectly treated the isolated child
  issue list as the complete product contract. The maintained parity gate is
  now #320's cross-surface matrix above; closed child issues are evidence for
  their narrow behavior only, never for integration across structured editor,
  public, embed, immersive, and downloaded surfaces.

## Re-audit evidence (2026-09-02)

- Exact public URL: the deployed DOM contains `Preview` with only `Scene
  canvas`; the `Demo and camera controls` region is a sibling region outside
  the stage and no screenshot/download/fullscreen toolbar is present.
- Exact private 3D editor URL: after loading, the deployed DOM reports “This
  project doesn't exist, or you don't have access to it.” No editor controls
  can be claimed without the owner’s authenticated browser session.
- Current local source: `PieceStageToolbar` is used by `EditorWorkspace`,
  `PublicProjectViewer`, and `Scene3DPreview`; the portable 2D runtime already
  contains screenshot/fullscreen and camera/demo capability scripts, while the
  portable 3D runtime now contains screenshot/fullscreen, reset/orbit/zoom,
  explicit sound enable/settings, volume, keyboard notes, movement tones, and
  a permission-gated local camera overlay in Full bundles. Non-Camera 3D
  bundles omit that camera surface while retaining non-camera controls.
- The capability policy is explicit in
  `frontend/src/components/pieceStageCapabilities.ts`: 2D exposes only its
  implemented screenshot/HTML-export/fullscreen controls, while 3D exposes
  ZIP export, immersive, sound, piece controls, gesture, guide, and fullscreen.
  The immersive 3D route now keeps gesture steering and its guide enabled.
- Correct-stack verification: `scripts/browser-qa.sh` passed its repository
  identity probes; focused injection passed 33/33 and public lifecycle/camera
  passed 24/24, including the corrected opt-in camera/demo disclosure. The
  publication-status controls are now keyboard-actionable and covered by
  component tests. The first full 137-test run reached 99 passed before the two
  focused regressions were corrected; the corrected focused suites pass, but a
  clean replacement full batch reached 135/137 with one skipped and one
  authentication/fixture timing failure before the target scenario began.
  The exact failed 8-test `projectLifecycle.spec.ts` rerun passed 8/8 in
  isolation. This is recorded as a verification flake, not as a clean full
  batch, until the complete run is repeatably green.
- Focused 3D editor browser coverage now passes 2/2, asserting stage-local
  toolbar controls on both manual and AI-assisted editor routes. Focused 3D
  artifact coverage passes 7/7 and proves Full/Non-Camera camera-surface
  separation. Full 3D scripts now include the shared standalone MediaPipe
  module and expose its active hand signals to the local Three.js orbit/zoom
  loop; Non-Camera scripts omit the tracking module and camera host.
- The corrected public publishing/remix browser run passes 24/24 and now
  asserts screenshot, Full/Non-Camera download menu, fullscreen, and the
  chrome-less `/embed/p/:id` route's shared stage toolbar. The full frontend
  suite passes 188 files / 2,373 tests; lint, typecheck, format, and build
  pass. Moving the editor authoring toolbar into the stage initially exposed
  a Code-tab regression; the toolbar is now still available while the visual
  canvas is hidden, with the focused Code-tab suite passing 11/11.
- GitHub open-issue enumeration on 2026-09-02 contains #320, #321, #325–#345
  except the historical closed #323/#324; #295 and #306 are reopened. #123,
  #274, #323, and #324 are closed historical records and are not closure
  evidence for the current parent. The current manifest therefore has 23
  open issues: #320, #321, #325–#345, plus reopened #295 and #306.

## Distillation decisions and uncovered context

- The repository has no `examples/` directory. Existing `attached_assets/`,
  tests, and the sibling PHP contract are the available references. No issue
  was invented for a missing user-provided folder; if examples are required,
  the owner must supply or identify them before route QA.
- Structured 2D currently has no sound, hand-steering, hand-guide, or 2D
  immersive renderer capability. Those controls are explicitly N/A in the
  2D child contracts rather than being silently claimed. A future 2D audio or
  immersive implementation requires a new groomed issue after product scope
  is chosen.
- The stale published revision and anonymous private-editor response are
  deployment/authentication boundaries, not implementation closure evidence.
  No push, publish, credential acquisition, or sibling-container mutation is
  authorized by this task.
- Every open route/artifact issue now names its fixed entry, finite controls,
  exact privacy/fallback behavior, browser/automation evidence, deployment
  boundary, explicit N/A behavior, and one next action. A child with a vague
  “verify parity” statement is not closure-ready.

- Full 3D ZIPs also bundle the MediaPipe vision module, Wasm/JS runtime files,
  and gesture-recognizer model under `runtime/mediapipe/`, so direct `file://`
  downloads do not depend on a CDN. Non-Camera ZIPs omit those assets and
  their camera runtime entirely.

## Re-audit implementation increment (2026-09-01)

- Manual and AI-assisted 3D editors no longer place Save/export as bulky
  header actions. They pass authoring controls into the shared stage toolbar,
  with the visual stage remaining mounted while Code is selected.
- The manual 3D export callback now receives the shared Full/Non-Camera menu
  variant instead of silently exporting Full for both menu choices.
- Full 3D downloads reuse `buildStandaloneCameraScript()` and the existing
  `window.__exportSetActiveInput` contract. The Three.js runtime consumes
  palm deltas for orbit, pinch strength for zoom, and resets the bridge when
  camera tracking stops. Non-Camera generation does not embed that module.
- Focused regression coverage is green: 15/15 across the 3D export and editor
  suites after waiting for the jsdom WebGL fallback before interacting with
  its remounted toolbar.

## Re-audit correction increment (2026-09-01)

- The second source audit found that the prior parity claim was too broad:
  AI-assisted 2D still had a separate screenshot/fullscreen row, manual 2D
  Save still lived in the header, AI-assisted 3D still had its whole-scene
  action outside the stage, and public 3D ignored the selected download
  variant. These were implementation defects, not deployment-only evidence
  gaps.
- AI-assisted 2D now uses `PieceStageToolbar` for screenshot, Full/
  Non-Camera HTML export, and fullscreen, and exposes the same Draft/Published
  control. Manual 2D Save is compact and inside the authoring stage toolbar.
  AI-assisted 3D's whole-scene action is also stage-local. The manual 2D
  stage toolbar remains reachable while Code is selected; only the artwork
  canvas is hidden.
- Public 3D now forwards the toolbar's selected export variant. The 3D
  fallback toolbar preserves immersive/download/fullscreen affordances even
  when WebGL cannot initialize.
- Focused correction coverage passes 65/65. The clean full frontend rerun is
  green at 188 files / 2,373 tests after one asynchronous WebGL-toolbar
  test-readiness failure was fixed. The first corrected publishing/remix
  browser rerun exposed a real selection-HUD hit-testing regression over the
  compact authoring Save control; the editor toolbar is now content-sized and
  layered above the HUD, and the shared stage toolbar remains above editor
  overlays. The complete disposable PostgreSQL/Django/Vite publishing/remix
  suite passes 24/24 after that correction.

## Memory links

## Re-audit implementation increment (2026-09-02)

- The shared 3D preview now keeps sound, keyboard/mic/theremin, gesture-camera,
  and overlay settings inside the stage-local Piece controls disclosure; the
  previous duplicate panels below the canvas were removed. Sound transitions
  reset the disclosure safely.
- Full and Non-Camera 3D exports retain the stage action controls and now make
  keyboard notes an explicit, functional opt-in in the portable runtime.
- Focused verification passes: 3D live controls 37/37, 3D export 7/7, and the
  real disposable PostgreSQL/Django/Vite browser lifecycle suite 2/2 for
  manual and AI-assisted 3D editors. This remains local evidence only; the
  supplied deployed URLs still require a publish before production-readiness
  can be assessed.

## Re-audit implementation increment (2026-09-02, continued)

- A second DOM-level inspection found the manual 2D authoring toolbar was
  still only positioned inside the outer canvas viewport, not inside the
  actual artwork canvas. That preserved the visual failure mode reported by
  the owner even though the earlier test only checked the viewport ancestor.
- Commit `b04b6b6` moves the complete authoring toolbar into
  `[data-testid="scene-canvas"]` and updates the narrow/desktop structural
  assertions. `EditorWorkspace.test.tsx` and
  `EditorWorkspace.toolbarAddShape.test.tsx` pass 37/37.
- This is an implementation-defect correction, not a deployment-only gap.
  Exact deployed verification remains blocked until the current local
  commits are pushed/published by the repository owner.
- The PHP reference contract also anchors shared stage chrome at the top of
  the stage. Commit `cea96ca` aligns the React toolbar and its menus with
  that placement for both 2D and 3D surfaces; focused parity tests remain
  green (82/82), and the production build passes.
- The first real-stack browser rerun after the canvas move exposed event
  bubbling from the nested authoring toolbar into canvas hit-testing, which
  cleared shape selection and hid the inspector. Commit `0f28d67` adds an
  interaction boundary around the overlay. The corrected disposable
  PostgreSQL/Django/Vite publishing/remix run passes 24/24, including public
  rendering, camera fallbacks, unpublishing, and remix.
- A separate corrected real-stack run of `project3dLifecycle.spec.ts` passes
  2/2 for manual and AI-assisted 3D creation, confirming the stage toolbar
  is rendered in the actual browser editor surface. This does not replace
  the still-missing authenticated exact-route check against the deployed
  application.
- Commit `647f0ca` extends that suite with a published 3D project flow. The
  real browser now verifies public screenshot/sound/Piece-controls/steering/
  guide/fullscreen chrome, both ZIP download variants, and the owner’s
  Published → Draft transition; the expanded suite passes 3/3.
- The expanded 3D run initially caught a real hit-testing defect: the shared
  download popover lacked its anchored layout, so the visible Full action could
  invoke Non-Camera. Adding the shared popover CSS fixed the composed behavior;
  the rerun passes 3/3 and inspects both downloaded ZIP manifests/runtime
  scripts. This is local disposable-stack evidence; the supplied deployed
  URLs remain unverified until the current branch is published and an owner
  browser session is available.
- The standalone 2D export audit found the same class of parity miss in a
  different surface: motion/demo/camera controls were still page-level while
  only screenshot/fullscreen were stage-local, and the generated document had
  a duplicate camera-runtime tag. The export now packages one compact,
  stage-local Piece controls disclosure containing the existing functional
  hosts, removes the duplicate tag, and the real Chromium artifact suite
  passes 17/17 across all interaction modes and camera lifecycle/privacy
  scenarios.
- The 3D artifact check was strengthened beyond source inspection: both ZIPs
  are extracted and opened from `file://` in a fresh Chromium page, where the
  canvas, Piece controls, Reset view, and Non-Camera camera-feature omission
  are exercised. The correct-stack suite passes 3/3 with this executable
  artifact coverage.
- The full 138-test browser batch then exposed a composed toolbar regression:
  the new download popover could remain open across editor interactions and
  intercept Layers-panel pointer targets. The shared toolbar now closes the
  popover on outside pointer input and explicitly honors `[hidden]`; the
  targeted Layers suite passes 7/7 and the full batch passes 137/137 with one
  intentional skip.
- The repository-wide check then exposed the related Code-tab boundary: the
  visual-view wrapper hid the stage-mounted authoring toolbar along with the
  artwork, so Add/Undo actions were unavailable while Code was selected. The
  wrapper now remains mounted and CSS hides only artwork/interaction layers;
  the stage controls remain accessible and functional in Code. The focused
  Code-tab suite passes 11/11 and the full frontend suite passes 189 files /
  2,375 tests; typecheck and production build also pass.

## Re-audit implementation increment (2026-09-02, immersive/download)

- The immersive 3D route now implements the reference contract's Custom and
  CMS embed variants as copyable iframe snippets and query-driven chrome-less
  modes.
- The standalone 3D runtime now implements arrow-key camera travel while
  leaving WASD available for keyboard notes. The extracted Full ZIP executes
  this state transition from `file://` in Chromium.
- Focused immersive tests pass 13/13, frontend format/typecheck pass, and the
  corrected disposable PostgreSQL/Django/Vite `project3dLifecycle.spec.ts`
  passes 3/3. Exact deployed immersive/embed/download evidence remains
  pending publication and authenticated owner access.

## Re-audit implementation increment (2026-09-02, publication chrome)

- Draft/Published controls now live in the compact stage-local editor toolbar
  for manual and AI-assisted 2D/3D editors, keeping publication state beside
  the authored piece rather than in a bulky header row.
- The shared publication switch explicitly uses content-sized horizontal
  options, preventing the stage icon-button rule from overlapping Draft and
  Published hitboxes. Focused React coverage passes 46/46 and the disposable
  real-browser 3D lifecycle passes 3/3, including the Published → Draft
  transition.
- This increment is tracked by #323. The former broad #324 verification issue
  was closed as not planned and replaced by #325–#337, one route, variant, or
  downloaded artifact per independently observable closure unit.

- `.agents/memory/authored-piece-surface-parity.md`
- `.agents/memory/generated-art-piece-surface-parity.md`
- `.agents/memory/e2e-wrong-docker-project.md`
- `.agents/memory/full-browser-readiness-gate.md`
