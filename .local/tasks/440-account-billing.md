## #440 — Account billing: create and display a PayPal sandbox subscription

### Transaction ledger

- **Phase:** GROOMED → ENGINEERING → QA pending
- **Stage provenance:** issue scoping and implementation performed by Codex as
  the owner-authorized substitution for the rostered external stages; no
  external model was invoked.
- **Implementation:** added authenticated `/api/account/billing/` status and
  idempotent PayPal subscription checkout, `BillingCheckout` correlation
  ledger, pending/past-due subscription states, frontend `/account/billing`,
  and migration `0045_billing_checkout`.
- **Focused evidence:** `tests/test_billing_checkout.py` and
  `tests/test_paypal_webhooks.py` pass; 10 checkout/webhook tests passed.
- **Boundary:** the live PayPal sandbox approval/webhook roundtrip remains
  operator-authorized and has not been claimed from mocked tests. Published
  deployment must receive this migration/code before release evidence.
