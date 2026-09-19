# Issue #635 — Reduce CI feedback time without weakening required coverage

## Status

`PROPOSED` — discovered during the final QA pass for #622/#633. The final
local frontend run passed 241 test files / 2,734 tests but took approximately
172 seconds before the build.

## Scope

Measure the current CI/local suite costs, compare changed-path selection,
parallel Vitest/sharding, and required-fast/full-release workflow options,
then implement the selected coverage-preserving strategy.

## Acceptance criteria

- Baselines exist for each CI job and the full local/frontend/backend suites.
- Two or three coverage-preserving strategies are documented before choice.
- The selected strategy shortens PR feedback without deleting tests,
  weakening assertions, or removing required security/browser/schema coverage.
- A deterministic full-suite release workflow remains available.
- Before/after timings and green results are recorded for representative
  frontend-only, backend-only, and cross-stack changes.
- CI documentation and durable memory record the chosen boundary and fallback
  command.

## Verification

- `make check`
- CI workflow validation
- Full frontend/backend release suites
- Timed representative PR feedback paths

## GitHub

https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/635
