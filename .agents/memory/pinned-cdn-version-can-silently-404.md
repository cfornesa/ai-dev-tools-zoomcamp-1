---
name: pinned-cdn-version-can-silently-404
description: A pinned jsdelivr npm CDN URL can 404 even when the version exists on npm — the package's published dist filename isn't guaranteed to stay the same across releases. Confirmed for aframe@1.5.0 (issue #236); the AI-generated markup was never the actual bug.
metadata:
  type: project
---

`ai_provider/art_piece_provider.py`'s `AFRAME_CDN_URL` (mirrored in
`frontend/src/generative/artPieceSandbox.ts` and `artPieceBundle.ts`'s
`LIBRARY_CDN`) pinned `https://cdn.jsdelivr.net/npm/aframe@1.5.0/dist/aframe.min.js`.
That URL returns **404** — confirmed live via `fetch(..., {method: 'HEAD'})`
against production. A-Frame's 1.5.0 npm release does not publish a
`dist/aframe.min.js` file at all; its minified UMD bundle is only
available at `dist/aframe-master.min.js` for that version.
`aframe@1.4.2/dist/aframe.min.js` (200, correct `content-type:
application/javascript`) still uses the expected filename, so the fix
was to pin all three copies to `1.4.2` instead of guessing at the 1.5.0
filename.

**Why this was hard to find:** the entire investigation of
[#236](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/236)
up to this point (see [[aframe-default-camera-facing-convention]])
assumed the AI-generated `<a-scene>` markup was the problem — first
camera-facing, then flat-shape edge-on orientation — and both of those
fixes were real, correctly-diagnosed, and shipped. But the preview
stayed blank through both fixes because a *third*, unrelated cause was
also present: the A-Frame runtime script itself never loaded, so
`AFRAME` was `undefined` in the sandboxed iframe regardless of how
correct the generated markup was. Confirmed by injecting the exact
`<script src="https://cdn.jsdelivr.net/npm/aframe@1.5.0/dist/aframe.min.js">`
tag into a matching sandboxed/CSP'd iframe standalone and observing the
script's own `onerror` fire (no `securitypolicyviolation` — CSP wasn't
blocking it, the resource itself 404s). Three.js's pinned URL
(`three@0.160.0/build/three.min.js`) was independently confirmed still
200 at the same time, so this was library/version-specific, not a
general CDN or sandbox problem.

**How to apply:** when a "generated content doesn't render" bug survives
a content-focused fix, verify the runtime dependency itself loads before
looking for another content-generation cause — `fetch(url, {method:
'HEAD'})` against the exact pinned CDN URL from the browser console (or
`curl -sI`) settles it in one step and rules out an entire category of
false leads. Don't assume a version pin that worked at write-time still
resolves later: `npm`/jsdelivr does not guarantee a package's dist
filename stays stable release-to-release. If any future report says a
Three.js/A-Frame art piece (or any other pinned-CDN-runtime feature)
renders blank, check the pinned URL's HTTP status *first*, before
re-auditing the AI system prompt.
