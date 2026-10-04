# Continuous run — CI unblock and E2E cleanup

- **Branch / PR:** `docs/backlog-reevaluation-2026-09-27` / #1094.
- **Run order:** Goals 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15. Do not run Goal 5b; do not start #1193 or #1195.
- **Current state:** Goal 7 locally complete (with #1178 blocked on #1235); Goal 8 next. Stage 0 branch check passed: expected branch; handoff commit `0d1a2942` is in branch history; branch is ahead of origin. Do not push until goals are finished/blocked and their `make check`/PR-check conditions are met.
- **Environment/evidence boundary:** disposable local Compose PostgreSQL and fresh Vite on `127.0.0.1:5202` → backend `127.0.0.1:8003`; Chromium local macOS, unsandboxed due MachPort startup denial inside sandbox. Linux evidence: `Linux evidence PENDING (owner dispatch)`.
- **Provenance:** scoping from handoff/Claude issue contracts; implementation Codex / GPT-6, effort unavailable, substituted for the rostered service; independent QA/review not run. Track: mixed.

## Goal 7 — Wave 2D stage and geometry

| Issue | State | Commit | Focused evidence | QA matrix | Block / next action |
|---|---|---|---|---|---|
| #1188 | implemented / local QA passed | `a4cbcf7c` | `publicArtPiecePhoneStage.spec.ts`, `publicArtPieceMobileLayout.spec.ts`, #1083 regression; 375×812, 768×1024, 1280×900; 34-test union | [matrix](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1188#issuecomment-5979334928) | Linux evidence pending owner dispatch |
| #1189 | implemented / local QA passed | `68971664` | embed stage specs at 375×812 and 1280×900; 34-test union | [matrix](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1189#issuecomment-5979334910) | Linux evidence pending owner dispatch |
| #1175 | implemented / local QA passed | `f9229f02` | four stage/toolbar specs; 44px minimum, six visible controls; 34-test union | [matrix](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1175#issuecomment-5979334909) | Linux evidence pending owner dispatch |
| #1177 | implemented / local QA passed | `3e0db079` | content-panel shadow matrix; 4 presentations × 2 themes × 2 viewports; 34-test union | [matrix](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1177#issuecomment-5979334908) | Linux evidence pending owner dispatch |
| #1178 | dependency-blocked | — | strict center-pixel test fails because phone D-pad covers projected drawing center | [blocked matrix](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1178#issuecomment-5979334922) | #1235 owns product occlusion fix; preserve pixel assertion and rerun after #1235 |
| #1176 | implemented / local QA passed | `a611e4a8` | export toolbar unit suites: 3 files/65 passed; focused responsive browser case passed at 1280×900 and 375×812; included in 34-test union | [matrix](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1176#issuecomment-5979334929) | Linux evidence pending owner dispatch |
| #1228 | implemented / local QA passed | `48ecf0cb` | `aiPanelLayout2d.spec.ts` + `headerChrome.spec.ts` + `headerMobile.spec.ts` + `responsiveShell.spec.ts`; union 34/34; `make check`; inspected 1280×900 screenshot | [matrix](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1228#issuecomment-5979334920) | Linux evidence pending owner dispatch |

Goal 7 status: locally complete with #1178 dependency-blocked on #1235. Eligible 34-spec Chromium union (stage/toolbar/export/shared shell/AI panel) and `make check` passed; all seven issue QA matrices are posted. The #1178 pixel assertion stays unchanged. Record `Linux evidence PENDING (owner dispatch)`. No issue is closed. Next: Goal 8, diagnose #1171, #1185, #1186, #1181, #1182, #1183.

## Goal 8 — diagnosis first

Required order: #1171, #1185, #1186, #1181, #1182, #1183. Capture first-failure evidence; classify and comment. Fix test-only causes; file/link product issues for product causes. Do not modify gallery markup beyond #1181/#1182. Record cause/action/status table.

| Issue | State | Commit | QA matrix | Blocker / next action |
|---|---|---|---|---|
| #1171 | test-side failures cleared; one product-owned case remains | commit pending | pending issue comment | Focused local union: 13 passed / 1 failed; sole failure is AI refinement's saved version not receiving a captured thumbnail. New #1236 is in Batch 14 and owns it; baseline entry moved to #1236. Linux evidence pending owner dispatch. Next: #1185 |

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
