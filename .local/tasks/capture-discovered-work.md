# Capture Newly Discovered Work

## What & Why

Implement the discovery gate described by GitHub issue #108 so actionable
issues found during a task cannot remain only in chat, an agent context, or
an unlinked note. This is backlog task 78.

## Done looks like

- Agents search the backlog, local task plans, and GitHub issues before
  creating a new item.
- Every new actionable out-of-scope issue gets a `PROPOSED` entry in
  `_docs/tasks.md` before unrelated work continues.
- Each proposed entry has a matching GitHub issue and cross-links, or
  explicitly records why issue creation is pending.
- The process distinguishes ordinary pending work from durable memory.
- The task template requires discovery-gate and reconciliation checks.
- Agents reconcile newly discovered issues before marking their current task
  complete.

## Out of scope

- Automatically implementing every newly discovered issue.
- Storing ordinary TODOs or task status in long-term memory.
- Creating duplicate tasks or mutating unrelated issues.

## Relevant files

- `AGENTS.md`
- `replit.md`
- `_docs/process.md`
- `_docs/task-template.md`
- `_docs/tasks.md`
- `.agents/memory/MEMORY.md`