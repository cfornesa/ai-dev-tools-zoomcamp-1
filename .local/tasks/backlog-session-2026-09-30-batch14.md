# Backlog session — Batch 14 (2026-09-30)

Project: `cfornesa/ai-dev-tools-zoomcamp-1` (one codebase, one Replit app).
Worktree at resumption: clean `docs/backlog-reevaluation-2026-09-27`, tracking
the same remote branch. All six open GitHub issues (#1096, #1100–#1104) were
enumerated through the authenticated GitHub connector; each was in milestone
14. The independent #1101 transaction closed successfully; #1105 was filed
after QA discovered a separate login flake. The user's resumption authorizes
work on the current open set and Codex stage-2 substitutions; it does not waive
dependency order or owner decision points.

Execution profile: Codex / GPT-6.1-sol / effort not exposed by runtime.
Stage-1 scoping/grooming and orchestration are performed in this session.
Stage 3 is not run unless an independent-family reviewer is available. The
QA rostered service is unavailable, so Codex performs stage 4 as a flagged
substitution per the handoff contract. Stage 5 roster is Claude Opus 5 or
Sonnet 5; actual owner: none (not run), effort: not applicable, substituted:
no. The batch is incomplete and the stage-5 readiness gate remains blocked;
no readiness pass is claimed and no GPT-5 substitution was authorized.

## Batch manifest

| Issue | URL | Backlog entry | Dependencies / order | Scope | Status | Stage owners (scoping / impl / review / QA / gate) | Substituted? | Blocker / follow-up | Owner / next action |
|---|---|---|---|---|---|---|---|---|---|
| #1095 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1095 | `docs/tasks.md`, Batch 14 transaction #1095 | none; first | Gallery local-card date assertion under timezone/locale variation | completed / CLOSED | Codex GPT-6 (effort not exposed) / Codex GPT-6 (effort not exposed) / not run / Codex GPT-6 (effort not exposed) / pending batch gate | impl: yes (owner waiver); QA: yes; scoping: no | none | Reconciled; QA comment 5919356495; closed completed |
| #1097 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1097 | `docs/tasks.md`, Batch 14 CI follow-up | after #1095, before #1096 | named WebKit fullscreen/Escape workflow step | completed / CLOSED | Codex GPT-6 / stage 2b Ollama Cloud / optional Mistral Vibe / Claude Sonnet 5 / Claude Opus 5 or Sonnet 5 | impl: yes (owner waiver); QA: yes; stage 3 not run | Linux rerun belongs to #1096 | Reconciled; QA comment 5919537401; closed completed |
| #1096 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1096 | `docs/tasks.md`, Batch 14 CI follow-up | after #1097 | tracking issue for full 16-shard Linux/PostgreSQL browser matrix and cause reconciliation | HANDED-OFF / QA FAIL, tracking incomplete | stage 1 Codex / GPT-6.1-sol (effort unavailable); stage 2 not applicable / stage 3 not run / stage 4 Claude Sonnet 5 Medium roster, actual Codex GPT-6.1-sol (effort unavailable), substituted yes / gate pending | stage 4 substitution: yes | #1100 + #1102–#1104 helper migration; #1101 closed; #1105 loginViaUI flake; #1106 closed; #1107 mobile A-Frame drag; #1108 remaining 3D locator audit; remaining full-matrix causes still unclassified | Parent remains open; comments 5920587069, 5921705496, 5921927346; after linked fixes rerun Linux matrix and classify every residual failure |
| #1098 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1098 | `docs/tasks.md`, Batch 14 local-public quota follow-up | independent of CI; before #1099 | public-transfer preflight across the two `LocalEditorWorkspace` callers and `localPublicTransfer` | completed / CLOSED | Codex GPT-6 / Codex GPT-6 (substitution) / not run / Codex GPT-6 (substitution) / pending gate | impl: yes (owner waiver); QA: yes; stage 3 not run | none | QA comment 5920252275; closed completed |
| #1099 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1099 | `docs/tasks.md`, Batch 14 local-sync quota follow-up | #1098 (closed) | private sync aggregate preview and per-row preflight | completed / CLOSED | Codex GPT-6.1-sol / implementation-complex roster Ollama Cloud, actual Codex GPT-6 family / optional Mistral Vibe / Claude Sonnet 5 Medium roster, actual Codex GPT-6.1-sol / gate pending | stage 2 and stage 4 substitutions; stage 2 authorized in `DECISIONS.md`; stage 3 not run | expanded stored-content semantics via #1098 shared measurement | QA comment 5920683714; closed completed; batch readiness gate remains pending |
| #1100 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1100 | Proposed from #1096 run 36778653929 | approved defer-retirement option; prerequisite for #1102–#1104 | 2D/3D server-backed helpers; six 3D callers | OPEN / QA FAIL — Linux boundary | stage 1 Codex GPT-6.1-sol / stage 2a roster Opencode Go Kimi K2.5, actual Codex GPT-6.1-sol / stage 3 not run / stage 4 roster Claude Sonnet 5 Medium, actual Codex GPT-6.1-sol | stage 2a and 4: yes | Commit 91a7a553; six-spec rerun passed 7/7 on disposable PostgreSQL/macOS Chromium; all static checks and counts pass; Linux Chromium remains required | Updated QA comment 5925601911; run the same six-spec command on Linux Chromium, then reconcile before #1102 |
| #1101 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1101 | Proposed from #1096 run 36778653929 | independent | four offline E2E fixtures requesting IndexedDB v4 against application schema v5 | completed / CLOSED | stage 1 Codex GPT-6.1-sol; stage 2a roster Opencode Go/Kimi K2.5, actual Codex GPT-6.1-sol; stage 3 not run; stage 4 roster Claude Sonnet 5 Medium, actual Codex GPT-6.1-sol; gate pending | stage 2a and stage 4: yes | #1105 captures separate post-logout login flake | commit `0e3640a5`; QA comment 5921248449; closed completed |
| #1102 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1102 | Distilled from #1096 / #1100 | blocked by #1100 QA reconciliation | single-purpose 2D E2E caller migration | DEPENDENCY-BLOCKED | stage 1 Codex; stage 2a Opencode Go (pending); stage 3 optional; stage 4 Claude Sonnet 5 (pending); gate pending | none yet | helper implementation exists in 91a7a553; #1100's six-spec gate remains QA FAIL | next operator after #1100 reconciles; preserve each caller's current assertions |
| #1103 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1103 | Distilled from #1096 / #1100 | blocked by #1100 QA reconciliation | multi-call 2D E2E caller migration | DEPENDENCY-BLOCKED | stage 1 Codex; stage 2a Opencode Go (pending); stage 3 optional; stage 4 Claude Sonnet 5 (pending); gate pending | none yet | helper implementation exists in 91a7a553; #1100's six-spec gate remains QA FAIL | next operator after #1100 reconciles; preserve each caller's current assertions |
| #1104 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1104 | Distilled from #1096 / #1100 | blocked by #1100 QA reconciliation; owner decision within issue | lifecycle/publishing/responsive caller migration | DEPENDENCY-BLOCKED | stage 1 Codex; stage 2b Ollama Cloud (pending); stage 3 optional; stage 4 Claude Sonnet 5 (pending); gate pending | none yet | helper implementation exists in 91a7a553; scenario-intent decision remains required | next operator after #1100 reconciles; halt at the embedded owner decision if any scenario cannot retain its intent |
| #1105 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1105 | Proposed during #1101 QA | independent; handed to next session by discovery-gate rule | intermittent login form after logout during offline ownership account switch | HANDED-OFF / newly filed, not implemented this run | stage 1 Codex GPT-6.1-sol / stage 2a Opencode Go (pending) / stage 3 optional / stage 4 Claude Sonnet 5 (pending) / gate pending | no implementation or QA stage in this run | 20/20 repeated checks passed but root cause remains unexplained; no timeout widening | next backlog operator; investigate root cause per #1105 before any test/helper edits |
| #1106 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1106 | Discovered during #1100 QA; parent #1096 | helper implementation commit 91a7a553; #1109/#1111 prerequisites resolved | three 3D toolbar E2E locators | completed / CLOSED | stage 1 Codex GPT-6.1-sol / stage 2a Opencode Go Kimi K2.5, actual Codex GPT-6.1-sol / stage 3 not run / stage 4 Claude Sonnet 5 Medium, actual Codex GPT-6.1-sol | stage 2a and 4 substituted: yes | 3 Chromium specs pass; counts remain 1/3, 1/28, 1/53; typecheck/lint/format pass; screenshots inspected | commit 1ea89aaa; QA comment 5923931785; issue closed completed; local macOS only; continue to #1108 |
| #1107 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1107 | Discovered during #1100 QA; parent #1096 | after #1110 fix; unchanged spec rerun | mobile A-Frame drawing-plane drag root cause | CLOSED / completed | stage 1 Codex GPT-6.1-sol; stage 2a Codex GPT-6.1-sol substitution; stage 3 not run; stage 4 Codex GPT-6.1-sol substitution; batch gate pending | stage 2a and 4 substituted | spec unchanged vs `91a7a553`, 1/11; exact Chromium `--repeat-each=3` passed 6/6 on local PostgreSQL; screenshots inspected; typecheck/lint/format pass | QA comment 5923071850; closed completed; parent #1096 updated; Linux matrix still belongs to parent/#1100 |
| #1108 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1108 | Discovered during #1106 refinement; parent #1096 | #1106 closed; #1112 awaits this audit | audit remaining stale menu locators across E2E specs | GROOMED / ready | stage 1 Codex GPT-6.1-sol; stage 2a Opencode Go pending; stage 3 optional; stage 4 Claude Sonnet 5 pending; gate pending | no implementation/QA yet | #1112 is dependent; finish this audit and its criteria before resuming #1112 | inventory each hit and migrate only confirmed stale 3D inline-toolbar locators |
| #1109 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1109 | Discovered during #1106 QA; parent #1096 | product follow-up #1113 completed; rerun then passed | manual 3D stage-chrome checks for control placement and layout intent | CLOSED / QA PASS | stage 1 Claude refinement; stage 2a Codex GPT-6.1-sol substitution; stage 3 not run; stage 4 Codex GPT-6.1-sol substitution | stage 2a and 4 substituted | commit b928c76e, exact Chromium spec passed 1/1 at 1280x900 and 375x812; test/expect 1/53 preserved; typecheck/lint/format pass; rendered screenshots inspected | QA comment 5923875615; issue closed completed; local macOS/PostgreSQL evidence only; next #1106 three-spec gate |
| #1110 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1110 | Discovered during #1107 investigation; parent #1096 | implemented after #1111 per explicit owner authorization | mobile 3D drawing-plane move-handle hit target | OPEN / QA FAIL on fixture dependency | stage 1 Codex; stage 2a Codex GPT-6.1-sol substituted; stage 3 not run; stage 4 Codex GPT-6.1-sol substituted; batch gate pending | stage 2a and 4 substituted | commit 4587b424; combined A-Frame + Three.js route tests 2/2 across both viewports; #796 unchanged 6/6; transform782 fixture times out before assertions | QA comment 5922994330; new proposed setup-only #1112 handed off; rerun transform782 after its authorized implementation; #1107 remains open |
| #1111 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1111 | Discovered during #1109 QA; parent #1096 | implemented before #1110 per explicit owner authorization | prevent mobile inline 3D stage action controls from intersecting | OPEN / QA FAIL — dependency-blocked on #1103/#1100 | stage 1 Codex; stage 2a Codex GPT-6.1-sol substituted; stage 3 not run; stage 4 independent Codex QA subagent substituted for Claude Sonnet 5 Medium; batch gate pending | stage 2a and 4 substituted | commit `8766789c` scopes the mobile width rule to `.project3d-workspace`; 3D geometry 2/2, #796 repeat 3 6/6, manual 3D 1/1; 2D focused geometry 2/2, ink 2/2, manual2D 2/2; LayersPanel and interactionRuntime time out before assertions at retired `createBlankProjectViaUI` wait (#1103) | QA evidence appended to live issue body 2026-10-01; after #1100 Linux gate and #1103 migration rerun full 2D matrix |

Order: #1095 → #1097 → #1096, then #1098 → #1099; the resumed work handles
independent #1101 before the dependent creation-helper chain. The owner chose
defer retirement for #1100, whose implementation commit exists but whose QA
gate remains failed; #1102–#1104 stay dependency-blocked until #1100
reconciles. Owner authorization now covers #1105–#1111 per later user messages. #1107's
unchanged spec passed 6/6 after #1110; it is CLOSED / completed. #1110 has
implementation commit 4587b424 but remains QA FAIL on the out-of-scope
transform782 fixture handoff #1112. #1111 remains open pending 2D compatibility
verification. #1109 remains QA FAIL pending owner direction on real mobile
authoring-panel overflow; #1106 and #1108 stay gated. Current open issues were
refreshed from GitHub after #1118/#1119/#1121/#1122/#1123 closure: #1096,
#1100, #1102–#1104, #1108, #1110–#1112, #1114, and #1120 (11). #1122 closed
as the independent server-fixture repair. Next lane requires #1114/#1120 CSS
ordering review before #1112 and 3D compatibility follow-ups.

Duplicate report at resumption: no duplicate among the six open issues
(#1096, #1100–#1104). #1097 is the named WebKit failure boundary, while
#1096 owns the multi-shard browser matrix and must state how that specific
failure relates to the broad run. #1099 is distinct from #1098 because it is
the private cloud-sync upload path. During #1101 QA, duplicate search found
no open match for the post-logout login-form failure; closed #549 covers a
different login wait symptom, so criterion-ready issue #1105 was filed and
linked.

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
  #1100/#1101; posted the stage-4 verdict as comment 5920587069. Issue remains
  open, status HANDED-OFF.
- QA review of all live acceptance criteria: QA FAIL, because the remaining
  browser failure families lack evidenced first causes and linked issues.
  Baseline, run totals, known fixture children, and historical relationships
  passed. The exact 16-job log audit is recorded in GitHub QA comment
  5920587069. QA roster Claude Sonnet 5 Medium was unavailable; Codex
  GPT-6.1-sol (effort unavailable) performed stage 4 as a flagged
  substitution. No product diff was received or modified.
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

### #1099 — ENGINEERING → QA → RECONCILIATION → CLOSED

- Live contract re-read: selected aggregate preview sums each selected row's
  expanded `pieceBytes + mediaBytes`; upload preflight uses the same measure
  and one piece plus included media file counts; media-bearing fitting rows
  are allowed while over-quota rows remain blocked; no backend estimator/API
  or unrelated quota caller changes.
- Owner reaffirmed expanded stored-content semantics: UTF-8 serialized
  piece/version payload bytes plus included media blob bytes once each,
  excluding ZIP/manifest/container overhead. The sync path consumes the
  shared local package helper; preview reads Blob sizes without copying blob
  bytes or building ZIPs. Upload/build and preview derive measurements from
  the same record/media loader.
- Intake accepted. Scope is exactly four frontend helper/page/test files;
  test assertions were inspected and no weakened, skipped, deleted, or
  retargeted assertions were found. No API, schema, route, dependency, or
  backend estimator change.
- Stage 2b roster Ollama Cloud; actual owner separate Codex GPT-6-family task
  agent, effort unavailable; substituted under the owner waiver in
  `DECISIONS.md`. Stage 3 not run. Stage 4 roster Claude Sonnet 5 Medium;
  actual Codex GPT-6.1-sol, effort unavailable; substituted. QA verdict PASS,
  comment:
  https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1099#issuecomment-5920683714.
- `npm test -- --run src/pages/LocalPieceSyncOffer.test.tsx
  src/storage/localPiecePackage.test.ts` passed (2 files / 6 tests);
  `npm run typecheck` passed; `npm test` passed (310 files / 3,186 tests);
  changed-file Prettier check and `git diff --check 8b0cd0ae^ 8b0cd0ae`
  passed. Evidence is local macOS automated checks; no deployment verification
  claimed. Commit `8b0cd0ae`.
- GitHub issue was updated with resolved criteria/evidence and closed
  completed. No memory change. Batch 14 production-readiness gate remains
  pending; #1096 and its #1100/#1101 handoffs remain unresolved as recorded
  above.

## Remaining batch gates

### #1101 — GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED (resumed run)

- PM correction recorded in live issue: six hard-coded v4 opens existed
  across five fixture blocks plus one read-only outbox inspection. The
  criterion now explicitly requires the shared helper to verify the v5
  `versions` store and schema stamp. The helper must not navigate because
  callers may already be on a route whose scenario depends on that location.
- Stage provenance: stage 1 Codex / GPT-6.1-sol / effort unavailable,
  substituted no. Stage 2a roster Opencode Go / Kimi K2.5; actual Codex /
  GPT-6.1-sol / effort unavailable, substituted yes under the user's
  authorization for the current open issues in `DECISIONS.md`. Stage 3 not
  run (no independent-family reviewer). Stage 4 roster Claude Sonnet 5 /
  Medium; actual Codex / GPT-6.1-sol / effort unavailable, substituted yes.
- Commit `0e3640a5` adds the shared app-backed v5 fixture helper and replaces
  all six old opens. It seeds projects/scenes through repository functions,
  imports media through `importMediaAsset`, and uses generated media IDs for
  the transfer routes. No app source, backend, schema, dependency, or
  workflow changed.
- Focused browser command passed 16/16 cases against local disposable
  PostgreSQL `gesture_studio_test`, Django with `AI_PROVIDER=fake`, Vite, and
  unsandboxed macOS Chromium. Initial sandbox browser startup was denied by
  the macOS Mach-port boundary. The first unsandboxed attempt used the wrong
  database for Playwright global fixtures; teardown left zero fixture users
  in the default DB. The corrected run set `DATABASE_URL` for Django and the
  Playwright parent process, so fixture setup and teardown used the disposable
  test DB. No test fixture remained after teardown.
- One intermediate 15/16 run exposed the separate post-logout `loginViaUI`
  flake; new criterion-ready issue #1105 was created in milestone 14 per the
  discovery gate. The account-switch test then passed a clean full run and
  20/20 repetitions (10 per viewport); no timeout was widened. #1105 remains
  open for root-cause investigation, which was not absorbed into #1101.
- `npm run typecheck`, `npm run lint` (existing warnings only), `npm run
  format:check`, and `git diff --check` passed. Before/after test/expect
  counts were unchanged: ownership 4/16, media 2/4, conflict 1/4, sync 2/4.
  Four temporary assertion inversions each made its selected browser scenario
  fail on the inverted expectation; source files were restored. `rg
  "creatrart-local-projects', [0-9]" frontend/e2e` returned no matches.
- QA verdict `## QA: PASS`; comment
  https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1101#issuecomment-5921248449.
  Issue is CLOSED/completed. No durable memory change.

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

## Batch completion audit — 2026-09-30

- Manifest reconciled against GitHub after #1099 closure. Seven discovered
  issues: 4 completed (#1095, #1097, #1098, #1099), 0 blocked, 0 dependency-
  blocked, 3 handed-off (#1096, #1100, #1101), and 0 missing terminal status.
  Two follow-ups were discovered and created (#1100, #1101); none reused or
  pending authorization. All seven remain in milestone 14, which stays open
  while the three follow-ups are open.
- Final local project check: `UV_CACHE_DIR=/tmp/ai-dev-tools-uv-cache make
  check` exited 0. Backend lint/format/typecheck passed; backend tests:
  1,876 passed / 39 skipped; frontend lint, format, typecheck, and tests
  passed (310 files / 3,186 tests). Lint emitted existing warnings, and the
  skipped backend tests are environment-gated. Batch includes separate CI
  E2E evidence for #1096/#1097; local `make check` does not cover browser E2E.
- Readiness result: **BLOCKED / not run**. Three required items remain
  handed-off; #1096's full browser matrix failed and residual route/API,
  locator, assertion, wait, and timeout failures still lack evidenced
  first-cause classifications. Exact next action: implement #1100/#1101,
  rerun the full Linux matrix, classify and link every remaining failure,
  then request/run stage 5 on Claude Opus 5 or Sonnet 5 at the rostered effort
  after issue reconciliation. Do not claim production readiness meanwhile.
- Stage-5 routing audit for all manifest issues: roster Claude Opus 5 or
  Sonnet 5; actual owner none (not run), effort not applicable, substituted
  no. Gate is blocked by incomplete follow-up work; no authorized GPT-5
  substitution exists. Other stage owners and substitutions are recorded
  issue-by-issue above. Stage 3 is explicitly not run where applicable.
- Final follow-up audit: #1096 remains the parent tracking handoff for
  #1100/#1102–#1104 plus unresolved residual failures; #1101 is now closed,
  and #1105 tracks the login failure found during its QA. No discovered
  actionable item was left without an issue or owner/next action. The full
  suite gate is **not fully classified**: creation-helper and IndexedDB
  causes were filed; other failure families remain for #1096.
- Open issues at this checkpoint: #1096 and #1100–#1105 except closed #1101.
  #1100 awaits the user's architecture selection; #1102–#1104 are
  dependency-blocked by #1100; #1105 is a new handoff that cannot be
  implemented in this session under the discovery gate. The goal remains
  active and batch reconciliation is not complete.
- Memory topics unchanged; the new login flake is issue-scoped and no
  durable cross-cutting constraint emerged.

## Resumed goal checkpoint — 2026-09-30

- Current manifest totals: 11 discovered across Batch 14; 5 completed
  (#1095, #1097–#1099, #1101), 1 blocked (#1100), 3 dependency-blocked
  (#1102–#1104), 2 handed-off (#1096, #1105), 0 missing terminal statuses.
  One newly discovered follow-up (#1105) was created and assigned milestone 14.
- Current open issues are #1096, #1100, #1102–#1105. #1100's owner choice
  is pending; no dependent implementation can begin until that choice and
  the resulting criterion-ready contract are recorded. #1105 is intentionally
  handed off under the discovery-gate rule and is not implemented in this run.
- Remaining independent actionable work is exhausted. Resume after the owner
  selects an #1100 option; then process #1100 → #1102 → #1103 → #1104
  sequentially, preserving #1104's embedded owner decision, and finally rerun
  #1096's full Linux matrix and classify every residual failure. The overall
  backlog goal remains active; production readiness and session completion
  have not been run.

## #1100 implementation and QA checkpoint — 2026-09-30

- The owner approved defer retirement. Added typed server-backed 2D/3D API
  setup helpers while retaining the legacy exports, then migrated the six
  named 3D specs. Commit `91a7a553` changes only the two E2E support modules
  and those six spec files; test/expect inventories are unchanged.
- `npm run typecheck`, `npm run lint` (existing warnings),
  `npm run format:check`, and `git diff --check` passed. On local macOS with
  disposable `gesture_studio_test`, Django `AI_PROVIDER=fake`, and Vite, the
  exact six-spec Chromium run reported 3 passed / 4 failed. Three failures
  use a nonexistent toolbar opener; #1106 captures those. The A-Frame 375px
  drag produced no centroid movement while desktop passed; #1107 captures
  root-cause work. Linux Chromium evidence was unavailable; Docker is down
  and the authenticated connector has no workflow-dispatch operation.
- The six spec files preserve all test/expect counts: 1/3, 1/11, 1/18,
  1/28, 1/53, and 1/25 respectively. No product source, backend, schema,
  dependency, or workflow file changed. QA comment 5921704822 is `FAIL`;
  #1100 remains open. Parent #1096 received comment 5921705496 linking the
  new follow-ups.
- Current manifest: 13 issues; 5 completed, 5 handed-off (#1096, #1100,
  #1105–#1107), 3 dependency-blocked (#1102–#1104), and 0 missing terminal
  statuses. Current open issues: #1096, #1100, #1102–#1107 (8 total).
  Stage 5 and session-completion are not run while these gates remain open.
  Next action is to resolve #1106/#1107, re-run and reconcile #1100, process
  #1102 → #1103 → #1104, then resume #1096's complete Linux matrix and
  residual-cause reconciliation.

## #1106 implementation and QA handoff — 2026-09-30

- Live #1106 criteria were re-read. The diff directly activates the current
  inline 3D toolbar buttons in `cameraPreview3d`,
  `manual3dOutlineSelection`, and `manual3dStageChrome`; no scenario or
  assertion changed. Commit: `1ea89aaa`.
- Stage 1 roster Codex; actual Codex / GPT-6.1-sol / effort unavailable,
  substituted no. Stage 2a roster Opencode Go / Kimi K2.5; actual Codex /
  GPT-6.1-sol / effort unavailable, substituted yes. Stage 3 not run. Stage
  4 roster Claude / Sonnet 5 / Medium; actual Codex / GPT-6.1-sol / effort
  unavailable, substituted yes. Stage 5 is pending the batch gate; not run.
- Changed-file counts match base `91a7a553`: camera preview 1/3,
  outline selection 1/28, and stage chrome 1/53 (`test(`/`expect(`).
  Typecheck, lint (existing warnings), format check, and diff check passed.
- Focused Chromium command with `E2E_BASE_URL=http://localhost:5000` and
  `E2E_ENV_FILE=/tmp/creatrweb-e2e-1106.env` on local macOS and isolated
  local PostgreSQL: 2 passed, 1 failed. Camera preview passed; outline
  selection passed at both viewports. Stage chrome advanced past the direct
  authoring button, then failed at its pre-existing `Save scene`-inside-
  toolbar expectation on the first viewport. Snapshot confirms Save scene
  in the editor header and Ask AI in Project settings. This is test drift;
  no product control is missing. Initial attempt omitted `E2E_ENV_FILE` and
  is invalid evidence. Corrected fixture teardown reported `deleted: 0`;
  disposable database/temp env were removed and servers stopped.
- New issue #1109 was filed in milestone 14 after duplicate search found no
  open equivalent. It owns the unmodified control-placement assertions and
  blocks final #1106 QA. Comment 5921928116 records `## QA: FAIL`; #1106 is
  `HANDED-OFF / QA FAIL`, linked to #1109. Parent comment 5921927346 links
  the follow-up. No Linux CI or deployed result is claimed.
- Newest rollup: 15 discovered; 5 completed, 6 handed-off, 4 dependency-
  blocked, 0 missing terminal statuses. Live open set: #1096, #1100,
  #1102–#1109 (10). Next engineering in backlog order is #1105; then #1107.
  #1108 waits on #1106/#1109; #1102–#1104 wait on #1100. After #1109,
  rerun #1106, then the Linux six-spec gate for #1100. Stage 5 and session
  completion remain pending.

| #1112 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1112 | Discovered during #1110 QA; parent #1096 | setup migration committed; QA dependency-blocked by #1108 | migrate `drawingPlaneTransform782.spec.ts` setup to server-backed 3D helper only | OPEN / QA FAIL / DEPENDENCY-BLOCKED | stage 1 Codex; stage 2a Codex GPT-6.1-sol substituted; stage 3 not run; stage 4 Codex GPT-6.1-sol substituted | stage 2a and 4 substituted | commit dc518652, test/expect 1/26 preserved; exact Chromium/PostgreSQL rerun reaches both viewports but stale authoring-menu state prevents transform assertions | QA comment 5923459297; #1108 comment 5923468318; after #1108 migrates confirmed locators, rerun exact #782 spec |
| #1113 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1113 | Product gap confirmed during #1109 QA; parent #1109/#1096 | #1109; #1111 toolbar CSS nearby but separate | Make 3D mobile authoring panel a usable width without horizontal clipping and preserve vertical access | CLOSED / QA PASS | stage 1 Codex GPT-6.1-sol (effort unavailable; substituted); stage 2a Codex GPT-6.1-sol (effort unavailable; substituted); stage 3 not run; stage 4 Codex GPT-6.1-sol (effort unavailable; substituted) | stage 1, 2a, and 4 substituted | commit db01d47d; baseline failed at 44px; post-commit route QA passed at 1280x900, 375x812, and 375x360; 3186 frontend tests passed; build passed | QA comment 5923798247; issue closed completed; local macOS Chromium/PostgreSQL evidence only |


## #1107 post-#1110 QA completion — 2026-10-01

- Re-read the live acceptance criteria. #1107 requires the original `drawingPlaneAframe796.spec.ts` unchanged, exact PostgreSQL-backed Chromium run at `--repeat-each=3`, test/expect counts 1/11, three passes per viewport, and screenshot inspection.
- Test file is byte-identical to base `91a7a553`; counts remain 1/11. Exact run against disposable database `codex_qa_20261001_1107`, Django (`AI_PROVIDER=fake`), Vite, and local macOS Chromium passed 6/6 (desktop 3/3, mobile 3/3). Selected and after-drag screenshots were captured and inspected at both sizes. Strict movement, selection, Escape, and click-pick assertions remained intact.
- `npm run typecheck`, `npm run lint` (exit 0, existing warnings), `npm run format:check`, and `git diff --check` passed. No Linux CI or production evidence is claimed. QA PASS comment 5923071850; issue #1107 closed completed and parent #1096 updated.
- Disposable database removed and both local servers stopped.

## Resumed backlog audit — #1108 and 3D toolbar chain — 2026-10-01

| Issue | URL | Backlog entry | Dependencies | Scope | Status | Stage owners (scoping / implementation / review / QA / gate) | Substituted? | Blocker / evidence | Owner / next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1108 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1108 | Existing Batch 14 issue, parent #1096 | #1106; #1114 completed for #782; #1122 resolved; #1115–#1117 closed; #1104 lifecycle setup; #1145 mobile cancel selection | Audit and directly migrate stale inline 3D toolbar test locators; no product code | OPEN / QA FAIL / DEPENDENCY-BLOCKED | Stage 1 Codex GPT-6.1-sol; Stage 2a Codex GPT-6.1-sol; Stage 3 not run; Stage 4 Codex GPT-6.1-sol self-review | Stage 2a and 4 substituted for Opencode Go/Kimi K2.5 and Claude/Sonnet 5 Medium | Commits `006ca3b2`, `5e0cc907`, `15a5a86f`. Exact nine-spec PostgreSQL/Chromium batch 19/20; all 4 `aiDrawingPlane784` scenarios, both #782 transform viewports, all #773 private toolbar cases pass. Sole failure: `drawingPlaneDraw3d` 375x812 cancel screenshot mismatch (#1145). Fixed selector ambiguity and mobile disclosure sequencing, preserved 3 tests/19 expects. Stale `project3dLifecycle.spec.ts:54` remains unreachable until #1104 setup work. QA comment 5929141148. Fresh browser escalation worked; no Linux/deployed claim. | Keep open / dependency-blocked on #1145 and #1104. #1145 was filed by this agent, so implementation must be by another agent after refinement. Finish #1104 when #1100 is reconciled; rerun the nine-spec batch before closure. |
| #1110 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1110 | Existing Batch 14 child of #1107 | #1111, #1112, #1114, #1102/#1103 compatibility gate | Keep mobile 3D move handle hit-testable | OPEN / prior QA FAIL | Stage 1 Claude Sonnet 5.5; implementation commit `4587b424`; Stage 3 not run; Stage 4 Claude QA comment 5922994330 | — | Existing local implementation passes focused A-Frame/Three.js and #796 repeat checks, but #1112's mobile transform fails on #1114; 2D compatibility gate remains dependency-blocked by #1102/#1103. | Do not close based on implementation alone; rerun after #1112/#1114 and compatibility gates. |
| #1111 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1111 | Existing Batch 14 child of #1109 | #1102/#1103 2D compatibility; #1110 | Prevent 3D inline toolbar overlap | OPEN / prior QA FAIL | Stage 1 Claude Sonnet 5.5; implementation commit `efb5d494`; Stage 3 not run; Stage 4 Codex comments 5922615306 / 5922996204 | Stage 4 substituted for Claude/Sonnet 5/Medium | Local focused geometry passes at both viewports and #1110's CSS is scoped to Project3D; full 2D regression/screenshot gate remains incomplete under #1102/#1103. | Keep open until its 2D compatibility acceptance passes; no premature close. |
| #1112 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1112 | Existing Batch 14 setup issue | #1108 and #1114 | Server-backed fixture setup only for `drawingPlaneTransform782` | OPEN / DEPENDENCY-BLOCKED | Stage 2a Codex GPT-6.1-sol commit `dc518652`; Stage 3 not run; Stage 4 Codex QA comments 5923459297/5924606302 | Stages 2a and 4 substituted | Setup-only diff and 1/26 count preserved; desktop passes after #1108 close-path migration, mobile overlap remains under #1114. | Implement #1114 when eligible, rerun exact two-viewport spec, then close if all gates pass. |
| #1114 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1114 | New Batch 14 product follow-up, parent #1096 | #1112 setup committed; 2D regression rerun waits on #1103 (transitively #1100) | Separate selected-plane toolbar from inline 3D editor toolbar at 375px; preserve 16:9 stage contract | OPEN / QA FAIL / DEPENDENCY-BLOCKED | Stage 1 Codex GPT-6.1-sol plus PM subagent; Stage 2a Codex GPT-6.1-sol commit `28c0e8fd`, `0bc2bc08`, `04a5b1ff`; Stage 3 not run; Stage 4 Codex GPT-6.1-sol QA subagent; Stage 5 pending | Stages 1/2a/4 substituted for rostered Claude/Opencode Go/Claude | 3D geometry 2/2; #796 6/6; unchanged #782 2/2; manual3d 1/1; EditorWorkspace 37/37; static gates pass. Grouped 2D 2/8: manual2d stage 2/2; interactionRuntime + layersPanel 0/6 due obsolete `createBlankProjectViaUI` waiting for canonical editor while local-first flow lands `/studio`, at `createProject.ts:54`; tracked by #1103, which waits on #1100. Follow-up test relocation committed `9c42f60b`. Local macOS/disposable PostgreSQL only; Linux absent. | Keep open. Finish #1100 Linux gate, then #1103 setup migration and rerun exact grouped 2D command plus #1114 full matrix; no 2D fixture changes in this issue. |
| #1115 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1115 | New Batch 14 follow-up | #1108; #1114 may affect mobile interaction | Preserve Undo and Precise values after accepted AI drawing-plane proposal | CLOSED / QA PASS | Stage 1 Codex GPT-6.1-sol; Stage 2a Codex GPT-6.1-sol; Stage 3 not run; Stage 4 Codex GPT-6.1-sol | Stages 2a and 4 substituted for Opencode Go/Kimi K2.5 and Claude/Sonnet 5 Medium | Commit `b73e0ada`; pre-fix desktop/mobile timeout reproduced after Escape deselected the plane; full fake-AI Chromium/PostgreSQL spec 4/4; Width 4/Height 3 and retained selection asserted at both viewports; expectations 17→19; typecheck, lint (existing warnings), format check, diff check pass. | QA comment 5925178093; issue closed completed. |
| #1116 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1116 | New Batch 14 test follow-up | #1108 | Align generated-art private/public expected toolbar labels with rendered sound/guide controls | CLOSED / QA PASS | Stage 1 Codex GPT-6.1-sol; Stage 2a Codex GPT-6.1-sol; Stage 3 not run; Stage 4 Codex GPT-6.1-sol | Stages 2a and 4 substituted for Opencode Go/Kimi K2.5 and Claude/Sonnet 5 Medium | Commit `cc1333d1`; captured identical six-label rows for private/public at 1280x900 and 375x812; focused PostgreSQL/Chromium 1/1; typecheck, lint (existing warnings), format check, diff check pass; counts unchanged at 23. | QA comment 5925025517; issue closed completed. |
| #1117 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1117 | New Batch 14 test setup follow-up | Existing helper from #1100 | Re-home private 2D editor toolbar setup to server-backed 2D fixture | CLOSED / QA PASS | Stage 1 Codex GPT-6.1-sol; Stage 2a Codex GPT-6.1-sol; Stage 3 not run; Stage 4 Codex GPT-6.1-sol | Stages 2a and 4 substituted for Opencode Go/Kimi K2.5 and Claude/Sonnet 5 Medium | Commit `07229189`; focused PostgreSQL/Chromium combined 3D/2D scenario passed; visible inline toolbar and group checks replace obsolete hidden menu shim; canonical route and real private fixture retained; test/expect counts 3/20 unchanged; typecheck, lint (existing warnings), format check, diff check pass. | QA comment 5925076078; issue closed completed. |
| #1102 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1102 | Existing Batch 14 dependency child of #1100 | #1100 helper implementation present; new test follow-ups #1118–#1121 | Migrate nine named single-purpose 2D spec files (10 2D + 1 3D setup calls) to server-backed helpers | OPEN / QA FAIL | Stage 1 existing Codex; Stage 2a Codex GPT-6.1-sol; Stage 3 not run; Stage 4 Codex GPT-6.1-sol | Stages 2a and 4 substituted for Opencode Go/Kimi K2.5 and Claude/Sonnet 5 Medium | Commit `f3b6f53b`; setup-only diff; per-file test/expect counts preserved. Exact local Chromium batch 4/13 passed, 9/13 failed due current UI contract drift classified to #1118–#1121. Typecheck/lint/format/diff checks pass. Linux criterion not run. | QA comment 5925343335. Keep open; resolve follow-ups and run exact nine-spec batch on Linux Chromium before advancing/closing dependent series. |
| #1118 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1118 | Follow-up discovered during #1102 QA | #1102 implementation; #1120 owns 375px ink hit-target | Retarget private 2D editor E2E locators to current inline controls | CLOSED / QA PASS | Stage 1 roster Codex; actual Codex GPT-6.1-sol plus Claude Sonnet 5.5 refinement, with PM correction by Codex GPT-6.1-sol; Stage 2a roster Opencode Go/Kimi K2.5, actual Codex GPT-6.1-sol; Stage 3 not run; Stage 4 roster Claude/Sonnet 5/Medium, actual Codex GPT-6.1-sol independent read-only QA subagent | Stages 1/2/4 substituted | Commit 533a3ce2. Focused scoped specs passed 4/4, desktop ink passed 1/1, full frontend Vitest passed 310 files/3,186 tests; typecheck/lint/format pass; all test/expect counts unchanged. #692 publication flow moved to #1119. | QA comment 5925639191; issue closed completed |
| #1119 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1119 | Follow-up discovered during #1102 QA | #1102 implementation | Retarget owner publication and public 2D route E2E contracts to current inline controls | CLOSED / QA PASS | Stage 1 roster Codex; actual Codex GPT-6.1-sol plus Claude Sonnet 5.5 refinement and Codex PM update; Stage 2a roster Opencode Go/Kimi K2.5, actual Codex GPT-6.1-sol; Stage 3 not run; Stage 4 roster Claude/Sonnet 5 Medium, actual independent Codex GPT-6.1-sol QA subagent | Stages 1/2/4 substituted | Commit `e102ca19`; exact focused Chromium/PostgreSQL command 3/3, responsive rerun 1/1, full Vitest 310/3,186; typecheck, lint (existing warnings), format and diff checks pass. Test/expect counts unchanged at 1/10, 1/12, 1/24. Owner File → Publication status controls and canonical inline mode now match source; embed menu and privacy/download behavior retained. | QA comment 5925829513; issue closed completed |
| #1120 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1120 | Product follow-up discovered during #1102 QA | #1118 test correction; regression fix landed in #1111 | Keep the 2D Draw ink layer action tappable beside fullscreen at 375px | CLOSED / QA PASS — resolved via #1111 | Stage 1 Codex / owner-refined; Stage 2a Codex GPT-6.1-sol; Stage 3 not run; Stage 4 independent Codex QA subagent substituted for Claude Sonnet 5 Medium | stage 2 and 4 substituted | Commit `8766789c` restores 2D baseline by scoping the responsive width rule to 3D; focused geometry 2/2, full ink 2/2, screenshots at 375/1280 inspected, no overlap or horizontal overflow | QA evidence appended to issue body; closed completed 2026-10-01 |
| #1121 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1121 | Follow-up discovered during #1102 QA | #1102 implementation; generated-piece setup follow-up #1123 (closed first) | Use current Web address button in 3D slug E2E coverage | CLOSED / QA PASS | Stage 1 Codex GPT-6.1-sol plus Claude refinement; Stage 2a Codex GPT-6.1-sol substituted; Stage 3 not run; Stage 4 independent Codex QA subagent substituted for Claude Sonnet 5 Medium | Stages 1/2/4 substituted | Commits `e73cea76` + `abdf25a7`; focused scenario 1/1, complete spec 2/2, full Vitest 310/3,186; typecheck/lint/format/diff pass. Counts preserved at 2 tests / 12 expects. | QA comment 5926038646; closed completed after #1123 |
| #1122 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1122 | Follow-up discovered during #1108 full private toolbar rerun | #1100 server helpers already present | Use server-backed 2D/3D fixtures in private owner regular-view scenario (#790) | CLOSED / QA PASS | Stage 1 Codex GPT-6.1-sol plus independent PM subagent; Stage 2a Codex GPT-6.1-sol substituted for Opencode Go/Kimi K2.5; Stage 3 not run; Stage 4 independent Codex QA subagent substituted for Claude Sonnet 5 Medium | Stages 1/2/4 substituted | Commit `977746de`; focused Chromium/PostgreSQL scenario 1/1 covers both 3D and 2D privacy paths at 1280x900 and 375x812; counts remain 3/20; typecheck/lint/format/diff pass. | QA comment 5926110585; closed completed |
| #1123 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1123 | Discovered during #1121 QA; proposed backlog entry in `docs/tasks.md` | #1121 final acceptance rerun | Activate description panel before generated-piece slug assertions | CLOSED / QA PASS | Stage 1 roster Codex / actual Codex GPT-6.1-sol plus PM subagent; Stage 2a roster Opencode Go/Kimi K2.5, actual Codex GPT-6.1-sol implementation subagent; Stage 3 not run; Stage 4 Claude/Sonnet 5 Medium roster, actual independent Codex GPT-6.1-sol QA subagent | Stages 1/2/4 substituted | Commit `abdf25a7`; focused 1/1 and complete spec 2/2; typecheck/lint/format/diff pass; 2 tests and 12 expects unchanged. | QA comment 5925979847; closed completed |
| #1144 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1144 | Proposed discovery from #1108; `docs/tasks.md` | #1100 server-backed 3D helper | Re-home public 3D guide/proportions setup while preserving owner publish → anonymous route | OPEN / PROPOSED (externally authorized by owner message; issue body still says awaiting refinement) | Stage 1 Codex GPT-6.1-sol; implementation/QA not run | Stage 1 substitution provenance as recorded in ledger | Setup reaches `/local-projects/:id` and times out before public assertions; valid public menu locators. Owner now said refined open issues are workable, but current body has no refinement evidence to implement from. | Re-read issue and obtain/record external refinement before implementation; dependency #1100 remains open. |
| #1145 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1145 | Proposed discovery from #1108; `docs/tasks.md` | #1108 audit; #1114 mobile layout may affect reproduction | Restore selected drawing-plane state after mobile ink cancel without committing temporary ink | OPEN / PROPOSED / HANDED-OFF | Stage 1 Codex GPT-6.1-sol; implementation/QA not run | Newly filed in this run; separation-of-duties rule applies | Evidence: 375x812 before screenshot shows handles, after cancel screenshot does not; desktop passes; duplicate search completed; milestone 14. | Await external refinement, then a different agent implements. |

### #1111 — ENGINEERING → QA FAIL → DEPENDENCY BLOCKED

- Live criteria re-read. The mobile 3D toolbar geometry and 2D compatibility
  criteria pass; the whole issue remains open because the required broad 2D
  regression gate cannot pass until the known test-fixture migration (#1103,
  after #1100) is complete.
- Discovery: current pre-fix tree reproduced a mobile 2D ink/fullscreen hit
  collision; a disposable tree at the pre-#1111 baseline passed. This was an
  unintended 2D regression from a responsive 3D selector, not a pre-existing
  2D defect. Scoped the rule to `.project3d-workspace` and added the independent
  2D geometry test as #1120 evidence; no assertions were weakened or removed.
- Commit: `8766789c` (`fix(3d): scope mobile toolbar bound to 3D`).
- Verification: #1111 geometry 2/2 at 375x812 and 1280x900; #796 repeat 3,
  6/6; manual3d 1/1; manual2d 2/2; 2D geometry 2/2; full ink 2/2; focused
  EditorWorkspace Vitest 37/37; typecheck, lint (exit 0, existing warnings),
  format and diff checks pass. LayersPanel and interactionRuntime fail before
  feature assertions at `support/createProject.ts:54`; the grouped 2D gate
  remains blocked on #1103. Screenshots at both viewport sizes inspected.
- Provenance: Codex/GPT-6.1-sol implementation substitution for stage 2a;
  independent QA subagent substitution for Claude Sonnet 5 Medium at stage 4;
  stage 3 not run. Evidence is local macOS Chromium + disposable PostgreSQL
  (Django :8003, Vite :5003); no Linux or deployed acceptance evidence.
- QA result and matrix appended to live issue #1111; issue stays open. Next:
  complete #1100 Linux six-spec acceptance and #1103's multi-call setup
  migration, then rerun the full required 2D matrix.

### #1120 — ENGINEERING → QA → CLOSED

- Live acceptance re-read. The 375x812 ink center was intercepted by fullscreen
  before the CSS scope correction; focused geometry now passes 2/2 across
  375x812 and 1280x900. Full `inkLayer2d.spec.ts` passes 2/2, including the
  complete stroke/erase/undo/redo/save/reload/cancel workflow. Mobile and
  desktop screenshots inspected; no overlap or horizontal overflow.
- Scope resolution per the issue refinement: the defect was introduced by
  #1111's shared responsive rule and belongs to its CSS-scope repair. No
  separate 2D product rule is needed; 2D is restored to the pre-#1111 layout.
  The focused geometry regression stays in
  `frontend/e2e/inlineStageToolbarGeometry2d.spec.ts`.
- Commit: `8766789c`. Typecheck, lint (exit 0 with existing warnings), format
  passed. Stage 2 and stage 4 used Codex substitutes; independent QA agent
  completed read-only stage 4; stage 3 not run. Local macOS Chromium and
  disposable PostgreSQL evidence only.
- QA evidence appended to issue body; issue closed completed. #1111 remains
  open for its broader cross-editor gate, blocked by #1103/#1100.
