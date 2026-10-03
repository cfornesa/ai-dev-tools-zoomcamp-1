# Batch 14 — account and shell E2E Wave 2A

## Session scope and constraints

- Batch: 2026-10-03 / `cfornesa/ai-dev-tools-zoomcamp-1`, Wave 2A.
- Ordered issues (all open, milestone 14): #1160, #1161, #1162, #1172, #1184.
- #1179 is already implemented in `303288fb`; it remains open and is a regression reference only.
- One issue-scoped commit per issue; every commit removes only that issue's owned entries from `frontend/e2e/known-failures.json`.
- Do not push, dispatch, merge, or close issues. Preserve `.local/tasks/backlog-session-2026-10-02-batch19.md` and `docs/tasks.md` exactly. Do not edit `DECISIONS.md`; its 2026-10-03 CI tier decision already governs this work.
- Implementation provenance: Stage 2a is rostered to Opencode Go / Kimi K2.5. This session's implementation is Codex / GPT-6 (effort not surfaced), a substitution; record that on each issue row. Stage 4 is rostered to Claude / Sonnet 5 / Medium and has not run in this ledger yet.

## All-open-issue discovery

Authenticated GitHub issue search on 2026-10-03 returned 37 open issues. Every issue body was checked for the target specs, shared selectors, fixtures, responsive shell regressions and `known-failures.json`; repository path/selector searches and the run #1126 case map were cross-checked. The complete open inventory at analysis time was:

| Issue | Current title | Disposition in this batch |
| --- | --- | --- |
| #1096 | CI: reconcile full 16-shard browser acceptance failures | Out of batch; impacted through its child-case map and baseline. |
| #1160 | E2E: refresh account settings action count for retained pieces | In batch, first. |
| #1161 | E2E: align account settings reorder expectations with current sections | In batch, second; shares account-settings page/fixture with #1160. |
| #1162 | E2E: allow reduced-motion transition rounding in account styles | In batch, third; refined contract is the reduced-motion `:active` timing race. |
| #1163 | E2E injection audit: identify the extra `<script>` element in exported artifacts (5 tests) | Out of batch; security check, separate per handoff. |
| #1164 | E2E: PATCH `/api/account/profile/` fails in profile and template-parity flows (6 tests) | Out of batch; profile API/data contract. |
| #1165 | E2E: profile photo removal leaves the Remove photo control (2 tests) | Out of batch; depends on #1164. |
| #1166 | E2E: 'Piece controls' and the sr-only 'Open piece controls menu' shim collide in toolbar specs (18 tests) | Out of batch; toolbar selector migration. |
| #1167 | Owner decision: remove the sr-only no-op 'Open piece controls menu' button from inline toolbars? | Out of batch; decision/dependency for #1187. |
| #1168 | E2E: migrate remaining 3D lifecycle specs from Gallery-click creation to the server-backed helper (11 tests) | Out of batch; fixture migration. |
| #1169 | E2E: migrate public 3D camera/toolbar specs from Gallery-click creation to the server-backed helper (3 tests) | Out of batch; fixture migration. |
| #1170 | E2E: retarget AI panel specs from legacy AI routes and removed creation menu items to the unified editor (14 tests) | Out of batch; editor route migration. |
| #1171 | E2E: generated-art studio editor specs never reach their first control (12 tests) — diagnose first cause | Out of batch; diagnosis first. |
| #1172 | E2E: shell chrome specs expect the removed header color-mode and reduced-motion controls (10 tests) | In batch, fourth. |
| #1173 | E2E: public piece pages no longer show the expected 'By e2e_owner' byline (4 tests) | Out of batch; depends on #1164. |
| #1174 | E2E: the publish confirmation dialog cannot be completed in two publication specs (4 tests) | Out of batch; depends on #1164. |
| #1175 | Generated-piece stage specs expect the pre-phone-layout geometry (≤700px) (4 tests) | Out of batch; dependency-blocked on #1188/#1189. |
| #1176 | HTML export: labelled action buttons are 40px wide where the spec requires >= 44px (1 test) | Out of batch; separate export contract. |
| #1177 | Content panel shadow spec: offset panel height drifts by 306px at 375x812 dark (new in run #1126) | Out of batch; impacted by the required global shell regression run. |
| #1178 | 3D drawing plane render: pixel-coverage threshold fails (230 vs > 271) (1 test) | Out of batch; separate rendering contract. |
| #1179 | E2E: auth policy spec expects pre-#1127 login copy and a body background that moved (2 tests) | Out of batch, already implemented; its three named account specs are re-run unchanged. |
| #1180 | Authoring ownership gate: non-owner lands on the owner editor URL instead of being redirected (2 tests) | Out of batch; authorization check. |
| #1181 | Local gallery cards spec (#1087): the card heading is not found after creation (1 test) | Out of batch; fixture/setup contract. |
| #1182 | Public gallery engine filter: the select does not retain c2js-interactive (2 tests) | Out of batch; public gallery behavior. |
| #1183 | Sound telemetry spec: getByLabel(Key) matches two controls (1 test) | Out of batch; sound UI locator. |
| #1184 | Site content and theme admin specs: stale text and an ambiguous accent label (4 tests) | In batch, fifth; shares admin/theme surfaces with #1172's evidence matrices. |
| #1185 | E2E: three long-running specs end in protocol or connection errors after their timeouts (3 tests) | Out of batch; diagnosis/runner boundary. |
| #1186 | aiAndRecovery: explicit Save scenario receives a non-ZIP download (1 test, new in run #1126) | Out of batch; download contract. |
| #1187 | Remove the inert 'Open piece controls menu' shim from inline toolbars (after consumers migrate) | Out of batch; responsive-shell spec is required regression coverage, no shim edits here. |
| #1188 | Public regular generated-piece page on phones: declared ratio, tall stage only for interactive drawing, toolbar below | Out of batch; product layout. |
| #1189 | Embed route on phones follows the same stage and toolbar rule (after #1188) | Out of batch; depends on #1188. |
| #1190 | CI: known-failure ratchet so the 16-shard matrix fails only on new problems | Out of batch; baseline file shared and each child removal is part of its criteria. |
| #1191 | E2E: fail fast on missing controls (actionTimeout and navigationTimeout) instead of 30-186s waits | Out of batch; config/timeouts are unchanged. |
| #1192 | Owner action: protect main with the PR gate checks (not the 16-shard matrix) | Out of batch; owner-only. |
| #1193 | E2E class F audit: which browser specs could be Vitest/component tests (analysis) | Out of batch; no audit changes. |
| #1194 | E2E: document the shared helpers in frontend/e2e/support/README.md | Out of batch; helper docs are not changed. |
| #1195 | E2E: ratcheted check that new specs use shared helpers instead of re-deriving locators | Out of batch; helper scanner/allowlist is not changed. |

## Batch impact analysis

| Change / shared surface | Kind | In-batch issues | Open issues that reference it | Collision / resolution | Required re-verification |
| --- | --- | --- | --- | --- | --- |
| `frontend/e2e/accountSettings.spec.ts` — action list and retained unpublished action | Test contract | #1160 | #1096 maps four cases; #1160 owns the exact contract | Keep both empty/populated data fixtures, desktop/mobile viewports, navigation and grouping assertions. Assert the ordered names of all 12 current actions (including Retained unpublished pieces), not only a count. #1161 uses the same account-settings entry point and fixture account but edits separate specs. | Focus #1160 spec; run the account-settings reorder/layout specs in the batch union; rerun responsive/auth shell regression specs. |
| `frontend/e2e/accountSettingsReorder.spec.ts`, `accountSettingsLayout.spec.ts` — handles and persisted order | Test contract | #1161 | #1096 maps three cases; #1160 shares account settings fixture/page | Derive initial section order and handle count from rendered DOM; derive keyboard moves from observed Automatic retry position; retain keyboard-only operation and post-reload persistence. Do not use forced pointer clicks. #1160 changes only `accountSettings.spec.ts`. | Both focused specs; batch union and account shell regressions. |
| `frontend/e2e/accountComponentStyles.spec.ts` — reduced-motion and `:active` timing | Test contract | #1162 | #1096 maps the failure; #1179 explicitly says this spec stays unchanged | Refined acceptance supersedes issue's initial 0s diagnosis: wait for `html[data-reduced-motion="true"]`, accept duration ≤0.01ms, poll the active offset toward the expected 1px while retaining `matches(':active')`; preserve full-motion and toggle checks. No product CSS changes. | Focused component-style spec and unchanged `accountShell`, `accountThemeParity`; run whole required union. |
| `frontend/e2e/celestialStyle.spec.ts`, `cosmicBackdropStars.spec.ts`, `designSchemeMatrix.spec.ts`, `headerChrome.spec.ts`, `profileStyleInheritance.spec.ts`, `themeToggle.spec.ts`, `vividDesignMatrix.spec.ts` — theme/motion controls and skip-link layering | Test contract | #1172 | #1096 maps ten cases; #1177 requires shared shell regression checks; #1179 shares `accountShell`, `accountThemeParity`, `accountComponentStyles`; #1187 requires `responsiveShell`; historical #1158 (closed) established static mobile toggle placement | Keep each route/style/mode/viewport, keyboard, persistence and layering assertion. Map removed combobox/radio/status locators to current fixed `Display settings` theme/motion toggles. Do not change `Layout`/CSS. #1172's refined filing specifically says visible status copy with no current equivalent must be quoted and escalated under the stop rule; classify that before editing the assertion. | All seven focused specs plus `responsiveShell`, `headerMobile`, `publicShell`, `accountShell`, `accountThemeParity`, and #1177's `contentPanelShadow` search/review. |
| `frontend/e2e/homeHero.spec.ts`, `themeCustomization.spec.ts`, `adminThemeGeneration.spec.ts` — current content and scoped accent label | Test contract | #1184 | #1096 maps four cases; #1172 shares admin theme/style evidence behavior and current copy conventions; #1195 scans spec patterns but these changes must not introduce any new listed helper offender | Capture live rendered copy/accessibility labels per issue criterion; fix only stale copy or ambiguous locator after confirming source/current DOM, preserving focus, responsive overflow, theme scope, acceptance and restoration assertions. Do not change product text or theme API. | Three focused specs, then all target/regression union; inspect retained screenshots where existing tests create them. |
| `frontend/e2e/known-failures.json` | Baseline removal | #1160, #1161, #1162, #1172, #1184 | #1096 tracker; #1190 ratchet; every mapped child #1160–#1186 is required to remove its own entries | Remove only entries whose numeric owner issue equals the issue being committed, and only after verifying the matching test contract; all remaining entries and schema stay byte/semantically unchanged. #1190's comparator must still see remaining issue-owned entries. | For each issue, compare removed keys against pre-edit `issue` values and committed spec titles; validate JSON. After all commits, count/search removed vs remaining entries and run `make check`. |
| `requireE2EFixtures`, `loginViaUI`, API stubs, account-settings fixture data and `data-theme` / `data-reduced-motion` selectors | Shared helpers/fixtures/selectors | No helper or fixture edits | #1160/#1161/#1162; #1172; #1184; #1179 explicitly preserves shared account shell/theme specs | Reuse current fixture contracts; no helper, product API, auth or schema changes. `#1155` fixture guard and teardown remain untouched. | Run from the explicit disposable PostgreSQL stack; ensure teardown runs; rerun `accountShell` and `accountThemeParity`. |
| Required regression specs: `responsiveShell.spec.ts`, `headerMobile.spec.ts`, `publicShell.spec.ts`, `accountShell.spec.ts`, `accountThemeParity.spec.ts` | Re-verification only | Whole batch | #1177 names `responsiveShell`, `headerMobile`, `publicShell`, `accountShell`; #1179 names `accountShell`, `accountThemeParity`; #1187 depends on responsive-shell coverage; closed #1158's regression contract includes these routes | Not edited. These are cross-issue regression rows, not children of the current batch. | Run all five in the same Chromium invocation as the union of focused specs; review run counts and any changed route/viewport. |
| `frontend/e2e/helper-offenders.json` and #1195's proposed selector ratchet | Static helper pattern inventory | None | #1195 only; targeted specs may contain legacy text/locators | Not present in the issue edit scope; do not create/edit it. Verify this batch does not add or alter counts of the listed patterns (`/ai-projects`, Gallery creation, shim locator, exact scene-Save locator, `summary`, legacy create helpers). | Compare `rg` results for listed patterns before/after; record unchanged or classify any new hit before batch completion. |
| `frontend/playwright.config.ts`, `.github/workflows/ci.yml` | Test runner configuration | None | #1191 / #1190 respectively | Unchanged; no timeout, worker, trigger, fixture-env or workflow changes. | `make check` exercises the relevant static/workflow checks; inspect diff scope. |

### Baseline entry ownership at batch start

| Issue | Entry count | Owned keys | Planned commit |
| --- | ---: | --- | --- |
| #1160 | 4 | `accountSettings.spec.ts` empty/populated at 1280×900 and 375×812 | #1160 commit |
| #1161 | 3 | `accountSettingsLayout.spec.ts` ×2 and `accountSettingsReorder.spec.ts` ×1 | #1161 commit |
| #1162 | 1 | `accountComponentStyles.spec.ts` allauth style test | #1162 commit |
| #1172 | 10 | seven mapped shell/theme specs | #1172 commit |
| #1184 | 4 | `adminThemeGeneration` ×1, `homeHero` ×2, `themeCustomization` ×1 | #1184 commit |

## Batch manifest and implementation plan

| Order | Issue / milestone | Entry point / fixtures | Finite criteria and exact focused command | Dependencies / evidence boundary | Status / commit / provenance |
| ---: | --- | --- | --- | --- | --- |
| 1 | #1160 / milestone 14 | Authenticated `/account/settings`, deterministic `e2e_owner`, empty and populated fixtures; 1280×900 and 375×812 | Ordered list of exactly 12 current named actions in both fixture states; retain grouping, navigation, and overflow checks. `cd frontend && E2E_BASE_URL=http://localhost:5000 npm run test:e2e -- e2e/accountSettings.spec.ts --project=chromium` | Shares page/fixtures with #1161; Linux Chromium/PostgreSQL evidence required by issue. | PASS, 4/4 local Chromium tests against disposable PostgreSQL; commit pending; Stage 2a roster Opencode Go / actual Codex GPT-6 (effort unavailable), substituted: yes; Stage 4 pending Claude Sonnet 5 / Medium. |
| 2 | #1161 / milestone 14 | Authenticated `/account/settings`, `e2e_owner`; current sections and browser storage | Read initial eight section handles/order from the DOM, derive keyboard movement from actual start position, retain Escape cancel and reload persistence. `cd frontend && E2E_BASE_URL=http://localhost:5000 npm run test:e2e -- e2e/accountSettingsReorder.spec.ts e2e/accountSettingsLayout.spec.ts --project=chromium` | Shares fixture/page with #1160; Linux Chromium/PostgreSQL evidence required. | PASS, 4/4 local Chromium tests; covers keyboard lift/move/drop/Escape, mobile pointer placeholder, dynamic ordering/persistence, malformed storage and current motion toggle. Commit pending; Stage 2a roster Opencode Go / actual Codex GPT-6 (effort unavailable), substituted: yes; Stage 4 pending Claude Sonnet 5 / Medium. |
| 3 | #1162 / milestone 14 | Allauth account page, `prefers-reduced-motion: reduce`, active provider control | Wait for `html[data-reduced-motion="true"]`; transition duration ≤0.01ms; poll active offset for nonzero movement while retaining `matches(':active')`; preserve other checks. `cd frontend && E2E_BASE_URL=http://localhost:5000 npm run test:e2e -- e2e/accountComponentStyles.spec.ts --project=chromium` | User confirmed any nonzero movement is acceptable. No product CSS edit. Linux Chromium/PostgreSQL required. | PASS, 1/1 local Chromium test; reduced-motion readiness, ≤0.01ms duration and active transform polling verified; commit pending; Stage 2a roster Opencode Go / actual Codex GPT-6 (effort unavailable), substituted: yes; Stage 4 pending Claude Sonnet 5 / Medium. |
| 4 | #1172 / milestone 14 | Current shell, theme toggle and reduced-motion toggle on named routes/viewports | Preserve 10 scenarios/coverage; replace only stale control locators with current shell controls, keep theme persistence, motion state, skip-link layering and route/mode/viewport assertions. `cd frontend && E2E_BASE_URL=http://localhost:5000 npm run test:e2e -- e2e/headerChrome.spec.ts e2e/vividDesignMatrix.spec.ts e2e/themeToggle.spec.ts e2e/celestialStyle.spec.ts e2e/designSchemeMatrix.spec.ts e2e/profileStyleInheritance.spec.ts e2e/cosmicBackdropStars.spec.ts --project=chromium` | Stop-rule copy assertion requires owner clarification if it has no equivalent; #1158 closed precedent; shell regression union required. Linux Chromium/PostgreSQL required. | GROOMED; commit pending; Stage 2a roster Opencode Go / actual Codex GPT-6 (effort unavailable), substituted: yes; Stage 4 pending Claude Sonnet 5 / Medium. |
| 5 | #1184 / milestone 14 | Anonymous home fixture; authenticated admin theme surfaces with disposable `e2e_admin` | Per-case first-cause capture and classify copy drift, locator ambiguity or product; use current copy/scoped locator without changing assertions' intent. `cd frontend && E2E_BASE_URL=http://localhost:5000 npm run test:e2e -- e2e/adminThemeGeneration.spec.ts e2e/homeHero.spec.ts e2e/themeCustomization.spec.ts --project=chromium` | Stop if current product behavior is defective or an assertion lacks a current equivalent; no product copy/API change. Linux Chromium/PostgreSQL required. | PASS, 4/4 local Chromium cases: Home now uses `/home`; accent locator scoped to `Site theme tokens`; accepted snapshot assertion targets visible `.admin-theme-snapshot`. Commit pending; Stage 2a roster Opencode Go / actual Codex GPT-6 (effort unavailable), substituted: yes; Stage 4 pending Claude Sonnet 5 / Medium. |

## Verification and reconciliation

- Local stack/environment: pending check. Use only the existing isolated non-production PostgreSQL E2E database and an explicit environment file; never use a shared or published database. `AI_PROVIDER=fake` is needed only for AI paths (none of the focused cases call AI generation except #1184's admin theme generation, whose fake-provider status must be verified).
- Batch browser gate: one Chromium invocation for all 14 issue-owned specs plus `responsiveShell.spec.ts`, `headerMobile.spec.ts`, `publicShell.spec.ts`, `accountShell.spec.ts`, and `accountThemeParity.spec.ts`; exact union command to be recorded after execution.
- Full gate: `make check` once after all five commits.
- Batch-level result: pending.
- Matrix rows and open-issue re-verification: pending; update each row with exact result after focused union and `make check`.
- Newly discovered issues: none at impact-analysis time. Re-run the discovery gate if implementation/verification finds an out-of-scope actionable product or harness defect; do not implement it in this batch.
- Docs/tasks and memory: unchanged; no new durable constraint identified yet.
- GitHub QA comments: pending for #1160, #1161, #1162, #1172, #1184. Do not close issues.
- Baseline entries removed: 0 so far; target removal count is 22 (4 + 3 + 1 + 10 + 4), subject to actual test outcome.
- No push, workflow dispatch, merge, or issue closure.
