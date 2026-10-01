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
| #1100 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1100 | Proposed from #1096 run 36778653929 | approved defer-retirement option; prerequisite for #1102–#1104 | 2D/3D server-backed helpers; six 3D callers | HANDED-OFF / QA FAIL | stage 1 Codex GPT-6.1-sol / stage 2a roster Opencode Go Kimi K2.5, actual Codex GPT-6.1-sol / stage 3 not run / stage 4 roster Claude Sonnet 5 Medium, actual Codex GPT-6.1-sol / gate pending | stage 2a and 4: yes | #1106 closed; #1107 mobile A-Frame drag; Linux six-spec verification absent | Commit 91a7a553; QA comment 5921704822; resolve remaining child follow-up, rerun exact Linux Chromium gate, then reconcile before #1102 |
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
| #1111 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1111 | Discovered during #1109 QA; parent #1096 | implemented before #1110 per explicit owner authorization | prevent mobile inline 3D stage action controls from intersecting | OPEN / QA FAIL pending 2D compatibility | stage 1 Codex; stage 2a Codex GPT-6.1-sol substituted; stage 3 not run; stage 4 Codex GPT-6.1-sol substituted; batch gate pending | stage 2a and 4 substituted | commit efb5d494; follow-up 4587b424 scopes shared CSS to project3d; focused 3D/A-Frame routes pass; full 2D smoke gate awaits #1102/#1103 | corrected QA comment 5922996204; rerun both viewport 2D matrix after fixture migrations |

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
refreshed from GitHub: #1096, #1100, #1102–#1104, #1106, #1108–#1112 (11).

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
