# DECISIONS.md

Append-only log of agent-relevant decisions. See `AGENTS.md` Section 10 for
ownership and read cadence.

## 2026-09-08

- Roster finalized for ai-dev-tools-zoomcamp-1 — see LOOP-AGENTS.md Section 4 and GRAPH-AGENTS.md Section 5.

## 2026-09-07

- Adapted the four orchestration skills (`backlog-session`,
  `task-distillation`, `production-readiness`, `session-completion`) for the
  multi-service roster. Routing is **advisory**: Claude may run a stage
  rostered to another service, but every substitution must be flagged.
- Provenance is recorded in the **existing** ledger/manifest/evidence tables
  only — no new provenance file, no per-issue `DECISIONS.md` churn.
- Readiness-gate effort: owner constraint is **Opus 5 at `Low` effort**
  (budget). This conflicts with `per-service-kickoff-prompts.md`, which
  specifies `Max` with `xhigh` as the floor. The owner's session statement
  governs; the skills now encode "never downgrade the **model tier**" (Opus 5
  mandatory) rather than "never downgrade effort".
  **Open:** `per-service-kickoff-prompts.md` still says `Max` and should be
  reconciled to match.
