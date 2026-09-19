# Bound full browser acceptance workflow when Playwright hangs

## Status

`PROPOSED` — discovered while observing workflow-dispatch run #35420287899;
no implementation has started.

## Issue

[#626](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/626)

## Discovery evidence

- `Browser acceptance E2E` entered `Run full browser acceptance suite` at
  `2026-09-19T04:06:13Z` and remained `in_progress` beyond the prior run's
  roughly 28-minute browser duration without live logs.
- `.github/workflows/ci.yml` has no job-level `timeout-minutes`.
- `frontend/playwright.config.ts` has `workers: 1` and `retries: 0`, but no
  explicit global timeout.
- Duplicate search covered existing full-browser and timeout issues; no open
  issue owns this missing bounded execution contract.

## Routing

Stage 2a mechanical CI/test infrastructure. Do not cancel or replace the
current live run solely because this issue was discovered.
