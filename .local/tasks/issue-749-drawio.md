## Goal

Reconcile the draw.io public/embed/download E2E contract with the current
public piece controls and read-only surface.

## Acceptance criteria

- [ ] The public draw.io fixture reaches the piece-controls entry point
  without timing out.
- [ ] Public, embed, and downloaded surfaces still assert read-only draw.io
  rendering and documented controls.
- [ ] The focused draw.io Chromium spec passes without weakening assertions.

## Out of scope

- Responsive shell drift, closed in the sibling child record.
- Publishing/public-viewer drift, in the sibling task record.
- Remix/fork drift, in the sibling task record.
- Product toolbar or route behavior changes.

## Evidence and pending items

- **Status:** COMPLETE (implemented locally; not deployed)
- **Evidence so far:** Host-permission Chromium reproduced the stale public
  menu selector. The `/p/:id` compatibility route now lands on the canonical
  `/users/@handle/pieces/:slug` surface, whose controls are inline; embed stays
  menu-based.
- **Pending verification:** GitHub child issue/comment reconciliation is
  pending because the authenticated issue connector is unavailable.
- **Next action:** Reconcile this child against #749 when GitHub access is
  available; continue with the independent remix child.
- **Durable memory link:** None.

## Transaction ledger

- **Phase:** CLOSED
- **Issue owner / current transaction:** #749 child: draw.io public surfaces
- **Implementation commit:** Pending until the task record is committed with
  the spec update.
- **Focused checks / full checks:** `E2E_DOCKER_COMPOSE=true E2E_BASE_URL=http://127.0.0.1:5000 npx playwright test e2e/drawioPublicSurfaces.spec.ts --project=chromium` — 1 passed; `npx prettier --check e2e/drawioPublicSurfaces.spec.ts` and `git diff --check` — passed.
- **QA matrix:** PASS — canonical public route renders draw.io read-only,
  inline public controls omit the legacy menu trigger, embed retains its
  menu-based controls, and Full download remains covered.
- **GitHub closure evidence:** Authenticated issue connector unavailable;
  local child record is the reconciled handoff.
- **New gaps discovered:** None beyond #749 evidence.

## Discovery gate

- [x] Searched `docs/tasks.md`, `.local/tasks/`, and public GitHub issue #749.
- [ ] Add/reuse a GitHub follow-up when an authenticated issue connector is
  available.

## Constraints

- Candidate file: `frontend/e2e/drawioPublicSurfaces.spec.ts` and its existing
  fixture/helper only after grooming identifies exact drift.
- No dependencies, routes, APIs, or product behavior may change.
