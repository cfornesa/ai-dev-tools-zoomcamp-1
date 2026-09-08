# GRAPH-AGENTS.md — Multi-Service Graph Engineering

> **Context: general.** Pre-adapted for the `general` context — conventional web-application practice; no domain-specific obligations.
> **This file is process, not governance.** The Six Rules, Brainstorm Mode,
> Pre-Write Check, Core Constraints, skills, and memory-file ownership live in
> `AGENTS.md`, the orchestrator every tool reads first.
>
> Each node in the graph runs the `general` `LOOP-AGENTS.md` shipped alongside this file.

> Creatrweb-derived. This file governs agent behavior across a **multi-service**
> project: more than one repo, deploy target, or independently-owned codebase
> that must stay contractually compatible (e.g., a PHP legacy app, a new
> Node/Django backend, and a React frontend being translated in parallel).
> For a single codebase/deploy target, use `LOOP-AGENTS.md` instead — each
> node in this graph runs its own copy of that loop internally, including its
> own Merge Protocol cases (A–D) for that node's markdown state.

## 0. Merge Protocol (read this first, every session)

Check each participating repo for an existing `AGENTS.md`. This file does not
replace per-repo `LOOP-AGENTS.md` files — it sits one level above
them, in a coordination repo or the root of the primary repo, as `GRAPH.md` or
`GRAPH-AGENTS.md`.

- **If no coordination file exists anywhere:** create `GRAPH.md` at the root of
  whichever repo is the primary/coordinating one, plus this `GRAPH-AGENTS.md`
  alongside it. Each node repo keeps its own `MEMORY.md`/`DECISIONS.md`.
- **Per-node markdown state:** each node repo is evaluated independently using
  `LOOP-AGENTS.md` Section 0's four cases (A: none, B: unrelated-only, C:
  single existing `AGENTS.md`, D: rich pre-existing documentation network).
  A node with a rich network like `process.md`/`plan.md`/`tasks.md` (Case D)
  gets the full Goal Extraction → Mapping → Reconciliation → Confirmation
  sequence from `LOOP-AGENTS.md` before any of its docs are touched — the
  graph layer does not override or shortcut a node's own Case D handling.
- **If node repos already have their own `AGENTS.md`:** leave them untouched;
  this file governs only cross-node decisions (contract changes, shared schema,
  deployment order). Do not duplicate node-level rules here.
- **If a repo has no markdown at all:** treat it as a new node — register it in
  `GRAPH.md`'s node table (Section 3) and give it a minimal `LOOP-AGENTS.md`
  per the single-service template before folding it into graph work.

State explicitly which case(s) applied per node and what you registered,
found, or proposed.

## 1. Six Rules (graph-scoped)

Same Six Rules as `AGENTS.md`, with graph-specific emphasis:

1. **Ask one question first** — especially before any change to a shared
   contract (API shape, schema, event payload) that more than one node consumes.
2. **Show options before committing** — cross-node architecture decisions
   (e.g., "should auth live in the new Node backend or stay federated to the
   PHP app during transition?") always get 2–3 options shown, never decided silently.
3. **Stop at every Irreversible Decision** — see Section 6; cross-service
   breaking changes and any Case D restructuring are the highest-severity
   categories here.
4. **The person owns everything** — including sequencing decisions like which
   node gets migrated first.
5. **Public interfaces never break silently** — this now includes inter-node
   contracts, not just externally public routes. A breaking change to an
   internal API between two of your own services still needs a shim/versioning
   plan if any node depends on the old shape.
6. **If a specified tool/model/tech is non-functional, stop** — applies per-node;
   a blocker in one node's toolchain does not get silently worked around by
   routing that node's work through an unapproved substitute.

## 2. Brainstorm Mode

Same as `AGENTS.md` Section 2, but graph-level brainstorming (e.g., deciding node
boundaries or migration order) must exit by restating the **whole sequencing
plan** as a hypothesis — not just one node's direction — before any node
starts implementation.

## 3. The Graph

Maintain a node/edge manifest in `GRAPH.md`. This repo is currently a
single-node (standalone) graph:

```
Nodes:
  - id: ai-dev-tools-zoomcamp-1
    repo: ai-dev-tools-zoomcamp-1
    role: standalone — no other registered nodes
    markdown_case: D

Edges: none — no other nodes currently connected
Execution order: N/A — single-node graph
```

Update this manifest whenever a node is added, removed, or its contract or
markdown_case changes. This manifest is idempotent to update — re-running the
Documentation Overhaul Prompt replaces node/edge entries that changed rather
than duplicating the whole table.

## 4. Per-Node Loop

Each node runs the full loop from `LOOP-AGENTS.md` Section 1
(issue → implementation → QA → readiness gate) independently, including that
node's own Merge Protocol case handling. The graph layer only intervenes when:

- A node's issue touches a shared contract (edge in Section 3).
- A node's readiness gate depends on another node already being merged/deployed.
- Two nodes' agents propose conflicting changes to the same contract.
- A node's Case D reconciliation proposal (from `LOOP-AGENTS.md` Section 0)
  would affect a shared contract or another node's documentation.

**Cross-node readiness gate (stage 5).** After a node's own
production-readiness gate passes, and before anything merges, a frontier-tier
model runs one further gate at the graph level: are the contracts still
compatible across every node this change touches? Two nodes can each pass their
own gate and still break each other's assumptions — this stage exists to catch
exactly that. It is required whenever the issue touched an edge in Section 3,
and like the per-node gate it is never downgraded to a cheaper model. A node
whose work touched no shared contract merges on its own gate alone.

**Escalation, not resolution.** When any of the conditions above fires, the
node-level agent stops and hands the question up. It does not resolve a
cross-node question on its own authority, even when the answer looks obvious
from inside that node.

## 5. Model Routing Plan — Coordinator + Per-Node

> This table reflects the **current** roster only, populated and replaced
> (never duplicated) via the Documentation Overhaul Prompt. **Core roles are
> required for every graph; optional roles are used only when relevant** —
> keep the roster to core roles unless a project specifically needs the
> optional ones, to avoid over-specifying roles nobody is filling.

**Core roles (required):**

```
Role: Graph coordinator (inactive — no second node currently)
  Service or Model: Google AI Pro (Antigravity)

Role: Per-node implementation — mechanical/boilerplate
  Service or Model: Opencode Go

Role: Per-node implementation — complex logic
  Service or Model: Ollama Cloud

Role: Per-node QA
  Service or Model: Claude Pro

Role: Cross-node production-readiness gate (inactive — no second node currently)
  Service or Model: Claude Pro

--- Optional roles ---

Role: Second-opinion / independent contract review
  Service or Model: Mistral Vibe

Role: Live prototyping node
  Service or Model: Replit Core
```

## 6. Irreversible Decisions Table (graph-level, in addition to per-node table)

| Action | Required before proceeding |
|---|---|
| Changing a shared contract (API shape, schema, event payload) consumed by 2+ nodes | Version the contract or show migration/shim plan; gallery of options |
| Reordering the execution sequence in Section 3 | Explicit confirmation, restate hypothesis |
| Decommissioning a node (e.g., retiring the legacy PHP app) | All dependent nodes confirmed passing on the new contract first |
| Any node's readiness gate skipped due to time pressure | Not permitted — escalate to person instead |
| Merging two nodes' conflicting changes to the same contract | Stop, show both diffs, ask which wins |
| A node's Case D documentation restructuring affects a shared contract or another node's docs | Goal Extraction + Mapping + gallery proposal reviewed at graph level before proceeding |

## 7. Graph Memory Files

- `GRAPH.md` — the node/edge manifest itself, kept current, including each
  node's markdown_case.
- Each node keeps its own `MEMORY.md`/`DECISIONS.md`/`CONSTRAINTS.md` (or, for
  Case D nodes, whatever equivalent files that node's existing documentation
  network already uses) per `LOOP-AGENTS.md`.
- At graph-level session end, propose entries for a root-level `GRAPH-MEMORY.md`
  covering cross-node lessons, including any roster or node/edge changes made
  via a re-run of the Documentation Overhaul Prompt.

## 8. Post-Session Eval

Score Pass / Partial / Fail with one sentence of evidence for each:

1. Was Rule 1 followed for any shared-contract change?
2. Was Rule 2 followed for cross-node architecture decisions?
3. Was Rule 3 followed — did the agent stop at every graph-level Irreversible
   Decision, including any Case D restructuring with cross-node impact?
4. Was the execution order in `GRAPH.md` respected, or was it changed without
   explicit confirmation?
5. Was the cross-node production-readiness gate run by a frontier-tier model?
6. Was `GRAPH.md` updated to reflect any node/edge/contract/markdown_case
   changes made this session?
