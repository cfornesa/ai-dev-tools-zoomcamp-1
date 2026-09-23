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

- **Status:** PROPOSED
- **Evidence so far:** Host-permission Chromium timed out at the public
  `Open piece controls menu` lookup.
- **Pending verification:** Determine whether the fixture route/control is
  stale or the public surface is defective, then focused rerun.
- **Next action:** Process after the publishing child reaches a terminal state.
- **Durable memory link:** None.

## Transaction ledger

- **Phase:** GROOMED
- **Issue owner / current transaction:** #749 child: draw.io public surfaces
- **Implementation commit:** Pending
- **Focused checks / full checks:** Pending
- **QA matrix:** Pending
- **GitHub closure evidence:** Authenticated issue connector unavailable;
  local child record is the handoff.
- **New gaps discovered:** None beyond #749 evidence.

## Discovery gate

- [x] Searched `docs/tasks.md`, `.local/tasks/`, and public GitHub issue #749.
- [ ] Add/reuse a GitHub follow-up when an authenticated issue connector is
  available.

## Constraints

- Candidate file: `frontend/e2e/drawioPublicSurfaces.spec.ts` and its existing
  fixture/helper only after grooming identifies exact drift.
- No dependencies, routes, APIs, or product behavior may change.
