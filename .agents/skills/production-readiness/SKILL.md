---
name: production-readiness
description: Assess one project's complete backlog batch for local deployment, CI/browser verification, intended functionality, and production readiness.
---

# Production readiness

Evaluate the whole selected project and its issue manifest, not only the latest commit or issue. This is an evidence assessment, not permission to broaden implementation scope.

## No-loop handoff rule

Run production-readiness only after the per-issue backlog-session
transactions have been reconciled. Treat it as a read-only assessment of
release evidence, not a second engineering pass. For each finding, choose one
of these outcomes exactly once: `PASS`, `OPEN FOLLOW-UP`, `BLOCKED`, or
`NON-ACTIONABLE`. Link an `OPEN FOLLOW-UP` to an existing/new criterion-ready
issue and record its owner and next action; do not quietly send it back to an
already closed child.

Reopen a child only when the readiness finding names a failed criterion that
belongs to that child's fixed route/workflow and provides new evidence at its
contract boundary. If the finding concerns another route, a new fixture,
deployment identity, or a broader parent judgment, keep the child terminal and
record the finding on the correct route/reconciliation issue. Never use
production-readiness to make a broad parent absorb unresolved child work.

Readiness must respect scope-shifted completion. A functionally complete
shared capability remains closed when its route/deployment/artifact evidence
is explicitly owned by linked follow-up issues. Report that follow-up as
`OPEN FOLLOW-UP` rather than reopening the child unless the finding directly
fails the child's narrowed contract.

## Scope gate

Run this skill only after task distillation has produced a complete,
criterion-ready manifest. Production-readiness review may classify failed or
missing evidence and create/link follow-up backlog records, but it must not
implement fixes or rewrite tests to satisfy the readiness result. A readiness
failure remains open until the named issue is engineered and QA-reconciled.

## Readiness dimensions

Assess separately:

- local web-app deployment;
- approved-browser and CI verification;
- intended functionality against the project backlog;
- Replit publication, when that scenario is in scope;
- production readiness, when explicitly requested or required by session completion.

## Procedure

1. Load the complete issue manifest and reconcile it with `tasks.md`, GitHub, memory, open PRs, commits, and the current worktree.
2. Apply the project discovery gate and identify missing backlog entries, duplicate issues, stale statuses, unresolved dependencies, and unverified acceptance criteria.
3. Run the documented readiness checks appropriate to the project and record exact commands, environment, results, and limitations.
4. Classify each finding as completed, blocker, dependency-blocker, verification boundary, follow-up, or non-actionable context.
5. Link each finding to the relevant issue and memory topic. Before creating a new issue or topic, check for an existing record.
6. Reconcile all surfaces before exit: backlog, GitHub issue state/comments, PR state, commits, memory, and readiness report.

For a parity/release assessment, never count a locally closed capability as
deployed evidence. Compare the exact published asset/revision and every
user-supplied target URL with the checkout under review. A mismatch is an open
verification boundary for the affected route/artifact and for the parent
release gate, even when local unit, browser, and build checks pass.

## Output

Return:

- a readiness result for each requested dimension;
- evidence separated into local, approved-browser, CI, and production;
- every remaining issue and its status;
- every failed gate or verification boundary;
- exact next action for each blocker;
- confirmation that no issue is silently omitted or duplicated.

Do not call the project production-ready while any required issue or acceptance criterion is incomplete, unverified, or blocked. If tools or environments are unavailable, record the attempted command/tool, exact failure, impact, and next action rather than treating missing evidence as a pass.
