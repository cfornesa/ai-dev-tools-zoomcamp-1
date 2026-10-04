# Continuous run — CI unblock and E2E cleanup

- **Branch / PR:** `docs/backlog-reevaluation-2026-09-27` / #1094.
- **Run order:** Goals 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15. Do not run Goal 5b; do not start #1193 or #1195.
- **Current state:** Goal 7 in progress. Stage 0 branch check passed: expected branch; handoff commit `0d1a2942` is in branch history; branch is ahead of origin. Do not push until goals are finished/blocked and their `make check`/PR-check conditions are met.
- **Environment/evidence boundary:** disposable local Compose PostgreSQL and fresh Vite on `127.0.0.1:5202` → backend `127.0.0.1:8003`; Chromium local macOS, unsandboxed due MachPort startup denial inside sandbox. Linux evidence: `Linux evidence PENDING (owner dispatch)`.
- **Provenance:** scoping from handoff/Claude issue contracts; implementation Codex / GPT-6, effort unavailable, substituted for the rostered service; independent QA/review not run. Track: mixed.

## Goal 7 — Wave 2D stage and geometry

| Issue | State | Commit | Focused evidence | QA matrix | Block / next action |
|---|---|---|---|---|---|
| #1188 | implemented locally | `a4cbcf7c` | public-art phone stage specs; #1083 regression; viewports 375×812, 768×1024, 1280×900 | pending batch gate | Include in Goal 7 gate; Linux pending |
| #1189 | implemented locally | `68971664` | embed stage specs at 375×812 and 1280×900 | pending batch gate | Include in Goal 7 gate; Linux pending |
| #1175 | implemented locally | `f9229f02` | four stage/toolbar specs; approved 44px boundary; six visible controls | pending batch gate | Include in Goal 7 gate; Linux pending |
| #1177 | implemented locally | `3e0db079` | content-panel shadow matrix; 4 presentations × 2 themes × 2 viewports | pending batch gate | Include shared-shell specs in Goal 7 gate; Linux pending |
| #1178 | dependency-blocked | — | strict center-pixel test fails because phone D-pad covers projected drawing center | pending diagnostic comment | Product follow-up #1235; preserve pixel assertions and rerun after #1235 |
| #1176 | local pass / QA pending | `a611e4a8` | `npx vitest run src/export/exportStageToolbar.test.ts src/export/generateHtmlExport.test.ts src/export/generateHtmlExport3D.test.ts` — 3 files/65 passed; `E2E_BASE_URL=http://127.0.0.1:5202 E2E_FIXTURE_ENVIRONMENT=disposable-compose E2E_DOCKER_COMPOSE=true npx playwright test e2e/exportArtifacts.spec.ts --project=chromium --grep "stacks labeled actions and confines scrolling"` — 1 passed, 0 skipped at 1280×900 and 375×812; Prettier passed. Inspected both screenshots: all three 44px controls visible, no viewport overflow. | pending batch gate | Linux pending owner dispatch; run batch gate and post QA matrix |
| #1228 | not started | — | — | pending | Read refinement and issue; reserve space only on unified editor panels, preserve #1158 |

Goal 7 gate: pending union of focused specs, existing stage/toolbar regressions, `make check`, shared-surface regressions, and per-issue QA matrices. No issue is closed.

## Goal 8 — diagnosis first

Not started. Required order: #1171, #1185, #1186, #1181, #1182, #1183. Capture first-failure evidence; classify and comment. Fix test-only causes; file/link product issues for product causes. Do not modify gallery markup beyond #1181/#1182. Record cause/action/status table.

## Goal 9 — public discoverability

Not started; only after Goal 8. Required order: #1199, #1200, #1201, #1198, #1197, #1203, #1202, #1204. Owner decision #1196: server-side injection plus noscript fallback; no prerender, SSR, or new dependency. Preserve `llms.txt` except #1204.

## Goal 10 — public MCP server

Not started. Issues #1210, #1211, #1212, #1213, #1214. Use the approved official `mcp` Python SDK; owner-approved dependency is added with `uv add mcp`; contract docs precede contract changes. Verify privacy states and run focused backend/client checks plus `make check`.

## Goal 11 — security check and OAuth foundation

Not started. #1215 first and alone, then #1216 and #1217. Verify anonymous/non-owner/owner access on both accept-proposal routes; any anonymous write is a stop condition and P0 filing. Use approved `django-oauth-toolkit`, PKCE S256, exact redirects, preregistered admin-only clients and owner-approved scopes.

## Goal 12 — authenticated MCP tools

Not started; only after Goal 11 completes #1216/#1217. Required order: #1218, #1220, #1221, #1222, #1219. Every tool needs REST contract, non-owner/not-found and scope tests; `AI_PROVIDER=fake` for AI tests.

## Goal 13 — MCP Apps gallery widget

Not started; only after Goal 10. Verify current SEP-1865 status/client support from primary sources. If no supporting clients are available, leave unverified and record the limitation. Public tools only; narrow sandbox/CSP; text fallback.

## Goal 14 — PR gate widening

Not started; only after #1179 is committed and all four required PR checks are green on current head. #1224 owns only the offline core-journey spec list and CI-tier table change. Do not widen if any of the three focused specs fails.

## Goal 15 — Finish

Not started. Verify remaining "Open piece controls menu" references are menu-mode only. If any test needs the inert shim, leave it and report; otherwise #1187, focused specs, and `make check`, then remove passing #1180 owner-flow baseline entries. No #1193/#1195. Final report must list remaining open issues and owner next steps.

## Per-issue progress

Update this file in the same issue commit with the issue state/hash and after every goal with gate, QA links, remaining open issues, and next step. After each final push, watch PR #1094 checks using read-only commands. No workflow dispatches, merges, or issue closures.
