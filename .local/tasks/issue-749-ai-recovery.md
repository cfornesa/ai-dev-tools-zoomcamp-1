## Goal

Reconcile AI draft/save/recovery E2E assertions with the current canonical
editor route and creation flow while preserving recovery behavior coverage.

## Acceptance criteria

- [ ] Each named AI/draft failure is classified as test drift or product
  defect before editing.
- [ ] Test-only drift is updated without weakening sync, recovery, or lossless
  working-copy assertions.
- [ ] The focused AI/recovery spec passes in Chromium.

## Out of scope

- Responsive shell tab-order drift, in sibling task record.
- Publishing/remix/public-viewer drift, in sibling task record.
- Product save/recovery behavior changes without a separate complex-logic
  routing decision.

## Evidence and pending items

- **Status:** PROPOSED
- **Evidence so far:** Host-permission Chromium reproduced two AI/recovery
  failures; the other named AI cases passed.
- **Pending verification:** Root-cause classification and focused rerun.
- **Next action:** Groom after the responsive-shell child reaches a terminal
  state; do not start this transaction in parallel.
- **Durable memory link:** None.

## Transaction ledger

- **Phase:** GROOMED
- **Issue owner / current transaction:** #749 child: AI/recovery
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

- Candidate files are limited to the named AI/recovery E2E spec and helpers
  after grooming identifies exact drift.
- No dependencies, routes, APIs, or product behavior may change without a new
  scope decision.
