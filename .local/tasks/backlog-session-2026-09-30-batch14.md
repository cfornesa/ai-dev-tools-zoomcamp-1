# Backlog session — Batch 14 (2026-09-30)

Project: `cfornesa/ai-dev-tools-zoomcamp-1` (one codebase, one Replit app).
Worktree at start: clean `docs/backlog-reevaluation-2026-09-27`, tracking the
same remote branch. All five open GitHub issues were enumerated through the
authenticated GitHub connector; each is in milestone 14. No extra issue was
found in GitHub beyond the five represented in the latest `docs/tasks.md`
distillation entry. Discovery-gate rule 4 waiver for #1095–#1099 is recorded
in `DECISIONS.md`; it authorizes this session's Codex implementation
substitution and does not waive dependency order.

Execution profile: Codex / GPT-6 family / effort not exposed by runtime.
Stage-1 scoping/grooming and orchestration are performed in this session.
Stage 3 is not run unless an independent-family reviewer is available. The
QA rostered service is unavailable, so Codex may perform stage 4 as a flagged
substitution per the handoff contract. The rostered stage-5 model tier is not
available in this session; no readiness pass is claimed unless valid owner-
authorized substitution becomes available.

## Batch manifest

| Issue | URL | Backlog entry | Dependencies / order | Scope | Status | Stage owners (scoping / impl / review / QA / gate) | Substituted? | Blocker / follow-up | Owner / next action |
|---|---|---|---|---|---|---|---|---|---|
| #1095 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1095 | `docs/tasks.md`, Batch 14 transaction #1095 | none; first | Gallery local-card date assertion under timezone/locale variation | completed / CLOSED | Codex GPT-6 (effort not exposed) / Codex GPT-6 (effort not exposed) / not run / Codex GPT-6 (effort not exposed) / pending batch gate | impl: yes (owner waiver); QA: yes; scoping: no | none | Reconciled; QA comment 5919356495; closed completed |
| #1097 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1097 | `docs/tasks.md`, Batch 14 CI follow-up | after #1095, before #1096 | named WebKit fullscreen/Escape workflow step | completed / CLOSED | Codex GPT-6 / stage 2b Ollama Cloud / optional Mistral Vibe / Claude Sonnet 5 / Claude Opus 5 or Sonnet 5 | impl: yes (owner waiver); QA: yes; stage 3 not run | Linux rerun belongs to #1096 | Reconciled; QA comment 5919537401; closed completed |
| #1096 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1096 | `docs/tasks.md`, Batch 14 CI follow-up | after #1097 | tracking issue for full 16-shard Linux/PostgreSQL browser matrix and cause reconciliation | HANDED-OFF / tracking incomplete | stage 1 Codex / triage Codex GPT-6 (effort unavailable); stage 2 not applicable (no product changes authorized) / stage 3 not run / stage 4 not applicable / gate pending | scoping: no; QA: n/a (no diff) | #1100 stale 2D/3D creation helpers; #1101 v4 IndexedDB fixtures; residual UI/API/timeout failures still need classification | Parent remains open; next operator implement #1100/#1101, rerun Linux matrix, classify every residual failure |
| #1098 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1098 | `docs/tasks.md`, Batch 14 local-public quota follow-up | independent of CI; before #1099 | public-transfer preflight across the two `LocalEditorWorkspace` callers and `localPublicTransfer` | completed / CLOSED | Codex GPT-6 / Codex GPT-6 (substitution) / not run / Codex GPT-6 (substitution) / pending gate | impl: yes (owner waiver); QA: yes; stage 3 not run | none | QA comment 5920252275; closed completed |
| #1099 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1099 | `docs/tasks.md`, Batch 14 local-sync quota follow-up | #1098 (closed) | private sync aggregate preview and per-row preflight | ENGINEERING | Codex GPT-6 / implementation-complex roster Ollama Cloud / optional Mistral Vibe / QA Claude Sonnet 5 / gate pending | stage 2 substitution authorized in `DECISIONS.md`; QA substitute if required | expanded stored-content semantics; use #1098 shared measurement | current issue; implementation agent to return scoped commit and exact checks |
| #1100 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1100 | Proposed from #1096 run 36778653929 | after #1096 handoff | E2E local-first and server-backed 2D/3D project creation helper fixtures | HANDED-OFF / new follow-up, not implemented this run | stage 1 Codex GPT-6.1-sol / stage 2a Opencode Go / optional Mistral Vibe / stage 4 Claude Sonnet 5 / gate pending | no implementation or QA stage in this run | covers confirmed Gallery/helper route mismatch | project owner / next backlog operator; preserve all caller assertions, run focused Linux specs, then full matrix |
| #1101 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1101 | Proposed from #1096 run 36778653929 | after #1096 handoff | four offline E2E fixtures requesting local IndexedDB v4 against application schema v5 | HANDED-OFF / new follow-up, not implemented this run | stage 1 Codex GPT-6.1-sol / stage 2a Opencode Go / optional Mistral Vibe / stage 4 Claude Sonnet 5 / gate pending | no implementation or QA stage in this run | covers ten setup failures across four specs | project owner / next backlog operator; retain all offline scenarios and verify against v5 before rerunning matrix |

Order: #1095 → #1097 → #1096, then #1098 → #1099. The CI items follow the
prior distillation's explicit sequence. The media-accounting pair is
independent of CI; #1099 began after #1098 closed. #1097 isolates the WebKit
workflow step; #1096 remains open as the cross-shard matrix tracker and has
handed off #1100/#1101. Residual run failures are not fully classified.

Duplicate report: no duplicate among the five current open issues. #1097 is
the named WebKit failure boundary, while #1096 owns the multi-shard browser
matrix and must state how that specific failure relates to the broad run.
#1099 is distinct from #1098 because it is the private cloud-sync upload path.
No new follow-up has been discovered in #1095.

## #1098 — GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED

- Owner-selected expanded stored-content semantics remain authoritative. The
  shared package-content measure returns UTF-8 serialized record bytes,
  included media bytes counted once, and the included media count. The three
  public preflight paths pass those values rather than archive length or whole
  local-project usage.
- Changes are confined to the local package helper, its public-transfer
  callers, and related frontend tests. No backend/API/schema/dependency file
  changed.
- Stage 2b roster Ollama Cloud; actual owner Codex / GPT-6 family / effort
  unavailable, substituted under the owner waiver in `DECISIONS.md`.
  Implementation was performed by a separate task agent. Stage 3 was not run;
  no independent-family reviewer is available.
- Focused acceptance command passed: `npm test -- --run
  src/storage/localPiecePackage.test.ts src/storage/localPublicTransfer.test.ts
  src/pages/LocalEditorWorkspace.test.tsx` (3 files, 18 tests). `npm run
  typecheck` passed; `npm test` passed (309 files, 3,183 tests); Prettier and
  `git diff --check` passed.
- Commit: `61eae5bf` (`fix: account for expanded local publish payloads
  (#1098)`). QA intake: ACCEPTED; test audit found no weakened, skipped,
  deleted, or retargeted assertions. Criterion matrix passed for all five
  acceptance criteria. Focused four-file run passed (21 tests), frontend
  typecheck passed, full suite passed (309 files / 3,183 tests), lint/Prettier/
  commit diff checks passed, and backend estimator tests passed (3 tests).
- QA roster Claude Sonnet 5 Medium; actual Codex / GPT-6 family / effort
  unavailable, substituted. QA comment:
  https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1098#issuecomment-5920252275.
  Evidence boundary is local macOS automation plus backend unit tests; no
  production verification is claimed. GitHub issue is CLOSED / completed.
- Memory unchanged. #1099 is now eligible to begin its own transaction using
  the same shared accounting contract.

## #1096 — HANDED-OFF (tracking incomplete; 2026-09-30)

- Contract: re-read live #1096 and kept its prohibition on product changes or
  weakening assertions. Baseline run 36765070532: 208 failed tests across 110
  spec files; CI workflow validation, backend, and published-routing smoke
  passed; frontend Vitest had 1 failure of 3,180.
- Fixed-ref evidence: run 36778653929 at
  `ef5771b77db4d4d07efe0ab0950ad0d740788a62`. All 16 Linux E2E shards reached
  the full suite and failed: 205 failed cases across 111 spec files, 270
  passed. Workflow validation, backend, frontend, and disposable routing
  checks passed. Shard 1 WebKit Escape and public-media steps passed. Shard 7
  reached its 1500-second suite/teardown limit and reported 16 tests not run.
- Confirmed actionable fixture causes: #1100 covers stale 2D/3D server-backed
  project creation helpers; #1101 covers four offline specs making ten v4
  IndexedDB opens against application schema v5. Duplicate searches returned
  no equivalent open issue. Other route/API, locator, UI assertion, and wait
  failures remain without evidenced first-cause classification; the logs do
  not establish one common runtime defect. Parent #1096 remains open and is
  not ready to close.
- Scope: no product code or tests changed. Commit `cdedfc9f` reconciles this
  handoff in `docs/tasks.md`, `DECISIONS.md`, and this ledger. `git diff
  --check` passed. Local E2E was not run; the exact full-matrix evidence is
  GitHub Actions on Linux/PostgreSQL, while local macOS browser launch has a
  known host Mach-port boundary.
- GitHub reconciliation: updated #1096 body with final evidence and links to
  #1100/#1101. No standalone issue comment was posted; the available comment
  connector is PR-only. Issue remains open, status HANDED-OFF.
- Stage provenance: stage 1 roster Codex / actual Codex GPT-6.1-sol, effort
  unavailable, substituted no. Product stage 2 and QA stage 4 are not
  applicable to this tracking-only handoff; stage 3 was not run. Batch gate
  pending.
- Next action: project owner / next backlog operator implements #1100 and
  #1101 without changing or dropping scenarios, reruns the full Linux matrix,
  then maps each residual failure to an evidenced cause and linked criterion-
  ready issue. Keep #1096 open until this is done or the matrix passes.

## Transaction ledger

### #1095 — GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED

- Issue contract re-read before implementation and QA; three original
  criteria were preserved.
- Scope: `frontend/src/pages/Gallery.test.tsx` only. The test imports the
  existing `formatDate` helper and asserts the visible “Last updated …” label
  using the helper output. No product source, public API, route, schema, or
  dependency changed.
- Provenance:
  - Stage 1 roster: Codex; actual: Codex / GPT-6 family / effort unavailable;
    substituted: no.
  - Stage 2a roster: Opencode Go; actual: Codex / GPT-6 family / effort
    unavailable; substituted: yes under the owner waiver in `DECISIONS.md`.
  - Stage 3: not run; no independent-family reviewer available.
  - Stage 4 roster: Claude Sonnet 5 Medium; actual: Codex / GPT-6 family /
    effort unavailable; substituted: yes. Intake ACCEPTED.
  - Stage 5: pending batch gate; no stage-5 pass claimed.
- Commit: `c7545b8f` (`test: make gallery date assertion timezone-safe (#1095)`).
- Focused checks after commit:
  - `TZ=UTC npm test -- --run src/pages/Gallery.test.tsx -t "renders local cards with metadata, fallback, and lazy thumbnail backfill"` — 1 passed.
  - `TZ=America/Los_Angeles npm test -- --run src/pages/Gallery.test.tsx -t "renders local cards with metadata, fallback, and lazy thumbnail backfill"` — 1 passed.
- Full acceptance checks after commit:
  - `TZ=UTC npm test` — 308 files / 3,180 tests passed.
  - `TZ=America/Los_Angeles npm test` — 308 files / 3,180 tests passed.
  - `UV_CACHE_DIR=/tmp/ai-dev-tools-uv-cache make check` — exit 0; full
    backend and frontend gate passed, including 308 frontend files / 3,180
    tests.
  - `git diff --check` — passed.
- Check setup: initial `make check` hit sandbox denial opening the default uv
  cache before checks started; the supported `/tmp` cache retry passed. The
  same retry passed again in the post-commit QA run.
- Adversarial test audit: one assertion changed; no test was removed, skipped,
  weakened, or retargeted.
- QA verdict: `## QA: PASS`; GitHub comment
  https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1095#issuecomment-5919356495.
- Evidence boundary: committed local macOS automation at `c7545b8f`; no
  matching-ref GitHub Actions run or production evidence claimed.
- GitHub status: CLOSED / completed, verified through connector.
- Memory: unchanged; this was a test-only correction covered by existing
  timezone/locale and E2E drift guidance.

### #1097 — GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED

- Cause: the focused spec used the shared canonical-project helper, which
  waited for `/api/users/@.../edit/.../`. The Gallery action now creates a
  local-only p5.js project and routes to `/local-projects/:id`, so the old
  response never occurs and the test times out before fullscreen assertions.
- Scope: `frontend/e2e/manual2dStageChrome.spec.ts` only. The focused test now
  selects “Create a new 2D project with p5.js” directly and waits for the
  local-project route. Shared fixture behavior and fullscreen/Escape
  assertions were not changed.
- Provenance: stage 2b roster Ollama Cloud; actual Codex / GPT-6 family /
  effort unavailable under the owner waiver in `DECISIONS.md`; stage 3 not
  run; stage 4 roster Claude Sonnet 5 Medium, actual Codex / GPT-6 family /
  effort unavailable as a QA substitution. Intake ACCEPTED.
- Commits: `8d0d50e4` (replace the stale local-project route wait) and
  `ef5771b7` (create the canonical server-backed editor fixture for the
  fullscreen toolbar), pushed to `docs/backlog-reevaluation-2026-09-27`.
- `git diff --check` passed.
- Focused command:
  `npx playwright test e2e/manual2dStageChrome.spec.ts --project=webkit --grep "keeps the fullscreen command synchronized after browser Escape"`.
  Test setup reached `/health/` against a migrated, isolated PostgreSQL DB;
  macOS WebKit aborted at browser launch (`Abort trap: 6`, exit 134) before
  the test body. A local Chromium launch failed at the macOS Mach-port
  boundary too. The supported Linux CI run 36776824640 passed its exact
  `Run WebKit fullscreen Escape regression` step (job 110096727130) at
  `ef5771b7`; this is the pass evidence. The intervening Linux run
  36775617289 exposed that a local project has no fullscreen toolbar, so the
  final fix uses `apiPost('/api/projects/blank/')` and its canonical
  `editor_url`.
- `npx prettier --check e2e/manual2dStageChrome.spec.ts`,
  `npm run typecheck`, and `git diff --check` passed.
- QA verdict: `## QA: PASS`; GitHub comment
  https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1097#issuecomment-5919537401.
- GitHub status: CLOSED / completed, verified through connector.
- The isolated DB `codex_qa_20260930_1097` was dropped after Playwright
  global teardown; Django and Vite servers were stopped.
- Memory: unchanged; this is a specific instance of the recorded E2E spec
  drift and remains scoped separately from the broad matrix issue.

## Remaining batch gates

- Process #1096 next; #1097 is terminal. Re-run the full matrix at the
  reconciled commit and link any newly discovered independent defects before
  making fixes outside #1096 scope.
- For #1098, owner selected the expanded-content model: estimate uncompressed
  piece/version payload content and media once. Its issue now defines
  `pieceBytes` as UTF-8 serialized content excluding media and container
  overhead, `mediaBytes` as the included blobs exactly once, and file counts
  as one piece plus media assets. #1099's groomed contract inherits the same
  measurement for both preview and upload.
- Run session-completion after every manifest item has a terminal status.
- Stage-5 production-readiness is not currently satisfiable on this Codex
  runtime under the shared contract; record a blocked gate with the exact
  owner/next action rather than claiming readiness.
