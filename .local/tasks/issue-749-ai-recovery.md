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

- **Status:** IMPLEMENTED; QA pending
- **Evidence so far:** The focused host-permission Chromium run reproduced one
  remaining failure in the grouped explicit-Save test; its six other grouped
  scenarios passed. The failure was assertion drift: the spec expected the
  removed `/projects/<id>` route while the current editor correctly remained
  on the canonical `/users/@handle/edit/:slug` route. The earlier recorded
  draft-recovery setup failure did not reproduce in this run; both recovery
  groups passed.
- **Classification:** Test drift only. No product, auth, or data-layer defect
  was observed, so no complex-logic reroute was needed.
- **Pending verification:** The final full-file rerun was started but stopped
  after the containing explicit-Save test exceeded the short session window.
- **Next action:** QA self-review should rerun the full focused file before
  treating this child as release-ready.
- **Durable memory link:** None.

## Transaction ledger

- **Phase:** IMPLEMENTED
- **Issue owner / current transaction:** #749 child: AI/recovery
- **Implementation commit:** Pending local commit after QA handoff
- **Focused checks / full checks:** `E2E_DOCKER_COMPOSE=true E2E_BASE_URL=http://127.0.0.1:5000 npx playwright test e2e/aiAndRecovery.spec.ts --project=chromium` — 6 passed, 1 failed on the stale route assertion. The subsequent containing-test rerun was started but stopped before completion.
- **QA matrix:** Not run; this handoff is implementation-stage evidence only.
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
