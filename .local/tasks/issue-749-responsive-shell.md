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

- **Status:** ACTIVE
- **Evidence so far:** The host-permission Chromium run reproduced both tab
  order failures; Chrome DOM inspection showed the color-mode control between
  the brand link and Public gallery.
- **Pending verification:** Focused Chromium scenario and full frontend checks.
- **Next action:** Update only the affected E2E expectations, then run QA.
- **Durable memory link:** None.

## Transaction ledger

- **Phase:** GROOMED
- **Issue owner / current transaction:** #749 child: responsive shell
- **Implementation commit:** Pending
- **Focused checks / full checks:** Pending
- **QA matrix:** Pending
- **GitHub closure evidence:** GitHub issue/comment connector unavailable in
  this session; local child record is the reconciled handoff.
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
