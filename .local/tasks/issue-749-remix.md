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

- **Status:** BLOCKED (product-side fork navigation blocker)
- **Evidence so far:** Docker-matched host-permission Chromium passed the
  private-source, both concurrency, and authorization scenarios (4/6). The
  fork-enabled scenario still does not reach a new editor route, and the
  remix-disabled scenario has a stale unscoped heading assertion.
- **Pending verification:** Product/helper routing behavior must be resolved,
  then rerun the fork-enabled case; independently tighten the heading
  selector before terminal QA.
- **Next action:** Route the fork navigation failure to a complex/product
  implementation pass; do not close this child or #749.
- **Durable memory link:** Canonical piece route contract, if route assertions
  require the existing memory topic.

## Transaction ledger

- **Phase:** BLOCKED
- **Issue owner / current transaction:** #749 child: remix/fork
- **Implementation commit:** None; mechanical stage returned the work because
  the fork navigation failure is product-side.
- **Focused checks / full checks:** Docker-matched Chromium remix/fork subset:
  4 passed, 2 failed; `make compose-preflight` passed.
- **QA matrix:** BLOCKED — fork-enabled route transition remains unresolved;
  remix-disabled heading drift is identified but not silently absorbed.
- **GitHub closure evidence:** Authenticated issue connector unavailable;
  local child record is the blocked handoff.
- **New gaps discovered:** Product-side fork navigation failure needs a
  complex implementation route; no new issue could be created because the
  authenticated connector is unavailable.

## Discovery gate

- [x] Searched `docs/tasks.md`, `.local/tasks/`, and public GitHub issue #749.
- [ ] Add/reuse a GitHub follow-up when an authenticated issue connector is
  available.

## Constraints

- Candidate file: `frontend/e2e/publishingAndRemix.spec.ts` only after grooming
  identifies exact drift.
- No dependencies, routes, APIs, or product behavior may change.
