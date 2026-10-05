- Tasks are atomic GitHub issues; implementation and QA run in session batches whose impact analysis covers all open issues ("Canonical batch transaction" below)
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
- Distillation and grooming are batched across the complete backlog and issues
  stay atomic. Engineering and QA then run as a batch over the session's ready
  set: one issue-scoped commit per issue, then a single batch gate (union of
  focused checks, full suite, impact-matrix re-verification, cross-issue
  review) before any issue in the batch closes. See "Canonical batch
  transaction" below for the single-issue exceptions.
- The handoff must name the ordered batch (and waves, if any) of groomed
  issues and include the complete
  manifest, duplicate/already-covered report, dependency order, blocker
  triage, verification boundaries, and a closure contract for every
  actionable item. If any criterion is still broad, subjective, route-spanning,
  or dependent on an unprovisioned environment, the work remains in
  distillation/blocked status.
- Backlog-session may implement only the issues named in the batch manifest. A test failure found
  while distilling or grooming is captured and classified first; it is not an
  implicit authorization to fix it.
- A blocked issue is not a session or goal stop. Record its blocker class,
  owner/context, exact next action, and dependency edge, then skip only issues
  that depend on it and select the next independent closure-ready issue. Halt
  the goal only when no independent actionable work remains or every remaining
  issue requires the same unavailable external state.
- If the blocker is a dependency or environment problem unrelated to the user's
  judgment or decision, complete a fresh task-distillation reconciliation at
  the end of the batch (or wave) before selecting the next batch. Recheck duplicates,
  dependency order, closure criteria, ownership, and follow-up issue coverage;
  record the result before continuing.

Roles

- PM - grooms a task before anyone implements it, follows docs/team/pm.md
- Engineer - implements one groomed task, follows docs/team/software-engineer.md
- QA - checks the result against the acceptance criteria, follows docs/team/qa-engineer.md

### Live-QA prompt guideline

Prompts used for live generation-quality checks should read like something a
person could plausibly type: human-style, well-specified, and demanding enough
to exercise the intended behavior. State the visible outcome and the important
constraints, but do not paste implementation code, dictate literal function or
keyword names, or forbid JavaScript when the behavior naturally needs it. The
rubric should inspect observable behavior (for example, renders, animates,
toggles, blends, or derives a value at runtime) and may use source inspection
only to confirm the mechanism that cannot be established visually.


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
4. **Separation of duties (owner-mandated 2026-09-28; reworded 2026-09-30).**
   An issue must not be scoped or distilled and then implemented by the same
   agent in the same run. Distillation, scoping, review, QA, and readiness
   runs are unrestricted: they may file issues (`PROPOSED`, milestone-assigned
   per "Milestone assignment" below, linked from the current issue's ledger)
   and are not blocked by this rule. An issue filed in one run may be
   implemented in that run only by a *different* agent or service, recorded in
   the per-issue provenance line (`docs/proposals/dispatch-dual-track-2026-09-30.md`).
   The owner may waive this for named issues; every waiver is logged in
   `DECISIONS.md`. The original rationale stands: same-agent, same-run
   implementation of its own discoveries produced wasted tokens, broken
   existing functionality, and unreviewed implementation choices. This
   binds every agent and substituted service (Codex, Opencode, Ollama Cloud,
   or Claude) equally; a handoff prompt may restate it, but may not loosen it.
5. Before marking the current task complete, repeat the search for newly
   discovered actionable items and reconcile every item — "reconcile" means
   confirmed filed and either deferred or handed to a different implementing agent per rule 4 above, or explicitly classified
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

**Session batches and milestones:** implementation/QA batches are formed per
session regardless of milestone (see "Canonical batch transaction"); the
milestone is recorded per issue in the batch manifest and does not bound a
batch.

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

## Canonical batch transaction and anti-loop rules

*Owner-mandated 2026-10-01.* Issues are always created and groomed atomically.
Implementation and QA, however, run in **batches by default**, the same way
production-readiness and session-completion already do. Closing each issue on
only its own criteria repeatedly left later work colliding with, invalidating,
or leaving gaps against other open issues, which produced a chain of
follow-up issues. A batch considers the ramifications of every code addition,
change and deletion on **all open issues**, not only the one being worked.

**Terminology:** a *session batch* (this section) is the set of issues implemented
and QA'd together in one backlog session. It is unrelated to the milestone
naming convention `Batch N: <theme>` (a historical label for a milestone;
see "Milestone assignment"). A session batch may span several milestones,
and a milestone may be worked across several session batches.

The project has one normal direction of travel:

`distillation → grooming → impact analysis → engineering (ordered, one commit per issue) → batch gate (QA) → reconciliation → GitHub closure`

### Batch formation and milestone awareness

- A batch is the **session's ready set**: every closure-ready open issue for
  the project at session start, ordered by dependency, then backlog order,
  then priority. Dependency-blocked and owner-decision-pending issues are
  listed and skipped, never silently dropped.
- Batches are formed **per session regardless of milestone**; a batch may span
  milestones. Milestone awareness is built in: the manifest records each
  issue's milestone, ordering ties break by oldest milestone, and a milestone
  is closed only by the session-completion pass once all its issues are
  terminal (see "Milestone assignment" above).
- There is no fixed size cap. When the set is large, or an issue's acceptance
  depends on a sibling's merged behavior, the orchestrator may split it into
  **waves**. Every wave runs the full batch gate; session-completion covers
  all waves.

### Batch impact analysis (mandatory)

Built in the PM pass before any code and kept current by the engineer pass:

| Change (file / selector / route / API / schema / spec / fixture / helper) | Kind | Issue(s) in batch | Open issues that reference it (in or out of the batch) | Collision / invalidation? | Required re-verification |
| --- | --- | --- | --- | --- | --- |

1. Search every surface an issue will touch against **all** open issues: the
   GitHub open list, `docs/tasks.md`, and `rg` on paths, selectors and routes
   in issue bodies. Record the hits.
2. Resolve collisions and invalidated premises in the PM pass: reorder,
   deliver in one commit series by one implementer, amend a criterion by
   comment, or file a linked atomic issue. Two issues that edit the same CSS
   region, helper, fixture or route are delivered serially by one implementer.
3. For every deletion or rename, list every consumer (including specs and
   fixtures).
4. While engineering, add any newly touched shared surface to the matrix
   immediately, naming the affected open issues. Link the matrix from each
   affected issue.

### Batch gate and closure

After the batch's commits are complete, QA runs once over the batch:

1. each issue's own criterion matrix and `## QA` comment (format unchanged);
2. the union of every issue's focused commands;
3. the full required suite (`make check`) once, plus the browser/integration
   suites the criteria name;
4. every impact-matrix row re-verified, or recorded as "not affected" with the
   search evidence — including open issues outside the batch;
   global-shell CSS edits also rerun `contentPanelShadow.spec.ts`,
   `responsiveShell.spec.ts`, `headerMobile.spec.ts`, `publicShell.spec.ts`, and
   `accountShell.spec.ts`;
5. a cross-issue review that no issue's criteria were made false or
   unreachable by a sibling's change;
6. rendered evidence at the named viewports where criteria require it.

Closure follows the gate: **an issue closes only after the batch gate passes.**
A failing issue, and every issue that depends on it, stays open and returns to
engineering inside the batch; independent passing issues close once the gate
is green. A suite or matrix failure is classified before any issue closes; an
unattributable failure holds the whole batch. Each issue keeps its own commit
(its revert is its restoration path), criterion matrix, QA comment, and
provenance record.

### Exceptions

A single-issue transaction is allowed only with the reason recorded in the
ledger: a production-down hotfix; an issue whose impact matrix shows no
overlap with any other open issue and whose environment cannot be shared with
the rest of the batch; an explicit owner request; or an environment boundary
that makes a batch gate impossible.

### Ledger and discovery

At the start of a batch, create a **batch ledger** (`docs/task-template.md`):
the ordered issues with milestone and wave, fixed entry points/fixtures,
finite criteria, dependencies, evidence boundaries, exact checks, and the
impact matrix. During engineering, each discovered item is classified before
work continues:

- in-scope criterion failure: fix within the current issue and rerun its checks;
- independent actionable gap: reuse or create a criterion-ready issue and link
  it, without expanding the current issue (rule 4 of the Discovery gate still
  applies);
- blocker: record class, owner/context, exact failed command/evidence, and next
  action; skip only dependent issues;
- non-actionable or verification boundary: record the reason and the required
  external evidence.

The final reconciliation is a required state transition, not a summary. It
must record each issue's commit, focused results, the batch's full-suite and
matrix results, QA matrices, evidence location, backlog status, memory links,
GitHub comment, and close action. “Implemented,” “tests pass,” “published,”
and “QA PASS” are intermediate states.

Production-readiness runs after the batch gate(s) as an assessment. It
does not start a hidden repair loop. It creates or links follow-up work when a
finding is outside a child contract. Closed issues remain closed by default;
reopening is allowed only when the owner explicitly authorizes reopening that
specific issue in the current conversation. Without that authorization, later
contradictory evidence becomes a new criterion-ready task, linked to the
closed issue for history. The same issue must never alternate between open and
closed as a substitute for backlog distillation.

Before ending a batch or wave, the orchestrator must answer “closed or
terminally handed off?” for every ledger row. If the answer is no for any row,
it must continue that issue or record its blocker; it may not end the batch
merely to make progress appear elsewhere.

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

#### Recorded-decision check (owner rule, 2026-09-29)

Before marking any issue owner-decision blocked, search memory
(`.agents/memory/`), `docs/api.md`/`docs/plan.md`, and the linked issues for a
decision the owner already recorded. If one exists, apply it, cite the source
in the issue, name a rollback (usually `git revert` of the single commit), and
proceed; do not re-ask. Only a genuinely undecided contract gets a hold, and
every hold must state a recommended default so the owner can answer in one
word. Origin: #1067 sat blocked although #886 had already chosen export-only.

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

## CI tiers and E2E suite standards (owner-decided 2026-10-03)

Evidence behind this section (run #1126 against run #1112, `docs/ci-failure-map-run1126.md`): the 16-shard browser matrix runs only on `workflow_dispatch` and the weekday schedule; `main` had no branch protection and no green run in the last 100 runs; 108 of ~111 failing tests failed identically in two consecutive full runs (deterministic, stale contracts, not flaky); 192 of 241 specs are per-issue acceptance probes. A permanently red advisory run must not block merging or other work.

### CI tiers
| Tier | What | Blocks |
|---|---|---|
| 1. PR gate | `Workflow validation`, `Backend checks`, `Frontend checks`, and `Browser acceptance E2E (shard 1)` (on pull requests: the 7-spec core smoke suite, 3 public-media specs, the WebKit fullscreen regression) | **Merging** (required status checks on `main`, owner action #1192) |
| 2. Full matrix | 16 isolated shards on `workflow_dispatch` and the weekday schedule, reported through the **known-failure ratchet** (#1190) | Nothing by itself. Fails only on a **new** failure, on a baseline entry that now passes, or on an expired entry |
| 3. Release | A production publish needs a ratchet-clean full run on the exact commit plus `scripts/smoke-published.sh` | **Replit publishes** |

Ratchet rules: the baseline (`frontend/e2e/known-failures.json`) lists each currently failing test with an owner issue and an expiry (21 days; 7 for security or authorization checks); no test is skipped, `fixme`'d, edited or weakened to make a run green; the commit that fixes a child issue removes its baseline entries; an entry without an issue or past its expiry fails the run. A child issue's closure evidence is a matrix run in which its entries are gone and its specs pass. The tracker (#1096) closes when every child is closed or baselined with an owner and expiry.

### E2E authoring and maintenance standards
1. **Test a journey or a current contract, not an issue.** Name specs by feature; an issue number may appear in a comment, not as the identity. A new E2E spec needs a user journey that unit or component tests cannot cover.
2. **Selectors go through shared helpers** (`frontend/e2e/support/`: `createServerProject2D/3D`, `openPieceControlsMenu`, the scene-Save helper, the Ask AI panel helper). A spec must not re-derive a locator that a helper owns. See the [E2E support helper reference](../frontend/e2e/support/README.md) for contracts, recipes, and stale patterns.
3. **No unexplained magic numbers.** Pixel counts, script counts, exact ratios and copy strings need a stated rationale and tolerance next to the assertion, or an allowlist of identified items (for example script ids) instead of a bare count.
4. **UI changes run an E2E impact search.** Any change that renames an accessible name, moves a control, changes a route or alters layout runs `rg` over `frontend/e2e` for the old name/route/selector in the batch impact analysis ("Canonical batch transaction") and updates the specs in the same batch.
5. **Fail fast.** Do not rely on the default test timeout to detect a missing control (#1191); per-call timeouts above the config default carry a comment with the reason.
6. **Baselines are debt with a clock.** A baseline entry names its owner issue and expiry; extending an expiry needs a comment on the issue.
7. **The suite is audited, not just run.** `docs/e2e-suite-audit.md` classifies every spec (core journey, current contract, geometry/pixel probe, export/security audit, obsolete, duplicate of lower-level coverage); retirements need the owner's approval.
