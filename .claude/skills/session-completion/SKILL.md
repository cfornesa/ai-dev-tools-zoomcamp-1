---
name: session-completion
description: Reconcile a complete project backlog run, its issues, memory, verification evidence, readiness, and handoff.
---

# Session completion

This is a batch-level pass. It runs after backlog-session has processed every issue in the project manifest sequentially. It may not silently reduce a multi-issue run to the latest issue.

## Completion procedure

1. Load the complete issue manifest and verify that every discovered issue has a terminal status: `completed`, `blocked`, `dependency-blocked`, or `handed-off`.
2. Reconcile each issue against its GitHub state, `tasks.md` entry, commits, QA comment, memory links, blockers, decisions, lessons, constraints, and next action.
3. Invoke [task-distillation](../task-distillation/SKILL.md) if new work, changed context, duplicate risk, or unresolved follow-up has appeared. Reuse existing issues and memory topics where applicable.
4. Invoke [production-readiness](../production-readiness/SKILL.md) only when all required issues are complete or when the user explicitly requests a readiness assessment. If required items remain blocked, record readiness as blocked and do not imply production readiness.
5. Run or verify the final project-wide relevant checks. Separate local, approved-browser, CI, and production evidence; do not substitute one for another.
6. Produce the batch rollup: discovered, completed, blocked, dependency-blocked, handed-off, and missing-terminal-status counts. Missing-terminal-status must be zero.
7. Confirm the exact next action for every non-completed issue and identify the verification boundary that prevents completion.
8. Run a follow-up audit: for every failed criterion, blocked command, or newly discovered defect, confirm its blocker class and that it is either covered by the current issue, linked to an existing/new issue, or explicitly classified as a non-actionable verification boundary. Record any issue-creation authorization gap and owner; no actionable work may remain only in the final narrative.

## PR and notification rule

Create or update a PR only if every issue intended for that PR has passing acceptance criteria, required checks, QA evidence, committed issue-scoped changes, reconciled memory/backlog links, and no required follow-up remains. If any issue is incomplete, leave the issue/PR state open and document the blockers. Do not close an issue merely because implementation exists.

## Required artifact

Return a self-contained completion report containing:

- project and manifest reference;
- per-issue terminal status and evidence links;
- final verification boundary;
- memory and backlog reconciliation;
- readiness result, when run;
- PR/issue state;
- exact next action for every remaining item.
- blocker triage and follow-up issue audit, including created, reused, pending-authorization, and non-actionable outcomes.
