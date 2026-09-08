---
name: backlog-session
description: Process every remaining open backlog issue for one project sequentially, with explicit PM, engineering, QA, reconciliation, evidence, and handoff gates.
---

# Backlog session

Use this skill when the user asks to work through a project backlog and its GitHub issues. A session is a complete run for one project: discover every remaining open backlog issue, process issues one at a time in dependency order, and leave every issue with a terminal status. Never claim the project batch is complete when a required gate was skipped.

## Transaction ledger (mandatory)

Maintain one explicit current-issue record with exactly one state:

`GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`

or

`GROOMED → ENGINEERING/QA → BLOCKED|DEPENDENCY-BLOCKED|HANDED-OFF`.

The record must contain the issue number, commit, focused checks, full checks,
QA result, evidence boundary, GitHub comment, final status, and, for every
stage, the stage owner actually used (`service / model / effort`) plus a
`substituted: yes|no` flag when Claude ran a stage rostered to another
service. See "Multi-service stage routing" below. The
orchestrator may select the next issue only after the current record reaches
`CLOSED` or a documented terminal blocked/handoff state. A code commit, green
focused test, QA PASS, or deployment publication is never itself a terminal
state.

New work discovered during engineering or QA is handled before advancing:
classify it as in-scope (fix and retest this issue) or out-of-scope (reuse or
create/link a criterion-ready issue, record the dependency, and keep the
current issue's own finite criteria separate). Do not absorb an unrelated gap
into the current issue and do not create a cosmetic duplicate solely to make
the issue count larger.

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
the production-readiness gate never routes to another service or a lesser
Claude model (Opus 5 is mandatory; its effort level is the owner's to set).

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
- Process issues sequentially, never in parallel. A blocker on one issue does not stop independent issues; dependency-blocked issues receive a documented handoff and are not implemented prematurely.
- A blocked issue is not a session or goal stop. After recording its blocker class, owner/context, exact next action, and GitHub status, skip only issues that depend on it and select the next independent closure-ready issue. Halt the goal only when no independent actionable work remains or every remaining issue requires the same unavailable external state.
- If the blocker is a dependency or environment problem unrelated to the user's
  judgment or decision, run and record a fresh task-distillation
  reconciliation at the end of that issue before selecting the next issue.
  Recheck duplicates, dependency order, closure criteria, blocker ownership,
  and follow-up issue coverage.
- Batch only the PM/distillation work. Engineering and testing are a strict
  per-issue transaction: finish implementation, focused tests, required full
  checks, browser QA, evidence reconciliation, and the GitHub status decision
  for issue N before starting engineering or testing issue N+1. Never build a
  queue of implementations and postpone their tests or closures.
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
  downloaded artifacts into separate issues before implementation. Process one
  such issue at a time and reconcile its GitHub state immediately after QA;
  never defer several issue closures until the end of a long batch.
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

| Issue | URL | Backlog entry | Dependencies | Scope | Status | Stage owners (scoping / impl / review / QA / gate) | Substituted? | Blocker class / follow-up issue | Owner / next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Record each stage owner as `service / model` using the routing table above,
or `Claude (substituted for <rostered owner>)` when Claude ran it instead.

Order by explicit dependencies, then project backlog order, then priority. If GitHub and `tasks.md` disagree, reconcile the records before implementation. Existing issues must be updated or reused; create a new issue only for genuinely new work authorized by the user.

## Per-issue loop

Run these passes for every manifest issue, labeling artifacts with the issue number. If delegation is unavailable, perform the passes yourself in sequence and say so; never imply another agent ran. Record the stage owner for each pass in the ledger as it runs, not retroactively at the end of the batch.

### PM pass — groom

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
  stage 3 second-opinion review is wanted for this issue.

If the issue is not implementable because a dependency is unresolved, record `dependency-blocked`, its exact prerequisite, and its next action. Continue to the next independent issue. If the issue spans multiple independently observable surfaces, stop grooming it as a unit and create/reuse one criterion-ready child per surface before engineering.

If grooming discovers distinct actionable work outside the current issue, reuse an existing issue or create a criterion-ready follow-up immediately through the authenticated connector when authorized. Link it from the current issue and manifest. If creation is not authorized, mark the current work `handed-off` with `issue-creation-pending-authorization`, an owner, and the exact issue definition needed; do not silently absorb or omit the work.

### Engineer pass — implement

Delegated to stage 2. Select by the issue's routing hint: the
[implementation-mechanical](../implementation-mechanical/SKILL.md) skill
(Opencode Go) or [implementation-complex](../implementation-complex/SKILL.md)
(Ollama Cloud). When Claude substitutes, invoke that same skill and flag the
substitution.

The orchestrator's responsibilities around this pass:

- Read `docs/team/software-engineer.md`; before tests, `docs/testing-guidelines.md`,
  and for UI work `docs/design-system.md`, where those files exist.
- Require an issue-scoped commit before advancing. Do not start another
  issue's engineering while this issue lacks its own implementation commit and
  test result. Do not close the issue here.
- If implementation is blocked, do not modify unrelated code. Record the
  attempted command or tool, exact failure, impact, and next action; mark the
  issue `blocked` or `handed-off` and continue with independent issues.
- When a stage-2a service stops because the work exceeded its rostered
  complexity, record a routing handoff to the complex-logic owner — that is a
  routing event, not a blocker, and the issue stays current.
- When engineering discovers a new defect, decide whether it belongs to the
  current acceptance criteria. Fix and retest it within this issue if so;
  otherwise create or reuse a follow-up issue before advancing, link the
  dependency, and mark the current issue `handed-off` or `dependency-blocked`.
  A code change does not complete an issue until its verification is rerun.
- Optional stage 3 runs here, before QA:
  [second-opinion-review](../second-opinion-review/SKILL.md). Record it as run
  (with the service and model) or `not run`. It cannot be satisfied by the
  model that wrote the diff.

### QA pass — verify

Delegated to the [qa-self-review](../qa-self-review/SKILL.md) skill (stage 4,
Claude Sonnet 5 at Medium effort), which owns intake of untrusted external
diffs, verification, and the `## QA: PASS`/`## QA: FAIL` comment.

The orchestrator's responsibilities around this pass:

- QA is part of the same issue transaction as engineering and must run before
  the next issue begins. Never build a queue of implementations and postpone
  their verification.
- On `FAIL`, keep the issue current, return it to its implementation stage,
  and re-enter QA. Do not advance to a later issue's engineering to work
  around it.
- Carry the verdict's provenance block and intake outcome into the ledger.
- The QA skill does not set terminal status or close issues; that is the issue
  handoff below.

### Issue handoff

Set the manifest status and reconcile the backlog entry, issue comment, commits, memory links, and next action immediately after that issue's QA pass. An issue is `completed` only when every acceptance criterion and required check passes. Otherwise use `blocked`, `dependency-blocked`, or `handed-off` with evidence. If the criteria are complete, close the GitHub issue in the same reconciliation step; do not leave a verified closure-sized issue open merely because its parent batch is unfinished.

Before assigning a terminal status, verify that every blocker has a class, owner/context, exact next action, and an existing/new follow-up issue or an explicit non-actionable/verification-boundary rationale. `handed-off` requires a linked owner issue unless issue creation is pending authorization.

For parity work, the final status must state both dimensions when they differ:
`implemented locally` versus `deployed and verified`. Do not inherit a child
capability's local closure as evidence for a route, artifact, or parent release
gate. If a live URL contradicts the checkout, preserve any already-closed
issue and create a new deployed-scope task with the published asset/revision
evidence.

## Batch completion pass

After the per-issue loop, run [session-completion](../session-completion/SKILL.md) with the complete manifest. It must reconcile all issues, memory topics, decisions, lessons, constraints, blockers, verification boundaries, and the final verification boundary. Run [task-distillation](../task-distillation/SKILL.md) for newly discovered work or context changes, and [production-readiness](../production-readiness/SKILL.md) when its conditions require it.

Do not create a PR while any required issue is incomplete, unverified, or missing a terminal status. A PR may be created or updated only after the batch completion pass confirms that all intended issues pass and no required follow-up remains.

## Required evidence

Include per issue and as a batch rollup:

| Gate | Required evidence |
| --- | --- |
| Routing | Rostered owner and actual owner (`service / model / effort`) per stage, every substitution flagged, and the readiness-gate model/effort named explicitly |
| Scope | Project, complete issue manifest, ordering, worktree classification |
| PM | Grooming result, issue URL, acceptance matrix, plan |
| Engineer | Changed files, focused tests, commits, dependency decisions, originating service/model for any externally produced diff |
| Second opinion | Whether an independent-family review ran, by which service/model, and how its findings were dispositioned (or an explicit “not run”) |
| Automation | Repository runner/CI ownership of local and browser verification, disposable-service setup, cleanup, and retained failure artifacts |
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
- QA results are recorded on every processed issue;
- changes are committed without unrelated files;
- backlog, GitHub, and memory links are reconciled;
- every stage of every processed issue has a recorded owner, with each
  substitution flagged and the readiness gate run on the rostered model tier
  (Opus 5) at the owner's budgeted effort;
- session completion has run; and
- the issue/PR state reflects the actual batch result.
- every newly discovered actionable item is linked to an existing/new issue or explicitly recorded as pending authorization with an owner and next action.

If any issue is blocked or incomplete, report `INCOMPLETE` or `BLOCKED`, keep the issue open, list the failed gate, and give one concrete next action per issue. Do not imply that blocked work is complete.
