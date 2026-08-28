---
name: camera-synthetic-verification-gap
description: A camera-performance issue was closed QA:PASS three times on synthetic mocked-frame evidence alone while production stayed broken; require real-camera/production evidence before closing this class of issue.
metadata:
  type: project
---

Issue #192 ("Reduce live camera tracking latency and resource usage") was closed
QA:PASS multiple times between 2026-08-24 and 2026-08-27, each time on evidence
from `installMediaPipeTestSeam`'s synthetic, fixed-frame Playwright/Chromium
seam (`frontend/e2e/publishingAndRemix.spec.ts`) — never against a real camera
or the actual Replit production deployment. Each closure was followed by fresh
user evidence that the live feed was still slow or effectively nonfunctional in
production, including a case where the deployed public viewer
(`/p/<id>`) showed what looked like a single frozen/stale webcam frame rather
than a live feed. The synthetic seam's fixed test-double frames cannot detect
a frozen-feed regression by construction — passing FPS/inference-rate
assertions on canned frames says nothing about whether a *real* MediaStream is
still advancing.

The one quantitative budget in that seam (`maxLongTaskMs <= 100`) has never had
real headroom: it passed once at 94ms, then failed at 151ms and 174ms in
immediately subsequent CI runs (see [full browser readiness gate](full-browser-readiness-gate.md)
and issues [#193](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/193),
[#195](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/195)). A
budget that close to its own noise floor is not a meaningful production gate.

**Why:** Repeatedly declaring QA:PASS on synthetic-only evidence for a
production-facing performance/functionality issue let the same regression
resurface at least three times without ever being caught before the user hit
it live.

**How to apply:** Before closing any future camera/tracking performance or
liveness issue, require verification against a real camera and, where
feasible, the actual deployed environment — not only the mocked seam. Treat a
long-task or timing budget passing within ~10% of its own threshold as
unresolved, not as headroom. See [[full-browser-readiness-gate]] for the
related pattern of the CI browser gate itself being non-deterministic near
these same thresholds.
