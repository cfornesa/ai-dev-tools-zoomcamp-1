---
name: task-distillation
description: Discover, deduplicate, groom, and reconcile all actionable backlog work and its memory topics for one project.
---

# Task distillation

Use this skill to turn a user request, review feedback, failures, or readiness findings into a reconciled project backlog. It is batch-aware and idempotent: do not create duplicate GitHub issues or memory topics when an existing record already covers the work.

## Discovery and reconciliation

1. Identify exactly one project and read its `tasks.md`, relevant plan, `docs/process.md`, and applicable acceptance criteria and constraints.
2. Inspect the current worktree and relevant repository history without overwriting user changes.
3. Use the authenticated GitHub connector to enumerate open issues associated with the project. Compare GitHub issues, `tasks.md`, existing memory topics, related PRs, and the user's evidence.
4. Build or update an issue manifest containing issue number, URL, goal, dependencies, priority/order, duplicate links, scope, and status.
5. Order work by dependencies, then backlog order, then priority. Mark already-completed, duplicate, blocked, and dependency-blocked items explicitly.

## Gap and blocker triage

Classify every discovered gap or failed gate before deciding its issue status:

- `implementation-defect`: product or code behavior fails an acceptance criterion.
- `verification-boundary`: the required environment, browser, service, credential, or CI evidence is unavailable, without evidence of a new product defect.
- `workflow/infrastructure-defect`: a repeatable CI, Compose, test-harness, fixture, or readiness problem prevents the required check from running or passing.
- `dependency-blocked`: the current work cannot proceed until a specific prerequisite issue is complete.
- `non-actionable`: transient noise, duplicate evidence, or an environment limitation that does not require repository work.

Do not treat every blocked issue as a reason to create another issue. Create or reuse a follow-up issue immediately when the blocker is distinct, actionable repository/workflow work and is not already covered. If issue creation is authorized for the session, use the authenticated GitHub connector and add the issue URL to the manifest, parent issue, backlog, and next action before continuing. If authorization is absent, record `issue-creation-pending-authorization` as the handoff and do not leave the work only in prose.

Every blocked or failed item must record its blocker class, coverage/follow-up issue decision, owner/context, exact command or evidence boundary, and one concrete next action. When a focused check passes but the full required check fails, preserve the failure as actionable until its cause is classified. A missing service or failed harness setup is a workflow/infrastructure defect when it is reproducible or required by the documented command; it is not a passing verification boundary merely because product-focused tests pass.

## Distillation loop

For each gap:

1. State the current behavior, desired behavior, evidence, and verification boundary.
2. Identify actionable implementation items, decisions, blockers, lessons, constraints, and context; classify each blocker using the triage rules above.
3. Reuse or update an existing GitHub issue when it covers the item. Create a new issue in the same distillation pass when the work is genuinely absent and issue creation is authorized. Link parent/child issues and state whether the parent is blocked, dependency-blocked, or handed-off.
4. Give each issue a clear goal, checkable acceptance criteria, constraints, out-of-scope links, dependencies, and exact next action.
5. Create or update memory topics only for durable decisions, blockers, verification boundaries, lessons, constraints, actionable context, or other information needed by a later session. Link each topic to its issue(s).
6. Reconcile issue status, backlog entry, memory topic, PR/commit evidence, blocker classification, issue-creation decision, owner, and next action before moving on.

## Required outputs

Produce:

- a complete project issue manifest;
- a duplicate and already-covered-work report;
- one criterion-ready issue definition for each actionable item;
- linked memory topics for durable context;
- a dependency/order rationale;
- an explicit list of unresolved blockers and verification boundaries.
- a blocker triage and follow-up issue report showing why each blocker did or did not produce a new issue.

No actionable item may be left only in prose. Every actionable follow-up must be linked to an existing or newly created issue, or explicitly marked `issue-creation-pending-authorization` with an owner and next action. No issue or memory topic may be created twice because a prior session already captured it. If external tooling is unavailable, record the attempted tool, exact failure, issue-creation decision, impact, and next action.

## Exit criteria

Exit only when every discovered gap is one of:

- linked to an existing or newly authorized issue;
- explicitly classified as duplicate or already covered;
- documented as blocked with an exact next action; or
- documented as non-actionable with a reason.

Return the manifest to the caller so backlog-session can process every remaining open issue sequentially.
