---
name: Login flake outlives timeout fix
description: loginViaUI still times out waiting for "Your projects" intermittently after #492 widened the timeout to 15s — the real cause isn't just timeout width.
metadata:
  type: project
---

`frontend/e2e/support/auth.ts`'s `loginViaUI` helper intermittently times out
waiting for `getByRole('heading', { name: 'Your projects' })` after a real
login. [#492](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/492)
closed this by widening the assertion's timeout from the default to 15000ms,
verified with 10/10 and 40/40 repeat runs on the two specs/browsers where it
was first observed (`drawioEditor.spec.ts` chromium, `artPieceSteeringRuntime.spec.ts`
firefox).

It recurred anyway, independently, twice more in 2026-09-16's
production-readiness pass: once in CI on `e2e/projectLifecycle.spec.ts`
(chromium, desktop) on a docs-only commit (ruling out a code regression),
and once locally on `e2e/offlineSync.spec.ts`'s mobile 375x812 scenario.
Filed as new [#549](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/549)
rather than reopening the immutable #492.

**Why:** #492's own verification only exercised the two specs/browsers where
it was first seen; a wider timeout reduces but does not eliminate whatever
the underlying timing issue is (session/cookie timing, backend fixture
setup latency, or something viewport/spec-order-dependent), since it keeps
recurring on different specs and viewports that weren't part of that
verification.

**How to apply:** do not treat another timeout increase as sufficient
evidence of a fix — #549's acceptance criteria require actually
root-causing this (repeat-run harness across multiple specs/viewports,
correlate with viewport/ordering/session timing) before closing. Any new
`loginViaUI` timeout observed anywhere should be logged against #549, not
treated as a one-off.
