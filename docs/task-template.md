## Goal

One or two sentences on what should be true when this is done.

## Acceptance criteria

- [ ] A statement you can check by looking at the result
- [ ] One line per case, including the awkward ones

## Out of scope

- Something that does not belong in this task, moved to #TASK-NUMBER

## Evidence and pending items

- **Status:** PROPOSED | ACTIVE | COMPLETE
- **Evidence so far:** What has been observed or verified
- **Pending verification:** The exact check that remains, if any
- **Next action:** The smallest safe step that advances or closes the task
- **Durable memory link:** Link only when this task depends on a non-obvious
  reusable constraint recorded in `.agents/memory/`

## Transaction ledger

- **Phase:** DISTILL | GROOMED | ENGINEERING | QA | RECONCILIATION | CLOSED |
  BLOCKED | DEPENDENCY-BLOCKED | HANDED-OFF
- **Issue owner / current transaction:** One issue only; do not begin another
  issue before this entry reaches a terminal status
- **Implementation commit:** Required before QA advances
- **Focused checks / full checks:** Exact commands and results
- **QA matrix:** Criterion-by-criterion PASS/FAIL with route, fixture,
  viewport, browser state, and published revision where applicable
- **GitHub closure evidence:** Comment URL/ID and close timestamp, or blocker
  status/owner/next action
- **New gaps discovered:** In-scope fix, linked follow-up issue, blocker, or
  non-actionable classification; no unresolved item may remain only in chat

## Reopen rule

A closed issue may be reopened only for new contradictory evidence against its
own fixed contract. Record the exact contradiction and one next action; do not
reuse the prior PASS matrix, broaden the issue, or reopen solely because a
parent or sibling issue is incomplete.

## Scope-shift record before closure

- **Implemented/verified in this issue:** The finite criteria and evidence that
  justify `COMPLETE`.
- **Shifted out of scope:** Every unimplemented or unverified portion, linked
  issue, dependency, owner, and next action. Do not leave this as “remaining
  work” without an issue link.
- **Closure decision:** `COMPLETE` only for the narrowed contract; parent,
  route, deployment, artifact, or readiness status is recorded separately.

## Discovery gate

- [ ] Searched `docs/tasks.md`, `.local/tasks/`, and existing GitHub issues
  for a duplicate
- [ ] Added the matching GitHub issue link, or recorded why issue creation is
  still pending
- [ ] Reconciled newly discovered out-of-scope work before closing this task

## Constraints

- Files this should stay inside
- Libraries to use
- Guidelines to follow
