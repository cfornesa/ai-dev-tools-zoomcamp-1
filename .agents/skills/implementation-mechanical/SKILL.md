---
name: implementation-mechanical
description: Implement one criterion-ready issue whose work is mechanical or boilerplate, scoped strictly to the issue, with focused regression coverage. Stage 2a of the multi-service loop. Load when implementing an issue routed as mechanical; stop and reroute if it turns out to need auth, data-layer, or schema logic.
---

# Implementation — mechanical / boilerplate (stage 2a)

Stage 2a of the loop in `LOOP-AGENTS.md` Section 2. Read
`.agents/skills/_shared/HANDOFF-CONTRACT.md` first.

**Rostered owner:** Opencode Go — `kimi-k3` for frontend/React work,
`qwen3.6-plus` for backend/API work. State which you selected and why; the
choice is recorded as provenance.

Running this skill in a Claude session is a **substitution**. Record it as
such in the `backlog-session` ledger. To delegate instead, hand this file's
body to Opencode Go with `[REPO]` and `[ISSUE]` filled in.

**Input:** one criterion-ready stage-1 issue with a mechanical routing hint.
**Output:** a diff scoped to that issue, plus the exact commands run.

## Scope boundary

Implement strictly within the issue's stated scope. Touch no file the issue
did not name. Do not run QA or the readiness gate, and do not close the issue —
a diff is never a terminal state.

## Procedure

Read the issue's acceptance criteria, `AGENTS.md`, `CONSTRAINTS.md`, and
`docs/team/software-engineer.md`. Before writing tests read
`docs/testing-guidelines.md`; for UI work read `docs/design-system.md`.

Implement the criteria and add focused regression coverage that asserts the
criterion itself, not the implementation's shape. Run the issue's documented
checks through the repository's automated runner and report the exact commands
with their real output — stage 4 re-runs everything claimed here, so an
overstated result only costs a round trip.

Commit coherent, issue-scoped changes. Preserve any unrelated or user-owned
working-tree changes; do not commit them.

## Stop conditions

Stop and hand back rather than proceeding when:

- the work turns out to need **complex logic** — auth, data layer, migrations,
  schema or business-logic translation. That is stage 2b
  (`implementation-complex`). Say so explicitly and record it as a routing
  handoff: the issue stays current and this is not a blocker.
- you hit anything in the `LOOP-AGENTS.md` Section 3 Irreversible Decisions
  table;
- the work needs a new dependency (never add one without the owner's
  approval), a public interface change (Rule 5), or a URL/route change.

If implementation is blocked, do not modify unrelated code. Record the
attempted command, the exact failure, the impact, and the next action.

## Exit

Hand the diff and its command output to stage 3 (`second-opinion-review`) if
that stage was requested for this issue, otherwise to stage 4
(`qa-self-review`).
