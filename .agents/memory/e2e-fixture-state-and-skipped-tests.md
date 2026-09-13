---
name: E2E fixture state and skipped tests
description: A self-skipped Playwright scenario is prerequisite evidence, not feature evidence.
---

The repository's Playwright global setup probes `/health/`, creates deterministic
fixture users, writes transient state, and global teardown removes that state.
Therefore a run that reports `skipped` can leave no state file to inspect after
teardown. When this happens, separately verify the health probe and run the
fixture command with output filtered so credentials are never displayed; if
fixtures were created manually, run the matching cleanup command afterward.

Do not report a skipped feature scenario as pass or fail. Use focused component
tests, `--list` discoverability, and previously recorded browser evidence only
for the claims those checks actually establish. Re-run the browser scenario
after the fixture-state cause is understood, against a disposable PostgreSQL
database and an explicitly configured `E2E_BASE_URL`.
