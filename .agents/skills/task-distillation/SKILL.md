---
name: task-distillation
description: Discover, deduplicate, groom, and reconcile all actionable backlog work and its memory topics for one project.
---

# Task distillation

Use this skill to turn a user request, review feedback, failures, or readiness findings into a reconciled project backlog. It is batch-aware and idempotent: do not create duplicate GitHub issues or memory topics when an existing record already covers the work.

## Phase gate: distill before engineering

This skill is a read/reconcile and backlog-definition phase. Do not implement
product behavior, update product tests to accommodate a suspected fix, or
close an issue while this phase is active. A failed test or observed UI gap is
evidence to classify and capture, not permission to start fixing it. Engineering
may begin only after the required outputs below exist and the next issue has a
complete closure contract. If the contract is incomplete, stop at the
backlog/documentation change and leave the item open or blocked with its next
action.

The only permitted writes during distillation are backlog/task records,
criterion-ready GitHub issue definitions and links, durable memory updates,
and the distillation manifest. Product source and product-test changes belong
to the later backlog-session engineer pass.

## Discovery and reconciliation

1. Identify exactly one project and read its `tasks.md`, relevant plan, `docs/process.md`, and applicable acceptance criteria and constraints.
2. Inspect the current worktree and relevant repository history without overwriting user changes.
3. Use the authenticated GitHub connector to enumerate open issues associated with the project. Compare GitHub issues, `tasks.md`, existing memory topics, related PRs, and the user's evidence.
4. Build or update an issue manifest containing issue number, URL, goal, dependencies, priority/order, duplicate links, scope, and status.
5. Order work by dependencies, then backlog order, then priority. Mark already-completed, duplicate, blocked, and dependency-blocked items explicitly.

## Atomicity and closure cadence

- Treat an epic or parent issue as a reconciliation container, never as one
  implementation/closure unit. Parent acceptance criteria must be decomposed
  before engineering begins.
- A closure-sized issue has one independently observable vertical slice: one
  route/surface, one workflow, or one narrowly bounded capability. If two
  surfaces need separate browser entry points, fixtures, screenshots, or
  deployment evidence, they are separate issues even when they share code.
- Do not combine regular editor, AI editor, public viewer, embed, immersive
  variants, and downloaded artifacts into one issue. Shared components belong
  in implementation issues; each consuming route gets its own acceptance and
  QA issue.
- During grooming, record the route or surface in the issue title and list
  exactly which evidence is in scope. A parent may close only after every
  child is terminal and reconciled; it must not be used to postpone a failed
  child criterion.
- A smaller issue is not automatically closable. Before filing it, require a
  closure contract: one named entry point, fixed fixture/precondition, a
  finite checklist of observable outcomes, exact focused/full commands, and
  one explicit evidence boundary. Replace vague phrases such as “all
  permitted controls” or “where applicable” with named controls and a stated
  not-applicable decision. If the issue needs another route, an unprovisioned
  credential, or a parent-wide visual judgment to decide pass/fail, split or
  reclassify it before engineering.
- Distillation and grooming may be performed in one bulk pass so the complete
  backlog can be decomposed and ordered. That batching ends at the handoff:
  backlog-session must process engineering and testing as a strict
  per-issue transaction. Process and reconcile one closure-sized issue at a time. After its required
  QA passes, immediately post the criterion matrix and set its GitHub status
  (closed only when every criterion passes; otherwise open with a classified
  blocker). Do not accumulate several hours of implementation without
  terminalizing or handing off the current issue.
- Before handing the manifest to backlog-session, perform a completeness
  check: every actionable item has a unique issue, one route/workflow or
  capability boundary, fixed preconditions/fixtures, finite pass/fail
  criteria, exact agent-runnable verification, explicit out-of-scope items,
  and a blocker/owner/next action. A list of small-looking issue titles is
  not sufficient.

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

Also do not exit into implementation until the manifest, duplicate report,
criterion-ready issue definitions, dependency/order rationale, blocker triage,
and verification boundaries have all been written and reconciled. The next
phase must name exactly one groomed issue; it may not select a broad parent or
an issue whose acceptance criteria still require a later decomposition.

Return the manifest to the caller so backlog-session can process every remaining open issue sequentially.
