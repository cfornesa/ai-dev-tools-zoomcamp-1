# #515 — Published billing pending state and centered layout

## Goal

After PayPal approval, clearly tell the user that webhook synchronization can
take a few minutes, and center the Billing content horizontally and vertically
within the page body while preserving the existing dark application theme.

## Entry point / fixture

`frontend/src/pages/AccountBilling.tsx`, `frontend/src/index.css`, and the
published return route `/account/billing`. Use a signed-in fixture with a
checkout return URL before webhook state is visible, then an active paid state.
Inspect 1280x900 and 375x812.

## Acceptance criteria

- [ ] A post-approval/pending state displays an accessible `role=status`
  message explaining that PayPal confirmation is asynchronous and may take a
  few minutes; it does not falsely claim activation.
- [ ] The page polls or provides an explicit refresh path with bounded,
  non-duplicating requests and transitions to active/free/error truthfully.
- [ ] Billing content is centered horizontally and vertically in the main
  body area at both viewports without overlapping the shell/footer or causing
  horizontal overflow.
- [ ] Active paid, free, loading, error, and unavailable-PayPal states retain
  clear labels and keyboard-accessible controls.
- [ ] Rendered screenshots and interaction evidence cover the fixed fixture at
  both viewports; component tests and `make check` pass.

## Verification

`npm --prefix frontend test -- --run src/pages/AccountBilling.test.tsx`; add a
focused browser spec if the existing billing E2E does not cover the pending
state; `make check`; Chromium at 1280x900 and 375x812.

## Out of scope

PayPal API/webhook semantics (#424/#440), pricing changes, account identity,
or general layout redesign.

## Routing / dependency

Stage 2a mechanical. Reuse existing billing API and webhook state; reroute if
the API contract must change.
