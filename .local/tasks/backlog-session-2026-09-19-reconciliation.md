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
| 3 | [#622](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/622) | Replit publish and production piece evidence | #633 | `OPEN FOLLOW-UP / interaction-download-authorization matrix` | Card thumbnails, canonical links, API thumbnails, embeds, routes, and one visual immersive/editor path pass; complete the six-engine browser interaction/download/author-only-controls matrix before closure. |
| 4 | [#635](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/635) | Reduce CI feedback time without weakening required coverage | none | `PROPOSED / scoped follow-up` | Baseline the 172-second frontend run and compare changed-path, parallel/sharded, and fast/full workflow strategies before implementation. |

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
- Replit synchronization, Security Center scan, and publication are now
  resolved. The published API returns eight profile pieces total, including
  six `reference-*` fixtures; all six imported detail endpoints return JSON
  200 and all six thumbnail endpoints return PNG 200.
- The remaining classification is `surface-contract`: `PieceCard` hides a
  stored fallback thumbnail whenever `thumbnail_is_fallback` is true, so the
  profile visually renders a no-preview tile even though the API has a valid
  PNG URL. This is an existing #622 acceptance gap, not a new duplicate issue.

## Required terminal sequence

1. Resolve the #622 card-rendering discrepancy so stored fallback thumbnails
   display consistently with the API contract.
2. Complete #622's six-engine regular/immersive/embed/download/editor-owner
   browser matrix and anonymous authorization checks.
3. Post per-criterion QA/reconciliation comments, close only
   criteria-complete issues, then invoke production-readiness and
   session-completion.

The production-target and synchronization prerequisites are resolved. The
remaining blocker is the rendered-card contract described above; no new issue
is needed because it is already within #622's public-card acceptance scope.
