# Backlog session transaction — Wave C — 2026-10-01

Project: `cfornesa/ai-dev-tools-zoomcamp-1`  
Branch: `docs/backlog-reevaluation-2026-09-27`  
Batch record: [live backlog and impact refresh](backlog-session-2026-10-01-batch16-impact-refresh.md)

## Batch record

- **Ordered issues (milestone):** #1136 (Batch 16) → #1137 (Batch 16); #1141 (Batch 16); #1148 (Batch 16).
- **Impact matrix:** Batch 16 refresh, especially the VersionHistoryPanel, `.version-comparison*`, API/export, public related-project, and full-browser-matrix rows.
- **Full-suite result / batch gate:** Stage 4 PASS for the combined batch. `UV_CACHE_DIR=/tmp/uv-cache-wavec make check` passed once: backend 1,942 passed / 41 skipped; frontend 314 files / 3,212 tests; lint, format, and typecheck passed (existing Oxlint warnings only).
- **Environment and fixtures:** local macOS; unit tests use repository test DB. Browser QA used a disposable native PostgreSQL cluster (:55432), Django (:8011), Vite (:5011), and `AI_PROVIDER=fake`; active Chrome only. Fixture data and services were removed. Existing :5000/:8000 services were not used.
- **Stage 3:** not run.
- **GitHub state:** pending closure operations and typed read-after-write confirmation. No issue should be described as closed until the response/read confirms `closed`.

## Issue rows

| Issue | Phase | Implementation commit | Acceptance / QA result | GitHub status |
|---|---|---|---|---|
| #1136 | CLOSED | `93dfe777` | PASS. Deterministic, schema-validated bounded 2D scene diff; covers nested paths, reorder/add/remove, omitted counts, invalid input, immutability, and <50 ms schema-limit assertion. | GitHub `closed/completed`, read-after-write confirmed 2026-10-01 21:14:55Z |
| #1137 | CLOSED | `cb164ecc` | PASS. Pairwise “Compare with…” UI within Versions tab; non-mutating, loading/empty/error states; active Chrome 1280×900 and 375×812, no horizontal overflow, internal long-list scrolling. | GitHub `closed/completed`, read-after-write confirmed 2026-10-01 21:14:58Z |
| #1141 | CLOSED | `a1050763` | PASS. Related public projects endpoint enforces public eligibility, caps candidate work and response, deterministic ranking, expected card shape, and three-query bound. | GitHub `closed/completed`, read-after-write confirmed 2026-10-01 21:15:01Z |
| #1148 | CLOSED | `db102898` | PASS. Owner JSON export adds only allowlisted activity, newest-first with ID tie-break, owner scoped, includes retained soft-deleted projects; ZIP and other payloads unchanged. | GitHub `closed/completed`, read-after-write confirmed 2026-10-01 21:15:04Z |

## Verification evidence

- Focused frontend: `cd frontend && npm test -- --run src/pages/sceneDiff.test.ts src/pages/VersionHistoryPanel.compare.test.tsx src/pages/VersionHistoryPanel.activity.test.tsx src/pages/VersionHistoryPanel.a11y.test.tsx` — 18 passed.
- Focused backend: `UV_CACHE_DIR=/tmp/uv-cache-wavec uv run pytest tests/test_public_related_projects_api.py -q` — 5 passed; `UV_CACHE_DIR=/tmp/uv-cache-wavec uv run pytest tests/test_account_export.py -q` — 9 passed.
- Playwright: `E2E_BASE_URL=http://127.0.0.1:5011 E2E_ENV_FILE=/tmp/codex-wave-c-qa/backend.env UV_CACHE_DIR=/tmp/uv-cache-wavec npm run test:e2e -- --project=chromium e2e/versionHistoryCompare.spec.ts e2e/projectActivityHistory.spec.ts` — 2 passed.
- Full gate: `UV_CACHE_DIR=/tmp/uv-cache-wavec make check` — PASS, exactly once for this batch.
- `git diff --check 93dfe777^..HEAD` — PASS.
- Independent Stage 4 found no acceptance-criteria failures or cross-issue regressions and made no product/test changes.

## Residuals and next actions

- #1142's dependent UI work and cross-impact review against #1102's public-route fixture migration were completed in Wave D; see `.local/tasks/backlog-session-2026-10-01-wave-d-transaction.md`. #1143 needs product-manager contract tightening. The #1096 Linux/PostgreSQL matrix and #1100 dependent helper issues remain outside this Wave C QA evidence.
- No external service or deployment was used; no push or publish was performed.
