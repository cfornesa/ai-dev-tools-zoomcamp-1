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
| [#320](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/320) | Shared authored Project/Project3D stage chrome, public/embed/immersive parity, publication state, portable capability-preserving downloads, privacy, browser coverage | First implementation item; consumes existing renderer, camera, sound, gesture, export pieces | `in_progress` | `implementation-defect` plus `verification-boundary`; build one shared stage contract/component, add artifact/browser coverage, then authenticate and publish for exact-route QA |
| [#274](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/274) | Parent parity epic covering screenshot, fullscreen, download menu, sound, controls, camera/hand behavior, immersive view | Parent of #320 and prior generated-art work | `dependency-blocked` | #320 must pass before parent can close; retain open because prior #285–#311 closures cover only narrower/other surfaces |
| [#123](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/123) | Native E2E default port must match Vite’s documented port | Independent workflow item | `closed_completed` | QA PASS posted and issue closed after source/default and browser-runner verification |
| [#321](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/321) | Docker browser verification must select and fingerprint the correct project | Independent workflow item; no repository Compose definition currently exists | `open_in_progress` | `workflow/infrastructure-defect`; native runner fingerprints its own stack, but Compose preflight remains to be implemented; do not stop sibling containers |

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
| Manual 2D editor | Local source now places authoring, Camera, and Demo controls in stage-local chrome; exact deployed/editor visual parity remains unverified | `implemented locally / needs browser evidence` | #320; authenticate and verify the exact owner route after publish |
| AI-assisted 2D editor | Local source now uses shared stage-local toolbar and Camera/Demo disclosure with the existing preview lifecycle; exact deployed/editor visual parity remains unverified | `implemented locally / needs browser evidence` | #320; authenticate and verify the exact owner route after publish |
| Public 2D viewer / embed | Local source now uses shared stage-local toolbar and Camera/Demo disclosure; deployed route still serves the old sibling-panel shell | `verification-boundary` | #320; publish, then verify exact public and embed routes |
| Manual/AI 3D editors | Shared toolbar and publication control exist locally; editor-specific actions remain a separate authoring toolbar within the stage, which is acceptable only if it does not duplicate runtime chrome | `implemented locally / needs browser evidence` | #320; verify visual hierarchy and all controls with authenticated browser |
| Public/embed/immersive 3D | Shared `Scene3DPreview` toolbar exists locally; immersive route reuses the regular orbit runtime plus arrow-key fly, but there is no reference-equivalent Custom/CMS immersive embed choice | `implementation-defect` | #320; decide and implement the permitted React equivalent or document the deliberate route-scope difference in acceptance evidence |
| Full 3D download | Local bundle includes stage controls, hand guide, permission-gated hand tracking, microphone, camera theremin, sound, keyboard, reset, screenshot, and fullscreen behavior; disposable-stack browser test downloads and inspects the real ZIP | `implemented locally / needs deployed evidence` | #320; verify the exact deployed download after publish |
| Non-Camera downloads | Camera host/module and camera-only mic/theremin code are omitted while non-camera sound/keyboard/view controls remain; disposable-stack browser test downloads and inspects the real ZIP | `implemented locally / needs deployed evidence` | #320; verify the exact deployed download after publish |
| Draft / Published | 2D and 3D owner controls exist locally and API tests cover atomic transitions; supplied private deployed route cannot be inspected anonymously | `verification-boundary` | #320; authenticate in the owner's browser session, then verify both states on exact URLs |
| Deployed examples | Public supplied URL serves the old shell; local `main` is 42 commits ahead of `origin/main` and has not been published | `verification-boundary` | #320/#274; after implementation, obtain authorization to push/publish, then run exact-route post-deploy QA |

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
- GitHub open-issue enumeration now contains #274, #320, and #321; #123 is
  closed with a QA PASS. #274 remains dependency-blocked by #320 and is not
  treated as complete merely because earlier child issues were closed.

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

- `.agents/memory/authored-piece-surface-parity.md`
- `.agents/memory/generated-art-piece-surface-parity.md`
- `.agents/memory/e2e-wrong-docker-project.md`
- `.agents/memory/full-browser-readiness-gate.md`
