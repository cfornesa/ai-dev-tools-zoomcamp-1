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
| #1096 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1096 | `docs/tasks.md`, Batch 14 CI follow-up | after #1097 | 16-shard browser acceptance workflow at commit `900fe968`; classify root causes, preserve assertions, rerun | GROOMED | Codex GPT-6 / stage 2b Ollama Cloud / optional Mistral Vibe / Claude Sonnet 5 / Claude Opus 5 or Sonnet 5 | pending actual execution | causes spanning shards must be fixed or linked atomically | process after #1097 |
| #1098 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1098 | `docs/tasks.md`, Batch 14 local-public quota follow-up | independent of CI; before #1099 | public-transfer preflight across the two `LocalEditorWorkspace` callers and `localPublicTransfer` | GROOMED — expanded stored-content accounting contract on issue | Codex GPT-6 / stage 2b Ollama Cloud / optional Mistral Vibe / Claude Sonnet 5 / Claude Opus 5 or Sonnet 5 | pending actual execution | shared content-byte measurement and regressions | next after #1096 terminal |
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
