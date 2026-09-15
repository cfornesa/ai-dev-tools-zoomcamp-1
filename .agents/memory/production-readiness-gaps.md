---
name: Production readiness gaps
description: Durable operational boundaries identified while auditing AI limits, runtime startup, and authentication policy.
---

Production AI quotas cannot rely on process-local state when requests may be
distributed across workers; use a shared, explicitly configured backend or a
transactional alternative and fail clearly when it is unavailable. Published
runtime startup must use a supported WSGI/ASGI server rather than Django
runserver. Authentication policy must be explicit and consistent across plan,
settings, templates, verification, and abuse controls.

**Why:** Local tests can pass while production workers disagree about quota
state, the development server can appear healthy while being unsupported for
production, and a plan/UI mismatch can create ambiguous or unverified signup
behavior.

**How to apply:** #414, #415, and #416 are CLOSED (verified 2026-09-15) —
shared AI quota storage, published ASGI routing, and explicit signup policy
are all resolved. Keep live deployment, multi-worker, real-camera, and
provider-credential checks as explicit verification boundaries rather than
claiming them from local evidence; treat this page as historical operational
context only, not an open pointer.