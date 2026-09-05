---
name: Stratified browser E2E CI
description: Keep pull-request browser feedback bounded while retaining a complete release gate.
---

Ordinary pushes and pull requests use a named Chromium smoke set plus the
required WebKit fullscreen regression. The complete multi-browser acceptance
suite runs on manual dispatch or the weekday schedule. A smoke pass is not
release evidence; the full disposable-stack suite and published Replit checks
remain separate boundaries.

The current workflow implementation is tracked by #418. Current-revision full
suite timeout/cache/draft failures are tracked separately by #419.

The first current smoke failure is a stale E2E entry-point contract, tracked by
#427: authoring and publication controls are behind the stage-local `Edit scene`
popover and must be opened by the shared helper before locators resolve them.
