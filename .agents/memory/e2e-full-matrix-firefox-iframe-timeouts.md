# E2E full-matrix Firefox art-piece iframe timeouts

The curated Firefox subset's art-piece iframe tests can hit the 30s `testTimeout` in full-matrix CI while passing standalone and in chromium. Observed 2026-09-09 in the owner-triggered manual full-matrix run (`34404323033`, at current `main`, reflecting the current curated-subset config): all 3 firefox scenarios in `artPieceSteeringRuntime.spec.ts` failed at 30.3-30.4s.

**Correction:** an earlier version of this note cited a different run (`34307303394`) and claimed "9 other artPiece runtime tests" failed alongside it. That run predates both today's fixes and the firefox-curation change itself (`playwright.config.ts`'s firefox project now runs only `drawioEditor.spec.ts`, `artPieceSteeringRuntime.spec.ts`, and `manual2dStageChrome.spec.ts` — files like `artPieceFullZipRuntime`/`artPieceImmersive*`/`artPieceNonCameraZip` aren't even in the firefox project anymore). That evidence is stale and does not apply to the current config; independently re-verified against the actual current-`main` run, the only firefox failures are the 3 in `artPieceSteeringRuntime.spec.ts` — no other firefox test failed.

**Signature:** `waitForThreeJsReady` (line 138, waiting for `#art-piece-container canvas` inside the iframe) or `sendCommandAndAwaitPose` (line 332, waiting for a postMessage pose round-trip) timing out. The test that does NOT load a Three.js/A-Frame iframe (`hand steering controls are absent`) passes at 4.3s.

**Local reproduction failed:** the exact same 4 tests pass in ~14s standalone and under `--repeat-each=3` in firefox, even with other curated files interleaved.

**Classification (per #465's framework):** likely (c) CI-runner-capacity boundary — the shared runner is under heavy load from chromium's full suite running in parallel (or recently completed), and Firefox's WebGL context creation inside a sandboxed iframe may be slower than chromium's under that load, with 30s insufficient. This is a narrower claim than the original note made — only 3 tests in one file are confirmed affected on the current config, not a broader multi-file pattern.

**Not the same as #504/#505:** #504 is an fps-floor issue on the synthetic camera benchmark (chromium, independent of iframe loading). #505 is session/plan cross-test leakage (any browser, deterministic drift). #506 is a firefox-only iframe startup timing issue.

**Routing:** if the owner wants a fix, it likely needs stage 2b (Three.js/A-Frame runtime investigation or a longer testTimeout for firefox art-piece tests), not stage 2a mechanical work. The curated firefox subset was newly added to CI on 2026-09-09; this may be a previously-unknown, not a regression.
