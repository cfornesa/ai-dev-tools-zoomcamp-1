# Backlog session transaction — Wave D — 2026-10-01

Project: `cfornesa/ai-dev-tools-zoomcamp-1`  
Branch: `docs/backlog-reevaluation-2026-09-27`  
Batch impact analysis: [Batch 16 refresh](backlog-session-2026-10-01-batch16-impact-refresh.md)

## Batch record

- **Ordered issues (milestone):** #1142 (Batch 16), after #1141 (closed in Wave C).
- **Impact surfaces:** canonical `PublicProjectViewer`, `CanonicalPublicPiece`, `PublicProjectCard`, related-project API wrapper, and `public2dRouteStageChrome.spec.ts` consumer from #1102.
- **Full-suite gate:** one final `UV_CACHE_DIR=/tmp/uv-cache-1142 make check` — PASS. Backend 1,942 passed / 41 skipped; frontend 315 files / 3,217 tests; Ruff, Prettier, mypy, TypeScript, frontend build passed.
- **Browser environment:** disposable local PostgreSQL at :55433, Django :8012, Vite :5012, `AI_PROVIDER=fake`; active Chrome at 1280×900 and 375×812. User services :5000/:8000 untouched. QA removed fixture rows, database, servers, and task-created Chrome tabs.
- **Stage 3:** not run.

## Issue row

| Issue | Phase | Implementation commits | Acceptance / QA result | GitHub status |
|---|---|---|---|---|
| #1142 | CLOSED | `7a4c7bb6`, `1eb8b1ab` | PASS. Canonical public 2D page shows related public cards after details; empty/failure responses omit the section; keyboard links work; no layout shift above stage. Embed, immersive, and owner editor do not show the row or issue a related request. Desktop/mobile screenshots pass with no horizontal overflow. Existing PublicProjectViewer tests and `public2dRouteStageChrome.spec.ts` remain unchanged and pass. | GitHub `closed/completed`; post-update fetch confirmed at 2026-10-01 21:51:22Z |

## Verification evidence

- Focused: `npm test -- --run src/api/projects.test.ts src/pages/RelatedPublicProjects.test.tsx src/pages/PublicProjectViewer.test.tsx src/pages/PublicProjectViewer.a11y.test.tsx` — 4 files / 44 tests passed.
- Browser: `E2E_BASE_URL=http://127.0.0.1:5012 E2E_ENV_FILE=/tmp/codex-1142-qa/backend.env UV_CACHE_DIR=/tmp/uv-cache-1142 npm run test:e2e -- --project=chromium e2e/relatedPublicProjects.spec.ts e2e/public2dRouteStageChrome.spec.ts` — 2 passed.
- Cross-route active Chrome: regular canonical page rendered cards at 1280×900 and 375×812; embed, canonical immersive 2D, and owner editor had no related section. Immersive was rechecked after restarting the isolated Vite process when the initial stale process served pre-fix transforms.
- Full check: `UV_CACHE_DIR=/tmp/uv-cache-1142 make check` — PASS, exactly once after the final fix.
- `git diff --check` — PASS.

## Residuals

- #1102's broader Linux/PostgreSQL migration gate was not run; its named `public2dRouteStageChrome.spec.ts` passed locally unchanged, which is not Linux evidence.
- No product gaps discovered. No new issue needed. No push or publish performed.
