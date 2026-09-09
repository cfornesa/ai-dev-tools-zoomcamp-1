# E2E full-matrix Firefox art-piece iframe timeouts

The curated Firefox subset's art-piece iframe tests can hit the 30s `testTimeout` in full-matrix CI while passing standalone and in chromium. Observed 2026-09-09 (CI run `34307303394`): all 3 firefox scenarios in `artPieceSteeringRuntime.spec.ts` failed at 30.3-30.4s, plus 9 other artPiece runtime tests.

**Signature:** `waitForThreeJsReady` (line 138, waiting for `#art-piece-container canvas` inside the iframe) or `sendCommandAndAwaitPose` (line 332, waiting for a postMessage pose round-trip) timing out. The test that does NOT load a Three.js/A-Frame iframe (`hand steering controls are absent`) passes at 4.3s.

**Local reproduction failed:** the exact same 4 tests pass in ~14s standalone and under `--repeat-each=3` in firefox, even with other curated files interleaved.

**Classification (per #465's framework):** likely (c) CI-runner-capacity boundary — the shared runner is under heavy load from chromium's full suite running in parallel (or recently completed), Firefox's WebGL context creation inside a sandboxed iframe is slower than chromium's, and 30s is insufficient. The same CDN-loaded iframe art piece tests (FullZip, Immersive*, NonCameraZip) all fail at exactly 30.3s, suggesting a shared resource bottleneck rather than a code defect.

**Not the same as #504/#505:** #504 is an fps-floor issue on the synthetic camera benchmark (chromium, independent of iframe loading). #505 is session/plan cross-test leakage (any browser, deterministic drift). #506 is a firefox-only iframe startup timing issue.

**Routing:** if the owner wants a fix, it likely needs stage 2b (Three.js/A-Frame runtime investigation or a longer testTimeout for firefox art-piece tests), not stage 2a mechanical work. The curated firefox subset was newly added to CI on 2026-09-09; this may be a previously-unknown, not a regression.
