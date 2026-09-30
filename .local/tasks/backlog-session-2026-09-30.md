# Backlog session 2026-09-30

Execution profile: Codex / GPT-5 / default effort. Stage 2 external dispatch was unavailable; any direct implementation is recorded as a substitution. Stage 3 is not run unless an independent-family reviewer becomes available. Stage 4 and the readiness gate are Claude substitutions when performed in this session.

## Distillation manifest

| Issue | Order / dependency | Routing | Status | Next action |
| --- | --- | --- | --- | --- |
| #1076 | 1; none | 2b complex/security boundary | GROOMED | implement, focused checks, QA, reconcile |
| #1077 | 2; none | 2a mechanical/backend | GROOMED | process after #1076 |
| #1081 | 3; none | docs | GROOMED | process after code prerequisites |
| #1078 | 4; #1076/#1077 | 2b complex | GROOMED | process after dependencies |
| #1079 | 5; #1078 | 2b complex | GROOMED | process after dependency |
| #1080 | 6; #1077–#1079 | 2a mechanical/backend | GROOMED | process after dependencies |
| #1082 | 7; none | 2a frontend | GROOMED | process sequentially |
| #1083 | 8; none | 2a frontend | GROOMED | process sequentially |
| #1084 | 9; none | 2a frontend | GROOMED | process sequentially |
| #1085 | 10; none | 2b storage/data layer | GROOMED | process sequentially |
| #1086 | 11; #1085 | 2b storage/data layer | GROOMED | process after dependency |
| #1087 | 12; #1085/#1086 | 2a frontend | GROOMED | process after dependencies |
| #1088 | 13; #1085 | 2a frontend | GROOMED | process after dependency |
| #788 | owner-scoped production action | owner-run | OPEN / owner-run | use named production workflow and Chrome evidence |
| #926 | #924/#925/#920 | live-provider Chrome | OPEN / live-provider | process after prerequisites |
| #1040 | tracking parent | children #1041–#1046 | OPEN / reconciliation container | close only after children terminal |
| #1042 | live-provider / #1076–#1080 | owner-run QA | OPEN | revisit after generator contract |
| #1046 | live-provider / #1076–#1080 | owner-run QA | OPEN | revisit after generator contract |

## Duplicate and blocker report

- No duplicate was found among the 18 open GitHub issues returned for `cfornesa/ai-dev-tools-zoomcamp-1`.
- #1040 is a tracking/reconciliation parent, not an implementation unit.
- #788 is a narrowly authorized production-data workflow and must not be replaced by local evidence.
- #926, #1042, and #1046 require bounded live-provider/browser evidence; they remain in the ordered manifest and are not silently omitted.
- No new follow-up issue was discovered during distillation; newly discovered actionable work will be filed before leaving the current issue.

## Current transaction ledger

### #1076 — GROOMED → ENGINEERING

- Issue: https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1076
- Scope: `backend/ai_provider/prompts.py`, `backend/ai_provider/art_piece_provider.py`, focused provider tests; security evidence references existing sandbox/CSP tests.
- Stage 1: Codex / GPT-5 / default effort / substituted: no.
- Stage 2b roster: Ollama Cloud; actual: Codex / GPT-5 / default effort / substituted: yes (dispatch unavailable).
- Stage 3: not run (independent Mistral Vibe unavailable).
- Stage 4 and stage 5 are pending.
- Commit: `e7271b93`.
- Focused checks: provider/API tests 66 passed; full `tests -k art_piece` 181 passed; Ruff and mypy passed; frontend sandbox/CSP tests 36 passed; frontend typecheck passed; lint passed with existing warnings.
- QA: `## QA: PASS`, GitHub comment `5904939035`, provenance and criterion matrix recorded; stage 3 not run.
- Evidence boundary: local automated checks plus active Chrome inspection of the authenticated GitHub issue inventory; no deployed/live-provider criterion.
- Stage 5 readiness: pending batch-level production-readiness assessment; GPT-5 substitution will be flagged if the rostered Claude tier is unavailable.
- Final status: CLOSED / completed on GitHub. Shifted work: extraction, reason-coded validation, repair loop, and live showcase evidence remain in #1077–#1081 and #1042/#1046.

## Reconciliation checkpoint

The current transaction is terminal: #1076 is CLOSED before #1077 engineering begins. No new actionable follow-up was discovered; the existing dependency chain covers all shifted work.
