---
name: implementation-complex
description: Implement one criterion-ready issue involving auth, data-layer, migration, or schema and business-logic translation work, treating any cited source-of-truth document as authoritative. Stage 2b of the multi-service loop. Load when implementing an issue routed as complex logic.
---

# Implementation — complex logic (stage 2b)

Stage 2b of the loop in `LOOP-AGENTS.md` Section 2. Read
`.agents/skills/_shared/HANDOFF-CONTRACT.md` first.

**Rostered owner:** Ollama Cloud, `qwen3-coder:cloud` — the strongest
reasoning in that tier, which is what this stage's work needs.

Running this skill in a Claude session is a **substitution**. Record it as
such in the `backlog-session` ledger. To delegate instead, hand this file's
body to Ollama Cloud with `[REPO]` and `[ISSUE]` filled in.

**Input:** one criterion-ready stage-1 issue with a complex-logic routing hint
— auth, data layer, migrations, schema and business-logic translation.
**Output:** a diff scoped to that issue, plus the exact commands run.

## Scope boundary

Implement strictly within the issue's stated scope. Touch no file the issue
did not name. Do not run QA or the readiness gate, and do not close the issue.

## Procedure

Read the issue's acceptance criteria, `AGENTS.md`, `CONSTRAINTS.md`,
`docs/team/software-engineer.md`, and **every cited source-of-truth document**
— legacy code, business-logic docs, `docs/benchmarks.md` for runtime and
`schema/limits.json` caps — before writing anything.

When translating existing behavior, the cited source is authoritative. Add
focused regression coverage that asserts the criterion, and run the issue's
documented checks through the repository's automated runner, reporting exact
commands and real output — stage 4 re-runs everything claimed here.

Commit coherent, issue-scoped changes. Preserve unrelated or user-owned
working-tree changes.

## Stop conditions

**The source-vs-code conflict is the defining stop for this stage.** Where a
cited source-of-truth document and the current code disagree, stop and ask
which one wins (Rule 1). That exact conflict is in the Irreversible Decisions
table; never pick a winner silently.

Stop also before any schema migration on a production or shared database, any
write to a production database, any public API contract change (document it in
`docs/api.md` first), any URL or route change, any secret or credential
handling, and anything else in the Section 3 table. Adding a dependency
requires the owner's approval.

If implementation is blocked, do not modify unrelated code. Record the
attempted command, the exact failure, the impact, and the next action.

## Exit

Hand the diff and its command output to stage 3 (`second-opinion-review`) if
that stage was requested for this issue, otherwise to stage 4
(`qa-self-review`).
