# E2E global fixture isolation

Global/account-wide E2E fixtures (fixture users, their server-side sessions, and singleton settings like `SiteSettings`/`Plan`) need explicit reset between spec files, unlike this suite's already-isolated per-project resources (projects, versions, drafts).

Two failure modes observed in the full serial CI run (2026-09-09):

1. **Session accumulation** (#505): every spec that logs a fixture user in via `loginViaUI` (the real `/accounts/login/` form) leaves a server-side Django session behind. Closing a `BrowserContext` only drops the client's cookie jar. In a ~200-test serial run, ~8 unrevoked sessions accumulate before `accountSessions.spec.ts` runs, breaking its exact-count assertion (`toHaveCount(2)` observed 8). Fix: `e2e_fixtures.py` gained a `reset-sessions` action; `accountSessions.spec.ts` invokes it once per file in `beforeAll` via `resetFixtureSessions()` from `e2e/support/resetSessions.ts`. The same cleanup also runs inside `e2e_fixtures create` for cross-run residue.

2. **Singleton baseline drift** (#505): `adminSettings.spec.ts` asserted `daily_ai_requests=5` for the seeded free plan, but migration 0031's actual seed is `50`. The hardcoded `5` only ever passed locally because a previous run's restore happened to leave `5` in a persistent dev DB; CI's fresh disposable DB shows `50`. Fix: the test now reads the live value from `GET /api/admin/plans/` at test start and asserts/restores against that actual value, never a hardcoded constant.

**Rule:** Any spec asserting exact session counts or singleton settings must establish its own baseline at the file level. Never assert a value that only exists because a previous run's restore left it behind.
