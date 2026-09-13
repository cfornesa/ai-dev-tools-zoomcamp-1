# #519 — Cross-surface capability registry and plan consistency

## Goal

Define one named capability/limit registry consumed by every editor family and
AI/publish surface so plan access is deterministic: paid access to one editor
family never silently omits an equivalent permitted family, and free users keep
their local capabilities.

Owner clarification (2026-09-13): permissions must be atomic at the named-task
level. A user may receive an explicit allow/deny for a specific editor family
or function (for example local 2D, local 3D, generated pieces, AI create/edit,
publishing, cloud sync, or code editing inside a named editor), while plan
defaults remain stable for Free and paid tiers. Roles are reusable sections
(Free, Premium, and admin-defined roles), and plans may point at one role.
Global capability settings are a separate atomic layer; a global cloud-sync
off switch must suppress sync for every user and remain synchronized with the
existing site setting. Missing plan entries never hide local
create/open/edit/import/export; the UI should omit unavailable optional tools
rather than advertise a locked feature.

## Entry point / fixture

`backend/scenes/entitlements.py`, `Plan`/override models, authorization helpers,
`frontend/src/App.tsx`, account entitlement API, and 2D/3D/generated routes.
Fixture: free, paid, higher-tier, explicit allow, explicit deny, inactive-plan,
and provider-outage users.

## Acceptance criteria

- [ ] A finite registry names each capability separately (local 2D, local 3D,
  generated pieces, AI operations, publishing, cloud sync, and named editor
  functions such as code editing) with explicit local, remote, quota, and plan
  semantics; the admin panel exposes role sections and atomic global toggles.
- [ ] All named routes and API entry points use the same fail-closed resolver;
  unknown/missing capabilities deny only the affected remote/paid operation,
  never local create/open/edit/import/export.
- [ ] Free, paid, higher-tier, override, downgrade, cancellation, and outage
  fixtures produce stable effective capability maps visible to the account UI.
- [ ] Concurrent plan/override changes are atomic and do not mutate projects,
  versions, media, credentials, or sessions; audit records identify the actor.
- [ ] Role creation/editing, plan-to-role assignment, global capability toggles,
  and per-user overrides use revision checks and never partially apply. A
  global cloud-sync denial overrides role/plan/user grants without deleting
  local-first data.
- [ ] Backend authorization/concurrency tests, route/API coverage, fixed
  viewport browser evidence, and `make check` pass.

## Verification

Extend `backend/tests/test_entitlements.py` and add
`frontend/e2e/capabilityConsistency.spec.ts`; use disposable PostgreSQL and
Chromium at 1280x900/375x812.

## Out of scope

PayPal transport (#424/#440), OAuth, page CMS (#517), and cloud retention
policy (#522).

## Routing / dependency

Stage 2b complex: authorization/business logic. Reuse closed #423; do not
reopen it.

## Distillation reconciliation (2026-09-13)

The requested immersive/gallery viewer and multi-library AI editor surfaces
are already covered by completed, immutable parity work: #274/#318 for
immersive presentation and #326/#463 plus the closed renderer/editor child
issues for AI-assisted 2D/3D and multi-library pieces. They are not reopened;
#519 owns only their atomic capability vocabulary and consistent visibility.
The new actionable work is therefore this issue's role sections, named editor
function permissions (including code-editor access), and global capability
settings. No duplicate issue was created. Next issue: #519, after this
criterion update, with complex implementation routing.
