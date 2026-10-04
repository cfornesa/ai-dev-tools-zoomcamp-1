---
name: backlog-session
description: Process the open backlog of one project as a session batch — atomic issues, batched implementation and QA, an impact analysis across all open issues, and explicit reconciliation, evidence, and handoff gates.
---

# Backlog session

Use this skill when the user asks to work through a project backlog and its GitHub issues. A session is a complete run for one project: discover every remaining open backlog issue, process the ready set as a **batch** in dependency order, and leave every issue with a terminal status. Never claim the project batch is complete when a required gate was skipped.

**Issues are atomic; implementation and QA are batched (owner-mandated, 2026-10-01).** Each issue is still created, groomed and committed as one closure-sized slice. But engineering and QA run over the whole ready set of the session, with an impact analysis that considers every code addition, change and deletion against **all open issues** — not only the issue being worked. The earlier per-issue transaction closed issues against only their own criteria, and later work then collided with, invalidated, or left gaps against other open issues. The batch gate exists to catch that before closure, the same way production-readiness and session-completion already operate on the whole batch. The canonical statement is `docs/process.md` ("Canonical batch transaction").

## Batch ledger (mandatory)

Maintain one **batch record** and one row per issue. The batch record carries: batch id (session date plus project), wave number (waves are optional, see "Batch formation"), the ordered issue list with each issue's **milestone**, the impact matrix link, the batch gate result, and the environment/fixtures used.

Each issue row has exactly one state:

`GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`

or

`GROOMED → ENGINEERING/QA → BLOCKED|DEPENDENCY-BLOCKED|HANDED-OFF`.

The row contains the issue number, milestone, commit, focused checks, QA result, evidence boundary, GitHub comment, final status, and, for every stage, the stage owner actually used (`service / model / effort`) plus a `substituted: yes|no` flag when Claude ran a stage rostered to another service. See "Multi-service stage routing" below. The batch record additionally carries the full-suite result and the impact-matrix result. The orchestrator ends a batch (or wave) only after **every** row is `CLOSED` or in a documented terminal blocked/handoff state. A code commit, green focused test, QA PASS on one issue, or deployment publication is never itself a terminal state, and no issue closes before the batch gate has passed.

New work discovered during engineering or the batch gate is handled before the batch ends:
classify it as in-scope (fix and retest this issue) or out-of-scope (reuse or
create/link a criterion-ready issue, record the dependency, and keep the
current issue's own finite criteria separate). Do not absorb an unrelated gap
into the current issue and do not create a cosmetic duplicate solely to make
the issue count larger. An out-of-scope item that gets filed this way is
never implemented in this same session — see `docs/process.md`'s Discovery
gate rule 4; file it, milestone it, link it, and move on.

Production-readiness is a post-child assessment. It may classify missing
evidence or create/link follow-up issues, but it never reopens or re-engineers
a closed child. Any later failure, including a failure of the broader parity
goal, becomes a new criterion-ready issue linked to the closed child.

An issue's completion is scoped completion, not parent-feature completion.
When implementation reveals route, deployment, artifact, or readiness work
that is not part of the current contract, the PM must shift it to a linked
criterion-ready issue before reconciliation. The current issue may then close
as `completed` once all of its narrowed criteria pass, provided the closure
matrix separately lists the shifted work and its next issue. Do not reopen the
completed issue merely because that linked work is unfinished.

## Supported execution profiles

This orchestration task is platform-portable. The recommended default is
Claude Sonnet at Medium effort. It is also expected to work as a first-class
dispatch with Codex Luna at Medium, Antigravity Gemini 3.8 Flash, or
Antigravity's Sonnet implementation.

Choosing one of these supported profiles is not a substitution. Record the
actual platform, model, and effort in the session provenance, then apply the
same ledger, handoff, and completion requirements without weakening them for a
faster model. The Luna restriction on the separate `issue-scoping` stage does
not apply to this orchestration task.

## Multi-service stage routing

This skill is the loop **orchestrator**. It owns the transaction ledger, the
manifest, dependency order, reconciliation, and the completion gate. It does
not own the stage bodies: each stage is a separate document, listed with its
rostered owner in `.agents/skills/_shared/HANDOFF-CONTRACT.md`. Read that file
once per session — the stage map, the advisory-routing rule, the provenance
record format, the per-stage handoff artifacts, and the untrusted-external-
input rules all live there and are not restated in this skill.

The orchestrator's own obligations at each handoff:

- select the stage document by the issue's routing hint, and name the rostered
  owner before the stage runs;
- record `stage / rostered owner / actual owner (service, model, effort) /
  substituted: yes|no` in the ledger as each stage completes, never
  retroactively at the end of the batch;
- validate the incoming artifact against the receiving stage's expectations,
  and return an incomplete artifact to its stage rather than repairing it;
- when a stage handed to an external service comes back with scope beyond the
  issue, apply the in-scope/out-of-scope rule above before any verification.

Two rules from the contract are repeated here because the ledger enforces
them: a Claude-authored diff can never satisfy the second-opinion stage, and
the production-readiness gate remains rostered to Opus 5/Sonnet 5 unless the
owner explicitly authorizes GPT-5 as a session substitution. Any such
substitution must be flagged in `DECISIONS.md` and the ledger with actual
service/model/effort provenance.

## Prerequisite phase gate

Do not begin an engineering pass from a raw backlog. The task-distillation
phase must first leave a reconciled manifest, duplicate report, dependency
order, blocker triage, and criterion-ready closure contract for every
actionable issue. If any item still needs decomposition or its acceptance
criteria require a parent-wide judgment, stop and return to distillation.

## Scope and invariants

Completion means closure: code, tests, or QA finishing in isolation is not
task completion. The final step is reconciliation of evidence, checklist,
backlog, and GitHub state; only then may a passing issue be marked `completed`
and closed. Blocked or handed-off work remains open with its terminal status,
owner, blocker class, and next action.

- Work in exactly one project per session. If the project is unclear, ask before changing files.
- At session start, discover and reconcile every open GitHub issue associated with that project against its `tasks.md`. Do not silently omit, duplicate, or invent an issue.
- Implement the batch's issues in dependency order, one issue-scoped commit each, and never let two runs edit the same files concurrently. A blocker on one issue does not stop independent issues; dependency-blocked issues receive a documented handoff and are not implemented prematurely.
- A blocked issue is not a session or goal stop. After recording its blocker class, owner/context, exact next action, and GitHub status, skip only issues that depend on it and select the next independent closure-ready issue. Halt the goal only when no independent actionable work remains or every remaining issue requires the same unavailable external state.
- If the blocker is a dependency or environment problem unrelated to the user's
  judgment or decision, run and record a fresh task-distillation
  reconciliation at the end of the batch (or wave) before selecting the next batch.
  Recheck duplicates, dependency order, closure criteria, blocker ownership,
  and follow-up issue coverage.
- **Batch the work, keep the issues atomic.** By default, PM grooming, engineering, and QA run over the session's whole ready set, with the impact analysis and batch gate below. Each issue still gets its own commit, its own criterion matrix, and its own `## QA` comment. What is deliberately *not* allowed is closing issue N on its own criteria alone while sibling or other open issues are affected by the same change. Postponing tests indefinitely is also not allowed: the batch gate runs as soon as the batch's commits are complete, and any `FAIL` returns the issue to engineering inside the batch.
- **Exceptions (single-issue transaction permitted, reason recorded in the ledger):** a production-down hotfix; an issue whose impact matrix shows no overlap with any other open issue and whose environment cannot be shared with the rest of the batch; an explicit owner request; or an environment boundary that makes a batch gate impossible. Everything else is batched.
- Build an issue manifest before implementation. Every manifest item must end as `completed`, `blocked`, `dependency-blocked`, or `handed-off`.

Closure integrity after owner review:

- Treat a current owner-visible failure after closure as a new task signal.
  Preserve the closed issue and distill a linked criterion-ready issue; never
  reopen the completed issue.
- Never close on DOM roles, accessible names, non-zero geometry, source
  matches, or shared-component tests alone when the issue includes visual or
  route-level criteria. Require inspected rendered evidence and the named
  interaction boundary.
- If a closed issue has unchecked criteria or contradictory closure comments,
  preserve it as historical record and create a new corrective task with
  explicit criteria. Never reopen or rewrite the closed issue.
- Inspect `git status --short --branch` before editing. Classify pre-existing changes as unrelated, user-owned relevant work, or session work. Preserve unrelated and user-owned changes; do not commit them without clear authorization.
- Do not add dependencies without the user's approval.
- Use the authenticated GitHub connector for issue, comment, and PR operations. Do not use a local `gh` token as a substitute.
- Read acceptance criteria before implementation and again during QA.
- Make verification automation-first: the agent or CI must execute local,
  browser, integration, and regression checks. Do not hand a local test
  command to the user as a prerequisite or substitute for QA. Manual checks
  are reserved for Replit deployment verification when the acceptance
  criteria explicitly require deployed behavior or a human visual judgment.
- Treat a blocker as a triage decision, not an automatic new issue: classify it as an implementation defect, verification boundary, workflow/infrastructure defect, dependency blocker, or non-actionable limitation. Any distinct actionable repository/workflow defect must be linked to an existing issue or created immediately when issue creation is authorized.
- Enforce closure-sized work: a parent/epic is not an implementation unit. Split
  distinct routes, editor modes, embeds, immersive query variants, and
  downloaded artifacts into separate issues before implementation. Each such
  issue is committed and QA'd on its own criteria and then closed after the
  batch gate; do not defer closures past the gate, and do not close before it.
- Enforce closure-ready contracts, not just small titles: every active issue
  must name one entry point and fixture, enumerate finite observable pass/fail
  outcomes, specify exact commands/evidence, and state what is explicitly not
  applicable. Rewrite or split criteria containing “all permitted,” “where
  applicable,” or parent-wide visual judgments before implementation.
- Separate implementation status from release/parity status. A local
  capability issue may close only when its own contract is explicitly local;
  it must never be described as live or production parity. Any issue whose
  contract names a deployed URL, a user-supplied live example, or a published
  revision must verify that exact URL against the exact revision under test.
  Localhost, disposable Compose, source-string, or shared-component evidence
  cannot close that deployed criterion.

## Batch manifest

Record this manifest in the working notes and final handoff:

| Issue | URL | Milestone | Wave | Backlog entry | Dependencies | Scope | Status | Stage owners (scoping / impl / review / QA / gate) | Substituted? | Blocker class / follow-up issue | Owner / next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Record each stage owner as `service / model` using the routing table above,
or `Claude (substituted for <rostered owner>)` when Claude ran it instead.

Order by explicit dependencies, then project backlog order, then priority. If GitHub and `tasks.md` disagree, reconcile the records before implementation. Existing issues must be updated or reused; create a new issue only for genuinely new work authorized by the user.

### Batch formation and milestone awareness

- The batch is the **session's ready set**: every closure-ready open issue for the project at session start. Dependency-blocked and owner-decision-pending issues are listed and skipped, not silently dropped. Formation is per session, **regardless of milestone**; a batch may span milestones.
- Milestone awareness is built in: the manifest records each issue's milestone; ordering ties are broken by milestone, oldest first; a milestone is closed only by the session-completion pass once every issue in it is terminal (`docs/process.md`, "Milestone assignment").
- There is no fixed size cap. When the set is large, or an issue's acceptance needs a sibling's behavior to be merged first, the orchestrator may split it into **waves**. Every wave runs the full batch gate; session-completion covers all waves.

### Batch impact analysis (mandatory, built in the PM pass, updated while engineering)

Before any code is written, build a matrix for the batch and keep it current:

| Change (file / selector / route / API / schema / spec / fixture / helper) | Kind (add / change / delete / rename) | Issue(s) in batch | Open issues that reference it (in or out of the batch) | Collision / invalidation? | Required re-verification |
| --- | --- | --- | --- | --- | --- |

Rules:

1. Search every file, CSS region, selector, helper, fixture, route, API and schema element an issue will touch against **all** open issues: the GitHub open list, `docs/tasks.md`, and `rg` on paths, selectors and routes in issue bodies. Record the hits.
2. Resolve a collision or an invalidated premise in the PM pass — reorder, deliver in one commit series by one implementer, amend a criterion by comment, or file a linked atomic issue — never after closure. Two issues editing the same CSS region or shared helper are delivered serially by one implementer.
3. For every deletion or rename, list every consumer, including specs and fixtures.
4. During engineering, any newly touched shared file or surface is added to the matrix immediately, with the affected open issues named.
5. Link the matrix from each affected issue.

## Batch loop

Run these passes over the manifest, labeling artifacts with the issue number and the wave. If delegation is unavailable, perform the passes yourself in sequence and say so; never imply another agent ran. Record the stage owner for each pass in the ledger as it runs, not retroactively at the end of the batch.

### PM pass — groom and analyze impact

Scoping itself is stage 1 ([issue-scoping](../issue-scoping/SKILL.md), Codex);
this pass grooms the issue it produced and validates that its contract is
complete enough to hand to an implementation stage. Read the issue, relevant
`tasks.md`, `docs/process.md`, `docs/team/pm.md`, and any required project
guidance. Confirm or update:

- goal and checkable acceptance criteria;
- constraints, dependencies, files in scope, and out-of-scope follow-ups;
- duplicate/related issue links;
- blocker triage, including whether each blocker is covered by this issue, an existing issue, or a new follow-up;
- criterion-by-criterion implementation plan;
- automated verification commands and fixtures, including the local runner
  or CI job that owns execution; identify any Replit-only manual acceptance
  separately and do not make it a local development prerequisite;
- backlog entry and GitHub issue URL;
- the routing hint (stage 2a mechanical vs. 2b complex logic) and whether
  stage 3 second-opinion review is wanted for this issue;
- the issue's rows in the batch impact matrix, with every other open issue
  that references the same files, selectors, routes, helpers, fixtures or
  specs, and the resolution of each collision.

If the issue is not implementable because a dependency is unresolved, record `dependency-blocked`, its exact prerequisite, and its next action. Continue to the next independent issue. If the issue spans multiple independently observable surfaces, stop grooming it as a unit and create/reuse one criterion-ready child per surface before engineering.

If grooming discovers distinct actionable work outside the current issue, reuse an existing issue or create a criterion-ready follow-up immediately through the authenticated connector when authorized. Link it from the current issue and manifest. If creation is not authorized, mark the current work `handed-off` with `issue-creation-pending-authorization`, an owner, and the exact issue definition needed; do not silently absorb or omit the work.

Any issue created this way gets a milestone before it's left — reuse the current issue's open milestone (it's a direct follow-up), or create a new one if none fits. Never leave a newly filed issue unmilestoned; see `docs/process.md`'s "Milestone assignment" section.

### Engineer pass — implement (ordered, one commit per issue)

Delegated to stage 2. Select by the issue's routing hint: the
[implementation-mechanical](../implementation-mechanical/SKILL.md) skill
(Opencode Go) or [implementation-complex](../implementation-complex/SKILL.md)
(Ollama Cloud). When Claude substitutes, invoke that same skill and flag the
substitution.

The orchestrator's responsibilities around this pass:

- Read `docs/team/software-engineer.md`; before tests, `docs/testing-guidelines.md`,
  and for UI work `docs/design-system.md`, where those files exist.
- Require an issue-scoped commit per issue, in manifest order, each with its
  focused test result. The next issue's engineering may start once the
  previous issue has its own commit and focused result; QA and closure wait
  for the batch gate. Do not close any issue in this pass.
- Before editing a shared file or surface, read the impact matrix, do not undo
  or contradict a sibling issue's criteria, and add newly touched shared
  surfaces to the matrix with the affected open issues named.
- If implementation is blocked, do not modify unrelated code. Record the
  attempted command or tool, exact failure, impact, and next action; mark the
  issue `blocked` or `handed-off` and continue with independent issues.
- When a stage-2a service stops because the work exceeded its rostered
  complexity, record a routing handoff to the complex-logic owner — that is a
  routing event, not a blocker, and the issue stays current.
- When engineering discovers a new defect, decide whether it belongs to the
  current acceptance criteria. Fix and retest it within this issue if so;
  otherwise create or reuse a follow-up issue before the batch ends, link the
  dependency, and mark the current issue `handed-off` or `dependency-blocked`.
  A code change does not complete an issue until its verification is rerun at
  the batch gate.
- Optional stage 3 runs here, before the batch gate (per issue, or over the batch's diff range when the same reviewer covers several issues):
  [second-opinion-review](../second-opinion-review/SKILL.md). Record it as run
  (with the service and model) or `not run`. It cannot be satisfied by the
  model that wrote the diff.

### Batch gate — verify (stage 4, over the whole batch)

Delegated to the [qa-self-review](../qa-self-review/SKILL.md) skill (stage 4,
Claude Sonnet 5 at Medium effort), which owns intake of untrusted external
diffs, verification, and the `## QA: PASS`/`## QA: FAIL` comment per issue.

The gate has six parts, run after the batch's commits are complete:

1. each issue's own criterion matrix and `## QA` comment, in the existing format;
2. the **union** of every issue's focused commands;
3. the full required suite (`make check`) once for the batch, plus the browser or integration suites the criteria name;
4. every impact-matrix row: re-run its re-verification command, or record "not affected" with the search evidence — including open issues *outside* the batch;
5. a cross-issue review that no issue's criteria were made false or unreachable by a sibling's change;
6. rendered evidence at the named viewports where criteria require it.

The orchestrator's responsibilities around this pass:

- The gate runs as soon as the batch's commits exist; never build a queue of implementations and postpone verification.
- On `FAIL`, return the failing issue to its implementation stage inside the batch and re-run the affected parts of the gate. Do not close the failing issue or any issue that depends on it. Independent passing issues close after the gate is green.
- A failure in the full suite or a matrix row is classified before any issue closes; a failure attributable to a specific issue returns that issue, an unattributable one blocks closure of the whole batch until classified.
- Carry each verdict's provenance block and intake outcome into the ledger.
- The QA skill does not set terminal status or close issues; that is the batch handoff below.

### Batch handoff

Set each manifest row's status and reconcile its backlog entry, issue comment, commits, memory links, and next action immediately after the batch gate, issue by issue. An issue is `completed` only when every acceptance criterion and required check passes. Otherwise use `blocked`, `dependency-blocked`, or `handed-off` with evidence. If the criteria are complete and the batch gate passed, close the GitHub issue in the same reconciliation step; do not leave a verified closure-sized issue open merely because its parent feature is unfinished, and do not close it before the gate.

Before assigning a terminal status, verify that every blocker has a class, owner/context, exact next action, and an existing/new follow-up issue or an explicit non-actionable/verification-boundary rationale. `handed-off` requires a linked owner issue unless issue creation is pending authorization.

For parity work, the final status must state both dimensions when they differ:
`implemented locally` versus `deployed and verified`. Do not inherit a child
capability's local closure as evidence for a route, artifact, or parent release
gate. If a live URL contradicts the checkout, preserve any already-closed
issue and create a new deployed-scope task with the published asset/revision
evidence.

## Batch completion pass

After the batch loop (all waves), run [session-completion](../session-completion/SKILL.md) with the complete manifest. It must reconcile all issues, memory topics, decisions, lessons, constraints, blockers, verification boundaries, and the final verification boundary. Run [task-distillation](../task-distillation/SKILL.md) for newly discovered work or context changes, and [production-readiness](../production-readiness/SKILL.md) when its conditions require it.

Do not create a PR while any required issue is incomplete, unverified, or missing a terminal status. A PR may be created or updated only after the batch completion pass confirms that all intended issues pass and no required follow-up remains.

## Required evidence

Include per issue and as a batch rollup:

| Gate | Required evidence |
| --- | --- |
| Routing | Rostered owner and actual owner (`service / model / effort`) per stage, every substitution flagged, and the readiness-gate model/effort named explicitly |
| Scope | Project, complete issue manifest, ordering, worktree classification |
| PM | Grooming result, issue URL, milestone, acceptance matrix, plan |
| Batch impact matrix | Rows for every changed or deleted shared surface, the open issues (in and out of the batch) that reference it, each collision and its resolution, and the re-verification result |
| Engineer | Changed files, focused tests, commits, dependency decisions, originating service/model for any externally produced diff |
| Second opinion | Whether an independent-family review ran, by which service/model, and how its findings were dispositioned (or an explicit “not run”) |
| Automation | Repository runner/CI ownership of local and browser verification, disposable-service setup, cleanup, and retained failure artifacts |
| Batch gate | Union of focused commands, the single full-suite run, matrix re-verification, and the cross-issue review result |
| QA | Exact automated focused/full commands, runner/CI environment, results, criterion verdicts, GitHub comment; any Replit-only manual evidence is explicitly labeled |
| Memory | Updated or explicitly unchanged topics, linked to issues |
| Session completion | Batch reconciliation result and remaining-item audit |
| Handoff | Every issue's status, blocker, owner/context, and exact next action |

The final rollup must state counts for discovered, completed, blocked, dependency-blocked, handed-off, and missing-terminal-status issues. Missing-terminal-status must be zero.
It must also state the number of newly discovered actionable follow-ups, how many were created/reused/pending authorization, and confirm that no failed full-suite gate remains unclassified.

## Completion gate

The project batch may be reported complete only when:

- every discovered issue has a terminal status;
- every issue reported as completed has all acceptance criteria passing;
- full relevant suites and required builds/checks pass for completed issues;
- all local and CI verification is executable by the agent or CI without a
  user-operated terminal/browser session; any remaining manual step is
  explicitly limited to Replit deployment acceptance;
- QA results are recorded on every processed issue, and the batch gate (including the impact matrix) passed before any issue closed;
- changes are committed without unrelated files;
- backlog, GitHub, and memory links are reconciled;
- every stage of every processed issue has a recorded owner, with each
  substitution flagged and the readiness gate run on the rostered model tier
  (Opus 5/Sonnet 5) at the owner's budgeted effort, or on an explicitly
  owner-authorized GPT-5 substitution recorded in `DECISIONS.md` and the
  ledger;
- session completion has run; and
- the issue/PR state reflects the actual batch result.
- every newly discovered actionable item is linked to an existing/new issue or explicitly recorded as pending authorization with an owner and next action.

If any issue is blocked or incomplete, report `INCOMPLETE` or `BLOCKED`, keep the issue open, list the failed gate, and give one concrete next action per issue. Do not imply that blocked work is complete.
