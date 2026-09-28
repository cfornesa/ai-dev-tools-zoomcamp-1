## Goal

One or two sentences on what should be true when this is done.

## Acceptance criteria

- [ ] A statement you can check by looking at the result
- [ ] One line per case, including the awkward ones

## Regression-risk and restoration safeguard (required if any risk exists)

- **Regression risk:** Does this task touch, remove, relocate, or change the
  behavior of anything that already works? If none, state "None" and skip
  the rest of this section.
- **Restoration path:** If risk exists, the concrete mechanism that lets the
  prior behavior be restored without a code archaeology exercise — a
  feature flag, a reversible migration, the old path kept live behind a
  switch, or an equivalent. An issue with regression risk and no stated
  restoration path is not criterion-ready; do not move it past GROOMED.
- **QA restoration check:** The exact step QA takes to confirm the
  restoration path actually restores prior behavior, not just that the new
  behavior works.
- This task may not degrade or regress existing functionality without the
  owner's explicit, per-change permission (see `AGENTS.md` §13).

## Code-quality checklist (required if this issue touches code structure,
an accessible pattern, a security-relevant boundary, or a UI surface)

- **Applicable `CONVENTIONS.md` page(s):** Name which `docs/conventions/
  <topic>.md` page(s) govern this issue (python/typescript/react/
  html-css-vanilla-js/testing/dependencies/architecture/efficiency/
  accessibility/security/design-ux) and the specific section/rule.
- **Data-structure justification:** If this issue introduces or changes a
  data structure in a hot path, name the scale ceiling or benchmark it's
  justified against (e.g. `schema/limits.json`'s relevant cap, `docs/
  benchmarks.md`'s budget). If none apply, state "None."
- **Naming/organization conformance:** States whether new/moved code
  follows the applicable naming/file-pairing/colocation convention from the
  cited page(s).
- **New global/shared state:** If this issue adds module-level or
  cross-component state, states which category it falls under (document
  state vs. device/browser preference, per `docs/conventions/react.md`) and
  why.

## Out of scope

- Something that does not belong in this task, moved to #TASK-NUMBER

## Evidence and pending items

- **Milestone:** The GitHub milestone this issue is filed under (existing
  open one it's a follow-up to, or a newly created one — see
  `docs/process.md`'s "Milestone assignment" section for which). Never
  leave this unset once the issue is filed.
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

## Closed-issue rule

A closed issue stays closed. New contradictory evidence, an owner-visible
failure, or broader unmet parity becomes a new criterion-ready issue linked to
the closed issue for history. Reopening is allowed only when the owner
explicitly authorizes reopening that specific issue in the current
conversation; do not reuse its prior evidence or silently broaden its
contract.

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
- [ ] Assigned an existing open milestone (if this is a direct follow-up of
  work already in one) or created a new one (per `docs/process.md`); never
  left unmilestoned
- [ ] Reconciled newly discovered out-of-scope work before closing this task

## Constraints

- Files this should stay inside
- Libraries to use
- Guidelines to follow
