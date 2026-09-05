# Pieces readiness and distillation audit — 2026-09-05

Status: DISTILLATION IN PROGRESS. This document is the current reconciliation; older task ledgers remain historical.

## Initial readiness assessment

User explicitly requested production-readiness before task-distillation; this initial read-only assessment uses existing manifests despite normal skill ordering. No product implementation is authorized by this audit.

- Local: BLOCKED. `UV_CACHE_DIR=/private/tmp/pieces-audit-uv make check` passed action pins, then Docker socket access failed during workflow validation. No full-gate pass.
- Browser/CI: BLOCKED. Playwright discovery passes: 522 tests in 42 files. PR #417 head b4cde2e46deb2a9f1b1a24d27af0227389214b28 has CI run 499 in progress at inspection; this is not terminal evidence.
- Intended functionality: OPEN FOLLOW-UP. Generated piece source defects below, plus existing open application-extension backlog.
- Replit: OPEN FOLLOW-UP. Anonymous shell loads `/assets/index-DqBGvDVD.js`; prior public fixture `/p/7b2ecd2b-0a46-4031-b4a2-bb6b9cd74df2` now renders unavailable. This is an availability/publication verification boundary, not proof of a product defect. #415 owns published process evidence.
- Production readiness: BLOCKED until required contracts and release evidence reconcile.

## Revision boundaries

Checkout main cb98fb6ffadcd09987c50d4ec328df1a476f18a2 contains extensive pre-existing uncommitted changes; these are preserved. Open PR #417 contains related implementations but has a different head. Reference sibling augment-humankind is read-only at f94dca489a60c0a407edbade412888f3c23ddf1a. Compare pieces only, not unrelated CMS/blog/collections. Correct environment variables cannot repair the source defects identified below.

## New generated-piece issue manifest

| Issue | Goal | Dependencies | Status / owner / next action |
|---|---|---|---|
| [#428](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/428) | Generated studio /art-pieces: persist an explicit supported capability contract | none | PROPOSED; engineering/QA; reproduce fixed fixture then implement its contract |
| [#429](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/429) | Generated owner management: reopen and revise a saved private art piece | none | PROPOSED; engineering/QA; reproduce fixed fixture then implement its contract |
| [#430](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/430) | Generated regular viewer: implement acknowledged sound and microphone runtime | none | PROPOSED; engineering/QA; reproduce fixed fixture then implement its contract |
| [#431](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/431) | Generated regular viewer: implement camera composition and capture lifecycle | none | PROPOSED; engineering/QA; reproduce fixed fixture then implement its contract |
| [#432](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/432) | Generated regular viewer: implement hand-steering ownership and Reset | camera | PROPOSED; engineering/QA; reproduce fixed fixture then implement its contract |
| [#433](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/433) | Generated public SVG viewer: download a rendered PNG screenshot | none | PROPOSED; engineering/QA; reproduce fixed fixture then implement its contract |
| [#434](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/434) | Generated immersive viewer: implement walkable navigation and stage controls | sound,camera,steer,svg | PROPOSED; engineering/QA; reproduce fixed fixture then implement its contract |
| [#435](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/435) | Generated regular embed: add a chrome-less published-piece entry point | sound,camera,steer,svg | PROPOSED; engineering/QA; reproduce fixed fixture then implement its contract |
| [#436](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/436) | Generated Full ZIP: execute packaged runtime controls after extraction | sound,camera,steer,svg | PROPOSED; engineering/QA; reproduce fixed fixture then implement its contract |
| [#437](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/437) | Generated Non-Camera ZIP: preserve artwork while enforcing device isolation | none | PROPOSED; engineering/QA; reproduce fixed fixture then implement its contract |
| [#438](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/438) | Generated thumbnail service: capture artwork instead of hash-derived placeholders | none | PROPOSED; engineering/QA; reproduce fixed fixture then implement its contract |

## Criterion-ready issue definitions

### #428

## Goal
Generated studio /art-pieces: persist an explicit supported capability contract.

## Entry point and fixed fixture
/art-pieces

Authenticated owner; fake Canvas2D generation of a red rectangle, then Three.js rotating cube; second non-owner.
Viewports: 1280x900 and 375x812. Use disposable PostgreSQL, AI_PROVIDER=fake and isolated browser contexts; never shared/production fixture writes.

## Evidence
2026-09-05 source audit of local main cb98fb6 plus existing working changes; reference augment-humankind f94dca4 docs/piece-surface-parity.md and pieces runtime. ArtPieceStudio.tsx handleSave omits capabilities and ArtPieceCreateSerializer defaults to an empty dictionary; API-seeded E2E capabilities bypass this user path.

## Acceptance criteria
- [ ] Offer named Screenshot, Download, Fullscreen, Sound, Keyboard, Microphone, Camera view, Hand steering and Immersive settings; unsupported engine/runtime combinations are visibly unavailable with a reason.
- [ ] Save explicit booleans validated server-side (reject strings/numbers/unknown keys); reload preserves the selected version contract without granting unsupported capabilities.
- [ ] New pieces default to no device/audio activation; enabling availability never requests permission or executes arbitrary source in Django.
- [ ] Exercise generate → configure → save from the real studio at both viewports; verify request payload and persisted version, cross-user denial and failure recovery.

## Verification
Add the missing focused browser spec `frontend/e2e/artPieceCapabilities.spec.ts` (a planned deliverable, not an existing passing test).
`cd backend && uv run pytest tests/test_art_piece_persistence.py -q`
`cd frontend && npm run test:e2e -- e2e/artPieceCapabilities.spec.ts --project=chromium`
Run `make check`, then `cd frontend && npm run test:e2e -- e2e/artPieceCapabilities.spec.ts` on the supported disposable stack. Retain rendered screenshots and finite assertion results; event/DOM/source-string evidence alone cannot pass.

## Dependencies and out of scope
Prerequisite keys in docs/pieces-readiness-audit-2026-09-05.md: none. Sibling routes/artifact variants belong to separate linked contracts in that manifest. This issue does not implement unrelated CMS collections/blog/admin or expand supported rendering engines. No new dependency without authorization.
Closed history: #314, #315. Preserve historical scoped evidence; this is a newly identified missing behavior, not a reopening.

## Evidence and pending items
Status: PROPOSED / GROOMED.
Class: implementation-defect. Owner: next assigned engineering/QA transaction.
Next action: reproduce the fixed entry point, implement this contract only, then run focused/full checks.
Evidence boundary: local/disposable runtime only; physical hardware and exact Replit published revision are separate operator verification and may not be claimed from fake devices.
Backlog: docs/tasks.md; manifest: docs/pieces-readiness-audit-2026-09-05.md.


### #429

## Goal
Generated owner management: reopen and revise a saved private art piece.

## Entry point and fixed fixture
/art-pieces/manage → owner-only /art-pieces/:id/edit (proposed)

Owner with Draft, Published and Archived Canvas2D fixtures and two immutable versions; separate non-owner.
Viewports: 1280x900 and 375x812. Use disposable PostgreSQL, AI_PROVIDER=fake and isolated browser contexts; never shared/production fixture writes.

## Evidence
2026-09-05 source audit of local main cb98fb6 plus existing working changes; reference augment-humankind f94dca4 docs/piece-surface-parity.md and pieces runtime. ArtPieceManagement.tsx links every saved piece to the public-only viewer; no owner edit route exists, and studio Save always creates a new piece.

## Acceptance criteria
- [ ] Draft/Archived cards open the authenticated editor, never an unavailable public viewer; expose public links only for Published pieces.
- [ ] Load and edit title/description, save a new source version on the same piece, show version list and selected current version; previous source remains immutable.
- [ ] Reload restores saved state; stale/concurrent saves fail recoverably without overwriting another version; invalid saves retain user input.
- [ ] Owner can regenerate thumbnail and soft-delete with confirmation; non-owner reads/writes fail without existence leakage; cancelled actions preserve data.

## Verification
Add the missing focused browser spec `frontend/e2e/artPieceOwnerEditing.spec.ts` (a planned deliverable, not an existing passing test).
`cd backend && uv run pytest tests/test_art_piece_persistence.py -q`
`cd frontend && npm run test:e2e -- e2e/artPieceOwnerEditing.spec.ts --project=chromium`
Run `make check`, then `cd frontend && npm run test:e2e -- e2e/artPieceOwnerEditing.spec.ts` on the supported disposable stack. Retain rendered screenshots and finite assertion results; event/DOM/source-string evidence alone cannot pass.

## Dependencies and out of scope
Prerequisite keys in docs/pieces-readiness-audit-2026-09-05.md: none. Sibling routes/artifact variants belong to separate linked contracts in that manifest. This issue does not implement unrelated CMS collections/blog/admin or expand supported rendering engines. No new dependency without authorization.
Closed history: #314, #315. Preserve historical scoped evidence; this is a newly identified missing behavior, not a reopening.

## Evidence and pending items
Status: PROPOSED / GROOMED.
Class: implementation-defect. Owner: next assigned engineering/QA transaction.
Next action: reproduce the fixed entry point, implement this contract only, then run focused/full checks.
Evidence boundary: local/disposable runtime only; physical hardware and exact Replit published revision are separate operator verification and may not be claimed from fake devices.
Backlog: docs/tasks.md; manifest: docs/pieces-readiness-audit-2026-09-05.md.


### #430

## Goal
Generated regular viewer: implement acknowledged sound and microphone runtime.

## Entry point and fixed fixture
/art-pieces/p/:id

Published deterministic Canvas2D fixture with sound, keyboard and microphone enabled; all-disabled sibling; fake audio/mic in disposable browser.
Viewports: 1280x900 and 375x812. Use disposable PostgreSQL, AI_PROVIDER=fake and isolated browser contexts; never shared/production fixture writes.

## Evidence
2026-09-05 source audit of local main cb98fb6 plus existing working changes; reference augment-humankind f94dca4 docs/piece-surface-parity.md and pieces runtime. artPieceSandbox.ts only dispatches unconsumed art-piece-command events; no application runtime performs the declared actions.

## Acceptance criteria
- [ ] Sound starts only from Sound activation; mute/unmute, volume and keyboard notes change actual runtime output with observable state.
- [ ] Live microphone requires a separate gesture, shares no implicit camera grant, reports denied/unavailable states, and stops every track on disable/unmount.
- [ ] Versioned commands validate sender window, session and payload; acknowledge actual runtime state and reject spoofed frames/unsupported commands rather than reporting success.
- [ ] Enabled and disabled fixture controls match saved capabilities; inspect desktop/mobile screenshots and measured audio/runtime effects, not event dispatch alone.

## Verification
Add the missing focused browser spec `frontend/e2e/artPieceSoundRuntime.spec.ts` (a planned deliverable, not an existing passing test).
`cd backend && uv run pytest tests/test_art_piece_persistence.py -q`
`cd frontend && npm run test:e2e -- e2e/artPieceSoundRuntime.spec.ts --project=chromium`
Run `make check`, then `cd frontend && npm run test:e2e -- e2e/artPieceSoundRuntime.spec.ts` on the supported disposable stack. Retain rendered screenshots and finite assertion results; event/DOM/source-string evidence alone cannot pass.

## Dependencies and out of scope
Prerequisite keys in docs/pieces-readiness-audit-2026-09-05.md: none. Sibling routes/artifact variants belong to separate linked contracts in that manifest. This issue does not implement unrelated CMS collections/blog/admin or expand supported rendering engines. No new dependency without authorization.
Closed history: #316, #319. Preserve historical scoped evidence; this is a newly identified missing behavior, not a reopening.

## Evidence and pending items
Status: PROPOSED / GROOMED.
Class: implementation-defect. Owner: next assigned engineering/QA transaction.
Next action: reproduce the fixed entry point, implement this contract only, then run focused/full checks.
Evidence boundary: local/disposable runtime only; physical hardware and exact Replit published revision are separate operator verification and may not be claimed from fake devices.
Backlog: docs/tasks.md; manifest: docs/pieces-readiness-audit-2026-09-05.md.


### #431

## Goal
Generated regular viewer: implement camera composition and capture lifecycle.

## Entry point and fixed fixture
/art-pieces/p/:id

Published Canvas2D red-square fixture with camera enabled, synthetic blue camera frames; disabled sibling.
Viewports: 1280x900 and 375x812. Use disposable PostgreSQL, AI_PROVIDER=fake and isolated browser contexts; never shared/production fixture writes.

## Evidence
2026-09-05 source audit of local main cb98fb6 plus existing working changes; reference augment-humankind f94dca4 docs/piece-surface-parity.md and pieces runtime. Camera command in artPieceSandbox.ts has no runtime consumer; allow-scripts-only sandbox/CSP needs a deliberate trusted device-runtime boundary.

## Acceptance criteria
- [ ] Camera view starts from its own gesture, visibly composites overlay/background with opacity, and never intercepts pointer input.
- [ ] Screenshot is a PNG containing artwork plus visible camera in stacking order; title/timestamp filename; no camera in automatic thumbnails.
- [ ] Denied permission, ended stream and unavailable device show actionable states; disable/unmount stops tracks and restores artwork.
- [ ] Use a trusted host/runtime protocol without adding same-origin privileges to generated source; validate sender/session and reject source-triggered permission requests.

## Verification
Add the missing focused browser spec `frontend/e2e/artPieceCameraRuntime.spec.ts` (a planned deliverable, not an existing passing test).
`cd backend && uv run pytest tests/test_art_piece_persistence.py -q`
`cd frontend && npm run test:e2e -- e2e/artPieceCameraRuntime.spec.ts --project=chromium`
Run `make check`, then `cd frontend && npm run test:e2e -- e2e/artPieceCameraRuntime.spec.ts` on the supported disposable stack. Retain rendered screenshots and finite assertion results; event/DOM/source-string evidence alone cannot pass.

## Dependencies and out of scope
Prerequisite keys in docs/pieces-readiness-audit-2026-09-05.md: none. Sibling routes/artifact variants belong to separate linked contracts in that manifest. This issue does not implement unrelated CMS collections/blog/admin or expand supported rendering engines. No new dependency without authorization.
Closed history: #316, #317, #319. Preserve historical scoped evidence; this is a newly identified missing behavior, not a reopening.

## Evidence and pending items
Status: PROPOSED / GROOMED.
Class: implementation-defect. Owner: next assigned engineering/QA transaction.
Next action: reproduce the fixed entry point, implement this contract only, then run focused/full checks.
Evidence boundary: local/disposable runtime only; physical hardware and exact Replit published revision are separate operator verification and may not be claimed from fake devices.
Backlog: docs/tasks.md; manifest: docs/pieces-readiness-audit-2026-09-05.md.


### #432

## Goal
Generated regular viewer: implement hand-steering ownership and Reset.

## Entry point and fixed fixture
/art-pieces/p/:id

Published deterministic Three.js cube with camera pose fixed at [0,0,5], hand steering enabled; synthetic landmarks and camera/mic on/off permutations.
Viewports: 1280x900 and 375x812. Use disposable PostgreSQL, AI_PROVIDER=fake and isolated browser contexts; never shared/production fixture writes.

## Evidence
2026-09-05 source audit of local main cb98fb6 plus existing working changes; reference augment-humankind f94dca4 docs/piece-surface-parity.md and pieces runtime. enable-hand-steering and reset-view currently only emit events; no command consumer controls the generated engine camera.

## Acceptance criteria
- [ ] Steer requires explicit activation and an acknowledged engine ownership hook; Look, Move, Orbit and Zoom visibly change bounded pose; release/hand loss stops motion.
- [ ] Steering claims only conflicting navigation and restores prior pointer/touch/keyboard ownership on stop; Reset returns home without toggling sound/camera/steering.
- [ ] Sound → mic → camera → steer and reverse activation order share/release resources correctly; denied/model failure reports failure rather than an enabled-looking toggle.
- [ ] Five-step guide and model preparation status are visible without requesting permission; no device-tilt substitution merely for file URLs; unsupported engines report unavailable.

## Verification
Add the missing focused browser spec `frontend/e2e/artPieceSteeringRuntime.spec.ts` (a planned deliverable, not an existing passing test).
`cd backend && uv run pytest tests/test_art_piece_persistence.py -q`
`cd frontend && npm run test:e2e -- e2e/artPieceSteeringRuntime.spec.ts --project=chromium`
Run `make check`, then `cd frontend && npm run test:e2e -- e2e/artPieceSteeringRuntime.spec.ts` on the supported disposable stack. Retain rendered screenshots and finite assertion results; event/DOM/source-string evidence alone cannot pass.

## Dependencies and out of scope
Prerequisite keys in docs/pieces-readiness-audit-2026-09-05.md: camera. Sibling routes/artifact variants belong to separate linked contracts in that manifest. This issue does not implement unrelated CMS collections/blog/admin or expand supported rendering engines. No new dependency without authorization.
Closed history: #316, #319. Preserve historical scoped evidence; this is a newly identified missing behavior, not a reopening.

## Evidence and pending items
Status: PROPOSED / GROOMED (dependency-blocked until prerequisites reconcile).
Class: implementation-defect. Owner: next assigned engineering/QA transaction.
Next action: reproduce the fixed entry point, implement this contract only, then run focused/full checks.
Evidence boundary: local/disposable runtime only; physical hardware and exact Replit published revision are separate operator verification and may not be claimed from fake devices.
Backlog: docs/tasks.md; manifest: docs/pieces-readiness-audit-2026-09-05.md.


### #433

## Goal
Generated public SVG viewer: download a rendered PNG screenshot.

## Entry point and fixed fixture
/art-pieces/p/:id

Published SVG 320x240 red rectangle containing a Unicode title; no external assets, camera disabled.
Viewports: 1280x900 and 375x812. Use disposable PostgreSQL, AI_PROVIDER=fake and isolated browser contexts; never shared/production fixture writes.

## Evidence
2026-09-05 source audit of local main cb98fb6 plus existing working changes; reference augment-humankind f94dca4 docs/piece-surface-parity.md and pieces runtime. artPieceSandbox.ts emits percent-encoded SVG while PieceStageControls.tsx calls atob unconditionally, so SVG capture fails.

## Acceptance criteria
- [ ] Click Screenshot downloads a decodable 320x240 PNG with the expected red artwork and no toolbar; Unicode markup survives decoding.
- [ ] Filename uses sanitized title and timestamp; repeated capture produces distinct names.
- [ ] Malformed/oversized capture payloads and wrong-frame responses show recoverable error and do not download arbitrary content.
- [ ] Canvas2D screenshot remains correct; verify actual file bytes/pixels in Chromium and rendered controls at both viewports.

## Verification
Add the missing focused browser spec `frontend/e2e/artPieceSvgCapture.spec.ts` (a planned deliverable, not an existing passing test).
`cd backend && uv run pytest tests/test_art_piece_persistence.py -q`
`cd frontend && npm run test:e2e -- e2e/artPieceSvgCapture.spec.ts --project=chromium`
Run `make check`, then `cd frontend && npm run test:e2e -- e2e/artPieceSvgCapture.spec.ts` on the supported disposable stack. Retain rendered screenshots and finite assertion results; event/DOM/source-string evidence alone cannot pass.

## Dependencies and out of scope
Prerequisite keys in docs/pieces-readiness-audit-2026-09-05.md: none. Sibling routes/artifact variants belong to separate linked contracts in that manifest. This issue does not implement unrelated CMS collections/blog/admin or expand supported rendering engines. No new dependency without authorization.
Closed history: #317, #319. Preserve historical scoped evidence; this is a newly identified missing behavior, not a reopening.

## Evidence and pending items
Status: PROPOSED / GROOMED.
Class: implementation-defect. Owner: next assigned engineering/QA transaction.
Next action: reproduce the fixed entry point, implement this contract only, then run focused/full checks.
Evidence boundary: local/disposable runtime only; physical hardware and exact Replit published revision are separate operator verification and may not be claimed from fake devices.
Backlog: docs/tasks.md; manifest: docs/pieces-readiness-audit-2026-09-05.md.


### #434

## Goal
Generated immersive viewer: implement walkable navigation and stage controls.

## Entry point and fixed fixture
/art-pieces/immersive/:id

Published Three.js cube, fixed camera [0,0,5], capability-enabled version; disabled and private siblings.
Viewports: 1280x900 and 375x812. Use disposable PostgreSQL, AI_PROVIDER=fake and isolated browser contexts; never shared/production fixture writes.

## Evidence
2026-09-05 source audit of local main cb98fb6 plus existing working changes; reference augment-humankind f94dca4 docs/piece-surface-parity.md and pieces runtime. ImmersiveArtPieceViewer.tsx renders an iframe and instructions but contains no navigation handlers or stage toolbar.

## Acceptance criteria
- [ ] Arrow-key travel, drag/touch look, zoom and Reset change bounded rendered pose; WASD remains available for sound; entry/return preserve piece/version.
- [ ] Stage-local Screenshot, Full/Non-Camera Download, Sound, Piece controls, Steer, Guide and Fullscreen use acknowledged capabilities and remain usable in fullscreen.
- [ ] No load-time camera/mic activation; reduced motion and permission failures are observable; unsupported spatial engine has honest fallback, not false movement instructions.
- [ ] Public/unpublished/archived/deleted privacy is enforced on direct access; inspect fixed-viewport screenshots and actual navigation from this route; do not claim headset WebXR.

## Verification
Add the missing focused browser spec `frontend/e2e/artPieceImmersiveRuntime.spec.ts` (a planned deliverable, not an existing passing test).
`cd backend && uv run pytest tests/test_art_piece_persistence.py -q`
`cd frontend && npm run test:e2e -- e2e/artPieceImmersiveRuntime.spec.ts --project=chromium`
Run `make check`, then `cd frontend && npm run test:e2e -- e2e/artPieceImmersiveRuntime.spec.ts` on the supported disposable stack. Retain rendered screenshots and finite assertion results; event/DOM/source-string evidence alone cannot pass.

## Dependencies and out of scope
Prerequisite keys in docs/pieces-readiness-audit-2026-09-05.md: sound,camera,steer,svg. Sibling routes/artifact variants belong to separate linked contracts in that manifest. This issue does not implement unrelated CMS collections/blog/admin or expand supported rendering engines. No new dependency without authorization.
Closed history: #318, #319. Preserve historical scoped evidence; this is a newly identified missing behavior, not a reopening.

## Evidence and pending items
Status: PROPOSED / GROOMED (dependency-blocked until prerequisites reconcile).
Class: implementation-defect. Owner: next assigned engineering/QA transaction.
Next action: reproduce the fixed entry point, implement this contract only, then run focused/full checks.
Evidence boundary: local/disposable runtime only; physical hardware and exact Replit published revision are separate operator verification and may not be claimed from fake devices.
Backlog: docs/tasks.md; manifest: docs/pieces-readiness-audit-2026-09-05.md.


### #435

## Goal
Generated regular embed: add a chrome-less published-piece entry point.

## Entry point and fixed fixture
/embed/art-pieces/:id (proposed)

Cross-origin local host iframe embedding published Canvas2D fixture; Draft/Archived/deleted siblings.
Viewports: 1280x900 and 375x812. Use disposable PostgreSQL, AI_PROVIDER=fake and isolated browser contexts; never shared/production fixture writes.

## Evidence
2026-09-05 source audit of local main cb98fb6 plus existing working changes; reference augment-humankind f94dca4 docs/piece-surface-parity.md and pieces runtime. App.tsx includes generated regular and immersive pages but no generated regular embed; reference requires a regular stage embed.

## Acceptance criteria
- [ ] Regular public page copies a correctly escaped iframe URL for this embed; embed renders the current published version without site header, prompt, owner actions or duplicated toolbar.
- [ ] Shared Screenshot, Download, Sound, Piece controls, Steer, Guide and Fullscreen honor enabled/unsupported states and iframe permission restrictions.
- [ ] Cross-origin host can display/fullscreen the stage without authentication or frame-policy failure; draft/unpublished/deleted remain unavailable.
- [ ] Verify 1280x900 and 375x812 host viewports, keyboard focus and stage containment; source sender/session checks remain enforced.

## Verification
Add the missing focused browser spec `frontend/e2e/artPieceEmbed.spec.ts` (a planned deliverable, not an existing passing test).
`cd backend && uv run pytest tests/test_art_piece_persistence.py -q`
`cd frontend && npm run test:e2e -- e2e/artPieceEmbed.spec.ts --project=chromium`
Run `make check`, then `cd frontend && npm run test:e2e -- e2e/artPieceEmbed.spec.ts` on the supported disposable stack. Retain rendered screenshots and finite assertion results; event/DOM/source-string evidence alone cannot pass.

## Dependencies and out of scope
Prerequisite keys in docs/pieces-readiness-audit-2026-09-05.md: sound,camera,steer,svg. Sibling routes/artifact variants belong to separate linked contracts in that manifest. This issue does not implement unrelated CMS collections/blog/admin or expand supported rendering engines. No new dependency without authorization.
Closed history: #315, #316, #319. Preserve historical scoped evidence; this is a newly identified missing behavior, not a reopening.

## Evidence and pending items
Status: PROPOSED / GROOMED (dependency-blocked until prerequisites reconcile).
Class: implementation-defect. Owner: next assigned engineering/QA transaction.
Next action: reproduce the fixed entry point, implement this contract only, then run focused/full checks.
Evidence boundary: local/disposable runtime only; physical hardware and exact Replit published revision are separate operator verification and may not be claimed from fake devices.
Backlog: docs/tasks.md; manifest: docs/pieces-readiness-audit-2026-09-05.md.


### #436

## Goal
Generated Full ZIP: execute packaged runtime controls after extraction.

## Entry point and fixed fixture
Extracted generated Full ZIP index.html

Published Three.js cube with sound/camera/steering enabled; downloaded archive extracted to isolated temp directory; network disabled after download.
Viewports: 1280x900 and 375x812. Use disposable PostgreSQL, AI_PROVIDER=fake and isolated browser contexts; never shared/production fixture writes.

## Evidence
2026-09-05 source audit of local main cb98fb6 plus existing working changes; reference augment-humankind f94dca4 docs/piece-surface-parity.md and pieces runtime. artPieceBundle.ts emits unconsumed sound/camera/hand events with names differing from live protocol; camera/hand runtime assets are not bundled.

## Acceptance criteria
- [ ] Full ZIP packages engine plus approved audio/MediaPipe runtime/model assets with relative URLs and contains no recursive Download control.
- [ ] Offline extracted entry supports Screenshot, Sound/mute/volume/keyboard, Camera view, Steer, Guide, Reset and Fullscreen with the same actual state transitions as the runtime contract.
- [ ] No automatic device grants; file-open restrictions produce actionable errors after attempted supported activation; localhost proof is recorded separately from file://.
- [ ] Inspect rendered proportions/controls at both viewports and downloaded PNG pixels; no prompts/private metadata/credentials or automatic camera captures in archive.

## Verification
Add the missing focused browser spec `frontend/e2e/artPieceFullZipRuntime.spec.ts` (a planned deliverable, not an existing passing test).
`cd backend && uv run pytest tests/test_art_piece_persistence.py -q`
`cd frontend && npm run test:e2e -- e2e/artPieceFullZipRuntime.spec.ts --project=chromium`
Run `make check`, then `cd frontend && npm run test:e2e -- e2e/artPieceFullZipRuntime.spec.ts` on the supported disposable stack. Retain rendered screenshots and finite assertion results; event/DOM/source-string evidence alone cannot pass.

## Dependencies and out of scope
Prerequisite keys in docs/pieces-readiness-audit-2026-09-05.md: sound,camera,steer,svg. Sibling routes/artifact variants belong to separate linked contracts in that manifest. This issue does not implement unrelated CMS collections/blog/admin or expand supported rendering engines. No new dependency without authorization.
Closed history: #317, #319. Preserve historical scoped evidence; this is a newly identified missing behavior, not a reopening.

## Evidence and pending items
Status: PROPOSED / GROOMED (dependency-blocked until prerequisites reconcile).
Class: implementation-defect. Owner: next assigned engineering/QA transaction.
Next action: reproduce the fixed entry point, implement this contract only, then run focused/full checks.
Evidence boundary: local/disposable runtime only; physical hardware and exact Replit published revision are separate operator verification and may not be claimed from fake devices.
Backlog: docs/tasks.md; manifest: docs/pieces-readiness-audit-2026-09-05.md.


### #437

## Goal
Generated Non-Camera ZIP: preserve artwork while enforcing device isolation.

## Entry point and fixed fixture
Extracted generated Non-Camera ZIP index.html

Deterministic Three.js source uses ordinary variable named camera; additional source exercises aliased/computed getUserMedia access; no real device.
Viewports: 1280x900 and 375x812. Use disposable PostgreSQL, AI_PROVIDER=fake and isolated browser contexts; never shared/production fixture writes.

## Evidence
2026-09-05 source audit of local main cb98fb6 plus existing working changes; reference augment-humankind f94dca4 docs/piece-surface-parity.md and pieces runtime. stripCameraArtifacts replaces every word camera with non-camera, corrupting normal Three.js identifiers; regex removal cannot establish device isolation.

## Acceptance criteria
- [ ] Normal Three.js camera variables and non-camera animation/sound remain executable and visually identical; never sanitize JavaScript with broad token replacement.
- [ ] Exclude camera/hand UI and model/assets and block generated-source device access with an enforceable runtime policy, including aliased/computed access.
- [ ] Keep Screenshot, Sound and Fullscreen functional and no recursive Download; failures clearly reject unsupported export rather than emit a corrupted ZIP.
- [ ] Open extracted artifact offline; capture console, permission/API attempts and rendered pixels at both viewports; test actual behavior, not absence of marker strings.

## Verification
Add the missing focused browser spec `frontend/e2e/artPieceNonCameraZip.spec.ts` (a planned deliverable, not an existing passing test).
`cd backend && uv run pytest tests/test_art_piece_persistence.py -q`
`cd frontend && npm run test:e2e -- e2e/artPieceNonCameraZip.spec.ts --project=chromium`
Run `make check`, then `cd frontend && npm run test:e2e -- e2e/artPieceNonCameraZip.spec.ts` on the supported disposable stack. Retain rendered screenshots and finite assertion results; event/DOM/source-string evidence alone cannot pass.

## Dependencies and out of scope
Prerequisite keys in docs/pieces-readiness-audit-2026-09-05.md: none. Sibling routes/artifact variants belong to separate linked contracts in that manifest. This issue does not implement unrelated CMS collections/blog/admin or expand supported rendering engines. No new dependency without authorization.
Closed history: #317, #319. Preserve historical scoped evidence; this is a newly identified missing behavior, not a reopening.

## Evidence and pending items
Status: PROPOSED / GROOMED.
Class: implementation-defect. Owner: next assigned engineering/QA transaction.
Next action: reproduce the fixed entry point, implement this contract only, then run focused/full checks.
Evidence boundary: local/disposable runtime only; physical hardware and exact Replit published revision are separate operator verification and may not be claimed from fake devices.
Backlog: docs/tasks.md; manifest: docs/pieces-readiness-audit-2026-09-05.md.


### #438

## Goal
Generated thumbnail service: capture artwork instead of hash-derived placeholders.

## Entry point and fixed fixture
POST /api/art-pieces/:id/thumbnail/regenerate/ and returned thumbnail

Owner's red-rectangle Canvas2D and blue-circle SVG immutable versions, plus invalid-runtime fixture; second non-owner.
Viewports: 1280x900 and 375x812. Use disposable PostgreSQL, AI_PROVIDER=fake and isolated browser contexts; never shared/production fixture writes.

## Evidence
2026-09-05 source audit of local main cb98fb6 plus existing working changes; reference augment-humankind f94dca4 docs/piece-surface-parity.md and pieces runtime. art_piece_persistence.py _thumbnail_bytes draws hash-derived colored ellipses and marks is_fallback=False, unrelated to rendered artwork.

## Acceptance criteria
- [ ] Generate 320x240 artwork-only captures tied to the current immutable version, with aspect-preserving crop and actual expected fixture pixels.
- [ ] Generated code executes only in an isolated browser renderer, never Django; capture excludes chrome, prompt and all camera/mic frames.
- [ ] Invalid/timeout capture stores an explicitly marked fallback; retry replaces fallback; stale/concurrent regeneration cannot attach output to the wrong version.
- [ ] Unauthorized regeneration fails and public thumbnail remains status-gated; browser evidence and backend concurrency tests prove bytes and version association.

## Verification
Add the missing focused browser spec `frontend/e2e/artPieceThumbnailCapture.spec.ts` (a planned deliverable, not an existing passing test).
`cd backend && uv run pytest tests/test_art_piece_persistence.py -q`
`cd frontend && npm run test:e2e -- e2e/artPieceThumbnailCapture.spec.ts --project=chromium`
Run `make check`, then `cd frontend && npm run test:e2e -- e2e/artPieceThumbnailCapture.spec.ts` on the supported disposable stack. Retain rendered screenshots and finite assertion results; event/DOM/source-string evidence alone cannot pass.

## Dependencies and out of scope
Prerequisite keys in docs/pieces-readiness-audit-2026-09-05.md: none. Sibling routes/artifact variants belong to separate linked contracts in that manifest. This issue does not implement unrelated CMS collections/blog/admin or expand supported rendering engines. No new dependency without authorization.
Closed history: #314, #315. Preserve historical scoped evidence; this is a newly identified missing behavior, not a reopening.

## Evidence and pending items
Status: PROPOSED / GROOMED.
Class: implementation-defect. Owner: next assigned engineering/QA transaction.
Next action: reproduce the fixed entry point, implement this contract only, then run focused/full checks.
Evidence boundary: local/disposable runtime only; physical hardware and exact Replit published revision are separate operator verification and may not be claimed from fake devices.
Backlog: docs/tasks.md; manifest: docs/pieces-readiness-audit-2026-09-05.md.

