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
| 2 | [#633](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/633) | Owner-scoped production reference-piece import | #622 evidence | `OPEN / production import PASS; surface follow-up remains` | Production now contains exactly six imported reference pieces with current versions and PNG thumbnail endpoints; the temporary import trigger was removed after verification. Final card rendering remains coupled to #622. |
| 3 | [#622](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/622) | Replit publish and production piece evidence | #633 | `OPEN FOLLOW-UP / card-rendering blocker` | Publish, smoke, schema, canonical links, route status, immersive stage, and API thumbnail evidence pass. Profile cards still show `No preview available` for fallback thumbnails, and the full six-engine browser matrix remains. |

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
