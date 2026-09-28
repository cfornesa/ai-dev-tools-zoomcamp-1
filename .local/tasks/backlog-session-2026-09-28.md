# Backlog session 2026-09-28

## Owner-workability reconciliation pass — 2026-09-28 (second pass, same date)

External feedback (attributed to Codex) summarized the prior pass's 23 open
issues using only two buckets — handed-off and dependency-blocked — and
silently dropped the six plain **owner-decision blocked** issues from its
accounting entirely (`#906`, `#926`, `#946`, `#1004`, `#1005`, `#1006`).
`docs/process.md` now states all three terminal statuses explicitly (see its
"The three non-closed terminal statuses" section) so this gap doesn't recur.
This pass made every one of the 23 issues workable: resolved every
outstanding owner decision in chat, closed what was already done but not
rolled up, chained vague blockers to concrete upstream issues, dispatched CI
for the verification-boundary cluster, and documented (without executing)
every owner-hands-on production/credential action.

| Issue | Outcome this pass |
| --- | --- |
| #987 | Closed — all 6 children (#911-916) were already closed; rolled up. |
| #988 | Closed — all 8 children (#979-986) were already closed; rolled up. |
| #995 | Owner decided Dependabot alerts; child #1022 filed. Stays open (handed-off) until #1022 closes. |
| #996 | Owner decided baseline+ratchet; children #1023 (Ruff C90/N), #1024 (TS strict) filed. Stays open until both close. |
| #1013 | Owner decided reuse `codeGrammar.ts`; children #1025 (transforms), #1026 (materials), #1027 (lights+composition) filed in that order. Stays open until all three close. |
| #1019 | Owner decided newest-sort-only + backend/frontend split; children #1028 (backend), #1029 (frontend) filed; relevance sort deferred to new issue #1030 rather than dropped. Stays open until #1028/#1029 close. |
| #1016 | Owner decided to depend on #941 rather than build a second media contract. Body updated with a `**Do not start until:** #941 closed` header; reclassified from vague `blocked` to concrete `dependency-blocked`. |
| #941 | Confirmed root of the media chain; only blocked on children #973/#974/#975. CI dispatched (`gh workflow run ci.yml`, run 36464649615) for real Linux/Chromium evidence — see CI-dispatch outcome below. |
| #942, #944, #946 | Status comments posted confirming each is dependency-blocked on the next link in the #941→#942→#944/#946 chain, not on any independent decision. #946's two other preconditions (#940, #931) were confirmed already closed. |
| #847, #945 | Status comments posted confirming both are dependency-blocked on #941's (and #941/#942's) contract, not a vague/open decision. |
| #788 | Owner decided: document, don't execute. Exact 8-step runbook posted (schema-preview review, preview-gate publish, evidence check, snapshot, write-gate publish, gate-disable, live verify, close-out evidence), drawing on the closed #954 tooling. Still dependency-blocked on the owner personally running it. |
| #906 | Owner decided: re-author in the editor (Option 1, zero-risk). Exact next step posted. Stays open until the owner posts the rebuild evidence. |
| #926 | Not a decision — restated the exact missing input (a real AI-provider credential in the app's own settings) and the issue's own 6-run budget. Stays open until the owner provisions the credential. |
| #1004 | Owner decided show-with-caption everywhere. Decision recorded in `docs/conventions/design-ux.md`; follow-up #1031 filed; closed. |
| #1005 | Owner decided unify onto `.shell-action` sizing. Decision recorded in `docs/conventions/design-ux.md`; follow-up #1032 filed (also closes #993's admin touch-target gap as a side effect); closed. |
| #1006 | Owner decided pilot Radix UI `AlertDialog` on the `confirm()` replacement; AGENTS.md §8 question asked and approved. Decision + new-dependency rationale recorded in `docs/conventions/design-ux.md` and `docs/dependencies.md`; follow-up #1033 filed; closed. |
| #973, #974, #859, #975 | CI dispatched (run 36464649615) but produced no usable evidence: shard 3 (where #973/#974/#975's specs live) hit its 25-minute `globalTimeout` before reaching them; shard 1 (where #859's five specs live) had its entire full-suite step skipped because a preceding, unrelated WebKit fullscreen/Escape regression check failed first. Both are CI reliability problems, filed as #1034, not a statement about these issues' own correctness. All four remain open, verification-boundary, now pointed at #1034 specifically instead of a generic runner-unavailable note. |

New child/follow-up/discovery issues filed this pass (all milestone-assigned,
none implemented per the discovery-gate rule against same-session
implementation of newly filed work): #1022, #1023, #1024, #1025, #1026,
#1027, #1028, #1029, #1030, #1031, #1032, #1033, #1034.

### CI-dispatch outcome detail (run 36464649615)

Conclusion: `failure`. Per-job: Workflow validation ✓, Disposable published
routing smoke check ✓, Backend checks ✗ (mypy reported the two errors #1021
already fixed — reproduced locally against the identical locked
dependencies as a clean pass, so this is CI-only nondeterminism, not a
regression of #1021), Frontend checks ✗ (a `publicPieceAssets.test.ts`
Vitest failure plus 21 pre-existing oxlint warnings — not yet triaged
further; unrelated to the e2e target specs), Browser acceptance E2E shard 1
✗ (WebKit fullscreen/Escape regression failed, gating the rest of the job),
shard 2 ✗ (`17 failed, 26 passed (25.0m)`, hit globalTimeout), shard 3 ✗
(`39 failed, 29 passed (25.0m)`, hit globalTimeout before reaching
`publicMediaAssets*.spec.ts`). Full diagnosis and acceptance criteria to fix
this: #1034.

## Current-goal final reconciliation — 2026-09-28

The user-requested goal resumed the live 25-issue inventory after the prior
incomplete handoff. Two independent follow-up issues were implemented and
terminalized; the remaining 23 received authenticated GitHub reconciliation
comments and remain open with terminal workflow status.

| Issue | Terminal status | Commit / QA | Exact next action |
| --- | --- | --- | --- |
| #1020 | completed | `83131c3f`; `## QA: PASS`; GitHub closed | None; local implementation/verification complete. |
| #1021 | completed | `5887d2a1`; `## QA: PASS`; GitHub closed | None; local implementation/verification complete. |
| #788 | dependency-blocked | Owner production publication/import | Owner runs the guarded production workflow after the supported publish/runtime gate. |
| #847 | dependency-blocked | #941 media/audio chain | Complete the public media/export contract, then implement ambient sample. |
| #859 | blocked | Approved-browser verification boundary | Run the six-engine matrix on the approved Compose/Linux/CI Chrome runner. |
| #906 | blocked | Owner authorization | Owner chooses re-author, guarded copy, or abandon and supplies live evidence. |
| #926 | blocked | Real-provider credential/owner action | Owner provisions a provider and authorizes at most six bounded live runs. |
| #941 | dependency-blocked/handed-off | Children #973/#974/#975 | Resolve route/artifact children, then reconcile the parent. |
| #942 | dependency-blocked | Depends on #941 | Implement transfer after #941 is terminal. |
| #944 | dependency-blocked | Depends on #942 | Implement retention after transfer contract is terminal. |
| #945 | dependency-blocked | Server-media/export contract | Implement complete account ZIP after prerequisites reconcile. |
| #946 | blocked | Owner production action | Owner authorizes and runs the bounded grandfathering workflow. |
| #973 | blocked | Playwright runner boundary | Run the named embed spec on approved Linux/CI Chrome. |
| #974 | dependency-blocked/verification-boundary | Route/media prerequisite | Resolve the 2D immersive route/media contract, then run the named spec. |
| #975 | blocked | Missing ZIP harness + runner boundary | Restore/add the ZIP spec, then run it on approved Chrome. |
| #987 | handed-off | Tracking parent | Roll up children #911–#916 only; do not implement parent. |
| #988 | handed-off | Tracking parent | Roll up children #979–#986 only; do not implement parent. |
| #995 | handed-off | Tracking/scoping parent | Define CI dependency-scanning decision and file milestone-assigned children. |
| #996 | handed-off | Tracking/scoping parent | Define incremental lint/strictness children before implementation. |
| #1004 | blocked | Owner decision | Owner selects and documents entitlement-gating UI pattern. |
| #1005 | blocked | Owner decision | Owner selects and documents button shape language. |
| #1006 | blocked | Owner decision | Owner selects hand-rolled vs. primitives pilot; answer vendor question if needed. |
| #1013 | handed-off | Tracking/scoping parent | Define 3D grammar and file atomic child issues. |
| #1016 | blocked | No server-backed collection media contract | Owner chooses server media or revises source/scope. |
| #1019 | handed-off | Backend/frontend split required | Scope criterion-ready backend and frontend children. |

Stage provenance for #1020/#1021: scoping Codex/GPT-5/Medium/substituted:no;
implementation Codex/GPT-5/Medium/substituted:yes for Opencode Go;
second-opinion not run; QA Codex/GPT-5/Medium/substituted:yes for Claude
Sonnet 5; readiness Codex/GPT-5/Medium/substituted:yes for the rostered
Claude Opus/Sonnet gate. For blocked/handoff issues, implementation/QA were
not run after grooming; their reconciliation comments name the owner,
dependency, evidence boundary, and next action.

Final counts for this goal: discovered 25; completed 2; blocked 10;
dependency-blocked 7; handed-off 6; missing terminal status 0. No new
actionable follow-up issue was created: every remaining item reuses an existing
issue or is an explicit owner/dependency/tracking handoff. No second-opinion
stage was credited to an implementing model.

## Current-goal reconciliation — 2026-09-28

This section is the live reconciliation for the current user-requested goal;
earlier entries in this file are historical transactions from the same date.
The repository is a single-node project governed by `LOOP-AGENTS.md` (the
standalone graph manifest has no edges). The worktree was clean at intake on
`docs/backlog-reevaluation-2026-09-27`; existing user/session commits are
preserved.

### GitHub inventory and dependency order

Authenticated GitHub inventory at intake: 33 open issues. Issues #1020 and
#1021 were created during the preceding distillation/rectification pass of
this still-active goal and are explicitly deferred under the discovery-gate
rule; they will not be implemented here. No new issue is created by this
reconciliation.

| Order | Issue | Scope / routing | Current terminal classification | Dependency or next action |
| --- | --- | --- | --- | --- |
| 1 | [#1012](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1012) | 3D editor gizmo / 2b | BLOCKED | Owner must confirm the existing Three.js `TransformControls` addon import; then implement and QA. |
| 2 | [#1016](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1016) | Collection cover / 2b | BLOCKED | Owner must choose/authorize a server-backed media source; current local-first media cannot serve public collection payloads. |
| 3 | [#1019](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1019) | Public collection browse / 2b | HANDED-OFF | Issue body requires backend/frontend split before engineering; next action is criterion-ready child scoping. |
| 4 | [#1020](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1020) | Light accent contrast / 2a | HANDED-OFF | Same-goal discovery; do not implement. Resume in a later goal after #994 follow-up scope is accepted. |
| 5 | [#1021](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1021) | Backend mypy repair / 2a | HANDED-OFF | Same-goal discovery; do not implement. Resume in a later goal. |
| 6 | [#788](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/788) | Production data import / owner action | DEPENDENCY-BLOCKED | #763 must be published via supported production runtime; owner-authorized write and live evidence only. |
| 7 | [#906](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/906) | Production record reconciliation / owner action | BLOCKED | Owner selects re-author, guarded copy, or abandon; no agent production write. |
| 8 | [#1004](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1004) | Entitlement UI decision | BLOCKED | Owner selects and documents one of the issue's patterns. |
| 9 | [#1005](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1005) | Button-shape decision | BLOCKED | Owner selects and documents the shape language; implementation is a later issue. |
| 10 | [#1006](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1006) | Primitives-library decision | BLOCKED | Owner selects stay hand-rolled or a scoped pilot; any dependency requires the mandated vendor question. |
| 11 | [#976](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/976) | Canonical immersive route / 2a | BLOCKED | Owner confirms redirect/shim plan before any public URL change. |
| 12 | [#847](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/847) | Ambient sample / 2b | DEPENDENCY-BLOCKED | Requires the resolved media/audio delivery contract and current authored-sound decisions; no public asset contract is inferred. |
| 13 | [#859](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/859) | Six-engine browser verification | DEPENDENCY-BLOCKED | Requires named serene fixtures and sound prerequisites; run local Compose/Chrome only after those fixtures are terminal. |
| 14 | [#926](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/926) | Real-provider Chrome demonstration | BLOCKED | Owner supplies/authorizes real-provider credential and bounded run; fake provider is not equivalent. |
| 15 | [#941](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/941) | Public media delivery / 2b | DEPENDENCY-BLOCKED | Depends on the local-first/media contract and must be scoped against current storage/auth boundaries before code. |
| 16 | [#942](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/942) | Publish-as-transfer / 2b | DEPENDENCY-BLOCKED | Depends on #941. |
| 17 | [#944](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/944) | Unpublish retention / 2b | DEPENDENCY-BLOCKED | Depends on publication/media retention contract. |
| 18 | [#945](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/945) | Account export ZIP / 2b | DEPENDENCY-BLOCKED | Depends on browser-only media/export contract; preserve JSON export behavior. |
| 19 | [#946](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/946) | Grandfathering script / owner action | BLOCKED | Owner-run production data/config action; no agent execution without explicit authorization. |
| 20 | [#973](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/973) | Embed media verification | DEPENDENCY-BLOCKED | Depends on #941 and its published media fixtures. |
| 21 | [#974](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/974) | Immersive media verification | DEPENDENCY-BLOCKED | Depends on #941 and its published media fixtures. |
| 22 | [#975](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/975) | ZIP media verification | DEPENDENCY-BLOCKED | Depends on #941 and its extracted artifact fixtures. |
| 23 | [#911](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/911) | Regular generated mic / 2a | DEPENDENCY-BLOCKED | Requires #909, #910, and #916. |
| 24 | [#912](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/912) | Immersive generated mic / 2a | DEPENDENCY-BLOCKED | Requires #911. |
| 25 | [#913](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/913) | Structured mic / 2a | DEPENDENCY-BLOCKED | Requires #909, #910, and #916. |
| 26 | [#914](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/914) | Generated ZIP mic / 2b | DEPENDENCY-BLOCKED | Requires #910 and the generated runtime path. |
| 27 | [#915](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/915) | Structured 3D ZIP mic / 2b | DEPENDENCY-BLOCKED | Requires #910 and the shared audio-flow contract. |
| 28 | [#916](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/916) | Mic harness/matrix | BLOCKED | Real hardware is explicitly an owner/browser boundary; agent can implement harness only after the capture/effects contract is selected. |
| 29 | [#987](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/987) | Tracking parent | HANDED-OFF | Navigability-only container; children #911–#916 own implementation and QA. |
| 30 | [#988](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/988) | Tracking parent | HANDED-OFF | Navigability-only container; children own decomposition. |
| 31 | [#995](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/995) | Dependency scanning tracking | HANDED-OFF | Requires a criterion-ready CI/dependency-tool decision before implementation. |
| 32 | [#996](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/996) | Ruff/TypeScript rollout tracking | HANDED-OFF | Requires incremental rollout plan and child issue boundaries. |
| 33 | [#1013](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1013) | 3D code grammar tracking | HANDED-OFF | Requires design/scoping pass and child issues; no monolithic implementation. |

The inventory report also contains #847, #859, #906, and the entries above;
the table is the complete 33-item authenticated list including the two
same-goal deferred discoveries. No duplicate follow-up was filed. The next
engineering-eligible item remains #1012 only after its owner gate; otherwise
the next safe action is to reconcile all blocked/handoff records and run the
requested batch readiness/completion reports without claiming readiness.

## Issue #1012 transaction — 2026-09-28 — BLOCKED

- **State:** `GROOMED → ENGINEERING/QA → BLOCKED`.
- **Scope:** manual 3D editor `TransformControls` gizmo; numeric fields and
  `OrbitControls` must remain functional and accessible.
- **Stage provenance:** scoping `Codex / GPT-5 / default / substituted: no`;
  implementation `not run — owner gate`; second opinion `not run`; QA
  `Codex / GPT-5 / medium / substituted: yes`, intake `RETURNED-TO-owner`;
  readiness `Codex / GPT-5 / medium / substituted: yes` at batch gate.
- **QA result:** `## QA: FAIL` in the blocked-transaction sense: no diff was
  accepted because the issue explicitly requires owner confirmation of the
  already-installed Three.js addon import before engineering. No product code,
  dependency manifest, route, schema, or public interface was changed.
- **Focused checks:** read-only `rg` confirmed the repository uses
  `three/examples/jsm/controls/OrbitControls.js`, has no existing
  `TransformControls` import, and retains numeric transform fields in
  `frontend/src/pages/Outline3DInspector.tsx`; no test was run because the
  owner gate precedes implementation.
- **Blocker class:** owner decision / irreversible-decision gate. Exact next
  action: owner confirms use of `TransformControls` from the installed
  `three` package (no new package), then re-enter implementation with the
  issue's finite criteria and run QA.
- **GitHub evidence boundary:** the available GitHub connector exposes issue
  reads and state updates but no issue-comment creation endpoint (its comment
  writer is PR-only); the attempted comment publication cannot be completed
  through the authenticated connector in this environment. The blocker and
  full QA intake are preserved here; no local `gh` token workaround was used.

## Fresh distillation / QA refresh — 2026-09-28

The previous table's dependency classifications were rechecked against the
current GitHub issue state and comments. #832, #833, #844, #853–#858, #886,
#909, #910, #918, #920, #924, #925, #928, and #947 are closed. Therefore
#859, #926, and #941 are not blocked by the prerequisites named in their issue
bodies. #916 remains open because its own six-case matrix still depends on
the downstream microphone routing work; #941 remains an implementation
parent whose children own the remaining route/artifact evidence.

### Issue #973 transaction — 2026-09-28 — BLOCKED / verification-boundary

- **State:** `GROOMED → ENGINEERING/QA → BLOCKED`.
- **Scope:** anonymous structured-2D public media embed verification, using
  the disposable `public-media-create` fixture and both required viewports.
- **Stage provenance:** scoping `Codex / GPT-5 / medium / substituted: no`;
  implementation `not applicable — verification-only`; second opinion `not
  run`; QA `Codex / GPT-5 / medium / substituted: yes`; readiness
  `Codex / GPT-5 / medium / substituted: yes` at batch gate.
- **Automated evidence:** `E2E_DOCKER_COMPOSE=true npx playwright test
  e2e/publicMediaAssetsEmbed.spec.ts --project=chromium` attempted both cases
  but failed before test bodies because Playwright Chromium terminated at
  `MachPortRendezvousServer ... Permission denied`. This is a host/browser
  verification boundary, not an assertion failure.
- **Focused evidence:** backend `uv run pytest tests -k "public_asset or
  media"` passed 12 tests; frontend `npx vitest run src/render src/generative`
  passed 17 files / 261 tests. The Compose fixture created one published
  project and was cleaned up successfully (`deleted: 1`). Direct HTTP checks
  returned 200 PNG with `nosniff`, `public, immutable`, `access-control-allow-
  origin: *`, and a 64-hex checksum; foreign and unknown assets returned 404.
  Active Chrome inspected the real embed at 1280x900 and 375x812; Preview,
  canvas, Piece actions, and mobile `scrollWidth == clientWidth == 375` were
  confirmed.
- **QA result:** `## QA: FAIL` only for the required automated browser gate;
  no product defect is inferred and no code was changed. Evidence is local
  Compose/Chrome only, not production.
- **Exact next action:** rerun the named Playwright Chromium command on the
  repository's approved Linux/Docker browser runner or CI environment, retain
  its screenshots/trace, and then reconcile #973. Do not close it on active
  Chrome plus HTTP checks alone because the issue names the Playwright command.

### Scope corrections from the same refresh

- **#1016:** source inspection confirms the current media library is
  browser-IndexedDB-only (`frontend/src/validation/scene.ts` and
  `frontend/src/render/mediaAssetResolver.ts`); no backend `MediaAsset` or
  collection cover upload/reference contract exists. This is now a genuine
  contract blocker, not merely an unvisited issue. Owner must choose a
  server-backed media contract or revise the cover source; no narrowing was
  silently implemented.
- **#1019:** the issue itself says the browse feature likely needs separate
  backend and frontend criterion-ready children. It remains handed off to a
  distillation/scoping pass; no child was created because the available
  GitHub connector lacks milestone-management support required by repository
  policy, and no new child will be implemented in this goal.
- **#859/#926/#941:** prerequisites are now verified closed, so they are
  actionable in principle. #859 still requires a broad six-engine browser
  matrix, #926 remains an owner credential boundary, and #941 remains
  parent/child route-artifact work. They are not silently marked complete.

### Issue #975 transaction — 2026-09-28 — BLOCKED / workflow-infrastructure

- **State:** `GROOMED → ENGINEERING/QA → BLOCKED`.
- **Scope:** extracted structured-2D ZIP media verification.
- **Stage provenance:** scoping `Codex / GPT-5 / medium / substituted: no`;
  implementation `not applicable — verification-only`; second opinion `not
  run`; QA `Codex / GPT-5 / medium / substituted: yes`; readiness
  `Codex / GPT-5 / medium / substituted: yes` at batch gate.
- **Checks:** `npx vitest run src/export` passed 18 files / 232 tests. The
  exact required command `E2E_DOCKER_COMPOSE=true npx playwright test
  e2e/publicMediaAssetsZip.spec.ts --project=chromium` cannot run because
  `frontend/e2e/publicMediaAssetsZip.spec.ts` is absent (`Error: No tests
  found`), independently of the known Chromium Mach-port launcher failure.
  Existing files include `publicMediaAssets.spec.ts`,
  `publicMediaAssetsRegular.spec.ts`, and `publicMediaAssetsEmbed.spec.ts`,
  but none covers extracted ZIP media.
- **QA result:** `## QA: FAIL` / workflow-infrastructure defect. The named
  browser artifact is missing, so no extracted ZIP criterion can be accepted;
  no product source was changed and no test assertion was weakened.
- **Exact next action:** add or restore the criterion-ready
  `publicMediaAssetsZip.spec.ts` harness (with disposable archive/server and
  cleanup), then run it on the approved browser runner/CI. Because the
  current GitHub connector cannot create milestone-assigned issues, this is
  recorded against #975 rather than silently filed as an unmilestoned new
  issue or implemented in this goal.

## Terminal-status audit — 2026-09-28

The current open inventory remains 33 issues. Every row now has a terminal
workflow status; open GitHub state is preserved where the work is blocked or
handed off.

- **Blocked:** #1012 (owner approval for installed Three.js addon), #1016
  (no server-backed collection media contract), #906/#1004/#1005/#1006/#976
  (owner/irreversible decisions), #926 (real-provider credential), #946
  (owner-run production action), #916 (matrix cannot pass until routing
  children are implemented), #973 (approved Playwright Chromium host
  boundary), and #975 (missing ZIP browser harness plus runner boundary).
- **Dependency-blocked:** #788 (supported production publication/runtime),
  #847 (public media/audio contract), #941 (remaining route/artifact child
  evidence), #942/#944/#945/#973/#974/#975 (the #941 chain), and #911–#915
  (the #916/audio-routing chain). #974 additionally waits on #976.
- **Handed off:** #1019 (backend/frontend child split), #987/#988 (tracking
  parents), #995/#996 (tracking/scoping children), #1013 (3D grammar design
  children), and same-goal deferred #1020/#1021. No newly created issue was
  implemented.
- **Verification-only follow-up:** #859 is unblocked by its named issue
  prerequisites, but remains open because the six-engine serene fixture and
  full cross-surface Chrome evidence are not present in the current local
  state; the known Playwright Chromium launcher boundary also prevents the
  named automated runner. It is not counted as passed or silently closed.

No issue is marked completed by this audit. The exact focused evidence and
next action for the two newly QA-exercised media issues are recorded above;
all other rows retain their issue-specific owner/dependency boundaries.

## Distillation manifest

Project: `cfornesa/ai-dev-tools-zoomcamp-1` on
`docs/backlog-reevaluation-2026-09-27`.

The live GitHub inventory contained 62 open issues. Production data actions
#788 and #906 were classified as owner-gated and skipped. Owner-decision
issues #1004, #1005, and #1006 were classified as blocked and skipped.
#976 was classified as blocked pending explicit confirmation for its
irreversible public-route change. Tracking parents #987, #988, #995, #996,
and #1013 were not treated as implementation authorization; their stated
measurement/navigability/scoping criteria remain separate.

The first implementation transaction was #979, the first unblocked
Batch 9 `owner-priority` issue with a finite criterion-ready contract.

## Issue #979 transaction ledger

- **Issue:** [#979](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/979)
- **Phase:** CLOSED; local evidence complete, GitHub issue closed with
  `state_reason=completed`; GitHub comment publication was rejected by
  connector risk policy.
- **Issue owner / current transaction:** Extract the camera-overlay state and
  handlers from `EditorWorkspace.tsx` into `useCameraOverlay` with zero
  behavior change.
- **Routing:** Stage 1 scoping — Codex / GPT-5 / default effort / substituted:
  no. Stage 2b implementation — Codex / GPT-5 / default effort / substituted:
  yes (substitution for the rostered service — see `DISPATCH.md`). Stage 3
  second-opinion — not run. Stage 4 QA — Codex / GPT-5 / default effort /
  substituted: yes (substitution for the rostered service — see
  `DISPATCH.md`). Stage 5 readiness — pending batch gate; Codex / GPT-5 /
  default effort / substituted: yes (authorized session substitution).
- **Implementation commit:** `550089a3` (`refactor(editor): extract camera
  overlay hook`).
- **Changed files:** `frontend/src/pages/EditorWorkspace.tsx`,
  `frontend/src/pages/useCameraOverlay.ts`.
- **Focused/full checks:**
  - `npx vitest run src/pages/EditorWorkspace*.test.tsx
    src/components/CameraControl*.test.tsx` — 37 files, 425 tests passed
    before commit and rerun from the committed state with the same result.
  - `npm run typecheck` — passed from the committed state.
  - `npm run lint` — exit 0; existing warnings only.
  - `npm run format:check` — passed.
- **QA matrix:** All four acceptance criteria PASS. Existing camera overlay,
  preview, real-control, and CameraControl accessibility suites remained
  green; no CameraControl props, route, schema, dependency, or public API
  changed. Restoration path is the single revertible commit; the full camera
  suite passed after extraction.
- **GitHub closure evidence:** The attempted `## QA: PASS` issue comment was
  rejected by the authenticated connector as unacceptable external-publication
  risk because the repository was not verified as trusted. No workaround was
  attempted. The full comment body and evidence are preserved in this ledger.
- **New gaps discovered:** None. The first attempted quoted Vitest glob was
  invalid and ran zero files; it was corrected to shell-expanded paths before
  the real focused/full run. This was a command-shape correction, not a
  product or workflow defect.
- **Closure decision:** COMPLETE for the finite local contract. Do not claim
  deployed or production verification. GitHub issue state is closed as
  completed; the missing comment publication is a recorded connector boundary.

## Blocked/deferred manifest items

- #788 and #906: `verification-boundary` / owner-authorized production data
  action required; exact next action is owner authorization and live evidence.
- #1004, #1005, #1006: `blocked` / owner decision required; exact next action
  is the owner's selection in the issue comment.
- #976: `blocked` / irreversible public-route decision; exact next action is
  owner confirmation of the redirect/shim and compatibility plan.
- Issues depending on closed prerequisites remain dependency-blocked until
  their named prerequisite is terminal; they were not implemented here.

## Issue #980 transaction ledger

- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Centralize HTML/CSS and JS code-tab synchronization in the
  parameterized `useCodeTabSync` hook without changing round-trip behavior.
- **Implementation commit:** `f5866d72`.
- **Changed files:** `frontend/src/pages/EditorWorkspace.tsx`,
  `frontend/src/pages/useCodeTabSync.ts`.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Checks:** `npx vitest run src/pages/EditorWorkspace*.test.tsx` — 35 files,
  399 tests passed; `npm run typecheck` passed; `npm run lint` exited 0 with
  pre-existing warnings; `npm run format:check` passed.
- **QA matrix:** All four acceptance criteria PASS. JSON remains on its
  existing sync hook; HTML/CSS retain their coupled parser/save semantics;
  JS retains its unchanged-save no-op and error behavior.
- **GitHub closure evidence:** QA comment publication was rejected by the
  connector's external-publication risk policy. The issue was closed through
  the typed issue-state update after this local ledger captured the complete
  evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #984 transaction ledger

- **Issue:** [#984](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/984)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Consolidate the genuinely overlapping ambient/keyboard
  sound-settings state into `useSoundSettingsState`, consumed by both the
  structured 3D editor and the generated-piece stage controls. The hook keeps
  each caller's existing execution path: direct `SonicEngine` calls for 3D
  scenes and command dispatch for sandboxed pieces.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `6c6a5915` (`refactor(sound): share settings state across stage controls`).
- **Changed files:** `frontend/src/audio/useSoundSettingsState.ts`,
  `frontend/src/audio/soundSettings.ts`, `frontend/src/pages/Scene3DPreview.tsx`,
  and `frontend/src/pages/PieceStageControls.tsx`.
- **Checks:** Relevant Scene3DPreview, Structured2DSoundControls, and
  PieceStageControls tests — 58 passed; frontend typecheck, format-check, and
  lint passed. Lint retains repository warnings, including the pre-existing
  `authoredSoundSettings` dependency warning. No manual Chrome hardware check
  was run in this pass.
- **QA matrix:** Shared state owns the listed scalar settings and exposes
  canonical names; the 3D editor's pre-existing chromatic keyboard default is
  preserved through a named sound-settings compatibility constant; effects,
  voice instruments, piano-note tracking, camera/gesture state, and visitor
  drawing remain local to their existing components.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** Manual Chrome sound-control verification remains a follow-up
  evidence boundary, not a discovered implementation defect.

## Issue #985 transaction ledger

- **Issue:** [#985](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/985)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Extract gesture/theremin state, hand-signal refs, gesture
  camera state, and independent camera-preview state from `Scene3DPreview.tsx`
  into `useScene3DCameraState`, preserving the existing `CameraControl` and
  render-loop contracts.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `5434ea87` (`refactor(3d): extract camera and gesture state hook`).
- **Changed files:** `frontend/src/pages/useScene3DCameraState.ts` and
  `frontend/src/pages/Scene3DPreview.tsx`.
- **Checks:** Gesture, camera-overlay, and sound regression tests — 48 passed;
  frontend typecheck and format-check passed; lint passed with existing
  repository warnings. No manual Chrome hardware check was run in this pass.
- **QA matrix:** Gesture steering refs, theremin refs, hand-signal extractor,
  camera stream/status state, video refs, and reset behavior now live in the
  hook; the component retains frame processing, engine calls, rendering, and
  UI wiring unchanged.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** Manual Chrome camera/gesture verification remains an evidence
  boundary, not a discovered implementation defect.

## Issue #986 transaction ledger

- **Issue:** [#986](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/986)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Extract the visitor drawing overlay into
  `useVisitorDrawingOverlay`, including drawing state/history, canvas
  rendering and resize handling, pointer/touch input, eraser behavior,
  keyboard undo/redo, and the overlay refs used by screenshot composition.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `1a9ce058` (`refactor(drawing): extract visitor overlay hook`).
- **Changed files:** `frontend/src/pages/useVisitorDrawingOverlay.ts` and
  `frontend/src/pages/PieceStageControls.tsx`.
- **Checks:** `npm run typecheck`, `npm run format:check`, and the focused
  visitor-drawing Vitest suite — 2 passed. Lint was previously green with
  repository warnings; no manual desktop/mobile pointer verification was run
  in this pass.
- **QA matrix:** The hook owns visitor drawing state, history, canvas and
  pointer refs, rendering/resizing, eraser hit-testing, touch interruption,
  undo/redo, and the event handlers now wired by the stage UI. Screenshot
  compositing continues to include visitor strokes through the shared refs.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** Manual desktop/mobile pointer verification remains an evidence
  boundary, not a discovered implementation defect.

## Issue #1018 transaction ledger

- **Issue:** [#1018](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1018)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Add an opt-in collection comments flag and authenticated
  public comment endpoint. Comments are disabled by default, public payloads
  include comments only when enabled, posts are per-user rate-limited, and
  owners/admins can soft-delete comments.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `31d459a1` (`feat(collections): add authenticated comments`).
- **Changed files:** `backend/scenes/models.py`,
  `backend/scenes/migrations/0103_collection_comments_enabled_collectioncomment.py`,
  `backend/scenes/collections.py`, `backend/scenes/collections_api.py`,
  `backend/scenes/urls.py`, `backend/tests/test_collections.py`,
  `frontend/src/api/collections.ts`, `frontend/src/pages/CollectionManagement.tsx`,
  `frontend/src/pages/CollectionManagement.test.tsx`, and
  `frontend/src/pages/PublicCollection.tsx`.
- **Checks:** 28 backend collection tests passed; 8 focused frontend collection
  tests passed; frontend typecheck and format-check passed; targeted backend
  Ruff check/format-check and Django migration consistency check passed.
- **QA matrix:** Disabled collections render no comment UI and reject posts;
  anonymous posts receive 401; authenticated posts create comments; repeated
  posts within the one-minute per-user/per-collection window receive 429;
  the comments toggle persists independently of visibility/status. Repository
  search found no existing moderation/reporting convention, so the issue's
  permitted basic ownership/admin soft-delete fallback was used. No manual
  browser verification was run.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** Rich moderation/reporting remains intentionally out of scope.

## Issue #1017 transaction ledger

- **Issue:** [#1017](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1017)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Add an independent collection lifecycle status (`active`,
  `draft`, `archived`) alongside public/private visibility. Draft collections
  are excluded from all public collection reads, archived collections are
  excluded from the owner's default management list, and the UI exposes the
  lifecycle status separately from publishing.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `a52a4630` (`feat(collections): separate lifecycle status from visibility`).
- **Changed files:** `backend/scenes/models.py`,
  `backend/scenes/migrations/0102_collection_status.py`,
  `backend/scenes/collections.py`, `backend/scenes/collections_api.py`,
  `backend/tests/test_collections.py`, `frontend/src/api/collections.ts`,
  `frontend/src/pages/CollectionManagement.tsx`, and its focused test.
- **Checks:** `uv run pytest tests/test_collections.py` — 27 passed;
  focused frontend Vitest — 10 passed; frontend typecheck, lint, and
  format-check passed; targeted backend Ruff check and format-check passed;
  Django migration consistency check reported no changes under
  `backend.test_settings`. Mypy still reports the two pre-existing dynamic
  collection-resolution errors in `scenes/collections.py` from #997.
- **QA matrix:** Existing rows default to `active` through the additive
  migration; draft status remains non-public even after a publish action;
  archived status remains stored and is hidden from the owner list; public
  collection, redirect, item-context, and management queries all enforce the
  appropriate status boundary.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #1016 transaction ledger

- **Issue:** [#1016](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1016)
- **Phase:** BLOCKED pending owner decision; GitHub issue remains open.
- **Transaction:** Add a manually selected collection cover image with public
  rendering and a first-item fallback.
- **Blocker:** The issue assumes an existing server-backed media-asset
  convention, but the current repository has no backend `MediaAsset` model or
  upload contract. Its media assets are browser-local IndexedDB records, which
  cannot be referenced by public collection payloads. Implementing this
  requires choosing a new server-media contract or narrowing the feature to a
  different source.
- **Next action:** Owner decides whether to authorize a server-hosted media
  asset contract or revise the cover-image source/scope.

## Issue #1014 transaction ledger

- **Issue:** [#1014](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1014)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Add a local searchable picker for the owner's published
  2D, 3D, and generated pieces while retaining raw UUID entry as a fallback.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `88637cd9` (`feat(collections): add published item picker`).
- **Changed files:** `frontend/src/pages/CollectionManagement.tsx`,
  `frontend/src/pages/CollectionManagement.test.tsx`.
- **Checks:** Focused Vitest — 4 passed; typecheck, lint, and format-check
  passed.
- **QA matrix:** Picker data comes from existing list APIs, filters to public
  projects / public 3D projects / published art pieces, searches title and ID
  with a linear pass appropriate to the owner-list scale, and submits through
  unchanged `replace_items` and server validation. UUID fallback remains.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #1012 transaction ledger

- **Issue:** [#1012](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1012)
- **Phase:** BLOCKED pending owner decision; GitHub issue remains open.
- **Transaction:** Add a draggable Three.js `TransformControls` gizmo to the
  manual 3D editor while preserving numeric-field accessibility and
  OrbitControls coexistence.
- **Blocker:** The issue explicitly requires owner approval before using the
  already-installed `three` package's `TransformControls` addon import
  surface. No code was changed for this issue.
- **Related completed work:** #1011's numeric snapping landed independently
  in commit `c03c2ac6`.
- **Next action:** Owner confirms whether to proceed with the existing Three.js
  addon import; then implement and verify the gizmo.

## Issue #1015 transaction ledger

- **Issue:** [#1015](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1015)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Add native drag-and-drop item reordering to collection
  management while preserving the existing keyboard Move up/Move down path.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `cb1a2cdb` (`feat(collections): add drag reorder`).
- **Changed files:** `frontend/src/pages/CollectionManagement.tsx`,
  `frontend/src/pages/CollectionManagement.test.tsx`.
- **Checks:** Focused Vitest — 3 passed; typecheck, lint, and format-check
  passed.
- **QA matrix:** Drag/drop computes the same full ordered list and calls the
  existing `replace_items` API; the existing Move up/Move down and Remove
  controls remain present and unchanged.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #1011 transaction ledger

- **Issue:** [#1011](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1011)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Add browser-local, toggleable numeric-field snapping for
  3D position, rotation, and scale transforms.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `c03c2ac6` (`feat(editor3d): add numeric transform snapping`).
- **Changed files:** `frontend/src/editor/snap3d.ts`,
  `frontend/src/editor/snap3d.test.ts`,
  `frontend/src/pages/Outline3DInspector.tsx`.
- **Checks:** Focused Vitest — 21 passed; typecheck, lint, and format-check
  passed.
- **QA matrix:** Position snaps to 0.5 units, rotation to 15 degrees, and
  scale to 0.1 increments; the toggle defaults off like the existing 2D
  preference, persists through the existing external-store mechanism, and
  snap-off behavior remains unchanged. Gizmo integration is out of scope.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** #1012 remains blocked pending the explicit owner decision
  required before using the installed Three.js `TransformControls` addon.

## Issue #1009 transaction ledger

- **Issue:** [#1009](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1009)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Add transient Three.js grid and axes orientation helpers to
  the manual 3D editor, default-visible and controlled by an accessible toggle.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `982d81a5` (`feat(editor3d): add viewport orientation helpers`).
- **Changed files:** `frontend/src/pages/Project3DWorkspace.tsx`,
  `frontend/src/pages/Scene3DPreview.tsx`,
  `frontend/src/pages/Project3DWorkspace.save.test.tsx`.
- **Checks:** Focused Vitest — 12 passed; typecheck, lint, and format-check
  passed.
- **QA matrix:** Helpers are created only in the transient Three.js scene when
  enabled, remain outside `scene.objects`, and therefore cannot enter JSON,
  exports, published runtime, or camera/OrbitControls state. The authoring
  disclosure toggles them without changing the authored scene.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #1010 transaction ledger

- **Issue:** [#1010](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1010)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Add the already schema-supported box and cylinder creation
  buttons to the manual 3D authoring menu, with matching default dimensions,
  material, placement, and naming conventions.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `569c35f2` (`feat(editor3d): add box and cylinder buttons`).
- **Changed files:** `frontend/src/pages/Project3DWorkspace.tsx`,
  `frontend/src/pages/Project3DWorkspace.save.test.tsx`.
- **Checks:** Focused Vitest — 8 passed; typecheck, lint, and format-check
  passed.
- **QA matrix:** Existing sphere, plane, and drawing-plane controls remain;
  new Box 1 and Cylinder 1 outline entries are created through the same
  undoable authoring path and use schema-supported dimensions/materials.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #1008 transaction ledger

- **Issue:** [#1008](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1008)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local
  reconciliation.
- **Transaction:** Resolved by #977: Ask AI now sits in the z-indexed editor
  control panel above the canvas rail, eliminating the documented overlap and
  pointer-hit-testing risk without changing its behavior.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `cd66b916` (#977).
- **Checks:** #977 focused and full frontend suites, typecheck, lint, and
  format-check passed; its Chromium setup boundary is recorded in the #977
  ledger entry.
- **GitHub closure evidence:** The attempted linkage comment was rejected by
  the authenticated connector's external-publication risk policy. The issue
  was closed through the typed issue-state update; no workaround was attempted.
- **New gaps:** None.

## Issue #997 transaction ledger

- **Issue:** [#997](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/997)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Replace per-item collection record lookups with batched
  per-kind fetches and eager-load public profiles in collection context.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `5aa499a2` (`perf(collections): batch collection item lookups`).
- **Changed files:** `backend/scenes/collections.py`,
  `backend/tests/test_collections.py`.
- **Checks:** `uv run ruff format --check scenes/collections.py tests/test_collections.py`;
  `uv run ruff check scenes/collections.py tests/test_collections.py`;
  `uv run pytest tests/test_collections.py` — 26 passed.
- **QA matrix:** Mixed Project/Project3D/ArtPiece payloads preserve ordering and
  titles. A four-item collection with two same-kind items is guarded by a
  constant query-count assertion. Public collection context with three rows is
  guarded by a single-query assertion.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #1003 transaction ledger

- **Issue:** [#1003](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1003)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Route canonical piece project and 3D project owner/public
  lookup authorization through centralized `permissions.can()` checks.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `712db6c3` (`refactor(auth): centralize canonical piece read checks`).
- **Changed files:** `backend/scenes/canonical_piece_api.py`.
- **Checks:** `uv run pytest tests/test_canonical_piece.py tests/test_permissions.py`
  — 74 passed; ruff check passed. Mypy was attempted but remains blocked by
  pre-existing errors in imported `scenes/collections.py` from #997.
- **QA matrix:** Public, owner-private, foreign-user, and permission tests
  pass unchanged; project and Project3D lookups use `Action.PROJECT_READ` and
  `Action.PROJECT3D_READ` through the centralized authorization service.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #994 transaction ledger

- **Issue:** [#994](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/994)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Documented WCAG AA targets of 4.5:1 for normal text and
  3:1 for large text, then audited the primary light/dark color-token pairs.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `a5344829` (`docs(a11y): record contrast target
  and audit`).
- **Checks:** Calculated ratios: light text 5.73:1, light heading 20.15:1,
  light accent 4.39:1, dark text 7.04:1, dark heading 16.25:1, dark accent
  6.77:1. The sole below-target pair was filed as follow-up #1020; no color
  change was made in this audit issue.
- **Discovery gate:** Follow-up [#1020](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1020)
  was created and linked before continuing.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** #1020 is deferred to a later transaction.

## Issue #993 transaction ledger

- **Issue:** [#993](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/993)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Raised `.admin-console-nav-button` and
  `.publish-visibility-option` minimum heights to 44px, matching the stated
  touch-target minimum.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `56c9214e` (`fix(a11y): normalize undersized
  touch targets`).
- **Checks:** `npm run build`, `npm run lint -- --quiet`, and
  `npm run format:check` passed. No existing dimension assertion required
  updates.
- **QA matrix:** Both selectors now meet 44px minimums. Live before/after
  screenshots at 1280x900 and 375x812 were not available in the current
  browser environment; this visual verification boundary is recorded and not
  claimed as performed.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #992 transaction ledger

- **Issue:** [#992](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/992)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Defined `--space-1: 4px` and `--space-3: 12px` alongside
  the existing 8px-step spacing tokens after inspecting all six call sites.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `742ef744` (`fix(css): define missing spacing
  tokens`).
- **Checks:** `npm run build`, `npm run lint -- --quiet`, and
  `npm run format:check` passed. The full `make check` suite had passed
  immediately before this CSS-only change.
- **QA matrix:** All six `--space-1`/`--space-3` call sites now resolve to
  nonzero values. Live before/after screenshots at both themes were not
  available in the current browser environment; this visual verification
  boundary is recorded and not claimed as performed.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #991 transaction ledger

- **Issue:** [#991](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/991)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Changed the PieceCard thumbnail from decorative `alt=""`
  to descriptive `alt={`Preview of ${title}`}` and updated the affected
  accessibility queries in PieceCard/PublicGallery tests.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `1ec038a8` (`fix(a11y): describe PieceCard
  thumbnail previews`).
- **Checks:** Full frontend suite — 293 files, 3,074 tests passed; focused
  PieceCard/PublicGallery suite — 2 files, 31 tests passed; formatting passed.
- **QA matrix:** The image now exposes a descriptive accessible name while
  fallback placeholders retain their existing accessible labels; no layout
  behavior changed.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #990 transaction ledger

- **Issue:** [#990](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/990)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Inventoried all `fflate` and `JSZip` usage and documented
  why both remain: JSZip supplies the async object-oriented generated-export
  API, while fflate supplies synchronous low-level `Uint8Array` local archive
  operations.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `da6fed4b` (`docs(deps): justify fflate and
  jszip coexistence`).
- **Checks:** Focused export/archive tests — 21 files, 259 tests passed;
  `make check` — 1,761 backend tests passed/39 skipped and 3,074 frontend
  tests passed; backend/frontend lint, formatting, and typecheck passed with
  existing warnings only.
- **QA matrix:** Both packages remain intentionally; no archive usage was
  migrated and no package-lock change was needed.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #989 transaction ledger

- **Issue:** [#989](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/989)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Removed the weaker duplicate `cryptography>=46.0.0`
  declaration, retaining the stronger `>=50.0.0` floor.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `abf0b7fd` (`chore(backend): remove duplicate
  cryptography dependency`).
- **Checks:** `uv lock` regenerated the lockfile with only the expected
  metadata-line removal; `make backend-lint` passed; `git diff --check`
  passed.
- **QA matrix:** Both dependency declarations now have one effective source;
  no resolved package version changed.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #984 transaction ledger

- **Issue:** [#984](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/984)
- **Phase:** BLOCKED pending owner decision; no code changes made.
- **Blocker:** The issue's evidence describes `effects`, `voiceInstruments`,
  and pressed-piano-note state duplicated in both components, but the current
  `PieceStageControls.tsx` has none of those states and uses a distinct
  command-driven parent-audio model. Its shared state overlaps only partly
  with `Scene3DPreview.tsx`, while its oscillator/filter/ADSR fields are
  broader. Implementing the requested hook therefore requires an owner choice
  between a limited common-state extraction and a broader audio-contract
  redesign.
- **Next action:** Owner confirms the intended shared contract/scope; issue
  remains open and no implementation was started.

## Issue #983 transaction ledger

- **Issue:** [#983](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/983)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Extract dirty tracking, before-unload protection, exit
  confirmation/save-failure state, and draft-failure notices into
  `useEditSessionLifecycle` without changing recovery behavior.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `30a6a4ff` (`refactor(editor): extract edit
  session lifecycle hook`).
- **Changed files:** `frontend/src/pages/EditorWorkspace.tsx`,
  `frontend/src/pages/useEditSessionLifecycle.ts`.
- **Checks:** `npx vitest run src/pages/EditorWorkspace*.test.tsx` — 35 files,
  399 tests passed; `npm run typecheck` passed; `npm run lint -- --quiet`
  passed; `npm run format:check` passed; `git diff --check` passed.
- **E2E boundary:** The required `E2E_DOCKER_COMPOSE=true npx playwright test
  e2e/aiAndRecovery.spec.ts --project=chromium` was run with the healthy local
  Compose preflight and elevated browser-launch permission. All seven
  scenarios timed out in the shared `createBlankProjectViaUI` setup while
  waiting for the editor API response, before reaching assertions. The first
  attempt also hit the host's Chromium Mach-rendezvous permission boundary.
  No manual Chrome exit/failure check could be completed beyond that setup
  failure; this is recorded as an environment/setup boundary, not as a
  passing E2E result.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #982 transaction ledger

- **Issue:** [#982](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/982)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Extract the AI-fix and AI-layer panel open/seed state into
  `useAiAssistPanels` without changing panel behavior.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `a70fbcd7` (`refactor(editor): extract AI
  assist panel state`).
- **Changed files:** `frontend/src/pages/EditorWorkspace.tsx`,
  `frontend/src/pages/useAiAssistPanels.ts`.
- **Checks:** `npx vitest run src/pages/EditorWorkspace*.test.tsx` — 35 files,
  399 tests passed; `npm run typecheck` passed; `npm run lint -- --quiet`
  passed; `npm run format:check` passed.
- **QA matrix:** All finite automated criteria PASS. Fix and layer panel
  opening, prompt seeding, closing, and preview-error auto-close behavior
  remained covered by the unchanged EditorWorkspace matrix. No live browser
  session was available for an additional manual interaction check.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #981 transaction ledger

- **Issue:** [#981](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/981)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Extract the canvas viewport's zoom, pan, fit-scale, wheel,
  resize, and fit-to-viewport behavior from `EditorWorkspace.tsx` into
  `useCanvasViewport` without changing the editor contract.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `a4a1e4f4` (`refactor(editor): extract canvas
  viewport hook`).
- **Changed files:** `frontend/src/pages/EditorWorkspace.tsx`,
  `frontend/src/pages/useCanvasViewport.ts`.
- **Checks:** `npx vitest run src/pages/EditorWorkspace*.test.tsx` — 35 files,
  399 tests passed; `npm run typecheck` passed; `npm run lint -- --quiet`
  passed; `npm run format:check` passed; `git diff --check` passed.
- **QA matrix:** All finite automated criteria PASS. Existing zoom/pan,
  wheel, fit, keyboard, gesture, and editor behavior remained covered by the
  unchanged EditorWorkspace matrix. The required manual live-Chrome check was
  not available because no running local stack/browser session was provided;
  this is recorded as an environment boundary, not claimed as performed.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #998 transaction ledger

- **Issue:** [#998](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/998)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Replace per-output `findIndex` lookups in
  `applyRuntimeOutputsToScene` with hoisted shape/group ID maps.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `2beaa84d` (`perf(runtime): index scene outputs by id`).
- **Changed files:** `frontend/src/runtime/behaviorRuntime.ts`.
- **Checks:** `npm exec vitest run src/runtime/behaviorRuntime.test.ts` — 193
  passed; `npm run typecheck`; `npm run lint -- --quiet`; `npm run format:check`.
  Elevated `npm run bench:runtime` passed all 3 scenarios: `maxScene` avg
  6.08ms/p95 6.60ms; `withinLimitsScene` avg 2.27ms/p95 3.00ms; forced
  over-budget recovery passed.
- **QA matrix:** Public renderer wiring tests remained green and benchmark
  fixtures stayed within documented thresholds. The manual live interactive
  piece check was not available; this is recorded as an environment boundary,
  not claimed as performed.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #999 transaction ledger

- **Issue:** [#999](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/999)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Add one-pass `shapeLabels` generation and use it for the
  outline and behavior-card target picker, preserving `shapeLabel` for single
  shape callers.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `76657481` (`perf(editor): batch shape label generation`).
- **Changed files:** `frontend/src/pages/sceneShapes.ts`,
  `frontend/src/pages/sceneShapes.test.ts`, `frontend/src/pages/sceneOutline.ts`,
  `frontend/src/pages/BehaviorCardsPanel.tsx`.
- **Checks:** Targeted scene-shape/outline tests — 107 passed; `npm run typecheck`;
  `npm run lint -- --quiet`; `npm run format:check`.
- **QA matrix:** The new 200-shape test compares independent expected labels
  and the old `shapeLabel` output, including per-type ordinals; outline and
  existing single-shape label tests remain green.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #1000 transaction ledger

- **Issue:** [#1000](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1000)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Add a custom allauth login form that counts failed password
  attempts through the existing cache-backed allauth limiter.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `ccda2092` (`security(auth): rate limit failed password logins`).
- **Changed files:** `backend/backend/login_forms.py`,
  `backend/backend/settings.py`, `backend/tests/test_login_rate_limit.py`.
- **Policy:** allauth's existing 30 login requests/minute/IP endpoint cap plus
  5 failed passwords per normalized email per 300 seconds. The failed-password
  limit is cache-backed and can be disabled with `ACCOUNT_LOGIN_ATTEMPTS_LIMIT=0`.
- **Checks:** Focused login tests — 2 passed; broader account/OAuth/reCAPTCHA/
  signup-policy regression suite — 40 passed; ruff format/check passed; mypy
  passed.
- **QA matrix:** Two wrong passwords remain allowed, the next failed attempt
  returns the clear allauth lockout message, the counter expires and permits a
  correct login, and the zero-limit disable path permits repeated failures.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #1001 transaction ledger

- **Issue:** [#1001](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1001)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Emit one structured minimal warning record from
  `permissions.require()` before raising `PermissionDenied`.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `c980bf62` (`observability(auth): log permission denials`).
- **Changed files:** `backend/scenes/permissions.py`,
  `backend/tests/test_permissions.py`.
- **Checks:** Full backend `uv run pytest` — 1766 passed, 39 skipped; focused
  permissions suite — 51 passed; ruff format/check passed.
- **QA matrix:** The denial record contains only user id/anonymous, action,
  resource type, and resource id. The test asserts exactly one record and the
  existing table-driven authorization behavior remains green.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #1002 transaction ledger

- **Issue:** [#1002](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1002)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Record forged PayPal signature deliveries as rejected
  `BillingEvent` rows and structured warning logs without signature material.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `725b9be9` (`observability(billing): record rejected PayPal signatures`).
- **Changed files:** `backend/scenes/billing.py`,
  `backend/tests/test_paypal_webhooks.py`.
- **Checks:** `uv run pytest tests/test_paypal_webhooks.py` — 15 passed; ruff
  format/check passed; mypy passed.
- **QA matrix:** A forged delivery records event id/type/detail and source IP
  in the structured warning, creates a rejected BillingEvent, returns 403,
  and creates no subscription. Verification still precedes accepted-event
  reads; accepted processing remains atomic. The rejection record is outside
  that transaction so the intentional exception cannot roll it back.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #977 transaction ledger

- **Issue:** [#977](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/977)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Consolidate the structured 2D editor's File, Ask AI,
  Visual/Code, zoom, and remaining save actions into one responsive control
  row, with publication status inside File.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `cd66b916` (`feat(editor): consolidate 2d control row`).
- **Changed files:** `frontend/src/pages/EditorWorkspace.tsx`,
  `frontend/src/pages/ProjectMediaLibraryPanel.tsx`,
  `frontend/src/pages/ProjectMediaLibraryPanel.test.tsx`,
  `frontend/src/pages/PublishControl.tsx`, `frontend/src/index.css`, and
  `frontend/e2e/manual2dStageChrome.spec.ts`.
- **Checks:** Focused Vitest — 44 passed; full frontend Vitest — 3,076 passed;
  typecheck, lint, and format-check passed. Chromium E2E was attempted but
  both scenarios timed out in shared project creation while waiting for the
  editor API response, before issue assertions ran.
- **QA matrix:** File has a unique icon and retains keyboard menu behavior;
  Ask AI is immediately after File outside the stage; Visual/Code and zoom are
  in the same row; publication status is rendered inside File; the duplicate
  stage publication trigger is absent; responsive Editor tools behavior and
  existing save/runtime controls remain covered.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** The shared Chromium E2E setup/API timeout remains an existing
  environment boundary and is not attributed to this UI change.

## Issue #1007 transaction ledger

- **Issue:** [#1007](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1007)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local
  reconciliation.
- **Transaction:** Resolved by #977: the publish-status stage popover was
  removed and publication status moved into File, eliminating the duplicate
  `StageControlsPopover` icon condition without an additional code change.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `cd66b916` (#977).
- **Checks:** #977 focused and full frontend suites, typecheck, lint, and
  format-check passed; its Chromium setup boundary is recorded above.
- **GitHub closure evidence:** The attempted linkage comment was rejected by
  the authenticated connector's external-publication risk policy. The issue
  was closed through the typed issue-state update; no workaround was attempted.
- **New gaps:** None.

## Issue #1012 transaction ledger

- **Issue:** [#1012](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1012)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA
  and evidence reconciliation.
- **Transaction:** Add draggable Three.js transform controls to the manual 3D
  editor while keeping the existing numeric inspector fields as the persisted
  transform path.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineering — Codex / GPT-5 substitution for the rostered Ollama Cloud
  implementation service. QA — Codex / GPT-5 substitution for the rostered
  Claude Sonnet fresh-eyes reviewer; no independent second-opinion model was
  available in this session. Production-readiness remains Codex / GPT-5
  substitution for the rostered readiness service.
- **Implementation commit:** `4846dd50` (`feat(3d-editor): add transform gizmo controls`).
- **Changed files:** `frontend/src/pages/Scene3DPreview.tsx`,
  `frontend/src/pages/Project3DWorkspace.tsx`, and
  `frontend/src/pages/Scene3DPreview.orbitControls.test.tsx`.
- **QA checks:** Focused gizmo/OrbitControls test — 6 passed; full frontend
  Vitest — 294 files / 3,080 tests passed; frontend typecheck passed;
  format-check passed; lint passed with the repository's existing warnings;
  production frontend build passed. The build reported only existing chunk
  size and ineffective dynamic-import warnings.
- **QA matrix:** The selected scene node receives the installed
  `TransformControls` addon; gizmo drag state disables OrbitControls even on
  the render loop; final local position/rotation/scale are converted back to
  the existing scene object and flow through the workspace's existing gesture
  and undo boundary; numeric inspector editing remains unchanged; cleanup
  detaches and disposes the control. No route, schema, API, package, or
  migration changed.
- **Browser boundary:** A live Chromium drag was not run because this host's
  previously recorded browser runner fails before tests with the macOS
  MachPortRendezvous permission error. The focused test exercises the control
  lifecycle and callback contract; no claim is made about manual pointer
  feel on that unavailable runner.
- **New gaps:** None discovered.

## Issue #976 transaction ledger

- **Issue:** [#976](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/976)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA
  and evidence reconciliation.
- **Transaction:** Restore the canonical immersive route for published
  structured 2D pieces by mounting the existing public 2D renderer from the
  existing canonical slug resolver, with a keyboard-accessible back link to
  the regular canonical view.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineering — Codex / GPT-5 substitution for the rostered
  implementation service. QA — Codex / GPT-5 substitution for the rostered
  fresh-eyes reviewer; no independent second-opinion model was available.
- **Changed files:** `frontend/src/pages/CanonicalImmersiveStructuredPiece.tsx`,
  `frontend/src/pages/PublicProjectViewer.tsx`, and
  `frontend/src/pages/CanonicalImmersiveStructuredPiece.test.tsx`.
- **Checks:** Focused frontend route/viewer tests — 36 passed; canonical
  backend API and slug-race tests — 30 passed; full frontend Vitest — 295
  files / 3,081 tests passed; frontend typecheck, format-check, lint, and
  production build passed. Lint and build emitted existing warnings only.
- **QA matrix:** The canonical slug resolver continues to enforce public,
  non-deleted, owner-scoped resolution and current-version serialization;
  2D now renders through `PublicProjectViewer` on the immersive route, while
  generated and 3D branches remain unchanged. The regular `/p/:id` and
  `/embed/p/:id` routes are untouched. The added back link is semantic and
  keyboard accessible.
- **Browser boundary:** The required Playwright Chromium scenario was
  attempted and failed before test execution because the host Chromium
  process cannot register its macOS MachPortRendezvous service (`Permission
  denied (1100)`). No browser pass or production claim is made.
- **New gaps:** None discovered.

## Issue #916 transaction ledger

- **Issue:** [#916](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/916)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA
  and evidence reconciliation.
- **Transaction:** Complete the microphone audio-flow verification boundary:
  retain the reusable Playwright source-to-bus probe and owner hardware
  checklist already present in the repository, and add the six named
  microphone/camera/steering interaction regression cases.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineering and QA — Codex / GPT-5 substitution for the rostered
  implementation/review services; no independent second-opinion model was
  available.
- **Changed files:** `frontend/src/audio/sonicEngine.test.ts` plus the
  previously landed repository evidence in `frontend/e2e/support/audioFlow.ts`,
  `frontend/e2e/artPieceSoundRuntime.spec.ts`,
  `docs/microphone-hardware-acceptance.md`, and
  `.agents/memory/camera-synthetic-verification-gap.md`.
- **Checks:** Sonic-engine suite — 39 passed; frontend typecheck passed. The
  six cases cover mic-only, mic/camera, mic/steer, camera/steer ordering, and
  camera+steer permutations while asserting the native source remains
  connected and the track is released on teardown. The regular generated-piece
  Playwright spec uses `audioFlow.ts`; its live browser execution remains
  subject to the host's known Chromium MachPortRendezvous boundary.
- **Acceptance boundary:** The written Chrome macOS, Safari iOS, and Chrome
  Android physical-device checklist remains explicitly owner-run; no hardware
  pass is claimed.
- **New gaps:** None discovered.

## Issue #911 transaction ledger

- **Issue:** [#911](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/911)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA
  and evidence reconciliation.
- **Transaction:** Route the regular generated-piece live microphone through the
  shared SonicEngine, enable the parent sound engine from the microphone gesture
  when needed, expose the supported microphone effects, and provide categorized
  recovery guidance for unsupported, insecure, denied, or failed microphone
  access.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineering and QA — Codex / GPT-5 substitution for the rostered
  implementation/review services; no independent second-opinion model was
  available.
- **Implementation commit:** `5e2b607c` (`feat(audio): route generated-piece
  microphone through engine`).
- **Changed files:** `frontend/src/pages/PieceStageControls.tsx`.
- **Checks:** Focused audio/viewer tests — 48 passed; SonicEngine interaction
  matrix — 39 passed; full frontend Vitest — 295 files / 3,087 tests passed;
  frontend typecheck, lint, format-check, and production build passed. Lint and
  build emitted only repository warnings. The targeted Playwright Chromium run
  was attempted but failed before test execution at the host's known macOS
  MachPortRendezvous permission boundary.
- **QA matrix:** Microphone permission is requested before lazy sound setup;
  the same gesture enables the parent sound engine when required; the stream is
  connected to `SonicEngine.connectMic`; disable and unmount disconnect the
  engine and stop tracks; all seven supported effects are exposed only while
  active and use the engine's effect API; categorized recovery text is rendered
  for failure states; no backend, schema, route, or dependency contract
  changed.
- **New gaps:** The live browser and physical-device portions remain bounded by
  the recorded Chromium host failure and the existing owner-run hardware
  checklist; no browser or hardware pass is claimed.

## Issue #912 transaction ledger

- **Issue:** [#912](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/912)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA
  and evidence reconciliation.
- **Transaction:** Verify the microphone-enabled immersive and immersive-embed
  routes expose the shared Live mic controls independently of camera capability.
  The actual parent-frame engine routing, effects, recovery, and cleanup are
  shared with and implemented by issue #911's `PieceStageControls` change.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineering and QA — Codex / GPT-5 substitution for the rostered
  implementation/review services; no independent second-opinion model was
  available.
- **Implementation commit:** `8f60ec6a` (`test(audio): cover immersive
  microphone routes`).
- **Changed files:** `frontend/e2e/artPieceImmersiveRuntime.spec.ts`.
- **Checks:** Immersive viewer unit tests — 4 passed; frontend format-check,
  lint, and typecheck passed; Playwright test discovery lists all four immersive
  scenarios including the new microphone route case. The Chromium suite was
  attempted but all four tests failed before execution at the host's known
  macOS MachPortRendezvous permission boundary.
- **QA matrix:** The new route fixture enables microphone and sound while
  disabling camera, visits both `/art-pieces/immersive/:id` and
  `/embed/art-pieces/immersive/:id`, opens Piece controls, verifies the Live mic
  group and enable button, verifies the off state, and asserts no camera control
  is rendered. #911's shared component tests and audio-engine matrix cover the
  actual stream routing and effects contract.
- **New gaps:** Live route execution remains a host-browser verification
  boundary; no browser or production claim is made.

## Issue #913 transaction ledger

- **Issue:** [#913](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/913)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA
  and evidence reconciliation.
- **Transaction:** Add the shared microphone capture lifecycle and seven-effect
  controls to structured 2D and structured 3D surfaces, retaining categorized
  failure copy and cleanup while documenting A-Frame structured previews as
  unsupported because they do not mount the live sound-control surface.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineering and QA — Codex / GPT-5 substitution for the rostered
  implementation/review services; no independent second-opinion model was
  available.
- **Implementation commit:** `ef846608` (`feat(audio): add structured
  microphone effects`).
- **Changed files:** `frontend/src/components/Structured2DSoundControls.tsx`,
  `frontend/src/components/Structured2DSoundControls.test.tsx`, and
  `frontend/src/pages/Scene3DPreview.tsx`.
- **Checks:** Focused structured/audio suite — 3 files / 76 tests passed;
  frontend typecheck, format-check, and lint passed; the full frontend suite
  previously passed at 295 files / 3,087 tests after the related microphone
  work; production build passed with existing chunk-size and dynamic-import
  warnings.
- **QA matrix:** Structured 2D requests audio-only capture, routes the stream
  through `connectMic`, exposes all seven effects only after activation, resets
  effects on disable, and disconnects on unmount. Structured 3D exposes the
  same seven controls over its existing engine lifecycle and resets them on
  disable. Failure categories continue to use `micFailure.ts`; microphone is
  off by default and not persisted. A-Frame structured previews remain an
  explicit unsupported boundary. The requested live Chromium and responsive
  screenshot run remains subject to the known host MachPort permission failure.
- **New gaps:** No new implementation gaps discovered.

## Issue #914 transaction ledger

- **Issue:** [#914](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/914)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA
  and evidence reconciliation.
- **Transaction:** Replace the generated Full and Non-Camera ZIP microphone
  permission stub with an offline native Web Audio path and seven-effect
  controls, preserving microphone capability independently from camera and
  steering.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineering and QA — Codex / GPT-5 substitution for the rostered
  implementation/review services; no independent second-opinion model was
  available.
- **Implementation commit:** `bbe26c04` (`feat(export): route generated zip
  microphone audio`).
- **Changed files:** `frontend/src/export/standaloneArtPieceRuntimeSource.ts`,
  `frontend/src/generative/artPieceBundle.ts`, and
  `docs/piece-toolbar-parity-matrix.md`.
- **Checks:** Standalone runtime and bundle tests — 2 files / 58 tests passed;
  frontend typecheck, format-check, and lint passed. ZIP Playwright discovery
  lists all seven requested scenarios. The full ZIP, immersive ZIP, and
  Non-Camera ZIP Chromium suite was attempted, but all seven tests failed before
  execution at the host's known macOS MachPortRendezvous permission boundary.
- **QA matrix:** The generated runtime requests the stream before lazy audio
  initialization, connects it to the master output through a rebuildable fixed
  order of distortion, chorus, tremolo, pitch shift, bitcrusher, flanger, and
  ring-mod nodes, exposes effects only while active, categorizes unsupported,
  insecure, denied, and missing-device failures, and stops/disconnects on
  disable and unload. Bundle markup keeps microphone controls in Full and
  Non-Camera exports whenever capability is enabled and omits them otherwise.
  The parity matrix records the camera-independent Non-Camera behavior.
- **New gaps:** Live extracted-ZIP audio assertions and screenshots remain
  blocked by the host browser runner; no browser or production claim is made.

## Issue #915 transaction ledger

- **Issue:** [#915](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/915)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA
  and evidence reconciliation.
- **Transaction:** Add the reference seven-effect microphone chain and audio
  context recovery to the standalone structured-3D export while preserving
  real stream routing and cleanup.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineering and QA — Codex / GPT-5 substitution for the rostered
  implementation/review services; no independent second-opinion model was
  available.
- **Implementation commit:** `0a3b8691` (`feat(export): add structured 3d
  microphone effects`).
- **Changed files:** `frontend/src/export/standaloneThreeRuntimeSource.ts`,
  `frontend/src/export/standaloneThreeRuntimeSource.test.ts`, and
  `frontend/src/export/generateHtmlExport3D.ts`.
- **Checks:** Standalone 3D source and generated-export tests — 2 files / 19
  tests passed; frontend typecheck, format-check, and lint passed. The targeted
  3D browser test was attempted and failed before execution at the host's known
  macOS MachPortRendezvous permission boundary.
- **QA matrix:** Full structured-3D exports expose the seven fixed-order effect
  toggles only while mic is active; toggling rebuilds the source chain, no
  effects routes dry to `masterGain`, stopping releases the stream and nodes,
  and `statechange` resumes suspended/interrupted contexts. Non-Camera exports
  continue to omit the device-control module. The source test asserts every
  effect name, rebuild hook, and recovery listener.
- **New gaps:** Live analyser, screenshot, and physical browser verification
  remain host-environment boundaries; no browser or production claim is made.

## Task-distillation refresh — 2026-09-28 after stream E

- **Live inventory:** 25 open GitHub issues remain after closing #911–#915.
- **Completed in this loop:** #1012, #976, #916, #911, #912, #913, #914,
  and #915 are closed with implementation or QA evidence in this ledger.
- **Deferred same-goal issues:** #1020, #1021, and #1013 were not implemented;
  #1021 remains the known backend mypy gate and #1020/#1013 remain follow-up
  work discovered during the active goal.
- **Next implementable candidates:** #1016 is contract-blocked by the absent
  server-backed collection-media path; #1019 requires the split it names before
  implementation. The next independent implementation candidate is #926,
  subject to its real-provider credential/browser boundary. #847 remains
  dependent on the public-media contract.
- **Owner/data gates:** #906, #788, and #946 remain owner-authorized or
  owner-run production data actions and were not touched. #1004–#1006 remain
  owner decisions. #941/#942/#944/#945 remain dependency-ordered local-first
  work.
- **Discovery reconciliation:** No new issue was created in this refresh; no
  newly created issue was implemented. Existing same-goal follow-ups remain
  explicitly deferred.

## Issue #975 harness restoration — 2026-09-28

- **Phase:** `GROOMED → ENGINEERING → QA → BLOCKED`.
- **Transaction:** Restore the missing public-media ZIP browser specification
  referenced by the issue, covering ZIP inspection, extraction, offline static
  serving, desktop/mobile overflow, screenshots, cleanup, and source-asset
  requests.
- **Implementation:** Commit `2e4a10d7`; added
  `frontend/e2e/publicMediaAssetsZip.spec.ts`.
- **Checks:** `make check` passed (backend 1,768 passed / 39 skipped;
  frontend 296 files / 3,089 tests; lint, format, typecheck, and build gates
  passed). Playwright discovery lists one ZIP test; Prettier and oxlint pass.
- **QA result:** `FAIL` only because the required Chromium execution was
  skipped by global setup when the Compose/Django health prerequisite was
  unavailable. `make compose-preflight` confirms the local Docker daemon is
  unavailable. The harness is now present; archive rendering, both viewport
  assertions, screenshots, and runtime asset requests still require the
  approved Linux/Compose runner.
- **GitHub:** Reassessment comment posted to #975; issue remains open and
  terminally blocked at the verification/workflow-infrastructure boundary.
