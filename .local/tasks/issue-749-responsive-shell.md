## Goal

Restore the responsive-shell E2E contract after the shared shell gained the
color-mode control and canonical navigation ordering.

## Acceptance criteria

- [ ] Signed-out tablet tab-order assertions follow the rendered focus order:
  skip link, brand link, color-mode control, Public gallery, Login, and the
  checked reduced-motion radio.
- [ ] Signed-in tablet tab-order assertions follow the rendered focus order:
  skip link, brand link, color-mode control, Studio, Public gallery, Account
  settings, Logout, and the checked reduced-motion radio.
- [ ] The existing responsive-shell visual/overflow assertions remain intact.
- [ ] `responsiveShell.spec.ts` passes in the CI-like Chromium runner.

## Out of scope

- Publishing/remix route and heading drift, tracked in the sibling #749
  publish/remix task record.
- AI draft/recovery drift, tracked in the sibling #749 AI task record.
- Product shell behavior changes.

## Evidence and pending items

- **Status:** COMPLETE (implemented locally; not deployed)
- **Evidence so far:** The host-permission Chromium run reproduced both tab
  order failures; Chrome DOM inspection showed the color-mode control between
  the brand link and Public gallery.
- **Pending verification:** No local verification remains. GitHub comment/closure
  reconciliation is pending because the authenticated issue connector is not
  available in this session.
- **Next action:** Reconcile this child against #749 in GitHub when the
  authenticated connector is available; keep #749 open for the sibling child
  transactions.
- **Durable memory link:** None.

## Transaction ledger

- **Phase:** CLOSED
- **Issue owner / current transaction:** #749 child: responsive shell
- **Implementation commit:** `951f078`
- **Focused checks / full checks:** `E2E_DOCKER_COMPOSE=true E2E_BASE_URL=http://127.0.0.1:5000 npm run test:e2e -- --project=chromium e2e/responsiveShell.spec.ts` — 3 passed; `npm test` — 2,824 passed; `make frontend-lint frontend-format-check frontend-typecheck` — passed (pre-existing lint warnings only).
- **QA matrix:** PASS — signed-out and signed-in tablet focus order plus
  populated 375px gallery all pass in Chromium; rendered browser evidence
  confirmed the shell sequence. QA ran as Claude Sonnet 5 / Medium
  substitution for the rostered external reviewer; second opinion not run.
- **GitHub closure evidence:** GitHub issue/comment connector unavailable in
  this session; local child record and commit are the reconciled handoff.
- **New gaps discovered:** The original #749 bundles unrelated E2E families;
  sibling task records split them before implementation.

## Discovery gate

- [x] Searched `docs/tasks.md`, `.local/tasks/`, and public GitHub issue #749;
  no existing child record was found.
- [ ] Add/reuse a matching GitHub follow-up when an authenticated issue
  connector is available.
- [x] Reconciled out-of-scope work into sibling local records.

## Constraints

- Files in scope: `frontend/e2e/responsiveShell.spec.ts` and its focused test
  evidence.
- No dependencies, routes, APIs, or product behavior may change.
