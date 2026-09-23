## Goal

Reconcile publishing/remix/public-viewer E2E assertions with the canonical
slug routes, current public headings, toolbar contract, and stage layout.

## Acceptance criteria

- [ ] Each named publishing/remix/public-viewer failure is classified as test
  drift or product defect before editing.
- [ ] Test-only drift is updated without weakening route-level or rendered
  interaction coverage.
- [ ] The focused publishing/remix/draw.io specs pass in Chromium.

## Out of scope

- Responsive shell tab-order drift, in sibling task record.
- AI draft/recovery drift, in sibling task record.
- New public route behavior or production deployment.

## Evidence and pending items

- **Status:** PROPOSED
- **Evidence so far:** Host-permission Chromium reproduced failures in draw.io,
  publishing, public stage layout, and remix scenarios.
- **Pending verification:** Root-cause classification and focused rerun.
- **Next action:** Groom after the responsive-shell child reaches a terminal
  state; do not start this transaction in parallel.
- **Durable memory link:** None.

## Transaction ledger

- **Phase:** GROOMED
- **Issue owner / current transaction:** #749 child: publish/remix
- **Implementation commit:** Pending
- **Focused checks / full checks:** Pending
- **QA matrix:** Pending
- **GitHub closure evidence:** GitHub issue/comment connector unavailable in
  this session; local child record is the reconciled handoff.
- **New gaps discovered:** None beyond the named #749 evidence.

## Discovery gate

- [x] Searched `docs/tasks.md`, `.local/tasks/`, and public GitHub issue #749.
- [ ] Add/reuse a matching GitHub follow-up when an authenticated issue
  connector is available.
- [x] Kept this surface separate from unrelated #749 families.

## Constraints

- Candidate files are limited to the named publishing/remix/draw.io E2E specs
  after grooming identifies exact drift.
- No dependencies, routes, APIs, or product behavior may change without a new
  scope decision.
