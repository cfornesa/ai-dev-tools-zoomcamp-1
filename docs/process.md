- Tasks are GitHub issues, one at a time
- Read the acceptance criteria before starting and before closing
- Commit regularly

Closure-ready atomicity (this is *issue-level* atomicity — one vertical
slice of work. *Code-level* atomicity — function/hook/module shape,
naming, state-scoping — is `CONVENTIONS.md`'s domain; the two are related
but distinct, don't conflate them.)

- An issue is atomic only when it has one named entry point or workflow, one
  fixed fixture/precondition, a finite observable acceptance checklist, exact
  verification commands, and one explicit evidence boundary.
- Do not use vague criteria such as “all permitted controls” or “where
  applicable.” Name the controls and record an explicit not-applicable result.
- If pass/fail requires another route, another deployment, or a parent-wide
  visual judgment, split the work or classify the dependency before starting.
- After QA, reconcile and close that issue immediately when every criterion
  passes. The parent remains a roll-up/reconciliation container.
- Record local implementation and deployed verification separately. A passing
  local or disposable-stack test cannot be reported as live parity. When a
  user-supplied URL contradicts the checkout, keep the affected deployed
  route/artifact and parent release gate open until the exact published
  revision is inspected; record the asset/revision and URL as evidence.
- A shared control component is not consumer evidence. For every route,
  inspect the actual rendered consumer for compact inner-toolbar geometry,
  stage containment, named controls, and that route's privacy/publication
  boundary. A local implementation commit, source-string match, or another
  route's browser pass cannot close the consumer route.
- A current owner-visible failure is new follow-up evidence after a prior
  closure. It does not retroactively invalidate the prior issue's scoped
  contract or closure evidence. Inspect the exact route, fixture, viewport,
  browser state, and deployed asset; classify the report as reproduced, not
  reproduced, or a verification boundary, and create/link new work when
  actionable. Never call a historical closure false or reopen it without the
  owner's explicit authorization naming that issue.

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
4. **Never implement a newly discovered/proposed item in the same session
   that discovered it (owner-mandated, 2026-09-28).** File it — `PROPOSED`,
   milestone-assigned per "Milestone assignment" below, linked from the
   current issue's ledger — and stop there. Continue only with issues that
   were already open and groomed before this session began. This applies
   regardless of how small, obvious, or low-risk the newly found item looks;
   there is no judgment-call exception. A prior session implementing
   same-session discoveries immediately produced wasted tokens, broken
   existing functionality, and inconsistent, unreviewed implementation
   choices — the fix is procedural, not a matter of being more careful next
   time. This rule binds every session and every substituted service
   (Codex, Opencode, Ollama Cloud, or Claude) equally; a handoff prompt may
   restate it, but may not loosen it.
5. Before marking the current task complete, repeat the search for newly
   discovered actionable items and reconcile every item — "reconcile" means
   confirmed filed-and-deferred per rule 4 above, or explicitly classified
   non-actionable; it does not mean implemented.
6. When all intended tasks for a session are sufficiently complete, commit the changes as a single pull request, aptly named given the context of each session.

### Milestone assignment (owner rule, 2026-09-27)

Every GitHub issue is assigned a milestone at filing time — never left
unmilestoned. This exists so the backlog stays navigable as it grows (see
`docs/tasks-index.md`); it is metadata only and never changes an issue's
content, criteria, or evidence.

**Reuse the current open milestone** when the new issue is a direct
follow-up, discovered sub-scope, or split-out of an issue already in that
milestone, **and** that milestone is still open (its batch hasn't been
reconciled/closed out yet). This is the common case: most issues discovered
mid-transaction (the "independent actionable gap" case above) belong in the
milestone of the work that surfaced them.

**Create a new milestone** when any of these hold:

- A task-distillation pass is starting a new backlog batch with no natural
  open-milestone parent (a fresh review, a new feature stream, a new audit).
- The most recent milestone has already been closed out by session-completion
  (see below) — do not reopen a closed milestone or add issues to it; that
  mirrors the closed-issue-immutability rule above. Start the next one
  instead.
- The current open milestone has grown past roughly 150 issues — split
  rather than let one milestone balloon past what a milestone view can
  usefully summarize.

**Naming convention:** `Batch N: <short theme> (<date or date range>)`,
numbered sequentially from whatever the highest existing batch number is
(retroactive history starts at Batch 1; do not renumber it). The description
states the issue-number range and a few representative titles.

**Who does this:**

- `task-distillation` decides and applies the milestone when filing an issue
  during discovery/grooming (create the milestone first if none fits).
- `backlog-session` applies the same rule for an issue discovered and filed
  mid-transaction; it never leaves a newly filed issue unmilestoned.
- `session-completion` decides, at batch rollup, whether every issue in a
  milestone has reached a terminal status; if so, it marks that milestone
  closed and records the decision. A milestone with any non-terminal issue
  stays open.
- Add or update the corresponding row in `docs/tasks-index.md` when a
  milestone is created or closed — that file is the human-facing index; it
  is not a substitute for setting the milestone field on the issue itself.

### Where each item belongs

| Item | Canonical markdown location | What to store |
| --- | --- | --- |
| Pending implementation or verification work | `docs/tasks.md` and `docs/task-template.md` | Goal, acceptance criteria, status, evidence, and next action |
| Task-specific execution plan | `.local/tasks/<slug>.md` | Steps and constraints for the current task |
| Durable unresolved constraint or blocker | `.agents/memory/<topic>.md` plus `MEMORY.md` | Rule, why it matters, and how to apply it |
| Agent-wide entry point | `AGENTS.md` | How agents discover and use the loop |
| Replit-specific operating reminder | `replit.md` | Short pointer to the canonical loop and environment boundaries |

## Canonical issue transaction and anti-loop rules

The project has one normal direction of travel:

`distillation → grooming → engineering → testing/QA → reconciliation → GitHub closure`

Distillation and grooming may be batched. Engineering and testing/QA may not:
they are one transaction for one issue, and the next issue is not selected
until the current issue is closed or has a documented terminal blocked,
dependency-blocked, or handed-off status.

At the start of a transaction, create a ledger entry containing the issue,
fixed entry point/fixture, finite criteria, dependencies, evidence boundary,
and exact checks. During engineering, each discovered item is classified before
work continues:

- in-scope criterion failure: fix within the current issue and rerun its checks;
- independent actionable gap: reuse or create a criterion-ready issue and link
  it, without expanding the current issue;
- blocker: record class, owner/context, exact failed command/evidence, and next
  action; skip only dependent issues;
- non-actionable or verification boundary: record the reason and the required
  external evidence.

The final reconciliation is a required state transition, not a summary. It
must record the commit, focused/full results, QA matrix, evidence location,
backlog status, memory links, GitHub comment, and close action. “Implemented,”
“tests pass,” “published,” and “QA PASS” are intermediate states.

Production-readiness runs after the child transactions as an assessment. It
does not start a hidden repair loop. It creates or links follow-up work when a
finding is outside a child contract. Closed issues remain closed by default;
reopening is allowed only when the owner explicitly authorizes reopening that
specific issue in the current conversation. Without that authorization, later
contradictory evidence becomes a new criterion-ready task, linked to the
closed issue for history. The same issue must never alternate between open and
closed as a substitute for backlog distillation.

Before selecting the next issue, the orchestrator must answer “closed or
terminally handed off?” for the current ledger entry. If the answer is no, it
must continue that issue or record its blocker; it may not advance merely to
make progress appear elsewhere.

### The three non-closed terminal statuses

An issue that isn't closed must carry exactly one of three terminal
statuses, recorded in its blocker-class field. These are easy to collapse
into two if only "handed-off" and "dependency-blocked" are kept in mind —
that gap previously caused an otherwise careful backlog summary to silently
drop every plain owner-decision issue from its accounting (2026-09-28). All
three are distinct and none subsumes another:

- **Handed-off**: the work itself isn't scoped yet. No child issue exists,
  and none can be drafted with finite acceptance criteria until further
  decomposition, design, or child-issue creation happens. A tracking/rollup
  parent whose children are still open is also handed-off. Next action:
  scope children (see `issue-scoping`), or close the parent once every
  child it tracks is closed.
- **Dependency-blocked**: a concrete implementation already exists — the
  issue itself is criterion-ready — but a named upstream issue, contract, or
  system must reach a terminal state first. Next action: work the named
  upstream issue; this issue becomes actionable automatically once it
  closes. Never leave the upstream reference vague ("the media contract")
  when a specific issue number is known — cite it.
- **Owner-decision blocked**: the issue is criterion-ready except for one
  fact only the repository owner can supply — an architectural/visual-
  identity choice among stated options, an irreversible-decision-table item,
  a production-data action, or a live credential/authorization only the
  owner holds. Nothing about the codebase or another issue is missing; the
  blocker is a decision or an action that must originate from the owner in
  chat, not from further engineering. Next action: present the options (or
  the exact step) and get the owner's answer; many of these issues are
  themselves scoped to "closes on decision + doc, not code," with the
  actual implementation filed as a separate follow-up once the owner picks.

## Scope-shifted completion

### CMS pieces parity boundary

The overarching parity goal is limited to the PHP repository's **pieces
implementation** as a behavioral/design reference and this Django/Python
backend plus React/TypeScript frontend's ability to create, render, publish,
embed, immerse, and package pieces like the maintained examples/fixtures. PHP
is never implemented in this repository. It does not require parity with
unrelated augment-humankind CMS features such as blog, collections, site
administration, or other content types. Every task must state which pieces
surface or workflow it covers.

Completion is evaluated against the current issue's contract, not against the
entire parent feature. If engineering or QA finds route-specific, deployment,
artifact, or production-readiness work outside that contract, grooming must
shift it to a linked criterion-ready issue before reconciliation. The current
issue may then close as `completed` when every remaining in-scope criterion
passes. Its closure matrix must contain two explicit sections:

- `Implemented/verified here` — finite criteria, checks, and evidence that
  justify closure;
- `Shifted to linked work` — each unfinished/unverified portion, issue link,
  dependency, owner, and next action.

This rule prevents both dishonest broad closures and needless reopen cycles.
A linked follow-up's failure creates or updates the follow-up task; it does not
reopen the completed parent/child unless the owner explicitly authorizes that
specific reopening.

### Closure evidence when GitHub comment tooling is unavailable

If the issue-comment connector cannot safely target an issue, do not retry it
through a pull-request or other indirect API. Record the complete evidence
matrix in the local task ledger and use the correctly typed GitHub issue update
operation for the final state transition. The issue remains permanently closed
once its finite contract passes; any later gap is a new linked issue.
