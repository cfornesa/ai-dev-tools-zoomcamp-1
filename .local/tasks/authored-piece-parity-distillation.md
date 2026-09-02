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
  explicit sound enable/settings, volume, keyboard notes, and movement tones.
- The capability policy is explicit in
  `frontend/src/components/pieceStageCapabilities.ts`: 2D exposes only its
  implemented screenshot/HTML-export/fullscreen controls, while 3D exposes
  ZIP export, immersive, sound, piece controls, gesture, guide, and fullscreen.
  The immersive 3D route now keeps gesture steering and its guide enabled.
- Correct-stack verification: `scripts/browser-qa.sh` passed its repository
  identity probes; focused injection passed 33/33 and public lifecycle/camera
  passed 24/24. The first full 137-test run reached 99 passed before the two
  focused regressions were corrected; the corrected focused suites pass, but a
  clean replacement full batch reached 135/137 with one skipped and one
  authentication/fixture timing failure before the target scenario began.
  The exact failed 8-test `projectLifecycle.spec.ts` rerun passed 8/8 in
  isolation. This is recorded as a verification flake, not as a clean full
  batch, until the complete run is repeatably green.
- GitHub open-issue enumeration now contains #274, #320, and #321; #123 is
  closed with a QA PASS. #274 remains dependency-blocked by #320 and is not
  treated as complete merely because earlier child issues were closed.

## Memory links

- `.agents/memory/authored-piece-surface-parity.md`
- `.agents/memory/generated-art-piece-surface-parity.md`
- `.agents/memory/e2e-wrong-docker-project.md`
- `.agents/memory/full-browser-readiness-gate.md`
