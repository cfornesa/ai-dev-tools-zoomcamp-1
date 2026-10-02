# Backlog session — Batch 18 — 2026-10-01 continuation

## Batch record

- Repository: `cfornesa/ai-dev-tools-zoomcamp-1`; one Django/React codebase with local and Replit deployment tracks.
- Scope: currently open issue inventory refreshed through authenticated GitHub on 2026-10-02: 19 open issues (#1096, #1100, #1102–#1104, #1129–#1130, #1138–#1140, #1143–#1144, #1149–#1155). The initial engineering transaction implemented #1155 under explicit owner authorization; later owner decisions retargeted #1152 and selected #1143's indexed full-history/hard-timeout strategy. The later batch-wide authorization makes #1143 eligible again. Other E2E issues retain their Linux verification boundaries; owner-decision/dependency-blocked items remain separately tracked.
- Branch/starting commit: `docs/backlog-reevaluation-2026-09-27` / `797a8732`.
- Workflow boundary: owner authorization permits edits to `.github/workflows/ci.yml` only for #1155's existing E2E and staging jobs. No push, workflow dispatch, merge, production DB access, or shared DB fixture use.
- Batch gate: **FAIL / verification boundary**. Local unit, static, and isolated PostgreSQL Chromium smoke checks pass; the Linux Chromium/PostgreSQL gate and full impacted 16-shard matrix remain unrun, so no issue closure is eligible.
- Environment: #1155 tests use SQLite pytest or disposable local PostgreSQL only; CI/staging wiring is changed but not dispatched.

## Open issue manifest

| Issue | Milestone | Dependencies / state | Batch disposition | Stage owners (scope / impl / review / QA / gate) |
|---|---:|---|---|---|
| #1096 | 14 | Parent CI tracker; requires all children plus Linux full 16-shard evidence | Open; verification-boundary / residual failure mapping | Codex GPT-6.1-sol / effort unavailable; other stages pending |
| #1100 | 14 | Helper foundation complete; Linux Chromium criterion pending | Open; verification-boundary | prior ledger |
| #1102 | 14 | #1100; Linux Chromium/WebKit criterion pending | Open; verification-boundary | prior ledger |
| #1103 | 14 | #1100; latest combined local failure assigned #1152; Linux pending | Open; QA fail / owner contract dependency | prior ledger |
| #1104 | 14 | #1100; local pass, Linux criterion pending | Open; verification-boundary | prior ledger |
| #1129 | 16 | Owner decision | Open; decision-pending | not run |
| #1130 | 16 | Owner decision | Open; decision-pending | not run |
| #1138 | 16 | #1129 | Open; dependency-blocked | not run |
| #1139 | 16 | #1129/#1138 | Open; dependency-blocked | not run |
| #1140 | 16 | #1129/#1138 | Open; dependency-blocked | not run |
| #1143 | 16 | Dependencies #1131–#1133 closed; owner selected indexed full-history query with hard timeout and retryable response; owner clarified reviewable-proposal denominator | Open; implementation complete locally, Stage 4 in progress; 1280x900/375x812 active-Chrome inspection remains pending | PM Codex GPT-6.1-sol / effort unavailable; Stage 2b Codex substitution; Stage 3 not run; Stage 4 Codex substitution |
| #1144 | 14 | #1100; Linux/browser evidence pending | Open; verification-boundary | prior ledger |
| #1149 | 16 | #1100; local failures and #1154 dependency evidence in prior ledger; Linux pending | Open; implementation/verification reconciliation | prior ledger |
| #1150 | 14 | Discovered E2E locator follow-up; local criterion passes, Linux pending | Open; verification-boundary | prior ledger |
| #1151 | 14 | Owner-approved toggle contract; local criterion passes, Linux pending | Open; verification-boundary | prior ledger |
| #1152 | 14 | Owner selected preserve #142; retarget to layer-level keyboard moves | Open; local implementation and QA pass; Linux gate pending | implementation Codex GPT-6 substitution; stage 3 not run; QA Codex GPT-6 self-review substitution; Linux gate pending |
| #1153 | 14 | Local fixture migration passes; Linux pending | Open; verification-boundary | prior ledger |
| #1154 | 14 | Backend scope regression tests pass; required Linux AI Agent E2E and per-run diagnostic table remain outstanding | Open; QA FAIL / verification-boundary | prior ledger + current QA below |
| #1155 | 14 | Owner-authorized, refined data-mutation guard; this transaction | HANDED-OFF — local QA pass; Linux verification boundary | scope Codex GPT-6.1-sol / effort unavailable; impl Codex GPT-6.1-sol / effort unavailable, substituted yes; stage 3 not run; QA Codex GPT-6.1-sol / effort unavailable, substituted yes; stage 5 not run |

## Impact matrix — #1155 shared fixture lifecycle

| Surface | Kind | Issues in scope | Other open issues referencing / depending on surface | Collision / invalidation | Re-verification |
|---|---|---|---|---|---|
| `backend/scenes/management/commands/e2e_fixtures.py` | change | #1155 | #1096, #1100, #1102–#1104, #1144, #1149–#1154 | New mandatory marker, explicit env file, disposable name policy, and matching target fingerprint affect every fixture action | Backend action-by-action rejection matrix; positive environment cases; isolated PostgreSQL smoke; all affected browser suites and Linux matrix |
| `frontend/e2e/support/fixtureCommand.ts` (new), `state.ts` | add/change | #1155 | #1096, #1100, #1102–#1104, #1144, #1149–#1154 | Central target resolver and setup fingerprint passed to later mutators; state schema now includes fingerprint | Typecheck/lint/format; resolver tests; setup/teardown target equality |
| `global-setup.ts`, `global-teardown.ts`, `resetSessions.ts`, `publicMediaFixture.ts`, `accountDeletion.spec.ts` | change | #1155 | #1096, #1100, #1102–#1104, #1144, #1149–#1154 | Five independent env fallback blocks become one; public media and per-file reseed now require setup identity | Grep no fallback copies; positive and negative resolver checks; exact E2E callers |
| `.github/workflows/ci.yml` (`e2e-browser`, `staging-authenticated-smoke`) | change | #1155 | #1096 and every browser child using these jobs | Owner explicitly authorized marker and env-file wiring only; no other workflow behavior changes | actionlint/workflow validation; inspect exact diff; CI not dispatched |
| `scripts/smoke-local.sh`, `scripts/browser-qa.sh`, `README.md` | change | #1155 | browser acceptance issues above | Browser QA supplies its own disposable marker; smoke requires explicit env target and fingerprints cleanup | shell syntax/check; disposable local smoke |
| `frontend/src/e2e/fixtureCommand.test.ts`, `backend/tests/test_e2e_fixtures_command.py`, `backend/tests/test_dev_account.py` | add/change | #1155 | fixture safety regression constraints; persistent `dev_account` is intentionally excluded from fixture lifecycle | Verify all five actions reject safely and persistent dev account survives | Focused pytest and Vitest; full relevant suites |
| `backend/tests/test_browser_qa_configuration.py` | change | #1155 | #1096 and browser children through shared E2E setup | Existing source-contract assertion referenced per-hook env resolution; retargeted to assert the centralized fail-closed resolver contract | Focused test and full backend suite |
| `AGENTS.md` | no edit | #1155 | operator instructions | Human-edited file; issue requires proposed patch in issue instead of local edit | Add suggested snippet to #1155 QA comment |

## Impact matrix — #1152 layer-level keyboard reorder retarget

| Surface | Kind | Issues in scope | Other open issues referencing / depending on surface | Collision / invalidation | Re-verification |
|---|---|---|---|---|---|
| `frontend/e2e/layersPanel.spec.ts` | change | #1152 | #1103; #1111/#1114; #1150/#1151 | Replaces invalid same-layer top-level shape premise with adjacent shape layers, then proves pointer/keyboard parity while preserving #142 and #194 invariants | Focused Chromium/PostgreSQL E2E, focused outline/component unit tests, full frontend suite and static checks; Linux Chromium/PostgreSQL remains required |

## Impact matrix — #1154 fake-provider Agent recovery

| Surface | Kind | Issues in scope | Other open issues referencing / depending on surface | Collision / invalidation | Re-verification |
|---|---|---|---|---|---|
| `backend/tests/test_ai_runs.py` | test-only change (`5e988499`) | #1154 | #1149 (canonical 2D/3D Agent runs), #1096 (browser matrix parent); #1103/#1150 consume the no-target fake outcome | Explicitly asserts empty `error_reason` on 2D/3D create and selected-edit runs; default no-target fake payload remains covered byte-for-byte | Focused four-file pytest set, full backend gate, Linux #1154 AI Agent E2E and full #1096 16-shard matrix |

## Impact analysis — #1143 continuity metrics (pre-implementation)

| Surface | Planned kind | Issues in scope | Other open issues referencing / depending on surface | Collision / resolution | Required re-verification |
|---|---|---|---|---|---|
| `docs/api.md` | additive contract documentation before endpoint code | #1143 | #1138 also updates this API contract document; #1130 is the unresolved choice about activity beyond 2D | Keep #1143's contract in a separate section and constrain it to the existing 2D `Project`/`ProjectActivity` domain; do not resolve #1130 or add 3D/generated activity | API-doc diff review; focused endpoint tests; cross-check #1138 intent-note API wording remains unchanged |
| `backend/scenes` metrics service/API and `backend/scenes/urls.py` | add, route additive owner-only read | #1143 | #1138 changes the `Project` data contract; #1140 changes AI prompt construction; #1154 changes private AI-run scope classification | Read existing `Project`, `ProjectActivity`, and `AIRun` records only; no model, schema, retry, or prompt changes; use `is_application_admin` | Synthetic full-history aggregation, privacy suppression and permission tests; backend full suite; inspect SQL timeout/error path |
| Existing admin console panel and admin API wrapper | add isolated read-only section | #1143 | #1150 touches admin-settings E2E controls but not their scene-save contract | Keep metrics request/error state independent from settings forms so timeout does not affect existing settings load/save behavior | Admin panel tests, responsive 1280x900/375x812 render inspection in active Chrome if available, frontend full suite/static checks |

## Duplicate and dependency reconciliation

No new independent issue discovered yet. #1155's shared-surface impact applies to existing browser issues but does not change their finite test criteria. The existing browser migration children are implemented and await Linux gates; local helper changes are sequenced after those implementation commits as refined. #1129/#1130 remain owner-decision items. #1152's owner decision resolved the conflict in favor of preserving #142, and its retargeted test passes locally; Linux remains the closure gate. #1138–#1140 remain dependency-blocked. #1143 is eligible under the later batch-wide authorization and has now been implemented locally.

## #1152 implementation and QA evidence

- Retargeted issue acceptance with the owner's decision to preserve #142; issue remains open pending Linux verification.
- Changed `frontend/e2e/layersPanel.spec.ts` only: the spec creates separate shape layers, checks pointer reordering reverses both panel and canvas order, uses focus + Enter for keyboard Move down, checks original order restoration, then continues through save/reload persistence.
- Focused outline/component unit tests: 127 passed. Full frontend Vitest: 316 files, 3,223 tests passed. Typecheck, format check, and lint exited successfully (lint reports existing repository warnings).
- Isolated local PostgreSQL + installed Chrome: `layersPanel.spec.ts` 3 passed, 0 failed, 0 skipped. Linux Chromium/PostgreSQL has not run; keep #1152 open until that required gate passes.

## Batch QA refresh — full static/unit gate and browser-run interruption

- `UV_CACHE_DIR=/tmp/codex-uv-cache-1155 make check` exited 0 on macOS. Backend action-pin validation, Ruff lint/format, mypy, the full backend pytest suite, frontend lint/format/typecheck, and all 3,223 frontend Vitest tests passed. Frontend lint retains pre-existing warnings. The backend suite collected 2,024 cases; its PostgreSQL-only skips remain environment-gated.
- A full Chromium suite attempt in the managed sandbox could not launch Chrome (`browserType.launch: Target page, context or browser has been closed` before application assertions). The identical unsandboxed attempt was interrupted at the owner's request to stop repeated browser launches; it produced no complete suite result and is not counted as QA evidence.
- Per the owner's instruction, no further Playwright/Chrome process was launched. The existing Chrome extension session was used directly to open the isolated local app at `http://127.0.0.1:5012`; the gallery rendered, and only the task-created tab was closed. The temporary app servers, isolated PostgreSQL cluster, and E2E fixtures were stopped/removed; fixture counts were verified as zero before cluster removal.
- Batch gate remains **FAIL / verification boundary** for E2E issues: the Linux Chromium/PostgreSQL checks and full fixed-ref 16-shard workflow have not been run. The repo remains local-only on the existing branch; no workflow dispatch or push occurred.

## #1155 implementation and QA evidence

- Implementation commit: `70d30d9b8ac8a5014462db0f712ce36fab548a91` (`Guard E2E fixture mutations for #1155`). QA comment: [#5944937281](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1155#issuecomment-5944937281). QA reconciliation is a separate documentation-only commit.
- Backend focused regression set: 56 passed, 0 skipped, including all five mutating actions crossed with six invalid selections against a seeded user/project/version baseline; all five explicit environment classes are positively authorized only under their required conditions.
- Full backend: 1,982 passed, 41 skipped; `ruff check`, `ruff format --check`, and `mypy` passed.
- Frontend full Vitest: 3,223 passed; typecheck and format passed. Lint passed with the repository's existing warnings.
- Isolated PostgreSQL Chromium smoke: `projectLifecycle.spec.ts` passed 6/6 with installed Chrome. Playwright setup created fixtures; teardown cleanup was verified with zero fixture users/projects/versions afterward. The isolated cluster ran on port 55439 and was stopped/removed.
- Restoration proof: a temporary run of the pre-#1155 command accepted unmarked fixture create/cleanup against a fresh isolated database; restoring the guard caused the same unmarked create to fail with `Fixture mutation refused` and left counts at zero. No production/shared DB was involved.
- Workflow validation: `scripts/check-github-action-pins.py`, `actionlint .github/workflows/ci.yml`, shell syntax, `git diff --check`, and resolver fallback search passed. No workflow dispatch or push.
- `make browser-qa` could not use Docker because the daemon is unavailable, so QA used a temporary local PostgreSQL cluster. Linux CI was not run; the issue's explicit Linux Chromium/PostgreSQL gate and full affected E2E matrix remain the exact next action.

## Current PR CI reconciliation — 2026-10-01

- Read GitHub Actions run `36797311618` in the active Chrome/GitHub session and fetched the failed job log. The run tested PR #1094 head `c2ea356d8d5e969f2fc729ac04d2b71c4afed8c7`, not this checkout's `f8e711fe91ec523eb854eda2b9a1e612ba2806d3`.
- Workflow validation, backend checks, frontend checks, and disposable published-routing smoke passed. The browser job's focused public-media and WebKit Escape steps passed. Its smoke suite had 15 failed, 3 not run, and 6 passed; every failure stopped at `frontend/e2e/support/createProject.ts:54`, where the stale UI helper waited for a server-backed edit response after current Gallery creation had moved local-first.
- This cause is already tracked by #1100 and its migration children. Because the CI commit predates the local helper migrations and all current local changes, this run is diagnostic evidence only, not verification of those changes. It does not satisfy the Linux gate for #1100, #1102–#1104, or the full #1096 matrix.
- GitHub's refreshed open-issue search returned 18 open issues: #1096, #1100, #1102–#1104, #1129–#1130, #1138–#1140, #1143–#1144, and #1149–#1155. In particular, #1152 remains open; no closure is inferred from local commits or QA notes.
- Before this evidence update, the working tree had no uncommitted code changes; the branch was `ahead 138` of `origin/docs/backlog-reevaluation-2026-09-27`. No push, dispatch, or merge was performed.

## #1154 independent QA reconciliation — 2026-10-01

- Intake: re-fetched the current GitHub issue and reviewed implementation commit `840257b4` as untrusted input. It changes the fake provider, the private Agent scope validator, focused tests, and one canonical-editor expectation; no route, API response, schema, migration, or dependency changed. The 2D E2E assertion was retargeted from the retired preview to the accepted generated shape in the canonical Layers panel; scenario title and intent remain.
- QA found that the backend state-machine regressions proved `awaiting_review` but did not explicitly prove the refined requirement `error_reason == ""`. Returned #1154 to Stage 2b and added those assertions for both 2D/3D create and selected-edit runs in `5e988499`; no product behavior changed.
- Regression baseline replay passed: with the pre-fix root-ID classifier temporarily substituted in memory, `test_target_scope_ignores_document_identity_but_guards_document_fields_and_order` fails as expected. No source file was modified for this replay.
- Exact focused backend command: `cd backend && UV_CACHE_DIR=/tmp/codex-uv-cache-1154 uv run pytest tests/test_ai_runs.py tests/test_e2e_provider_3d.py tests/test_ai_provider_matrix.py tests/test_ai_drawing_plane_edit.py` — 150 passed, 3 skipped, 0 failed.
- `UV_CACHE_DIR=/tmp/codex-uv-cache-1154 make backend-check` — Ruff check/format and mypy passed; 1,983 backend tests passed, 41 environment-gated skips.
- `cd frontend && npm run typecheck && npm run lint && npm run format:check` — passed; lint exits 0 with existing repository warnings.
- Verdict: **QA FAIL / verification boundary**. The refined six-scenario per-run `GET /api/ai/runs/<id>/` diagnostic table is absent from the issue thread and could not be reconstructed from durable run artifacts in this checkout. The required Linux Chromium/PostgreSQL command (`npm run test:e2e -- e2e/aiAgent2d.spec.ts e2e/aiAgent3d.spec.ts --project=chromium`) was not run; the owner-directed no-new-Playwright boundary was respected. The latest inspected CI run is on stale `c2ea356`, not the implementation tree. No push or dispatch is authorized; #1154 remains open until the missing diagnostic and Linux evidence are reconciled.
- Provenance: Stage 2b was performed by Codex as a substitute for Ollama Cloud/Kimi K3; exact prior effort is unavailable. Stage 3 was not run. This Stage 4 review and correction used Codex as a substitute for Claude Sonnet 5/Medium; `ACCEPTED-WITH-FIXES` for test-coverage assertions only. No issue state change was made.

## Batch gate refresh — full local baseline check before #1143 implementation on 2026-10-02

- `UV_CACHE_DIR=/tmp/codex-uv-cache-batch18 make check` exited 0. Action-pin check, Ruff, format check, mypy, backend pytest (**1,983 passed, 41 skipped**), frontend lint, Prettier, TypeScript typecheck, and Vitest (**316 files, 3,223 tests passed**) all passed. Backend emitted 10 existing deprecation warnings; frontend lint exited 0 with existing warnings.
- This is the current full local static/unit gate; it does not satisfy any issue's Linux Chromium/PostgreSQL requirement or #1096's full 16-shard workflow. No Playwright browser process was launched.
- An inspection request against an already-open local app tab in the active Chrome session timed out awaiting `Emulation.setFocusEmulationEnabled`. No second browser was launched; this timeout is not treated as rendered evidence or as proof Chrome quit.
- #1143's full-history query strategy is selected. The owner clarified that accepted share uses reviewable proposals as the denominator. The clarified API contract, endpoint, aggregate panel, and synthetic tests are now implemented locally; see the current Stage 4 entry below.

## #1143 implementation and Stage 4 QA — 2026-10-02

- The owner approved reviewable proposals as the acceptance denominator; the definition excludes provider failures and pre-review cancellations and includes awaiting-review, accepted, and recorded rejected proposals. The complete decision and five-second timeout contract was posted to GitHub issue #1143 before endpoint code, then documented in `docs/api.md`.
- Added `/api/admin/continuity-metrics/`, protected by the existing application-admin permission path. Its single aggregate SQL query covers lifetime 2D project cohorts at positions 1–3, uses existing project foreign-key joins for run/activity rollups, suppresses cohorts below five owners, and returns no per-user/project identifiers or content. PostgreSQL cancels the statement after 5 seconds; cancellation returns retryable 503 without partial results.
- Added the isolated “Project continuity” panel to existing admin settings with independent loading/error/retry state and visible metric definitions. Layout uses three cards at desktop widths and one column on mobile.
- Focused verification passed: backend `tests/test_continuity_metrics_api.py` (3 passed); Ruff check for changed backend files; frontend API and AdminSettings Vitest (10 passed); frontend TypeScript, lint (existing repository warnings only), and Prettier checks.
- Full `make check` passed after the implementation and mypy narrowing fix: backend Ruff/format/mypy and **1,986 passed, 41 skipped**, frontend static checks and **3,225 passed**. After the final model-table introspection refinement, the focused backend tests (3 passed), changed-file Ruff, and changed-module mypy passed again. Active Chrome remains running per `cua.getState()`, but the earlier existing-local-tab focus command timed out. No second browser was launched and no browser screenshot is being claimed. 1280x900/375x812 rendered inspection and PostgreSQL cancellation behavior remain unverified; issue #1143 stays open pending evidence.
- No migration, new dependency, schema change, worker, cache, push, workflow dispatch, or issue closure was made.
