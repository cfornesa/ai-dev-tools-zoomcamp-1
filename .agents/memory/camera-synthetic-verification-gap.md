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

**2026-08-28 exception:** #195 (the frozen-feed compositing bug this topic was
written about) was closed on engineering + full e2e evidence alone, without a
real-camera/production check, per the user's explicit choice when an agent
flagged it could not perform that verification itself (no physical camera, no
Replit deploy access). This does not weaken the rule above — it was a
deliberate, informed waiver by the one person with the authority to accept
that risk, not a determination that synthetic evidence is sufficient by
default. Continue requiring real-camera/production evidence unless a human
explicitly waives it again.

**2026-08-28 second recurrence — root cause of the evidence gap itself
identified:** with #195's compositing fix live, the user reported the feed is
now visibly live but still laggy/"practically unusable" — the original #192
symptom, never actually fixed. Inspecting `installMediaPipeTestSeam`
(`frontend/e2e/publishingAndRemix.spec.ts`) explains why every prior #192
"10-second warm-run" closure was structurally incapable of catching this: the
seam replaces `GestureRecognizer` with a stub whose `recognizeForVideo`
returns instantly, so none of #192's three passing closures ever loaded the
real `@mediapipe/tasks-vision` Wasm runtime, the real model, or exercised the
hardcoded `delegate: 'GPU'` option in
`frontend/src/tracking/mediapipeProvider.ts:399` (no CPU fallback, not
configurable). Every FPS/long-task number measured the scheduling/compositing
code *around* inference, never inference's own real cost — a synthetic seam
that stubs out the exact subsystem under test isn't merely "less realistic"
than a real camera, it is mathematically guaranteed to show zero cost for
whatever it stubs, regardless of how slow the real thing is. #192 reopened;
see its 2026-08-28 comment for the full finding and recommended next step
(a real MediaPipe/model/GPU-delegate diagnostic against a synthetic *video
track* a real recognizer can actually run inference on, then a CPU-vs-GPU
delegate comparison). **How to apply, updated:** for this issue class, also
check whether an existing "synthetic" test seam stubs out the very component
whose performance is in question — if so, its passing measurements are not
evidence of anything about that component, no matter how many times they
pass.

**2026-08-28 partial fix, issue kept open:** commit `47ec6b2` added a
GPU→CPU delegate fallback (`frontend/src/tracking/mediapipeProvider.ts`) for
the case where GPU delegate *creation* throws outright — the only part of
the identified root cause fixable without the real (non-seam) profiling
harness described above. The seam's `make browser-qa` run stayed green
(24/24, no regression), but per this topic's rule that evidence does not
prove anything about real inference cost, since the seam still stubs
`recognizeForVideo`. #192 was **not** closed on this evidence — see its
2026-08-28 engineering comment. A GPU delegate that creates successfully but
runs inference slowly is still unaddressed and unmeasured.
