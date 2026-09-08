# Per-Service Kickoff Prompts

> Use in either `ai-dev-tools-zoomcamp-1` or `augment-humankind-react-node` —
> both already have the roster finalized in `LOOP-AGENTS.md` Section 4 and
> `GRAPH-AGENTS.md` Section 5. Fill in `[REPO]` and `[ISSUE]` per session.
> Each prompt is scoped to exactly one stage — don't let a service drift into
> another stage's job.

---

## Codex (via ChatGPT Plus) — Issue Scoping / Spec Drafting

**Recommended model: `GPT-5.6 Sol` at `Medium` reasoning effort** — the
default for scoping work; strong enough for scope boundaries and acceptance
criteria without the extra cost of the top tier. Escalate to **`GPT-6 Astra`**
(if available on your plan) at `Low` or `Medium` effort only for unusually
ambiguous or high-stakes scoping decisions — treat Astra as an escalation,
not the default, since it costs more than Sol for most scoping work. Skip
`Terra` and `Luna` for this role: both are cost/speed-optimized tiers, and
this role's job is reasoning quality, not throughput — Terra/Luna are already
redundant here since Opencode Go and Ollama Cloud own the cheap-tier work
elsewhere in this roster.

You are working in `[REPO]`. Your assigned role, per `LOOP-AGENTS.md` Section
4, is issue scoping and spec drafting — nothing else. Read `AGENTS.md` and
`LOOP-AGENTS.md` first, and `BACKLOG.md` if this repo has one, before writing
anything.

Draft a single GitHub issue for: `[ISSUE — one testable outcome]`. Include
acceptance criteria and the specific files/modules expected to change. If this
touches translated business logic, cite the relevant source-of-truth doc
(e.g., an `ALGORITHMS.md`-equivalent or the legacy code in `legacy/`) as part
of the acceptance criteria. Ask one Rule 1 question before finalizing scope if
anything is ambiguous. Do not implement — hand the finished issue back to me.

---

## Opencode Go — Implementation (Mechanical/Boilerplate)

**Recommended model: `kimi-k2.5`** for frontend/React work, **`qwen3.6-plus`**
for backend/API work — pick based on which side of the codebase the issue
touches; state which one you selected and why.

You are working in `[REPO]` on issue: `[ISSUE]`. Your assigned role, per
`LOOP-AGENTS.md` Section 4, is mechanical/boilerplate implementation. Read
the issue's acceptance criteria and `CONSTRAINTS.md` before starting.

Implement strictly within the issue's stated scope. If the work turns out to
need complex logic (auth, data-layer, schema translation) beyond boilerplate,
stop and say so — that work is routed to Ollama Cloud, not this session. If
you hit anything in `LOOP-AGENTS.md`'s Irreversible Decisions table, stop and
flag it instead of proceeding. Do not run the QA or readiness-gate stages
yourself — hand the diff back when implementation is done.

---

## Ollama Cloud — Implementation (Complex Logic)

**Recommended model: `qwen3-coder:cloud`** — strongest reasoning available in
this tier for auth, data-layer, and schema/business-logic translation work.

You are working in `[REPO]` on issue: `[ISSUE]`. Your assigned role, per
`LOOP-AGENTS.md` Section 4, is complex-logic implementation — auth, data
layer, schema/business-logic translation. Read the issue's acceptance
criteria, `CONSTRAINTS.md`, and any cited source-of-truth documentation
(legacy code, business-logic docs) before starting.

If translating existing behavior, treat the cited source as authoritative; if
the source and the current code disagree, stop and ask which one wins (Rule 1)
rather than picking. Stop at anything in the Irreversible Decisions table.
Do not run QA or the readiness gate — hand the diff back when done.

---

## Mistral Vibe — Second-Opinion Patch Review (optional stage)

**Recommended model: `devstral-2`** — independent model family from the
implementation stages above, which is the point of this review.

You are reviewing a diff in `[REPO]` for issue: `[ISSUE]`, produced by another
model. Your job is independent review only — not re-implementation. Read the
diff against the issue's acceptance criteria with fresh eyes: look for
assumptions the diff's own author might have carried into its self-review.
Flag anything questionable; do not fix it yourself. Report findings back for
the QA stage to act on.

---

## Claude Pro — QA Self-Review, then Production-Readiness Gate

You own two sequential stages here, per `LOOP-AGENTS.md` Section 4 — run them
in order, in separate replies, not combined into one pass. Each stage uses a
different model **and** a different effort level; switch both between them.

**QA self-review — recommended model: `Claude Sonnet 5` at `Medium` effort**
(Anthropic's own recommended default — best balance of speed, cost, and
performance for routine work).
You are working in `[REPO]` on issue: `[ISSUE]`. Re-read the diff against the
issue's acceptance criteria. Check for regressions in adjacent code. Run the
test suite. Incorporate any findings from Mistral Vibe's second-opinion review
if one was run.

**Production-readiness gate — recommended model: `Claude Opus 5` at `Low`
effort.** This is the one stage in the entire pipeline where the **model tier**
is non-negotiable: Opus 5 always, never Sonnet, never Haiku, never a non-Claude
service, regardless of how small the change looks. That — not token spend — is
what `LOOP-AGENTS.md`'s "never downgraded" rule protects. Effort is a separate,
budget-owned dial, set at `Low`.

Because the effort level is low, this gate earns its rigor from procedure
rather than from unbounded reasoning: work the readiness dimensions and the
completion gate in `production-readiness` item by item, and record an explicit
`BLOCKED` or `OPEN FOLLOW-UP` wherever the effort level cannot support a
confident judgment. Never resolve an ambiguous readiness question by
assumption. Confirm
QA passed, confirm nothing in the Irreversible Decisions table was touched
without prior explicit confirmation, confirm `MEMORY.md`/`DECISIONS.md` (or
this repo's equivalent) is updated, and give an explicit go/no-go on merging.
