# Backlog-session reconciliation — 2026-09-19

## Project and provenance

Project: `cfornesa/ai-dev-tools-zoomcamp-1`.

This distillation/backlog orchestration pass is run by Codex/GPT-5 in the
current session. The rostered external implementation and QA services were not
available, so prior stage substitutions are preserved in each issue ledger and
GitHub comment; no unrecorded service is credited.

## Current open-issue manifest

| Order | Issue | Scope | Dependencies | State | Routing / next action |
| ---: | --- | --- | --- | --- | --- |
| 1 | [#634](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/634) | Resolve the Vitest Security Center gate | Replit workspace synchronization | `CLOSED / QA PASS` | CI and the fresh Replit Security Center scan pass; no remaining work in this issue. |
| 2 | [#633](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/633) | Owner-scoped production reference-piece import | #622 evidence | `CLOSED / QA PASS` | Production import, six reference engines, stored thumbnails, routes, cleanup publish, and regression evidence passed; broader release-surface work remains in #622. |
| 3 | [#622](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/622) | Replit publish and production piece evidence | #633 | `OPEN FOLLOW-UP / blocked on Replit authentication and rebase state` | Six-engine regular/immersive/editor matrices pass in the prior production artifact; latest Replit publish still serves the legacy UUID link. Replit Git now reports `UNAUTHENTICATED` and an in-progress rebase, so manual workspace recovery is required before Pull, republish, and fresh live verification. |
| 4 | [#635](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/635) | Reduce CI feedback time without weakening required coverage | none | `CLOSED / QA PASS` | Changed-test PR feedback path and deterministic full main/release gate are implemented and verified by green CI run `35444460681`. |

## Duplicate and already-covered work

- The Vitest advisory remediation is not duplicated by #622 or #633; #634 is
  the sole owner of the dependency/security gate.
- The unfinished Replit rebase is a deployment synchronization boundary,
  already covered by #634/#622 and the existing `parity-closure-evidence-gap`
  memory lesson. No new issue is created for a cosmetic duplicate.
- #612 remains closed and scoped to disposable imports; #633 is the distinct
  explicitly opt-in production owner-scoped workflow.

## Evidence and blocker triage

- Local #634 implementation: `df7ed16`; `npm audit` reports zero findings;
  `npm ci`, frontend checks, full Vitest, build, and push CI pass.
- Local #633 implementation: `2aa5b8a`; focused import tests, full backend
  tests, lint, format, and mypy pass. CI run `35440004191` is green.
- Security Center scan and the six-engine publication/import evidence are
  resolved. The published API returns eight profile pieces total, including
  six `reference-*` fixtures; all six imported detail endpoints return JSON
  200 and all six thumbnail endpoints return PNG 200.
- The card-rendering classification is resolved by `088545f`; live profile
  cards now show stored fallback PNGs. The latest source/API contract fix is
  `3e8e150`; the latest Replit publish promoted stale revision `885fceb` and
  live verification still shows the UUID immersive link.
- Replit Git currently reports `UNAUTHENTICATED` and an in-progress rebase;
  no destructive rebase recovery was attempted.
- #635 is closed after green CI run `35444460681`; the main push full frontend
  job took 5m46s, while the representative changed-test PR path took about 6s.

## Required terminal sequence

1. Resolve the #622 card-rendering discrepancy so stored fallback thumbnails
   display consistently with the API contract.
2. Complete #622's six-engine regular/immersive/embed/download/editor-owner
   browser matrix and anonymous authorization checks.
3. Post per-criterion QA/reconciliation comments, close only
   criteria-complete issues, then invoke production-readiness and
   session-completion.

The production target and imported data are resolved, but the remaining
release blocker is Replit workspace synchronization and promotion of the
canonical-link fix. The CI runtime concern is closed in #635 without dropping
release coverage.
