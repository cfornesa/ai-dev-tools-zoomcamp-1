---
name: production-readiness
description: Assess one project's complete backlog batch for local deployment, CI/browser verification, intended functionality, and production readiness.
---

# Production readiness

Evaluate the whole selected project and its issue manifest, not only the latest commit or issue. This is an evidence assessment, not permission to broaden implementation scope.

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

## Output

Return:

- a readiness result for each requested dimension;
- evidence separated into local, approved-browser, CI, and production;
- every remaining issue and its status;
- every failed gate or verification boundary;
- exact next action for each blocker;
- confirmation that no issue is silently omitted or duplicated.

Do not call the project production-ready while any required issue or acceptance criterion is incomplete, unverified, or blocked. If tools or environments are unavailable, record the attempted command/tool, exact failure, impact, and next action rather than treating missing evidence as a pass.
