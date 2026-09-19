# Issue 615 — Chrome-less embed runtime parity for six art-piece engines

## Goal

Make the chrome-less embed entry point fully functional for the six requested
engines—Three.js, A-Frame, p5.js, C2.js, C2.js Interactive, and SVG—using the
regular-runtime capability contract without duplicating or weakening sandbox
security.

## Entry point and fixture

Entry point: the generated-piece embed route for a published piece. Use one
sanitized published fixture per engine with a persisted version, capability
set, captured thumbnail, and owner profile handle. Use the repository's test
settings/disposable database; no Replit or production writes.

## Acceptance criteria

- [ ] Each of the six fixtures loads through the chrome-less embed route and
      renders a non-fallback artwork frame at 1280x900 and 375x812.
- [ ] The embed route uses the same engine identifier, version, source
      validation, capability negotiation, pinned runtime assets, and sandbox
      security policy as the regular viewer; no display label is used for
      runtime selection.
- [ ] The named controls supported by each fixture—screenshot, download,
      fullscreen, sound, camera, microphone, and hand steering—are visible or
      intentionally absent according to the persisted capability booleans;
      visitor permission requires a gesture and unsupported controls do not
      appear as enabled affordances.
- [ ] C2.js Interactive receives pointer input in embed mode and returns input
      ownership after steering ends; SVG remains inert and does not execute
      script; Three.js/A-Frame/p5.js fixtures report deterministic ready/error
      states when their runtime asset fails.
- [ ] Anonymous/private/version-boundary tests prove the embed route cannot
      expose unpublished source, prompts, owner-only fields, or a non-current
      version.
- [ ] Focused Chromium verification covers both fixed viewports and the finite
      interactions above; the full repository checks pass.

## Verification

```sh
cd backend && uv run pytest tests/test_art_piece_persistence.py tests/test_art_piece_validation.py tests/test_public_gallery.py
cd frontend && npm test -- --run src/generative/artPieceSandbox.test.ts src/generative/artPieceCapabilities.test.ts
make check
```

Run the repository's focused Chromium embed E2E with the six fixed fixtures;
record the exact route, fixture IDs, viewport, browser, and screenshot/error
evidence in the issue. A self-skipped browser scenario is prerequisite
evidence, not a pass.

## Dependencies and out of scope

Depends on #599, #600, #611, #614, and the regular runtime contract in #607.
The regular public viewer, immersive route, offline bundles, editor
integration, schema publication, and @cfornesa import remain outside this
issue; #607–#610, #613, and #612 own those boundaries.

## Routing hint

Stage 2b complex: sandbox/runtime security, device permissions, version
selection, and cross-engine interaction behavior are coupled.

## Evidence boundary

Local/disposable database and Chromium evidence prove the embed implementation
only. They do not prove Replit schema publication or production behavior.
