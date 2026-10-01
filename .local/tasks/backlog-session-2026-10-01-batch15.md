# Backlog session — 2026-10-01 continuation

Repository: `cfornesa/ai-dev-tools-zoomcamp-1`  
Branch: `docs/backlog-reevaluation-2026-09-27`  
Issue inventory at refresh: 32 open issues, from authenticated GitHub search on
2026-10-01. User authorized implementation of the refined open issues and
asked for bulk closure while preserving per-issue implementation/QA gates.
No push authorization was given.

## Open-issue manifest

The older Batch 14 and Batch 16 issue contracts and prior terminal decisions
remain in their linked issue bodies and earlier batch ledgers. This live
manifest captures every issue open at the refresh and the dependency order;
items advance only after the current transaction is terminal.

| Issue | Dependencies / lane | Initial status | Current owner / next action |
| --- | --- | --- | --- |
| #1096 | Browser-matrix tracker | HANDED-OFF | Comment 5934302482 refreshes child status; wait for #1100 Linux gate, #1102–#1104 migrations, then rerun and classify the full Linux matrix. |
| #1100 | Foundation E2E server fixtures | BLOCKED (verification-boundary) | Comment 5934294294; local 7/7 plus static checks pass; exact Linux Chromium/PostgreSQL gate is next, then reconcile before dependent migrations. |
| #1102 | After #1100 | DEPENDENCY-BLOCKED | Wait for #1100, then migrate single-purpose 2D specs. |
| #1103 | After #1100 | DEPENDENCY-BLOCKED | Wait for #1100, then migrate multi-call 2D specs. |
| #1104 | After #1100 | DEPENDENCY-BLOCKED | Wait for #1100, then migrate lifecycle/publication/responsive specs. |
| #1108 | 3D inline toolbar locator audit | CLOSED | QA PASS after 20/20 exact nine-spec rerun; comment 5932612079; closed completed 2026-10-01. #1104-owned lifecycle setup remains explicitly unverified and untouched. |
| #1110 | 3D mobile move handle | DEPENDENCY-BLOCKED | After #1111/#1112 and #1102/#1103 compatibility gate; then verify exact hit-testing and mobile criteria. |
| #1111 | 3D inline control overlap | DEPENDENCY-BLOCKED | Local CSS fix exists; reconcile its broad 2D gate after #1102/#1103 and #1100. |
| #1112 | After #1100; drawing-plane E2E | DEPENDENCY-BLOCKED | Migrate its setup after helper foundation. |
| #1114 | Depends on 3D toolbar/mobile regression lane | DEPENDENCY-BLOCKED | User selected 16:9 stage and outer rail under stage; finish required regression lane. |
| #1124 | Batch 15 theme/token foundation | CLOSED | QA comment 5930214077; closed completed 2026-10-01. |
| #1125 | After #1124 | CLOSED | Completed locally in `e2460057`; QA PASS comment 5931636109. |
| #1126 | After #1124 | CLOSED | QA PASS; implementation commit `f8630dc5`; GitHub closed completed 2026-10-01. |
| #1127 | Independent Batch 15 copy/provider order | CLOSED | QA PASS comment 5932906647; implementation `7efd8596`; closed completed 2026-10-01. |
| #1128 | After #1124–#1126 | CLOSED | QA PASS comment 5933282991; implementation `19f9411b`; closed completed 2026-10-01. Existing `accountShell.spec.ts` stale copy failure was shifted to #1147. |
| #1146 | Discovered during #1125 QA; Batch 15 | CLOSED | Implementation `e68aaac5`; QA PASS comment 5934137286; closed completed 2026-10-01. |
| #1147 | Discovered during #1128 regression batch; test maintenance | CLOSED | Commit `1ca91017`; QA PASS comment 5933568932; closed completed 2026-10-01. |
| #1129 | Owner decision D1 | OWNER-DECISION-PENDING | Request the project's documented owner choice when the decision gate is reached. |
| #1130 | Owner decision D2 | OWNER-DECISION-PENDING | Request the documented 2D/3D history scope decision. |
| #1131 | Independent 2D history event writer A1 | COMPLETED | Implementation `b11971c0`; latest QA PASS comment 5935229510; closed completed 2026-10-01. |
| #1132 | Independent 2D AI accept/discard history writer A2 | COMPLETED | Implementation `f205906b`; QA PASS comment 5935797610; closed completed 2026-10-01. |
| #1133 | Activity read API | COMPLETED | Implementation `b1796a7f`; independent Stage 4 QA PASS; reconciliation `ca7c5c9c`; closed completed after typed issue update. No QA comment URL; process fallback evidence in ledger. |
| #1134 | History UI | COMPLETED | Corrective commit `f4bd4a30`; independent Stage 4 PASS; GitHub closed completed 2026-10-01T18:28:20Z; read-after-write confirmed. |
| #1135 | AI proposal reason UI | ENGINEERING | PM refreshed contract; Stage 2a Codex/GPT-6.1-sol substitution active. |
| #1136 | Independent scene diff function B1 | GROOMED | Implement after Batch 15. |
| #1137 | Compare-versions UI | DEPENDENCY-BLOCKED | Requires #1136. |
| #1138 | Intent note storage/API | DEPENDENCY-BLOCKED | Requires owner decision #1129. |
| #1139 | Intent note editor | DEPENDENCY-BLOCKED | Requires #1138. |
| #1140 | Intent note AI context | DEPENDENCY-BLOCKED | Requires #1138/#1139. |
| #1141 | Independent related-pieces query C1 | GROOMED | Implement after Batch 15. |
| #1142 | More-like-this UI | DEPENDENCY-BLOCKED | Requires #1141. |
| #1143 | Owner continuity metrics | DEPENDENCY-BLOCKED | Requires #1131/#1132. |
| #1144 | Public 3D viewer E2E setup | DEPENDENCY-BLOCKED | Requires #1100. |
| #1145 | 3D drawing-plane cancel regression | CLOSED | QA PASS; #1145 closed completed 2026-10-01. Full viewport evidence and scene-data equality show cancel restores the selected plane; the old frame-only byte comparison was an invalid visual oracle. |
| #1148 | Activity in JSON account export | GROOMED / ELIGIBLE | #1133 closed; remains queued behind #1135 transaction. |
| [#1149](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1149) | #1100 server-backed fixture contract; parent #1096 | PROPOSED / HANDED-OFF | Discovered during #1135 QA; retarget the separate 2D and 3D AI Agent E2E specs to their canonical manual-editor routes after #1100 is reconciled. |

## Transaction ledger

### Fresh task-distillation reconciliation after #1100 QA — 2026-10-01

Authenticated GitHub search first returned **23 open issues after #1132
closed**: #1096, #1100, #1102–#1104, #1110–#1112, #1114, #1129–#1130,
#1133–#1144. PM then filed #1148, bringing the current total to **24 open**.
Closed outcomes remain immutable; #1101, #1106, #1107, #1131, #1132, #1145,
#1146, and #1147 are closed. This manifest's open rows cover the refreshed set
and retain links/dependencies from the Batch 14/16 issue bodies.

**Current #1100 transaction:** its existing implementation commit is
`91a7a553`; no product files changed in this refresh. The six named specs
passed 7/7 on the local disposable PostgreSQL/macOS Chromium stack after
#1106/#1107 closed. Assertion inventories match `ef5771b7` in every file:
1/3, 1/11, 1/18, 1/28, 1/53, and 1/25. Typecheck/lint/format and diff checks
pass. QA comment [#5934294294](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1100#issuecomment-5934294294)
records the latest independent Stage 4 review. The Linux-only acceptance is
still unverified; this Mac has no active Docker daemon, the implementation ref
is not pushed, and no push authorization was given. Class: **verification-
boundary**, not a code or workflow defect. Owner/context: project owner must
provide an authorized Linux runner/job against the implementation ref or
authorize publishing the branch for GitHub Actions. Exact next action: run
#1100's six-spec Linux Chromium/PostgreSQL command and record each spec's
result. No new issue is needed: the fixture causes remain covered by #1100,
#1101, #1106, and #1107; this refresh exposed no new actionable code defect.

The parent tracker #1096 remains **HANDED-OFF**; comment
[#5934302482](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1096#issuecomment-5934302482)
records that #1101/#1106/#1107 have closed, #1100 has local 7/7 but is still
Linux-blocked, and residual full-matrix causes remain incompletely mapped.
After #1100's Linux gate, #1102–#1104 can proceed one at a time; #1096 then
needs a fresh 16-shard Linux run and a cause map for remaining failures.

**Fresh dependency order:** #1100 is terminally blocked, so dependent
#1102–#1104, #1112, and #1144 stay dependency-blocked. #1110/#1111/#1114 also
wait for their stated mobile and 2D compatibility prerequisites. #1129 and
#1130 remain owner-decision gates only for their own dependent LIGDOL slices;
no current conversation response unambiguously chooses their listed options.
The Batch 16 issues #1131 and #1132 are completed. #1133 is now eligible after
both writer dependencies closed; #1136 and #1141 remain independent. New
follow-up #1148 was filed for account JSON export after the duplicate check; it
depends on #1133's shared activity projection. No unlinked discovery remains.
**#1133 reconciliation:** GitHub returned issue #1133 closed with reason `completed` at 2026-10-01T17:08:13Z. The prior transaction docs commit is `ca7c5c9c`. Read-after-write state confirms closure. The comment limitation and local evidence fallback are recorded above.

**#1134 reconciliation:** GitHub returned issue #1134 closed with reason `completed` at 2026-10-01T18:28:20Z after corrective Stage 4 PASS; read-after-write confirms closure. Reconciliation commit `36060300` contains the full criteria evidence and provenance. The backlog may now select the next eligible issue after refreshing the complete open inventory.

**Fresh open-issue inventory (2026-10-01):** authenticated GitHub search
returned 22 open issues: #1096, #1100, #1102–#1104, #1110–#1112, #1114,
#1129–#1130, #1135–#1144, and #1148. #1135 is selected next because both
dependencies (#1132 and #1134) are complete; it remains in PM refresh before
engineering. The other eligible independent issues remain queued per the
single-transaction gate.

### #1135 — 2D AI Agent review reason (PM complete; engineering active)

PM refresh confirmed #1132 and #1134 are closed and found no duplicate. It
corrected a functional contract mismatch: the old issue referenced one-shot
AIProposalPanel Accept/Reject controls that do not call #1132's event-writing
endpoints. The refined scope is the persisted 2D Agent `awaiting_review`
candidate controls in `AIRunPanel`, enabled only by its 2D caller; 3D remains
unchanged. Exact contract covers transient optional reason state, trimming and
whitespace omission, Unicode code-point counter/input cap (280), Enter not
submitting, accessible label/description, matching accept/cancel request
payloads, tests, and a real PostgreSQL/fake-provider E2E that writes distinct
accepted/rejected reasons and reads them from #1134 Activity at 1280x900 and
375x812. No backend/schema/API-contract change or live provider call.

**Stage 1 provenance:** rostered Codex/GPT-5.6 Luna/Medium; actual PM agent
Codex/GPT-6.1-sol/effort unavailable; substituted: no. **Stage 2a owner:**
rostered Opencode Go/Kimi K2.7-code; actual separate Codex engineer/GPT-6.1-sol
/effort unavailable; substituted: yes. Stage 3 explicitly not requested.
Stage 4 rostered Claude/Sonnet 5/Medium; will use a separate Codex QA agent if
Claude is unavailable, recording the substitution.

**Current transaction:** #1135 ENGINEERING. No product commit or verification
claim yet. QA, reconcile and close this issue before starting another issue.

**Stage 4 contract reconciliation:** QA found `aiAgent2d.spec.ts` and
`aiAgent3d.spec.ts` fail on their retired routes on both the #1135 parent and
target; #1149 owns their canonical-route retargeting. #1135's final QA must
preserve those specs' assertions, reproduce and record the same failures on
both revisions, and classify the legacy route issue as a verification
boundary assigned to #1149. It is not a pass claim or a reason to change
those specs in #1135. Valid non-regression evidence remains the dedicated
#1135 fake-provider 2D reason E2E and inspected screenshots, focused tests
showing the 3D caller/request remains unchanged, plus passing frontend
static/unit checks. The live #1135 contract now records the exact baseline
and dedicated E2E commands.

**Discovery during #1135 QA:** both existing AI Agent E2E specs still use
retired routes (`/ai-projects/:id` and `/ai-projects3d/:id`) whose redirects
land in manual editors without the Agent workflow radio. The 2D setup failure
reproduces at the parent commit. Duplicate/ownership review found no exact
owner: #1100–#1104 own their named fixture-helper caller sets, #1144 owns two
public 3D specs, and #1096 is the full-matrix tracker. Closed #462/#463 remain
the historical feature contracts; they are not reopened. Filed criterion-ready
follow-up [#1149](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1149)
in Batch 16, linked to #1096, with separate preserved 2D/3D fixtures and an
exact Linux Chromium/PostgreSQL command. It depends on #1100's helper contract
and is handed to a later transaction under the discovery gate; no code was
changed for it here.

### #1131 — 2D version lifecycle activity events

**State:** `GROOMED → ENGINEERING → QA FAIL (returned) → ENGINEERING AUDIT → QA PASS → RECONCILIATION → CLOSED`.
Closed completed on 2026-10-01 after the refined issue criteria, implementation,
performance evidence, and independent QA were reconciled.

The PM audit found and corrected the issue's missing fixture, actor, repeat-POST,
DELETE retry, regression-evidence, and routing detail before closure. It names
the owner-authenticated two-version project fixture and the three existing 2D
version endpoints; it preserves successful save/restore POST non-idempotency,
requires one activity per created version, and requires idempotent soft-delete
retries. The issue explicitly bounds evidence to local automated tests and
requires no production claim. `docs/tasks.md` now records this Stage 2b route.

**Implementation:** commit `b11971c0` adds transactional
`VERSION_SAVED`, `VERSION_RESTORED`, and first-transition `VERSION_DELETED`
events in the existing endpoints, with owner actor and safe version-only
metadata. Repeated DELETE stays 204 without a duplicate event or timestamp
change. Focused rollback/retry/metadata tests were added; 3D/generated-piece
paths, routes, response shapes, schema, dependencies, and secrets are untouched.

The initial Stage 4 comment [5934945703](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1131#issuecomment-5934945703)
passed functional criteria but returned the issue because it lacked the
specified save-latency evidence. After a separate Stage 2b protocol audit,
three independently rerun interleaved SQLite probes measured median signed
effects of 0.141, 0.111, and 0.114 ms, each below that run's p95 control noise
(0.670, 0.713, and 0.554 ms). The temporary probe was removed and is not in
the product diff. The evidence is host- and SQLite-test-database-specific; it
does not establish PostgreSQL or deployed performance.

**Verification:** focused `pytest tests -k "version or activity"` passed
217 tests, skipped 11, deselected 1701 (the temporary probe was present and
selected); final `make backend-check` passed Ruff, formatting, mypy, and the
full backend suite (1889 passed, 39 skipped). No temporary probe remains.
Latest Stage 4 comment [5935229510](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1131#issuecomment-5935229510)
is `QA: PASS`, supersedes the earlier FAIL, and accepts the implementation.

| Stage | Rostered owner | Actual owner | Substituted |
| --- | --- | --- | --- |
| PM/grooming | Codex / GPT-6.1-sol | Codex subagent / GPT-6.1-sol / effort unavailable | no |
| Implementation / stage 2b | Ollama Cloud / Kimi K3 | Repository owner / Codex GPT-6.1-sol / effort unavailable | yes |
| Independent review / stage 3 | Mistral Vibe | Not run | — |
| QA / stage 4 | Claude / Sonnet 5 / Medium | Separate Codex subagent / GPT-6.1-sol / effort unavailable | yes |

No new actionable issue was discovered. No durable memory update was needed.

### #1132 — AI proposal accept/discard history writer

**State:** `GROOMED → ENGINEERING → QA PASS → RECONCILIATION → CLOSED`.
Closed completed on 2026-10-01 after a separate Stage 4 review. Issue #1132
was fetched after PM grooming and again before QA. The PM
updated the live contract with a fixed owner/project/run fixture matrix, exact
reason validation/normalization, locked pre-transition discard semantics,
transaction and replay rules, API documentation requirements, and explicit
2D-only boundaries (#1130, #1133, #1135 out of scope). Entry points are
`AIRunAcceptView` and `AIRunCancelView` in `backend/scenes/ai_runs_api.py`;
focused coverage is `backend/tests/test_ai_runs.py`; documentation target is
`docs/api.md`. Exact checks: `cd backend && uv run pytest
tests/test_ai_runs.py -q` and `make backend-check`. Evidence is local automated
backend testing; production and PostgreSQL concurrency claims are excluded.

The fixture matrix covers valid accepted and discarded 2D `awaiting_review`
runs; running cancellation; an awaiting-review 3D control; invalid-candidate
and stale-base accept negatives. Reason tests cover omitted/null/empty/blank,
non-string and >280 submitted Unicode code points, Cc stripping, normalization
to empty, and preserved non-ASCII. Only the first locked awaiting-review to
cancelled explicit transition writes rejection; accepted replay reuses its
version and does not duplicate activity. Exact safe metadata is passed through
`ProjectActivity.save()` and `validate_activity_metadata()`.

| Stage | Rostered owner | Actual owner | Substituted |
| --- | --- | --- | --- |
| PM/grooming | Codex / GPT-6.1-sol | Separate Codex subagent / GPT-6.1-sol / effort unavailable | no |
| Implementation / stage 2b | Ollama Cloud / Kimi K3 | Codex subagent / GPT-6.1-sol / effort unavailable | yes |
| Independent review / stage 3 | Mistral Vibe | Not requested / pending | — |
| QA / stage 4 | Claude / Sonnet 5 / Medium | Separate Codex subagent / GPT-6.1-sol / effort unavailable | yes |

Implementation commit `f205906b` changes exactly the four issue-named files
(`backend/scenes/ai_runs.py`, `backend/scenes/ai_runs_api.py`,
`backend/tests/test_ai_runs.py`, and `docs/api.md`). It documents the optional
request field before implementing it, adds 2D-only accept/discard activity in
the transactional service paths, and tests the stated normalization and
state/idempotency matrix. Engineer-reported checks: exact focused command
passed 67 tests with 3 PostgreSQL-only skips; `make backend-check` passed
Ruff, format check (288 files), mypy (396 files), and backend tests (1920
passed, 41 skipped). The PostgreSQL-specific concurrency tests are present but
skipped because no disposable `POSTGRES_TEST_DATABASE_URL` is configured.
The independent QA PASS comment is
[#5935797610](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1132#issuecomment-5935797610).
QA verified each criterion, the exact four-file diff, and test scope, and
independently reran both required commands. Exact results: focused suite 67
passed/3 skipped; full backend check 1,920 passed/41 skipped after Ruff,
format, and mypy. The skipped tests include PostgreSQL two-worker concurrency;
the current result is not PostgreSQL concurrency evidence. Tests cover
concurrent replay code paths, but actual PostgreSQL row-lock behavior remains
an explicitly bounded verification limitation, not a claimed deployment pass.
There were no second-opinion findings, no new issue gaps, and no durable-memory
update. GitHub issue #1132 was closed as completed after this reconciliation.
The newly eligible dependent issue is #1133 (owner-only activity read API).

### #1133 — Owner-only activity read API (PM complete)

The separate PM audit found the former body bundled the read endpoint, JSON
account export, and account-deletion behavior; it also required immediate
deletion contrary to closed issue #443's explicit soft-delete/30-day retention
policy. Duplicate checks covered local backlog/task files and GitHub searches
for activity/export and activity/purge; closed #442, #443, and #945 were
inspected. PM narrowed #1133 to one read-only owner API and created
criterion-ready export follow-up #1148; #1133 and #1148 link each other. No
deletion change is authorized or needed: activity remains on its soft-deleted
project during retention and is removed by the existing hard-purge FK cascade.

The updated #1133 specifies `ProjectActivityListView.get` at the UUID public-ID
route, the owner-only permission action, private/public/soft-deleted/nonexistent
fixtures, exact anonymous/non-owner 404 masking, nullable actor projection and
all action labels, metadata allowlist, stable `(created_at DESC, id DESC)`
cursor pagination and bounds, a composite query-order index/migration, and a
10,000-event query proof (at most 100 returned, two application SELECTs, and
LIMIT 101; no timing promise). Exact checks are the named backend test module
and `make backend-check`; evidence is local automated tests, no deployment
claim. #1133 is closure-ready for Stage 2b.

Stage 2b implementation commit `b1796a7f` changes the issue-named activity
view, route, permission action, model index/additive migration, tests, and
`docs/api.md`. Engineer reports focused tests 16 passed; `make backend-check`
passed Ruff, format (290 files), mypy (399 files), and backend pytest
(1,936 passed, 41 skipped); migration check reports no changes. `git diff
--check` passed. No production/shared database was written or published.
Stage 4 independently re-fetched the live contract, treated the diff and
reported checks as untrusted, and inspected route/auth masking, cursor binding
and tie ordering, metadata projection, soft-deleted owner access, public
response isolation, the 10,000-event query bound, and the additive migration.
Verdict: PASS; no defects or undispositioned findings. It reran the exact
focused module (16 passed), `UV_CACHE_DIR=/tmp/codex-uv-cache make
backend-check` (Ruff, formatting, mypy; 1,936 passed, 41 skipped), migration
consistency check (no changes), and `git diff --check` (clean). Evidence is
local test DB only; PostgreSQL concurrency and deployment are not claimed.
Stage 3 was not run. Stage 4 owner was Codex subagent / GPT-6.1-sol
substituted for Claude / Sonnet 5 / Medium. Criterion matrix: response
envelope/labels/nullable actor/privacy PASS; metadata allowlist PASS; stable
cursor ordering/binding PASS; limit bounds/fetch cap PASS; owner access and 404
masking PASS; public response isolation PASS; index/migration PASS; 10k query
proof PASS; existing response compatibility PASS; focused/full/migration/diff
checks PASS. No QA comment URL exists. State is `GROOMED → ENGINEERING → QA →
RECONCILIATION → CLOSED` pending typed issue update and read-after-write
confirmation, under the documented fallback for unavailable issue-comment
tooling.

### #1134 — Project history timeline (closed after corrective QA)

GitHub confirms #1133 closed completed before this issue was selected. The
separate Codex/GPT-6.1-sol PM pass checked the live contract, dependency,
local task records, and GitHub duplicate candidates. No duplicate exists:
#1131/#1133 provide event writing/reading, #1148 is the separate account JSON
export, and #1135 is the AI reason form. Existing UI is
`frontend/src/pages/VersionHistoryPanel.tsx`; #1133's endpoint is already
documented and implemented, so Stage 2a can remain frontend-only.

Owner selected **tabs**, with Versions initially selected, on 2026-10-01.
The issue body was refined before implementation to add exact WAI-ARIA tab
semantics and keyboard behavior, labels/times/reason safety, async/pagination
states, the existing real API fixture and fake-provider boundary, responsive
measurement/screenshot evidence, exact commands, and quality/regression
constraints. Pagination is unit-tested with a controlled second page; the
real E2E fixture requires the four distinct activity types only, avoiding
26 setup mutations solely to expose the 25-row cursor.

**Stage 1 / PM provenance:** rostered Codex / GPT-6.1-sol; actual Codex
subagent / GPT-6.1-sol / effort unavailable; substituted: no. Stage 2a is
rostered Opencode Go / Kimi K2.5; actual Codex subagent / GPT-6.1-sol / effort
unavailable; substituted: yes. Stage 3 optional and not requested. Stage 4 is
rostered Claude / Sonnet 5 / Medium and must be separate; use a separate Codex
QA substitution only if Claude is unavailable and record it.

**Initial implementation:** commit `b8359ec4cc4c85d1c58ebeae937bd1a5d2d6e79f`
added the typed frontend activity wrapper, tabbed history panel, tests, and
owner-route E2E. Stage 4 returned it because it lacked actual baseline geometry
and scroll comparison evidence and browser delete coverage.

**Stage 2a engineer handoff:** accepted diff commit
`b8359ec4cc4c85d1c58ebeae937bd1a5d2d6e79f`
(`feat(activity): add project history tab`). Files are limited to
`frontend/src/api/projectActivity.ts`,
`frontend/src/pages/VersionHistoryPanel.tsx`,
`frontend/src/pages/VersionHistoryPanel.activity.test.tsx`, and
`frontend/e2e/projectActivityHistory.spec.ts`. The agent reports focused unit
tests (three files, 23 passed), typecheck, lint (repo-existing unrelated
warnings only), and format checks passing; exact Chromium spec 1/1 passed on
disposable PostgreSQL with `AI_PROVIDER=fake`, using port 5001 to preserve the
user's active 5000 server. E2E checked both tabs at 1280x900 and 375x812,
document and row overflow, row/control edges, and mobile Inspector selection.
No Stage 3, closure, or push. These are author claims; Stage 4 must re-read
criteria, inspect all four-file diff and tests as untrusted, rerun focused and
full relevant checks, and visually inspect rendered UI before verdict.

| Stage | Rostered owner | Actual owner | Substituted |
|---|---|---|---|
| PM/grooming | Codex / GPT-6.1-sol | Codex subagent / GPT-6.1-sol / effort unavailable | no |
| Implementation / 2a | Opencode Go / Kimi K2.5 | Codex subagent / GPT-6.1-sol / effort unavailable | yes |
| Independent review / 3 | Mistral Vibe | Not requested / not run | — |
| QA / 4 | Claude / Sonnet 5 / Medium | Codex subagent / GPT-6.1-sol / effort unavailable | yes |

**Corrective Stage 2a:** commit
`f4bd4a300d8c1fe186fbf50b192bbd195a339c39`
(`fix(activity): preserve version panel baseline`) moved tabs into the
existing title row with a 24px minimum target and added browser-level Delete
confirmation, Cancel/focus restoration, and confirm coverage. The parent
baseline is `67daa279955adcfc81b69202a5bf462d69844a4e` (`b8359ec4^`), served
against the same fixture. Reproduction script, geometry JSON, and
baseline/current screenshots are retained under
`/private/tmp/issue-1134-baseline-evidence-20261001/`. Desktop panel/list/
inspector/document/bottom-scroll geometry matches exactly. At 375x812 the
list matches; panel is +0.8 CSS px and document/bottom-scroll +1 px from
fractional layout rounding. Visual inspection found no clipping or material
shift.

**Final Stage 4:** separate Codex/GPT-6.1-sol QA substitution for Claude /
Sonnet 5 / Medium returned PASS. Focused Vitest: 23 passed. Full frontend:
311 files / 3,193 tests passed; typecheck, lint (existing warnings), format
check, and build passed (existing chunk-size/dynamic-import warnings). Exact
owner-route Chromium E2E with fresh disposable PostgreSQL and `AI_PROVIDER=fake`
passed 1/1, including lifecycle and Delete behavior. Sandboxed Chromium failed
at macOS Mach-port startup; approved unsandboxed retry passed. QA captured and
inspected both tabs at 1280x900 and 375x812. Captures:
`/private/tmp/qa-1134-{versions,activity}-{1280,375}.png`. QA dropped its
disposable databases and stopped ports 5005/8005; existing :5000/:8000 remain
live. Evidence is local macOS/disposable PostgreSQL only; no CI, Linux, or
deployed claim. Stage 3 was not run. No issue comment was posted because the
connector only exposes the unsafe PR-shaped comment operation; this matrix is
the local evidence fallback.

| Stage | Rostered owner | Actual owner | Substituted |
|---|---|---|---|
| PM/grooming | Codex / GPT-6.1-sol | Codex subagent / GPT-6.1-sol / effort unavailable | no |
| Implementation / initial + correction | Opencode Go / Kimi K2.5 | Codex subagent / GPT-6.1-sol / effort unavailable | yes |
| Independent review / 3 | Mistral Vibe | Not requested / not run | — |
| QA / initial + correction | Claude / Sonnet 5 / Medium | Separate Codex QA subagent / GPT-6.1-sol / effort unavailable | yes |

No new actionable issue or durable-memory constraint was found. Issue #1134
is ready for typed GitHub closure. After read-after-write confirmation,
refresh the full open-issue inventory and select the next eligible issue;
#1148 now meets its #1133 dependency, subject to PM contract refresh.

**New follow-up #1148:** add the same allowlisted event envelope to the
existing authenticated JSON account export only. Duplicate check found no
equivalent open issue; #945 is the distinct ZIP/browser-only package export.
The new item is `PROPOSED`/dependency-blocked on #1133 and must not begin until
the shared projection contract is implemented and closed. No code has changed
for either issue yet.

### #1147 — Account shell copy assertion

**State:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`.
Completed and closed 2026-10-01; QA PASS comment
[#5933568932](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1147#issuecomment-5933568932).

| Stage | Rostered owner | Actual owner | Substituted |
|---|---|---|---|
| PM/grooming | Codex / GPT-6.1-sol | Codex / GPT-6.1-sol / effort unavailable | no |
| Issue scoping | Codex (via ChatGPT Plus) | Not separately invoked in this transaction; the prior discovery transaction did not record the original stage owner, so it is not inferred | — |
| Implementation / stage 2a | Opencode Go / Kimi K2.5 | Codex / GPT-6.1-sol / effort unavailable | yes |
| Independent review / stage 3 | Mistral Vibe | Not run (optional) | — |
| QA / stage 4 | Claude / Sonnet 5 / Medium | Codex / GPT-6.1-sol / effort unavailable | yes |

**Implementation commit:** `1ca91017`. Only the stale login-copy assertion
in `frontend/e2e/accountShell.spec.ts` changed; `DECISIONS.md` records the
agent-loop provenance. No existing assertion was removed, weakened, or
skipped. The replacement checks the exact provider-neutral sentence rendered
by the login page.

**Focused verification:** the exact account shell Playwright scenario passed
1/1 on local macOS Chromium against the disposable PostgreSQL-backed stack.
The first sandboxed launch was denied at macOS `bootstrap_check_in` before
test setup; the same command passed on an approved unsandboxed retry.
Typecheck, lint (existing warnings only), and the focused Prettier check passed.
The full `UV_CACHE_DIR=/tmp/codex-uv-cache make frontend-check` passed with
310 files and 3,187 tests. QA inspected the generated 375×812 and 1280×900
screenshots.

**Evidence boundary:** local disposable PostgreSQL + macOS Chromium only; no
Linux or deployment claim. **New gaps:** none.

### #1146 — SPA content panel shadow token

**State:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`.
Implementation `e68aaac5`; QA PASS comment
[#5934137286](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1146#issuecomment-5934137286);
closed completed 2026-10-01.

| Stage | Rostered owner | Actual owner | Substituted |
| --- | --- | --- | --- |
| PM/grooming | Codex / GPT-6.1-sol | Codex / GPT-6.1-sol / effort unavailable | no |
| Issue scoping | Codex (via ChatGPT Plus) | Not separately invoked in this transaction; refinement was performed in PM pass | — |
| Implementation / stage 2a | Opencode Go / Kimi K2.5 | Codex / GPT-6.1-sol / effort unavailable | yes |
| Independent review / stage 3 | Mistral Vibe | Not run (optional) | — |
| QA / stage 4 | Claude / Sonnet 5 / Medium | Codex / GPT-6.1-sol / effort unavailable | yes |

**Focused verification:** the content panel browser regression passed 1/1 on
host Chromium against the disposable local fixture, exercising all 16
presentation/theme/viewport states. All screenshots were inspected; the soft
shadow appeared, none stayed clear, offset remained intact, and no clipping or
layout regression was visible. The initial sandboxed browser attempt was
blocked by macOS Chromium `bootstrap_check_in`; the same test passed on the
host runner.

**Full verification:** `UV_CACHE_DIR=/tmp/codex-uv-cache make check` passed:
backend 1,883 passed and 39 skipped; backend lint, format, and mypy passed;
frontend lint, format, and typecheck passed; Vitest 310 files / 3,187 tests
passed. Existing lint warnings only. QA independently repeated both the
focused browser run and full check.

**Scope:** only `frontend/src/index.css` and the new
`frontend/e2e/contentPanelShadow.spec.ts` changed. No API, dependency,
migration, or route changes. **Evidence boundary:** local disposable fixture
and macOS Chromium; no deployment criterion. **New gaps:** none.

### #1127 — Login guidance, provider divider, and order

**State:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`. Completed
2026-10-01; QA PASS comment
[#5932906647](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1127#issuecomment-5932906647).

| Stage | Rostered owner | Actual owner | Substituted |
|---|---|---|---|
| PM/grooming | Codex / GPT-6.1-sol | Codex / GPT-6.1-sol / effort unavailable | no |
| Implementation / stage 2a | Opencode Go / Kimi K2.5 | Codex / GPT-6.1-sol / effort unavailable | yes |
| Independent review / stage 3 | Mistral Vibe | Not requested / not run | — |
| QA / stage 4 | Claude / Sonnet 5 / Medium | Codex / GPT-6.1-sol / effort unavailable | yes |

Implementation commit: `7efd8596`. Login copy is provider-neutral; the closed
signup page clarifies that password signup is unavailable while enabled social
providers can create accounts following consent. Provider forms sort by
alphabetical display name, and the visible divider and named provider group
appear in the accessibility tree. Login fields, labels, actions, CSRF, and
provider POST forms remain unchanged. Google and GitHub account creation after
consent are covered by OAuth tests; LinkedIn is optional and requires an email.

Focused auth suite: 42 passed. Full backend suite: 1,883 passed, 39 skipped.
Full frontend suite: 310 files / 3,187 tests passed; lint (existing warnings),
Prettier, and typecheck passed. The initial `make check` stopped at Prettier
because it scanned ignored generated `frontend/.pytest_cache/README.md`; after
temporarily moving/restoring that file, `make frontend-check` passed all
frontend gates. Login Playwright regression passed at 375px/1280px in light and
dark themes, with no horizontal overflow; screenshots were inspected and the
active Chrome accessibility tree exposed the separator and provider group.
Evidence is local disposable PostgreSQL + macOS Chromium; no CI/Linux or
deployment evidence claimed. No memory update required.

### #1128 — Account pages design parity regression coverage

**State:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`. Completed
2026-10-01; QA PASS comment
[#5933282991](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1128#issuecomment-5933282991).

| Stage | Rostered owner | Actual owner | Substituted |
|---|---|---|---|
| PM/grooming | Codex / GPT-6.1-sol | Codex / GPT-6.1-sol / effort unavailable | no |
| Implementation / stage 2a | Opencode Go / Kimi K2.5 | Codex / GPT-6.1-sol / effort unavailable | yes |
| Independent review / stage 3 | Mistral Vibe | Not requested / not run | — |
| QA / stage 4 | Claude / Sonnet 5 / Medium | Codex / GPT-6.1-sol / effort unavailable | yes |

Implementation commit: `19f9411b` (Playwright test only). The new
`frontend/e2e/accountPagesDesignParity.spec.ts` covers login and the reachable
closed-signup page at 375×812 and 1280×900 under light, dark, system/light, and
system/dark preferences. All 16 screenshot cells are attached to test results,
saved, and visually inspected. Theme attributes and CSS variables match the
SPA gallery; there is no horizontal overflow. Computed contrast checks cover
body/intro text, labels, placeholders, validation error text, buttons, and the
actual 3px input focus ring against both adjacent surfaces. Keyboard checks
cover first-focus skip link and theme persistence to `/gallery`. A temporary
`.google`-only style mutation caused the new test to fail on provider-token
parity, then the original template was restored.

Focused matrix: 1 passed (16 route/viewport/theme cells). `make frontend-check`
passed lint (pre-existing warnings only), Prettier, typecheck, and 310 files /
3,187 tests. `npx playwright test --list` lists the new spec; the scheduled and
manual CI 16-shard full-suite command auto-discovers it under Playwright's
`testDir`. The related four-spec account regression batch had 4 passes and one
failure: existing #1126 `accountShell.spec.ts` still expects the “New here?”
copy removed by #1127. Filed as [#1147](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1147)
and deferred per the discovery rule; it does not change #1128's finite
test-only acceptance. Evidence is a local disposable PostgreSQL-backed stack
and macOS Chromium; no Linux or deployment result claimed.

### #1108 — Inline 3D toolbar locator audit

**State:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`. **Result:**
completed and closed 2026-10-01; QA PASS comment
[#5932612079](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1108#issuecomment-5932612079).

**Stage provenance**

| Stage | Rostered owner | Actual owner | Substituted |
|---|---|---|---|
| PM/grooming | Codex / GPT-6.1-sol | Codex / GPT-6.1-sol / effort unavailable | no |
| Implementation / stage 2a | Opencode Go / Kimi K2.5 | Codex / GPT-6.1-sol / effort unavailable | yes |
| Independent review / stage 3 | Mistral Vibe | Not requested / not run | — |
| QA / stage 4 | Claude / Sonnet 5 / Medium | Codex / GPT-6.1-sol / effort unavailable | yes |

**Commits:** primary implementation `006ca3b2`; later in-scope corrections
`5e0cc907`/`15a5a86f`; related child issue commits #1115 and #1145 are accounted
for separately. The issue implementation commit preserved each of its nine
files' test/expect counts versus its parent. Later child transactions added
assertions but removed none. The current locator audit is in the linked GitHub
inventory comment; current `rg` inventory contains 35 textual hits. Unverified
manual-editor lifecycle hits remain in #1104's stale route setup; menu-mode
public/2D/artifact uses remain untouched, as permitted by the criteria.

**Verification:** exact nine-spec PostgreSQL-backed Chromium batch passed 20/20
at 127.0.0.1:5003; typecheck, lint (exit 0 with existing warnings), format,
and diff checks passed; full frontend Vitest passed 310 files / 3,187 tests.
Mobile viewport screenshots for #782, #784, and drawing Cancel were inspected.
Evidence is local disposable PostgreSQL + Chromium on macOS; no Linux or
deployment evidence claimed. #1104/#1144 remain open for their separate setup
scope and were not reported as passing. No memory change required.

### #1145 — 3D drawing-plane cancel regression

**State:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`. **Result:**
completed and closed 2026-10-01 after QA PASS comment
[#5932448095](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1145#issuecomment-5932448095).

**PM/grooming:** issue re-read and confirmed criterion-ready; scope limited to
`frontend/e2e/drawingPlaneDraw3d.spec.ts`. The observed failure was reproduced
before edits at 375x812 (1280x900 passed). A full-page screenshot taken after
Cancel showed the selected plane handles and toolbar in the rendered viewport;
the prior assertion captured only the 16:9 canvas-frame element, whose
Playwright element screenshot omitted the selection chrome. No product defect
was present. The regression test now captures full viewport screenshots,
asserts handles and unchanged move-handle position relative to the preview,
compares server-backed scene objects before/after Cancel, and checks the mobile
stage bounds and document overflow. The existing confirm/save/reload sequence
and drawing-difference assertion remain.

**Stage provenance**

| Stage | Rostered owner | Actual owner | Substituted |
|---|---|---|---|
| PM/grooming | Codex / GPT-6.1-sol | Codex / GPT-6.1-sol / effort unavailable | no |
| Implementation / stage 2a | Opencode Go / Kimi K2.5 | Codex / GPT-6.1-sol / effort unavailable | yes |
| Independent review / stage 3 | Mistral Vibe | Not requested / not run | — |
| QA / stage 4 | Claude / Sonnet 5 / Medium | Codex / GPT-6.1-sol / effort unavailable | yes |

**Commits:** `2e9da3b8` test correction; `b5613875` formatter-only follow-up.
Product implementation was unnecessary because the live UI already retained
selection and canceled scene data. Only the issue-named E2E file changed.

**Focused and full verification**

- `E2E_BASE_URL=http://127.0.0.1:5003 E2E_ENV_FILE=/tmp/codex-qa-1120-current.env npm run test:e2e -- e2e/drawingPlaneDraw3d.spec.ts --project=chromium` — 2 passed at 1280x900 and 375x812.
- `npm run typecheck` — passed.
- `npm run lint` — exit 0; existing repository warnings only.
- `npm run format:check` — passed (the ignored `.pytest_cache` directory was moved temporarily and restored).
- `npm test` — 310 files / 3,187 tests passed.
- `git diff --check` — passed. Test declaration count 1→1; `expect(...)` call count 20→30; no skip/fixme.

**QA matrix:** all five issue criteria PASS. At mobile, full viewport before/after
screenshots were inspected; selected plane handles stay in the same stage-local
geometry. Persisted 3D scene objects are deeply equal before Draw and after
Cancel. At desktop the full workflow passes. Mobile document width does not
exceed its client width and the stage bounds remain within the viewport.

**Evidence boundary:** local disposable PostgreSQL-backed Django/Vite stack at
`127.0.0.1:5003`, Chromium on macOS. No Linux CI or deployment evidence claimed.
No memory update required; this corrects a test oracle, not a durable platform
constraint. **Next:** continue the refreshed open-issue manifest, respecting
explicit dependencies and external Linux gates.

### #1124 — Account pages: site theme parity

**State:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`  
**Result:** completed; GitHub issue closed 2026-10-01 with state reason
`completed`. QA comment:
https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1124#issuecomment-5930214077

**Stage owners and routing**

| Stage | Rostered owner | Actual owner | Substituted |
| --- | --- | --- | --- |
| Spec refinement / stage 1 | Codex via ChatGPT Plus | Claude Code; exact model/effort not present in issue record | yes |
| Implementation / stage 2b | Ollama Cloud / Kimi K3 | Codex / GPT-6.1-sol / effort unavailable | yes |
| Independent review / stage 3 | Mistral Vibe | Not run | — |
| QA / stage 4 | Claude / Sonnet 5 / Medium | Codex / GPT-6.1-sol / effort unavailable | yes |

**Commits:** `2c3056d7` server-injected palette/presentation and prepaint theme
resolution; `8cdeb84f` allauth template rendering coverage; `3646959e` spacing
tokens; `80de5581` normal-size account button text contrast at 4.5:1.

**Focused checks**

- Backend account/auth/OAuth tests: 29 passed in the focused run; updated
  template-render checks passed (2 tests).
- `E2E_BASE_URL=http://127.0.0.1:5003 E2E_ENV_FILE=/tmp/codex-qa-1120-current.env npx playwright test e2e/accountThemeParity.spec.ts --project=chromium`
  — final run 2 passed. It generated 32 screenshots for two viewport sizes,
  two palettes, four preference/OS combinations, and both Gallery/Login; the
  screenshots were inspected.
- A first sandboxed Chromium launch was blocked before tests by macOS
  `bootstrap_check_in` permission; rerun with approved escalation completed
  successfully. This was a runner restriction, not a product failure.

**Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache make check` — workflow/action
pin validation, backend lint/format/mypy, backend tests 1,878 passed / 39
skipped, frontend lint/format/typecheck, Vitest 310 files / 3,187 tests passed.
`git diff --check` passed.

**QA matrix:** all issue criteria PASS: token-only palette/presentation/spacing
mapping; prepaint light/dark/system selection and blocked-storage fallback;
SPA/account computed token parity for default/non-default palettes; measured
contrast (body, muted, and button text >= 4.5:1); named account/social template
rendering; unchanged login/provider form contracts; no dependency or API
contract changes.

**Evidence boundary:** local/macOS, isolated disposable Django/Vite stack at
`127.0.0.1:5003`, Chromium only. No Linux CI or published-account route claim.

**Environment diagnostic (not a product mutation):** local `GET
/api/site-theme/` returns `style_key=default`, palette `original`, and generic
dark colors for both light and dark; production `GET
https://augmentrart.com/api/site-theme/` returns `style_key=celestial`, distinct
light/dark palettes, and script/cosmic presentation. No database values were
changed. This is a local-versus-production settings-data difference; #1124's
criterion is parity with the effective setting on the same instance, which
passed.

**New work discovered:** none requiring a new code issue. The local theme-data
difference is not part of #1124's finite styling contract and no settings were
copied or altered.

**Next action:** process #1125 now that its theme plumbing prerequisite is
closed; retain strict one-issue-at-a-time implementation and QA. Do not push.

### #1125 — Account page component styles (current)

**State:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`.
**Result:** completed locally; GitHub issue closed 2026-10-01.
**QA comment:** https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1125#issuecomment-5931636109.
New related follow-up #1146 records the SPA
`.content-panel` soft-shadow/token mismatch discovered in computed-style QA;
that out-of-scope panel change is deferred to its own transaction.

The #1124 prerequisite is closed. The issue names the entry point, finite
visual outcomes, provider selectors, form preservation constraints, local E2E
fixture, viewports, 200% zoom, and exact verification. Its code-quality
conventions are `design-ux.md`, `html-css-vanilla-js.md`,
`accessibility.md`, and `testing.md`.

| Stage | Rostered owner | Actual owner | Substituted |
| --- | --- | --- | --- |
| PM/grooming | Codex / GPT-6.1-sol (portable backlog-session profile) | Codex / GPT-6.1-sol / effort unavailable | no |
| Implementation / stage 2a | Opencode Go / Kimi K2.5 | Codex / GPT-6.1-sol / effort unavailable | yes |
| Independent review / stage 3 | Mistral Vibe | Not requested / not run | — |
| QA / stage 4 | Claude / Sonnet 5 / Medium | Codex / GPT-6.1-sol / effort unavailable | yes |

The checked-in `docs/design-system.md` and `docs/testing-guidelines.md`
mentioned by older project notes are absent; their current equivalents,
`docs/conventions/design-ux.md` and `docs/conventions/testing.md`, were read.
`DECISIONS.md` and `.agents/memory/MEMORY.md` contain no pending confirmation
or open `REVIEW REQUIRED` gate. Relevant browser/account and local PostgreSQL
memory topics were read.

**Implementation commit:** `e2460057`. Product files: account base/login/signup
templates; focused Django template test; Playwright visual and form-contract
test. No dependency/API/schema change.

**Focused verification:**

- `UV_CACHE_DIR=/tmp/codex-uv-cache uv run pytest tests/test_account_component_styles.py tests/test_account_theme.py tests/test_account_templates.py`
  — 5 passed.
- `E2E_BASE_URL=http://127.0.0.1:5003 E2E_ENV_FILE=/tmp/codex-qa-1120-current.env npx playwright test e2e/accountComponentStyles.spec.ts e2e/accountThemeParity.spec.ts --project=chromium`
  — 3 passed. Covers stable provider class, themed controls, four shadow
  states, script font, 375px and 188px (200%-equivalent) widths, keyboard and
  pointer state, locally intercepted provider POST/CSRF, `loginViaUI`, and
  #1124 parity regression. Manual active-Chrome inspection showed the themed
  login card and consistent provider actions. 188px no-overflow check passes.
- `UV_CACHE_DIR=/tmp/codex-uv-cache make check` — 1,879 backend tests passed,
  39 skipped; 310 frontend files / 3,187 tests passed; workflow pin, lint,
  format, mypy, and typecheck gates passed.
- `git diff --check` — passed before commit.

**QA criterion matrix:** all #1125 criteria pass after final primary-button
correction to the site accent-tinted action token. Account card consumes its
page `--shadow` token; stable provider styling and allauth POST/CSRF contracts
remain intact. The SPA `.content-panel` computed shadow remains `none` while
the active `soft` root token is nonzero; because changing SPA CSS is outside
#1125, this distinct mismatch is shifted to [#1146](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1146).

| Stage | Rostered owner | Actual owner | Substituted |
| --- | --- | --- | --- |
| PM/grooming | Codex / GPT-6.1-sol | Codex / GPT-6.1-sol / effort unavailable | no |
| Implementation / stage 2a | Opencode Go / Kimi K2.5 | Codex / GPT-6.1-sol / effort unavailable | yes |
| Independent review / stage 3 | Mistral Vibe | Not requested / not run | — |
| QA / stage 4 | Claude / Sonnet 5 / Medium | Codex / GPT-6.1-sol / effort unavailable | yes |

**Evidence boundary:** local disposable Django/Vite stack (`127.0.0.1:5003`),
Chromium on macOS; no production or Linux CI claim. **Next:** process #1126.

### #1126 — Account pages: shared header, navigation and display controls

**State:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`.
**Result:** completed and closed on 2026-10-01. GitHub QA PASS comment:
https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1126#issuecomment-5932016119.

| Stage | Rostered owner | Actual owner | Substituted |
| --- | --- | --- | --- |
| PM/grooming | Codex / GPT-6.1-sol | Codex / GPT-6.1-sol / effort unavailable | no |
| Implementation / stage 2b | Ollama Cloud / Kimi K3 | Codex / GPT-6.1-sol / effort unavailable | yes |
| Independent review / stage 3 | Mistral Vibe | Not requested / not run | — |
| QA / stage 4 | Claude / Sonnet 5 / Medium | Codex / GPT-6.1-sol / effort unavailable | yes |

The user's stated priority was least risk and invasiveness; the mobile
navigation therefore wraps visible links rather than introducing a menu
state. The account pages now take the title from `SiteSettings`, request
published navigation from the existing anonymous `/api/pages/` projection,
and expose the SPA theme/motion preferences using their shared localStorage
keys. The mobile display controls switch to normal flow after visual QA found
that the fixed controls could cover the login helper copy. Allauth form fields,
actions, CSRF handling, and provider POST forms remain untouched.

**Implementation commit:** `f8630dc5`. Product files: site theme context,
account base template, focused Django template coverage, and a dedicated
Playwright shell/preference regression. No route, API contract, dependency,
or migration change.

**Focused verification:**

- `UV_CACHE_DIR=/tmp/codex-uv-cache uv run pytest tests/test_account_theme.py tests/test_account_component_styles.py tests/test_account_templates.py`
  — 6 passed.
- `E2E_BASE_URL=http://127.0.0.1:5003 E2E_ENV_FILE=/tmp/codex-qa-1120-current.env npx playwright test e2e/accountShell.spec.ts --project=chromium`
  — 1 passed. Checks 375px link reachability/no overflow, keyboard skip-link
  order, light/dark and reduced-motion storage, SPA preference loading, and
  persistence after logout. Four 1280×900/375×812 light/dark screenshots were
  visually inspected; mobile control overlap was corrected before final run.
- `UV_CACHE_DIR=/tmp/codex-uv-cache make check` — 1,880 backend tests passed,
  39 skipped; 310 frontend files / 3,187 tests passed; action pin, lint,
  formatting, mypy, and typecheck gates passed.
- `git diff --check` and focused Prettier check — passed.

**QA criterion matrix:** all #1126 criteria pass. The anonymous header uses
the configured brand, published page navigation uses the shared API, primary
landmarks and first-focus skip link are present, display controls work and
persist between account/SPA routes, and login flow/form contracts remain
unchanged.

**Evidence boundary:** local disposable Django/Vite stack at
`127.0.0.1:5003`, Chromium on macOS; no production or Linux browser claim.
**Next eligible issues:** #1127 and #1128; process #1127 first per the live
manifest order, then #1128.
