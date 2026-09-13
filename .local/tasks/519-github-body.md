# #519 — Cross-surface capability registry and plan consistency

## Goal

Define one named capability/limit registry consumed by every editor family and
AI/publish surface so plan access is deterministic. Permissions are atomic at
the named-task level: editor families, editor functions such as code editing,
AI operations, publishing, and cloud sync can be controlled independently.

## Entry point / fixture

`backend/scenes/entitlements.py`, `Plan`/role/override models, global settings,
authorization helpers, `frontend/src/App.tsx`, account entitlement API, admin
settings, and 2D/3D/generated routes. Fixture: Free, Premium, custom role,
higher-tier, explicit allow/deny, global deny, inactive-plan, and outage users.

## Acceptance criteria

- [ ] A finite registry names local 2D, local 3D, generated pieces, AI create,
  AI edit, AI art generation, publishing, cloud sync, and named editor
  functions such as code editing, with explicit local/remote/quota/plan
  semantics.
- [ ] Admins can create and edit reusable role sections (Free, Premium, and
  arbitrary roles), assign plans to roles, and set atomic per-user overrides.
  The admin panel presents the matrix without exposing it to ordinary users.
- [ ] Admins can atomically toggle global capabilities. Global cloud-sync off
  overrides role/plan/user grants and remains synchronized with the existing
  site-wide cloud-sync setting; it never deletes local-first data. Application
  admins are a separate full-access class and do not need role assignments,
  except that an explicit global shutdown still applies.
- [ ] All named routes and API entry points use the same fail-closed resolver;
  missing plan entries deny only affected remote/paid operations and never local
  create/open/edit/import/export. The UI omits unavailable optional controls.
- [ ] Free/paid/higher-tier/override/downgrade/cancellation/outage fixtures
  produce stable effective maps visible to the account UI, and concurrent
  changes are revision-checked, atomic, and actor-audited without mutating
  projects, versions, media, credentials, or sessions.
- [ ] Backend authorization/concurrency tests, route/API coverage, fixed
  viewport browser evidence at 1280x900 and 375x812, and `make check` pass.
- [ ] Public gallery persistence remains limited to explicitly public pieces;
  private pieces remain local-first in IndexedDB unless the account's allowed
  cloud-sync capability explicitly opts them into remote backup. No private
  piece, prompt, credential, or local-only draft is exposed by gallery/profile
  APIs.

## Verification

Extend `backend/tests/test_entitlements.py`, add admin role/global API tests,
and add `frontend/e2e/capabilityConsistency.spec.ts` against disposable
PostgreSQL and Chromium.

## Coverage and out of scope

The immersive/gallery and multi-library editor implementations are already
closed and immutable in #274/#318/#326/#463 and their child issues; this issue
does not reopen or reimplement them. PayPal transport (#424/#440), OAuth, page
CMS (#517), and cloud retention policy (#522) remain out of scope.

## Routing / dependency

Stage 2b complex: authorization/business logic, persistence, and migrations.
Reuse closed #423; do not reopen it.
