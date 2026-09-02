- Tasks are GitHub issues, one at a time
- Read the acceptance criteria before starting and before closing
- Commit regularly

Closure-ready atomicity

- An issue is atomic only when it has one named entry point or workflow, one
  fixed fixture/precondition, a finite observable acceptance checklist, exact
  verification commands, and one explicit evidence boundary.
- Do not use vague criteria such as “all permitted controls” or “where
  applicable.” Name the controls and record an explicit not-applicable result.
- If pass/fail requires another route, another deployment, or a parent-wide
  visual judgment, split the work or classify the dependency before starting.
- After QA, reconcile and close that issue immediately when every criterion
  passes. The parent remains a roll-up/reconciliation container.

Phase gate

- Task distillation is completed before backlog-session engineering starts.
  Distillation may inspect failures and write backlog, issue, manifest, and
  durable-memory records, but it must not change product source or product
  tests to make an observed failure pass.
- Distillation and grooming may be batched across the complete backlog. Once
  engineering starts, work is transactional per issue: implementation,
  focused tests, required full checks, browser QA, reconciliation, and the
  issue status decision for issue N must finish before issue N+1 begins.
- The handoff must name exactly one next groomed issue and include the complete
  manifest, duplicate/already-covered report, dependency order, blocker
  triage, verification boundaries, and a closure contract for every
  actionable item. If any criterion is still broad, subjective, route-spanning,
  or dependent on an unprovisioned environment, the work remains in
  distillation/blocked status.
- Backlog-session may implement only the named issue. A test failure found
  while distilling or grooming is captured and classified first; it is not an
  implicit authorization to fix it.
- A blocked issue is not a session or goal stop. Record its blocker class,
  owner/context, exact next action, and dependency edge, then skip only issues
  that depend on it and select the next independent closure-ready issue. Halt
  the goal only when no independent actionable work remains or every remaining
  issue requires the same unavailable external state.
- If the blocker is a dependency or environment problem unrelated to the user's
  judgment or decision, complete a fresh task-distillation reconciliation at
  the end of that issue before selecting the next issue. Recheck duplicates,
  dependency order, closure criteria, ownership, and follow-up issue coverage;
  record the result before continuing.

Roles

- PM - grooms a task before anyone implements it, follows docs/team/pm.md
- Engineer - implements one groomed task, follows docs/team/software-engineer.md
- QA - checks the result against the acceptance criteria, follows docs/team/qa-engineer.md


Orchestrator

The main session is the orchestrator. It launches the PM, the engineer
and QA as subagents. It does not groom, implement or test itself.

Lifecycle

1. Pick the next open issue from the backlog
2. PM grooms it
3. Engineer implements it
4. QA verifies it
5. On FAIL, back to step 3 with the QA comment as input
6. On PASS, close the issue. Do NOT proceed until the issue can be closed.

Task completion equals task closure. Code merged, tests passing, or a QA PASS
are intermediate gates; the task is complete only after the orchestrator
reconciles the checklist, evidence, backlog, and GitHub state and closes the
issue. Blocked or handed-off work stays open with an explicit terminal status,
owner, blocker class, and next action.
7. Repeat until the backlog is empty OR the specified task is complete. If an
   issue is blocked, reconcile its handoff and continue with the next
   independent closure-ready issue; do not treat the blocker as a reason to
   abandon the goal.

Rules

- Do not skip step 2
- The engineer does not close the issue
- QA does not fix the code, only outputs PASS or FAIL
- The orchestrator closes the issue only after QA outputs PASS

## Loop engineering principles

- **Single source of truth:** Track actionable pending work in `docs/tasks.md`
  and the associated task file or issue. Track durable lessons in
  `.agents/memory/`; do not maintain a second task list in memory.
- **Classify before recording:** Every unresolved item must be classified as
  an action, a decision, a blocker, a verification boundary, or a lesson.
  Actions go to the backlog; durable constraints and lessons go to memory.
- **Evidence before state changes:** A task moves from PROPOSED to ACTIVE or
  COMPLETE only when the stated evidence supports that transition. Record
  verification boundaries when a check cannot run in the current environment.
- **Close the loop:** Before finishing a work session, reconcile code,
  tests, task status, issue status, and memory. No pending item should exist
  only in chat or in an agent's working context.
- **Idempotent updates:** Re-reading or re-running the capture process should
  update an existing task or memory topic rather than create duplicates.
- **Fail closed:** Uncertainty around credentials, production data, branch
  history, schema ownership, or destructive actions must produce a safe stop
  and explicit next step—not a silent fallback or overwrite.
- **Separate implementation from learning:** Memory records why a decision
  matters and how to apply it later; it does not record routine commits,
  temporary TODOs, test counts, or details recoverable from the source tree.

## Pending-item capture loop

Use this loop whenever work reveals something incomplete or uncertain:

1. **Capture immediately:** Write the item down before changing context.
2. **Apply the discovery gate:** If the item is actionable and outside the
   current scope, stop unrelated implementation and create a proposed
   backlog task before continuing. The task must have a goal, description,
   status, acceptance criteria, and next action.
3. **Classify it:** Put ordinary work, follow-up behavior, and acceptance
   criteria in `docs/tasks.md`; put a durable constraint, unresolved
   platform behavior, or reusable lesson in a linked
   `.agents/memory/<topic>.md`.
4. **Add evidence:** State what was observed, what remains unverified, and
   what result would resolve the uncertainty. Never store a secret as
   evidence.
5. **Link the surfaces:** A task may link to a memory topic when the task
   depends on that lesson. The memory index must link to the topic, not to
   conversation-local identifiers.
6. **Reconcile before exit:** Update the task status and acceptance checklist,
   merge duplicate memory entries, and leave a clear next action if the work
   cannot close.

### Discovery gate

For every new actionable issue found during exploration, implementation, QA,
or review:

1. Search `docs/tasks.md`, `.local/tasks/`, and the GitHub issue list for an
   existing equivalent before creating anything.
2. If no equivalent exists, add a `PROPOSED` entry to `docs/tasks.md` and
   create a matching GitHub issue when repository access is available.
3. Put the issue link in the backlog entry and the backlog/task reference in
   the issue body. If issue creation is unavailable, record that pending
   linkage explicitly; never silently discard it.
4. Only then decide whether to implement the item now, defer it, or return
   it to the user for prioritization.
5. Before marking the current task complete, repeat the search for newly
   discovered actionable items and reconcile every item.
6. When all intended tasks for a session are sufficiently complete, commit the changes as a single pull request, aptly named given the context of each session.

### Where each item belongs

| Item | Canonical markdown location | What to store |
| --- | --- | --- |
| Pending implementation or verification work | `docs/tasks.md` and `docs/task-template.md` | Goal, acceptance criteria, status, evidence, and next action |
| Task-specific execution plan | `.local/tasks/<slug>.md` | Steps and constraints for the current task |
| Durable unresolved constraint or blocker | `.agents/memory/<topic>.md` plus `MEMORY.md` | Rule, why it matters, and how to apply it |
| Agent-wide entry point | `AGENTS.md` | How agents discover and use the loop |
| Replit-specific operating reminder | `replit.md` | Short pointer to the canonical loop and environment boundaries |
