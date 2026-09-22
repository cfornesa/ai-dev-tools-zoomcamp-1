# Issue #725 — AI custom theme generation and revision workflow

## Goal

Implement the bounded, reversible AI custom-theme workflow that consumes the
shared parity theme definitions from #724.

## Transaction ledger

- **Phase:** CLOSED — QA PASS
- **Issue owner / current transaction:** #725 — AI custom theme generation and revision workflow
- **Implementation commit:** `3d14f81`
- **Focused backend:** 12 passed (`test_theme_generation.py`, `test_profile_styles.py`, `test_admin_settings_api.py`)
- **Focused frontend:** 5 passed (`AdminSettings.test.tsx`, `adminSettings.test.ts`)
- **Full checks:** `make check` passed: backend 1,508 passed / 39 skipped; frontend 2,804 passed; lint/type/format/typecheck passed with existing warnings only.
- **Browser spec:** `frontend/e2e/adminThemeGeneration.spec.ts` is discoverable. The requested Chromium run was attempted and blocked before test execution by the local macOS Playwright headless binary (`MachPortRendezvousServer ... Permission denied`); this is host setup, not an assertion failure.
- **GitHub closure evidence:** QA evidence was posted to issue #725 and the issue was closed in the authenticated active Chrome session.

## Scope delivered

- Persisted bounded generation attempts with operation, state, prompt/source,
  revision, attempt cap, and accepted-definition snapshots.
- Fake-provider generation/refinement with strict metadata, palette,
  presentation, code-size, and forbidden executable/network-content checks.
- Admin API and UI for Generate New, Refine Existing, Retry, Accept, Reject,
  and Restore Snapshot using revision checks.
- Accepted definitions update the shared `ProfileStyle` catalog, while restore
  preserves the exact prior token representation, including legacy styles.

## Reconciliation

The live provider remains intentionally out of scope for this transaction;
production publication and provider credential provisioning were excluded by
the issue contract. The fake-provider path is the deterministic verification
surface for the workflow.
