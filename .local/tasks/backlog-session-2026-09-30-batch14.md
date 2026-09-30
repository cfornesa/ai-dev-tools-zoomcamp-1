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
| #1096 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1096 | `docs/tasks.md`, Batch 14 CI follow-up | after #1097 | tracking issue for full 16-shard Linux/PostgreSQL browser matrix and cause reconciliation | HANDED-OFF / not ready for implementation | stage 1 Codex / actual Codex GPT-6.1-sol (effort unavailable); stage 2b Ollama Cloud / optional Mistral Vibe / QA Claude Sonnet 5 / gate Claude Opus 5 or Sonnet 5 | scoping: no; engineering and QA: not started | wait for completed run 36778653929, classify non-shared failures and file linked atomic Batch 14 children | PM handoff; resume diagnosis when dispatch logs complete |
| #1098 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1098 | `docs/tasks.md`, Batch 14 local-public quota follow-up | independent of CI; before #1099 | public-transfer preflight across the two `LocalEditorWorkspace` callers and `localPublicTransfer` | ENGINEERING — expanded stored-content accounting | Codex GPT-6 / Codex GPT-6 (substitution) / not run / pending QA / pending gate | stage 2: yes (owner waiver); others pending | shared content-byte measurement and regressions | orchestrator to inspect, commit, then QA |
| #1099 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1099 | `docs/tasks.md`, Batch 14 local-sync quota follow-up | #1098 | private sync aggregate preview and per-row preflight | GROOMED / dependency-blocked until #1098 closes | Codex GPT-6 / stage 2a Opencode Go / optional Mistral Vibe / Claude Sonnet 5 / Claude Opus 5 or Sonnet 5 | pending actual execution | inherits expanded stored-content semantics; shared measurement | owner is this session; process after #1098 |

Order: #1095 → #1097 → #1096, then #1098 → #1099. The CI items follow the
prior distillation's explicit sequence. The media-accounting pair is
independent of CI; #1099 cannot begin until #1098's contract and behavior are
reconciled. #1097 isolates the WebKit workflow step; #1096 owns the remaining
cross-shard matrix diagnosis and exact-run reconciliation.

Duplicate report: no duplicate among the five current open issues. #1097 is
the named WebKit failure boundary, while #1096 owns the multi-shard browser
matrix and must state how that specific failure relates to the broad run.
#1099 is distinct from #1098 because it is the private cloud-sync upload path.
No new follow-up has been discovered in #1095.

## #1098 Stage 2b handoff (implementation complete, QA pending)

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
- QA intake, independent diff/test audit, issue-scoped commit, QA-rerun results,
  criterion reconciliation, and GitHub disposition are pending. #1099 remains
  dependency-blocked until this transaction is terminal.

## #1096 stage-1 handoff (2026-09-30)

- Live GitHub issue was re-read. Its stale title/body estimate (~280 failed
  specs), PROPOSED status, vague shard examples, and missing fixture/runner
  contract were replaced. The issue remains open in milestone 14 (Batch 14).
- Run 36765070532 is the authoritative baseline: all 16 isolated Linux
  PostgreSQL browser jobs completed setup, migrations, quota verification,
  Django/Vite startup, and health waits; each full browser step failed. Logs
  contain 208 failed tests across 110 spec files. Workflow validation,
  backend checks, and disposable published-routing smoke passed; frontend
  Vitest had one failure of 3,180. Failure patterns include the Gallery route
  helper's stale server-project wait, four v4 IndexedDB fixture opens against
  app schema v5, stale UI/strict-locator assumptions, feature-specific
  assertion mismatches, cascaded ended tests, and shard suite timeouts.
- Exact entry/fixture: `.github/workflows/ci.yml` `e2e-browser` workflow,
  `workflow_dispatch`, matrix shards `1/16` through `16/16`; each Ubuntu job
  owns a disposable PostgreSQL database and Playwright fixture lifecycle.
  The baseline is commit `900fe968` / run 36765070532. Current fixed-ref run
  36778653929 is in progress and is the required next evidence source.
- Latest run poll: workflow validation, backend checks, and disposable
  published-routing smoke passed; shard 1's focused WebKit Escape step passed.
  Shard 14's full suite failed four tests across
  `publicPieceSurfaceContract744.spec.ts`, `publicProfiles.spec.ts`, and the
  desktop/mobile cases in `publicShell.spec.ts`. Other full-suite shards and
  frontend checks remain in progress; no final matrix result is claimed.
- Exact local-equivalent runner command per shard:
  `cd frontend && E2E_BASE_URL=http://localhost:5000 npm run test:e2e -- --shard=N/16`
  with `N=1..16`; full collection command:
  `cd frontend && E2E_BASE_URL=http://localhost:5000 npm run test:e2e`.
  Acceptance is remote Linux/Compose CI evidence, because local macOS browser
  launch was already shown to fail at the Mach-port/Playwright host boundary.
- Proposed children (not filed per handoff instruction): (a) bring the four
  offline E2E IndexedDB fixture users
  (`offlineOwnershipRecovery.spec.ts`, `offlineMediaTransfer.spec.ts`,
  `offlineConflictResolution.spec.ts`, `offlineSync.spec.ts`) to schema v5
  and show each intended offline path still executes; (b) split the shared
  `createBlankProjectViaUI` helper contract into explicit local-only and
  server-backed setup entry points, migrate its affected test callers without
  dropping scenarios, and run the focused caller set on Linux. Remaining
  failure families (strict locators, interaction/assertion mismatches,
  timeouts) need run 36778653929 logs before stable atomic criteria can be
  recommended.
- Duplicate search evidence: open GitHub searches for the repo terms
  `createBlankProjectViaUI OR local-projects`, `IndexedDB VersionError v5`,
  and `E2E browser matrix shard failures`; the first two returned no issues,
  the third returned only #1096. Local duplicate check across `docs/tasks.md`,
  `.local/tasks/`, and `.agents/memory/` found no existing #1096 child tickets
  covering these exact causes. The source memory `.agents/memory/e2e-spec-
  drift-outside-smoke-suite.md` gives the reusable failure class but is not a
  duplicate task.
- Readiness: `HANDED-OFF`, not ready for implementation. Fixed-ref logs are
  incomplete and the 77 baseline failures classified as other assertion or
  runtime failures have not been decomposed to smallest common causes. No
  product code/test change and no child issue creation occurred in this PM
  pass. Next: inspect completed 36778653929 logs; update child proposals;
  file approved actionable children into open milestone 14; then return #1096
  to the transaction sequence.

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
