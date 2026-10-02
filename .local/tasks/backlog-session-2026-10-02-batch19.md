# Backlog session — batch 19 (2026-10-02)

## Scope and gate

Authenticated GitHub search returned 21 open issues: #1096, #1100, #1102–#1104,
#1129–#1130, #1138–#1140, #1143–#1144, and #1149–#1157. No issue is treated
as closed based on a local commit. Batch gate: **pending**; this record is a
continuation of the active backlog session, not a declaration that the project
batch is complete.

Owner choices now resolved: #1129 selected the private server-backed 2D
`Project.brief` field; #1130 selected owner-only history for structured 3D then
generated ArtPieces, tracked by #1156 and #1157. Their comments, `DECISIONS.md`,
and `docs/ligdol-adaptation.md` agree. Decision issues remain open until batch
reconciliation.

## Current manifest

| Issue | Milestone | Current state | Commit / next gate |
|---|---:|---|---|
| #1096 | 14 | Open; CI tracking/hand-off | Full 16-shard outcome and failure reconciliation |
| #1100 | 14 | Open; implementation/QA status carried from batch 18 | Linux Chromium six-spec gate |
| #1102 | 14 | Open; implementation/QA status carried from batch 18 | Linux Chromium child gate |
| #1103 | 14 | Open; QA failures carried from batch 18 | Resolve linked failures; Linux Chromium |
| #1104 | 14 | Open; QA failures carried from batch 18 | Resolve linked failures; Linux Chromium |
| #1129 | 16 | Owner decision recorded; awaiting batch reconciliation | Close only after batch gate |
| #1130 | 16 | Owner decision and follow-ups recorded; awaiting batch reconciliation | Close only after batch gate |
| #1138 | 16 | Implemented locally; batch QA pending | `d40f4a8a`; full impact/QA gate |
| #1139 | 16 | Implemented locally; visual/browser criterion pending | `3019c228`, `271678ea`; inspect 1280x900 and 375x812 |
| #1140 | 16 | Implemented locally; browser/CI criterion pending | `8100a4b9`; fake-provider E2E and full CI |
| #1143 | 16 | Implemented locally; batch/CI reconciliation pending | Prior batch record; fresh CI evidence pending |
| #1144 | 14 | Open; Linux/visual evidence pending | Full batch browser gate |
| #1149 | 16 | Open; local failures tracked in batch 18 | Resolve #1154 path and Linux browser gate |
| #1150 | 14 | Open; refined follow-up | E2E and Linux gate |
| #1151 | 14 | Open; refined follow-up | E2E and Linux gate |
| #1152 | 14 | Open; owner retargeted to preserve #142 | Focused test and Linux gate |
| #1153 | 14 | Open; refined follow-up | E2E and Linux gate |
| #1154 | 16 | Open; fake-provider Agent run follow-up | E2E/CI gate |
| #1155 | 14 | Open; disposable fixture guard | Full browser/CI gate |
| #1156 | 16 | Open; implementation committed; batch QA pending | `e28a57a3`; batch gate and Linux full-matrix reconciliation |
| #1157 | 16 | Open; depends on #1156 | Implement after #1156 |

Stage owner provenance for this continuation: stage 1 / Codex (this session) /
GPT-6 / effort not surfaced / substituted: no. Stage 2 for #1140 / rostered
Ollama Cloud / actual Codex (this session), GPT-6 / effort not surfaced /
substituted: yes. Stage 2 for #1156 / rostered Ollama Cloud / actual Codex
(this session), GPT-6 / effort not surfaced / substituted: yes. Stage 2 for
#1139 correction / rostered Opencode Go / actual
Codex (this session), GPT-6 / effort not surfaced / substituted: yes. Stage 3:
not run (no independent-family review). Stage 4: pending; no QA verdict or QA
comment has been posted in this continuation.

## Impact matrix — intent-note surfaces against all open issues

| Surface | Issue(s) | Open-issue collisions | Resolution / required re-verification |
|---|---|---|---|
| `backend/scenes/models.py`, migrations `0110`/`0111`, `docs/api.md`, account export/deletion, serializers, backup/sync, public projections | #1138, #1140 | #1130 decision, #1143 metrics contract, #1156/#1157 shared model/export docs | Preserve owner-only 2D field and export/deletion behavior; tests assert public/package/fork/cloud exclusion. #1156/#1157 own later history schema changes; migrations serialize after `0111`. |
| `backend/scenes/ai_runs.py`, `ai_runs_api.py`, `AIRun` model, `tests/test_ai_runs.py` | #1140 | #1154 AI-run fake-provider recovery; #1149 canonical AI Agent E2E; #1156 later 3D AI activity | Reuse one prompt builder for all attempts; note snapshot only for 2D; preserve empty-note prompt/digest bytes and 3D behavior. Re-run AI runs, corpus, layer-preservation and full backend suites. |
| `frontend/src/pages/EditorDetailsPanel.tsx` / test and metadata persistence | #1139 | #1138 contract/Project shape; public canonical route privacy criterion | Note uses existing metadata save path, helper/label/counter/clear and pending-save behavior covered by component tests; screenshot review at both specified viewports still required. |
| `frontend/src/pages/AIProposalPanel.tsx`, `AIRunPanel.tsx`, `useAIRun.ts`, `EditorWorkspace.tsx`, `frontend/e2e/aiIntentNotes.spec.ts` | #1140 | #1149 AI route retargeting; #1154 fake-provider Agent runs | Keep note disclosure confined to server-backed 2D Agent flow; per-request checkbox state resets; isolated E2E test checks disclosure and request opt-out. `aiAgent2d.spec.ts` test and expect counts are preserved for #1149. Current-SHA Linux CI run #36977977163 is the required browser evidence. |
| Full `make check` and shared AI/backend tests | #1138–#1140 | #1143 and all other open issues | Current local union gate passed: backend lint/format/typecheck and 2,038 collected tests; frontend lint (existing warnings), format/typecheck and 3,228 Vitest tests. CI full 16-shard run completed with browser failures. |
| `ProjectActivity` family FKs/constraint/index, shared activity view/cursor, 3D lifecycle and AIRun writers, private export, API docs | #1156 | #1133/#1148 2D projection/export; #1143 metrics; #1157 shared schema/view; #1096 Linux browser gate | Serialized after actual migration leaf `0111_airun_intent_note` as `0112`; preserved 2D response bytes with a golden test; separate 3D cursor salt; package intake/conversion/initial creation remain eventless; 2D metrics and public serialization unchanged. |

Open issue-body scan confirmed shared references: #1154 references `ai_runs.py`
and `test_ai_runs.py`; #1149 references `aiAgent2d.spec.ts`; #1138, #1143,
#1156, and #1157 reference `docs/api.md`; #1129/#1130 reference the decision
record. Other open issues remain listed in the manifest and in
`.local/tasks/backlog-session-2026-10-01-batch18.md`; no unrelated issue is
silently omitted from the batch.

## Verification and external run state

- Focused backend: `uv run ruff format ...`; `uv run pytest tests/test_ai_runs.py tests/test_account_deletion.py` → 90 passed, 4 skipped.
- Migration drift: `DJANGO_SETTINGS_MODULE=backend.test_settings uv run python manage.py makemigrations --check --dry-run` → no changes detected.
- Focused frontend: `npm test -- --run src/pages/AIProposalPanel.test.tsx src/pages/EditorDetailsPanel.test.tsx` → 39 passed; typecheck and format passed; lint exited successfully with repository warnings.
- Full local `UV_CACHE_DIR=/tmp/codex-uv-cache-batch19 make check`: backend and frontend gates completed; backend collected 2,038 tests; frontend Vitest reported 316 files / 3,228 tests passed. Existing lint/deprecation/media stubs emitted warnings.
- E2E discoverability: `npx playwright test --list e2e/aiAgent2d.spec.ts` → 5 tests listed; `npx playwright test --list e2e/aiIntentNotes.spec.ts` → 1 test listed. The #1140 test is isolated so #1149's test and expect counts remain at baseline. Real E2E is not run locally because the current browser tab is anonymous and the running local stack is not verified as disposable; never run fixture setup against a shared database.
- Push of `9db8a58480bfcf5b6493623ad341b5dbe54e0dd6` to the already-authorized branch updated PR #1094; no merge was performed.
- PR run `36977203802` on `8100a4b9` was cancelled after the follow-up test relocation; manual full 16-shard run `36977291895` was superseded. Corrected full 16-shard run `36977977163` finished on SHA `9db8a58480bfcf5b6493623ad341b5dbe54e0dd6`: workflow validation, backend, frontend, and disposable published-routing smoke passed; browser shards 1–16 failed. Failing specs include the open helper-migration/retarget issues (#1100–#1104, #1144, #1149–#1153) plus additional unmapped failures. The run predates #1156 commit `e28a57a3`; dispatch a fresh current-head run after this implementation wave. No merge was performed.
- #1156: commit `e28a57a3`. `UV_CACHE_DIR=/tmp/codex-uv-cache-batch19 make backend-check` passed Ruff, formatting, mypy, and pytest (2,003 passed, 43 skipped). Focused union after adding package-import/conversion eventless regressions: 169 passed, 5 skipped. `DJANGO_SETTINGS_MODULE=backend.test_settings uv run python manage.py makemigrations --check --dry-run` → no changes detected. The issue's `tests/test_ai_api3d.py` path is stale; used current `tests/test_ai_scene3d_api.py`.
- Remaining boundaries before any #1138–#1140 QA PASS: inspect rendered #1139 screenshots at 1280x900 and 375x812; obtain #1140 fake-provider browser evidence; finish impact-matrix cross-check and review current CI results. No `## QA` comments or GitHub state changes have been made for these issues.

## Reconciliation rule

Do not close issues until the complete ready batch's QA/matrix gate passes or the
issue has a documented terminal hand-off/blocker with next owner/action. Browser
contracts requiring Linux evidence must use CI; local source, component, and
list-only E2E checks do not substitute. PR #1094 remains open and unmerged.
