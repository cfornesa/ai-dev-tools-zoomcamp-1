- Tasks are GitHub issues, one at a time
- Read the acceptance criteria before starting and before closing
- Commit regularly

Roles

- PM - grooms a task before anyone implements it, follows _docs/team/pm.md
- Engineer - implements one groomed task, follows _docs/team/software-engineer.md
- QA - checks the result against the acceptance criteria, follows _docs/team/qa-engineer.md


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
7. Repeat until the backlog is empty OR the specified task is complete.

Rules

- Do not skip step 2
- The engineer does not close the issue
- QA does not fix the code, only outputs PASS or FAIL
- The orchestrator closes the issue only after QA outputs PASS

## Loop engineering principles

- **Single source of truth:** Track actionable pending work in `_docs/tasks.md`
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
2. **Classify it:** Put ordinary work, follow-up behavior, and acceptance
   criteria in `_docs/tasks.md`; put a durable constraint, unresolved
   platform behavior, or reusable lesson in a linked
   `.agents/memory/<topic>.md`.
3. **Add evidence:** State what was observed, what remains unverified, and
   what result would resolve the uncertainty. Never store a secret as
   evidence.
4. **Link the surfaces:** A task may link to a memory topic when the task
   depends on that lesson. The memory index must link to the topic, not to
   conversation-local identifiers.
5. **Reconcile before exit:** Update the task status and acceptance checklist,
   merge duplicate memory entries, and leave a clear next action if the work
   cannot close.

### Where each item belongs

| Item | Canonical markdown location | What to store |
| --- | --- | --- |
| Pending implementation or verification work | `_docs/tasks.md` and `_docs/task-template.md` | Goal, acceptance criteria, status, evidence, and next action |
| Task-specific execution plan | `.local/tasks/<slug>.md` | Steps and constraints for the current task |
| Durable unresolved constraint or blocker | `.agents/memory/<topic>.md` plus `MEMORY.md` | Rule, why it matters, and how to apply it |
| Agent-wide entry point | `AGENTS.md` | How agents discover and use the loop |
| Replit-specific operating reminder | `replit.md` | Short pointer to the canonical loop and environment boundaries |