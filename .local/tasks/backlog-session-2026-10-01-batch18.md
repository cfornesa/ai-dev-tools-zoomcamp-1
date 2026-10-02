# Backlog session — Batch 18 — 2026-10-01 continuation

## Batch record

- Repository: `cfornesa/ai-dev-tools-zoomcamp-1`; one Django/React codebase with local and Replit deployment tracks.
- Scope: currently open issue inventory refreshed through authenticated GitHub on 2026-10-01. The initial engineering transaction implemented #1155 under explicit owner authorization; a later owner decision retargeted #1152 and its test correction was committed separately. Other ready E2E issues retain their previous implementation and Linux verification boundaries; owner-decision/dependency-blocked issues remain skipped with their state recorded below.
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
| #1143 | 16 | Owner paused implementation after selecting bounded full-history strategy | Open; owner-paused | not run |
| #1144 | 14 | #1100; Linux/browser evidence pending | Open; verification-boundary | prior ledger |
| #1149 | 16 | #1100; local failures and #1154 dependency evidence in prior ledger; Linux pending | Open; implementation/verification reconciliation | prior ledger |
| #1150 | 14 | Discovered E2E locator follow-up; local criterion passes, Linux pending | Open; verification-boundary | prior ledger |
| #1151 | 14 | Owner-approved toggle contract; local criterion passes, Linux pending | Open; verification-boundary | prior ledger |
| #1152 | 14 | Owner selected preserve #142; retarget to layer-level keyboard moves | Open; local implementation and QA pass; Linux gate pending | implementation Codex GPT-6 substitution; stage 3 not run; QA Codex GPT-6 self-review substitution; Linux gate pending |
| #1153 | 14 | Local fixture migration passes; Linux pending | Open; verification-boundary | prior ledger |
| #1154 | 14 | Local fake-provider flow passes; Linux pending | Open; verification-boundary | prior ledger |
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

## Duplicate and dependency reconciliation

No new independent issue discovered yet. #1155's shared-surface impact applies to existing browser issues but does not change their finite test criteria. The existing browser migration children are implemented and await Linux gates; local helper changes are sequenced after those implementation commits as refined. #1129/#1130 remain owner-decision items. #1152's owner decision resolved the conflict in favor of preserving #142, and its retargeted test passes locally; Linux remains the closure gate. #1138–#1140 remain dependency-blocked; #1143 remains explicitly paused.

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
