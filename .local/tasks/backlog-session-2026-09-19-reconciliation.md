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
| 1 | [#634](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/634) | Resolve the Vitest Security Center gate | Replit workspace synchronization | `ENGINEERING → QA/DEPENDENCY-BLOCKED` | Stage 2a mechanical dependency remediation is implemented and locally/CI verified. Safely resolve the pre-existing Replit rebase, pull reviewed `0049e26`, rescan, and review Republish. |
| 2 | [#633](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/633) | Owner-scoped production reference-piece import | #634, then #622 evidence | `ENGINEERING/QA → DEPENDENCY-BLOCKED` | Stage 2b complex data-layer workflow is implemented and locally QA-verified. Run the documented production dry-run only after #634 clears, then import and verify routes/tables. |
| 3 | [#622](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/622) | Replit publish and production piece evidence | #633 | `OPEN FOLLOW-UP` | Existing publish/smoke/schema evidence passes. Re-run dry-run/import and authenticated/public route matrix after #633. |

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
  tests, lint, format, and mypy pass.
- Replit's Git panel currently reports: `Unsupported state: you are in the
  middle of a rebase. Please finish the rebase manually.` Its visible scan is
  still for Vitest 4.1.10, so the reviewed SHA has not been externally
  verified there.
- Classification: `verification-boundary` plus `workflow/infrastructure-
  defect` for Replit synchronization. It becomes actionable only through a
  reviewed rebase recovery choice; no force reset or agent mutation is
  authorized by inference.

## Required terminal sequence

1. Resolve the Replit rebase through an owner-approved choice, pull reviewed
   `0049e26`, run Security Center scan, and confirm Republish is enabled.
2. Republish and run `scripts/smoke-published.sh`.
3. Run #633's production dry-run through Replit Shell; review owner/profile,
   six fixtures, conflicts, and zero writes.
4. Execute the approved owner-scoped import, inspect production tables, and
   perform #622's public/immersive/embed/download/editor authorization matrix.
5. Post per-criterion QA/reconciliation comments, close only criteria-complete
   issues, then invoke production-readiness and session-completion.

No independent issue is currently available: all three remaining issues share
the same Replit synchronization prerequisite. This is a dependency handoff,
not a completion claim.
