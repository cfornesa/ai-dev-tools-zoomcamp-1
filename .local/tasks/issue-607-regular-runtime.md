## Goal
Make the regular public generated-art-piece viewer fully functional for the six requested engines: Three.js, A-Frame, p5.js, C2.js, C2.js Interactive, and SVG.

## Entry point and fixed fixture
Entry point: the published regular generated-piece route `/users/@<handle>/pieces/<slug>`. Use one sanitized published fixture per engine with a persisted current version, capability set, captured thumbnail, and public profile handle. Use the repository's test settings/disposable database; do not write Replit, production, or shared databases.

## Acceptance criteria
- [ ] Each six-engine fixture loads through the regular route and renders a non-fallback artwork frame at 1280x900 and 375x812.
- [ ] The viewer selects the runtime by stable engine ID and current version; source validation, capability negotiation, pinned runtime assets, and sandbox security are explicit for every engine. Display labels are never used as runtime selectors.
- [ ] The named controls supported by each fixture—screenshot, download, fullscreen, sound, camera, microphone, and hand steering—are visible or intentionally absent according to persisted capability booleans. Visitor permission requires a gesture and unsupported controls are not enabled.
- [ ] C2.js Interactive preserves authored pointer input and restores input ownership after steering ends; SVG remains inert and script-free; Three.js, A-Frame, and p5.js report deterministic ready/error states when their runtime asset fails.
- [ ] Anonymous/private/version-boundary tests prove the regular route cannot expose unpublished source, prompts, owner-only fields, or a non-current version; the owner-only edit affordance is shown only to the author.
- [ ] Focused Chromium verification covers both fixed viewports and the finite interactions above; the full repository checks pass.

## Verification
```sh
cd backend && uv run pytest tests/test_art_piece_persistence.py tests/test_art_piece_validation.py tests/test_public_gallery.py
cd frontend && npm test -- --run src/generative/artPieceSandbox.test.ts src/generative/artPieceCapabilities.test.ts
make check
```

Run the focused Chromium regular-view E2E with the six fixtures and record the exact route, fixture IDs, viewport, browser, and screenshot/error evidence. A self-skipped browser scenario is prerequisite evidence, not a pass.

## Dependencies
Depends on #599, #600, #611, and the canonical engine contract #614. The chrome-less embed consumer is split into #615 and depends on this issue.

## Out of scope
Chrome-less embed behavior (#615), immersive runtime (#608), offline bundles (#609), editor integration (#610), schema publication (#613), and reference import (#612). Shared runtime modules may be reused by those issues but their route-level acceptance remains separate.

## Routing
Stage 2b implementation-complex: sandbox/runtime security, device permissions, version selection, and cross-engine interaction behavior are coupled.

## Evidence boundary
Local/disposable database and Chromium evidence prove the regular viewer only; they do not prove Replit schema publication or production behavior.
