# Portable orchestration dispatch profiles

`task-distillation` and `backlog-session` are portable orchestration
dispatches, not roster-locked numbered loop stages.

Claude Sonnet at Medium effort is the recommended default. The following are
first-class supported alternatives and do not count as substitutions:

- Codex Luna at Medium reasoning effort;
- Antigravity Gemini 3.8 Flash; and
- Antigravity's Sonnet implementation.

Record the actual platform, model, and effort as provenance, while preserving
the same distillation, ledger, handoff, reconciliation, and completion gates.
The restriction against Luna in `DISPATCH.md` applies only to the separate
`issue-scoping` stage. It does not apply to these two orchestration tasks.

`DISPATCH.md` is a registry of agentic dispatches with routing and handoff
context. It is not a library of prompts to paste into models.

