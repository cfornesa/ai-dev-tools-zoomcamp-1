## Goal

Reconcile remix/fork E2E assertions with canonical slug-based routes and the
current public heading structure.

## Acceptance criteria

- [ ] Remix-enabled fork reaches and verifies the created project through the
  canonical route while preserving private-default, source-version, and
  attribution assertions.
- [ ] Remix-disabled and private-source cases identify the current heading
  and control contract without weakening authorization checks.
- [ ] Focused remix/fork Chromium scenarios pass.

## Out of scope

- Responsive shell drift, closed in the sibling child record.
- Publishing/public-viewer drift, in the sibling task record.
- Draw.io public/embed/download drift, in the sibling task record.
- Product remix or authorization behavior changes.

## Evidence and pending items

- **Status:** PROPOSED
- **Evidence so far:** Host-permission Chromium reproduced canonical-route and
  heading-selector failures in remix scenarios; authorization/concurrency
  cases passed.
- **Pending verification:** Root-cause classification and focused rerun.
- **Next action:** Process after the draw.io child reaches a terminal state.
- **Durable memory link:** Canonical piece route contract, if route assertions
  require the existing memory topic.

## Transaction ledger

- **Phase:** GROOMED
- **Issue owner / current transaction:** #749 child: remix/fork
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

- Candidate file: `frontend/e2e/publishingAndRemix.spec.ts` only after grooming
  identifies exact drift.
- No dependencies, routes, APIs, or product behavior may change.
