---
name: issue-scoping
description: Turn one groomed backlog item into one criterion-ready GitHub issue with acceptance criteria, exact verification commands, and an implementation routing hint. Stage 1 of the multi-service loop. Load when scoping or drafting an issue spec, before any implementation begins.
---

# Issue scoping / spec drafting (stage 1)

Stage 1 of the loop in `LOOP-AGENTS.md` Section 2. Read
`.agents/skills/_shared/HANDOFF-CONTRACT.md` first — the stage map, advisory
routing, provenance format, and handoff artifacts live there.

**Rostered owner:** Codex (via ChatGPT Plus), `GPT-5.6 Sol` at `Medium`
reasoning effort. Escalate to `GPT-6 Astra` at `Low`/`Medium` only for
unusually ambiguous or high-stakes scoping — an escalation, not a default.
Never `Terra` or `Luna`: this stage is judged on reasoning quality, not
throughput, and the cheap-tier work is already owned by stages 2a/2b.

Running this skill in a Claude session is a **substitution**. Record it as
such in the `backlog-session` ledger. To delegate instead, hand this file's
body to Codex with `[REPO]` and `[ISSUE]` filled in.

**Input:** one groomed backlog item from `task-distillation`, with its routing
hint. **Output:** exactly one criterion-ready GitHub issue. Do not implement.

## Scope boundary

The only permitted writes are the issue itself and its backlog/task record.
Product source, product tests, and issue closure belong to later stages. A
failing test or an observed gap is evidence to scope, not permission to fix.

## Procedure

Read `AGENTS.md`, `LOOP-AGENTS.md`, `docs/process.md`, `docs/task-template.md`,
and the relevant `docs/tasks.md` entry before writing anything.

Draft a single GitHub issue for one testable outcome — never a feature bundle.
It must be actionable by a service with **no access to this conversation**, so
everything it needs goes in the issue body: name the files, the fixtures, the
commands, and the cited documents rather than referring to context.

The issue must contain:

- one named entry point and one fixed fixture or precondition;
- a finite checklist of observable pass/fail outcomes — no "all permitted",
  "where applicable", or parent-wide visual judgments;
- the exact focused and full commands that verify it, runnable by an agent;
- explicitly what is out of scope, with links to the issues that own it;
- one stated evidence boundary;
- a **routing hint** — stage 2a (mechanical/boilerplate) or stage 2b (complex
  logic: auth, data layer, migrations, schema and business-logic translation)
  — and the reason. Work spanning both is a signal to split the issue.

If the work touches translated business logic, cite the source-of-truth
document (`ALGORITHMS.md`-equivalent, `docs/benchmarks.md` for runtime and
`schema/limits.json` caps, or the legacy code) as part of the acceptance
criteria. For visual or UI parity, name fixed viewports and require rendered
inspection — DOM roles, accessible names, non-zero bounds, and source-string
matches never close such a criterion by themselves.

If the item spans multiple independently observable surfaces — separate
routes, editor modes, embeds, immersive variants, downloaded artifacts — split
it into one issue per surface before finishing.

## Stop conditions

Ask one Rule 1 question before finalizing scope if anything is ambiguous. Stop
at anything in the `LOOP-AGENTS.md` Section 3 Irreversible Decisions table.

## Exit

Hand the finished issue to the `backlog-session` PM pass for grooming. The
issue is the handoff artifact; the receiving stage validates that its contract
is complete and returns it here if not.
