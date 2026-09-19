# Issue #635 — Reduce CI feedback time without weakening required coverage

## Status

`GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED` — changed-test PR
feedback and deterministic full main/release gates are implemented and green.

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

## Transaction ledger

- **Stage owners:** scoping `Codex / GPT-5 / medium, substituted: no`;
  implementation `Codex / GPT-5 / medium, substituted: yes for Ollama Cloud`;
  second opinion `not run`; QA `Codex / GPT-5 / medium, substituted: yes for
  Claude Sonnet 5`; readiness `Codex / GPT-5 / medium, owner-authorized
  substitution`.
- **Evidence:** changed path 10 files / 39 tests in about 6 seconds; full
  frontend 241 files / 2,734 tests in about 105 seconds; full backend 1,447
  passed / 39 skipped in about 131 seconds; authoritative CI run
  `35444460681` passed all required jobs.

## GitHub

https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/635
