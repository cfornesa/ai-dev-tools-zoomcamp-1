# Production-readiness assessment — 2026-09-13

Project: `ai-dev-tools-zoomcamp-1` / Replit `creatrweb`.
Manifest: `docs/distillation-2026-09-13-admin-profile-parity.md`.

## Results

| Dimension | Result | Evidence / boundary |
| --- | --- | --- |
| Local web-app deployment | PASS with dev-only warning | `UV_CACHE_DIR=/private/tmp/codex-uv-cache BASE_URL=http://localhost:5000 make smoke-local` passed health, anonymous, login, and authenticated smoke. `make deploy-check` passed with five expected local-DEBUG security warnings; production must use explicit secure settings. |
| Focused approved-browser verification | PASS | Escalated Chromium `themeCustomization.spec.ts` and `cloudRetention.spec.ts`: each passed at 1280x900 and 375x812; #522 screenshots inspected. |
| Full browser verification | BLOCKED / workflow boundary | First run could not launch Chromium under the managed sandbox. Escalated run launched successfully and reached 37 passes, but was stopped after six failures: four AI-agent cases lacked the documented `AI_PROVIDER=fake` server prerequisite, and the existing admin-settings case exposed cross-spec singleton baseline drift (#505 class). This is not evidence against #521. |
| CI verification | BLOCKED | Latest run `34738342190` was cancelled by workflow concurrency; the latest completed success `34736533185` targets older SHA `a51ec51a0a3648eab84a0a7ce428967042807102`, not the current local SHA `983505db8ca60d494d1c6206ee3fb3e65966dc85`. |
| Replit publication | BLOCKED by production schema drift | The post-republish check still has healthy public domains and passing credential-free smoke, but authenticated production requests return 500. CDP confirms `/api/account/profile/`, `/api/site-theme/`, and `/api/account/entitlements/` fail; Replit console evidence reports `ProgrammingError: column scenes_sitesettings.theme_config does not exist`; production schema is behind the published code. |
| Production readiness | BLOCKED | Current-revision CI is PASS, and credential-free published smoke passes, but production authenticated settings are not functional until Replit applies the missing schema diff. The required rostered Opus 5 readiness model is unavailable in this task, so no silent model substitution is claimed. |

## Issue rollup

- Completed and closed: #515, #516, #517, #518, #519, #520, #521.
- Completed and closed: #522; QA comment `issuecomment-5652013638` and GitHub state `COMPLETED` verified.
- Missing terminal-status issues: zero among the current manifest.

## Exact next actions

1. In Replit `creatrweb` → Publishing, reconcile/apply the production schema
   diff for the migrations through `0055_seed_cloud_retention_policy`; reject
   destructive conflict options. Then republish and recheck the authenticated
   account-settings APIs. The specific first confirmed missing field is
   `scenes_sitesettings.theme_config`.
2. Start the documented local E2E stack with `AI_PROVIDER=fake` and rerun the
   full suite; separately address the existing singleton-isolation failure if
   it reproduces in a clean per-spec run. Do not attribute either to #521.
3. After schema reconciliation, verify the exact published
   URL with `scripts/smoke-published.sh` and inspect migration-created tables
   directly; do not rely on `django_migrations`.
4. Obtain/retain the terminal CI result for the current revision before
   production release; CI run `34745983422` is already successful for
   `b44e249a68c6f7049fba3db855bb8131dcffea9b`.

## Routing audit

All engineering/QA work in this owner-directed run used Codex substitutions
because the user prohibited external model delegation; Stage 3 independent
review was not run. The production-readiness skill was loaded and its checks
were performed, but the mandatory rostered Opus 5 gate was unavailable; this
is recorded as a readiness limitation rather than silently credited as a
rostered pass.
