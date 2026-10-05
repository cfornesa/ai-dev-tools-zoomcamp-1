# Backlog session 2026-09-30

Execution profile: Codex / GPT-5 / default effort. Stage 2 external dispatch was unavailable; any direct implementation is recorded as a substitution. Stage 3 is not run unless an independent-family reviewer becomes available. Stage 4 and the readiness gate are Claude substitutions when performed in this session.

## Distillation manifest

| Issue | Order / dependency | Routing | Status | Next action |
| --- | --- | --- | --- | --- |
| #1076 | 1; none | 2b complex/security boundary | GROOMED | implement, focused checks, QA, reconcile |
| #1077 | 2; none | 2a mechanical/backend | GROOMED | process after #1076 |
| #1081 | 3; none | docs | GROOMED | process after code prerequisites |
| #1078 | 4; #1076/#1077 | 2b complex | CLOSED | completed and QA-reconciled |
| #1079 | 5; #1078 | 2b complex | CLOSED | completed and QA-reconciled |
| #1080 | 6; #1077–#1079 | 2a mechanical/backend | CLOSED | completed and QA-reconciled |
| #1082 | 7; none | 2a frontend | CLOSED | completed and QA-reconciled |
| #1083 | 8; none | 2a frontend | CLOSED | completed and QA-reconciled |
| #1084 | 9; none | 2a frontend | CLOSED | completed and QA-reconciled |
| #1085 | 10; none | 2b storage/data layer | CLOSED | completed and QA-reconciled |
| #1086 | 11; #1085 | 2b storage/data layer | CLOSED | completed and QA-reconciled |
| #1087 | 12; #1085/#1086 | 2a frontend | CLOSED | completed and QA-reconciled |
| #1088 | 13; #1085 | 2a frontend | CLOSED | completed and QA-reconciled |
| #1089 | discovery follow-up to #1087 | 2a frontend | CLOSED | completed and QA-reconciled |
| #788 | owner-scoped production action | owner-run | OPEN / owner-run | use named production workflow and Chrome evidence |
| #926 | #924/#925/#920 | live-provider Chrome | CLOSED | bounded failure recorded; #1091 tracks the implementation defect |
| #1091 | #926 | 2b complex | OPEN / live-provider follow-up | fresh bounded authorization required for post-fix Mistral verification |
| #1040 | tracking parent | children #1041–#1046 | CLOSED | children reconciled and parent closed |
| #1042 | live-provider / #1076–#1080 | owner-run QA | CLOSED | completed and QA-reconciled |
| #1046 | live-provider / #1076–#1080 | owner-run QA | CLOSED | completed and QA-reconciled |

## Duplicate and blocker report

- No duplicate was found among the 18 open GitHub issues returned for `cfornesa/ai-dev-tools-zoomcamp-1`.
- #1040 is a tracking/reconciliation parent, not an implementation unit.
- #788 is a narrowly authorized production-data workflow and must not be replaced by local evidence.
- #926, #1042, and #1046 require bounded live-provider/browser evidence; they remain in the ordered manifest and are not silently omitted.
- No new follow-up issue was discovered during distillation; newly discovered actionable work will be filed before leaving the current issue.

- Discovery update: active Chrome verification of #1087 found a generated/3D local-card route mismatch; GitHub duplicate search found no owner, so #1089 was filed as a proposed follow-up before continuing.

## Current transaction ledger

### #1076 — GROOMED → ENGINEERING

- Issue: https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1076
- Scope: `backend/ai_provider/prompts.py`, `backend/ai_provider/art_piece_provider.py`, focused provider tests; security evidence references existing sandbox/CSP tests.
- Stage 1: Codex / GPT-5 / default effort / substituted: no.
- Stage 2b roster: Ollama Cloud; actual: Codex / GPT-5 / default effort / substituted: yes (dispatch unavailable).
- Stage 3: not run (independent Mistral Vibe unavailable).
- Stage 4 and stage 5 are pending.
- Commit: `e7271b93`.
- Focused checks: provider/API tests 66 passed; full `tests -k art_piece` 181 passed; Ruff and mypy passed; frontend sandbox/CSP tests 36 passed; frontend typecheck passed; lint passed with existing warnings.
- QA: `## QA: PASS`, GitHub comment `5904939035`, provenance and criterion matrix recorded; stage 3 not run.
- Evidence boundary: local automated checks plus active Chrome inspection of the authenticated GitHub issue inventory; no deployed/live-provider criterion.
- Stage 5 readiness: pending batch-level production-readiness assessment; GPT-5 substitution will be flagged if the rostered Claude tier is unavailable.
- Final status: CLOSED / completed on GitHub. Shifted work: extraction, reason-coded validation, repair loop, and live showcase evidence remain in #1077–#1081 and #1042/#1046.

## Reconciliation checkpoint

The current transaction is terminal: #1076 is CLOSED before #1077 engineering begins. No new actionable follow-up was discovered; the existing dependency chain covers all shifted work.

### #1077 — CLOSED

- Commit: `5ea001b1`.
- Focused checks: 9 extraction tests passed; full art-piece regression 191 passed; Ruff and mypy passed.
- QA: `## QA: PASS`, GitHub comment `5904969409`; untrusted-diff intake accepted; stage 3 not run.
- Evidence boundary: local automated backend checks plus active Chrome inspection of the authenticated GitHub issue inventory.
- Stage 5 readiness: pending batch-level production-readiness assessment.
- Final status: CLOSED / completed on GitHub. No shifted work beyond #1078–#1080's declared validation/repair/corpus boundaries.

The current transaction is terminal: #1077 is CLOSED before #1078 engineering begins.

### #1081 — CLOSED

- Commit: `c75352eb` (docs/process.md only; issue annotations are GitHub comments).
- Focused checks: `git diff --check`; docs-only diff stat verified; active Chrome rendered inspection confirmed the #1040 annotation.
- QA: `## QA: PASS`, GitHub comment `5905007941`; stage 3 not run because this was docs-only.
- Evidence boundary: repository documentation plus rendered GitHub issue comments; live-provider generation remains child scope.
- Final status: CLOSED / completed on GitHub. Closed-child bodies were not rewritten; additive annotations preserve history and satisfy the current prompt contract.

The current transaction is terminal: #1081 is CLOSED before #1078 engineering begins.

### #1078 — CLOSED

- Commit: `a10bc0a6`.
- Implementation: structural tuple validators with reason codes, safe API detail propagation, selectable `ART_PIECE_RUBRIC=structural|legacy`, and SVG/A-Frame structural showcase checks.
- Focused checks: `tests -k art_piece` 204 passed; Ruff and mypy passed; `git diff --check` passed.
- QA: `## QA: PASS`, GitHub comment `5905095164`; stage 3 not run; stage 4 was a Codex substitution because the delegated QA service/tool is unavailable.
- Evidence boundary: local automated backend checks plus active Chrome/GitHub issue inspection; live-provider generation remains the declared owner/live scope.
- Stage 5 readiness: pending batch-level production-readiness assessment.
- Final status: CLOSED / completed on GitHub.

The current transaction is terminal: #1078 is CLOSED before #1079 engineering begins.

### #1079 — CLOSED

- Commit: `f5ae777b`.
- Implementation: bounded validation repair loop, output budgets for all vendors, optional final-repair model escalation, configurable overall deadline, non-sensitive attempt evidence, and documented environment variables.
- Focused checks: `tests -k art_piece` 208 passed; Ruff and mypy passed; `git show --check HEAD` passed.
- QA: `## QA: PASS`, GitHub comment `5905183919`; stage 3 not run; stage 4 was a Codex substitution because the delegated QA service/tool is unavailable.
- Evidence boundary: local automated backend checks plus active Chrome/GitHub issue inspection; live-provider generation remains the declared owner/live scope.
- Stage 5 readiness: pending batch-level production-readiness assessment.
- Final status: CLOSED / completed on GitHub.

The current transaction is terminal: #1079 is CLOSED before #1080 engineering begins.

### #1080 — CLOSED

- Commit: `130405d2`.
- Implementation: eight offline raw-output corpus fixtures plus extract/validate parameterized replay and scripted repair-loop replay coverage.
- Focused checks: `tests -k art_piece_corpus` 9 passed; Ruff and mypy passed; `git show --check HEAD` passed.
- QA: `## QA: PASS`, GitHub comment `5905216360`; stage 3 not run; stage 4 was a Codex substitution because the delegated QA service/tool is unavailable.
- Evidence boundary: local offline corpus tests plus active Chrome/GitHub issue inspection; no network calls or live-provider quota.
- Stage 5 readiness: pending batch-level production-readiness assessment.
- Final status: CLOSED / completed on GitHub.

The current transaction is terminal: #1080 is CLOSED before #1082 engineering begins.

### #1082 — CLOSED

- Commit: `9a8f7731`.
- Implementation: scoped full-width ArtPieceStudio container/controls, eight-row 10rem+ resizable prompt, and two-viewport Playwright coverage on the current `/art-pieces` route.
- Focused checks: ArtPieceStudio tests 14 passed; typecheck and Prettier passed; lint passed with existing warnings; Playwright list found both viewport scenarios.
- Active Chrome evidence: rebuilt local Compose frontend measured desktop controls/form at 960px and mobile controls/form at 310px, with textarea heights 201px/180px and no horizontal overflow; screenshots captured.
- QA: `## QA: PASS`, GitHub comment `5905356446`; stage 3 not run; stage 4 was a Codex substitution because the delegated QA service/tool is unavailable.
- Evidence boundary: active Chrome rendered verification is authoritative for this local UI; Playwright host launch/login setup remained unavailable and is recorded in the QA comment.
- Stage 5 readiness: pending batch-level production-readiness assessment.
- Final status: CLOSED / completed on GitHub.

The current transaction is terminal: #1082 is CLOSED before #1083 engineering begins.

### #1083 — CLOSED

- Commit: `64b03f53`.
- Implementation: mobile-only normal-flow stage toolbar/drawing controls, 416px responsive iframe height at 375px, unchanged desktop overlay/fullscreen behavior, and mobile geometry E2E coverage with screenshot artifact capture.
- Focused checks: PublicArtPieceViewer tests 5 passed; typecheck and Prettier passed; lint passed with existing warnings; Playwright list found the new scenario.
- Active Chrome evidence: 375px public C2 interactive fixture measured iframe 416px, controls below without intersection, and no horizontal overflow; 1280px retained absolute overlay toolbar; screenshot captured.
- QA: `## QA: PASS`, GitHub comment `5905427046`; stage 3 not run; stage 4 was a Codex substitution because the delegated QA service/tool is unavailable.
- Evidence boundary: active Chrome rendered verification is authoritative for this local UI; full Playwright execution remains subject to the host E2E login/browser setup.
- Stage 5 readiness: pending batch-level production-readiness assessment.
- Final status: CLOSED / completed on GitHub.

The current transaction is terminal: #1083 is CLOSED before #1084 engineering begins.

### #1084 — CLOSED

- Commit: `705a555a`.
- Implementation: scoped responsive wrapping for public generated-piece version context values, rows, summaries, details, and timestamps using `min-width: 0`, `overflow-wrap: anywhere`, and bounded definition margins; added a 375px browser regression fixture with a 2,400-character unbroken prompt and screenshot capture.
- Focused checks: PublicArtPieceViewer tests 5 passed; typecheck and Prettier passed; lint passed with existing warnings; Playwright list found the new scenario; committed diff passed `git show --check HEAD`.
- Active Chrome evidence: 375px measured `scrollWidth=360` and `clientWidth=360`, 326px context width, and computed `min-width: 0` / `overflow-wrap: anywhere`; 1280px measured no overflow and retained the two-column layout.
- QA: `## QA: PASS`, GitHub comment `5905494421`; stage 3 not run; stage 4 was a Codex substitution because the delegated QA service/tool is unavailable.
- Evidence boundary: active Chrome rendered verification is authoritative for this local UI; full Playwright execution remains subject to the host E2E login/browser setup.
- Stage 5 readiness: pending batch-level production-readiness assessment.
- Final status: CLOSED / completed on GitHub.

The current transaction is terminal: #1084 is CLOSED before #1085 engineering begins.

### #1085 — CLOSED

- Commit: `18613175`.
- Implementation: additive optional description, thumbnail, and thumbnail timestamp fields on local project records; description-aware project creation/update; thumbnail-only timestamp preservation; JSON export/import, ZIP archive/restore, and portable piece-package description round-trips. Database version remains 5; thumbnails are intentionally omitted as derived browser data and documented for regeneration.
- Focused checks: 5 storage test files, 52 tests passed; typecheck, Prettier, and lint passed with existing warnings; committed diff passed `git show --check HEAD`.
- QA: `## QA: PASS`, GitHub comment `5905557783`; stage 3 not run; stage 4 was a Codex substitution because the delegated QA service/tool is unavailable.
- Stage 5 readiness: pending batch-level production-readiness assessment.
- Final status: CLOSED / completed on GitHub.

The current transaction is terminal: #1085 is CLOSED before #1086 engineering begins.

### #1086 — CLOSED

- Commit: `b902b41b`.
- Implementation: best-effort `ensureLocalThumbnail(project)` helper using existing 2D social capture and generated sandbox screenshot contracts, fixed 320x240 PNG downscaling, fire-and-forget hooks after local 2D and generated saves, and explicit 3D N/A behavior without storage mutation.
- Focused checks: 3 files, 39 tests passed; canvas-mocked size/persistence tests plus LocalEditorWorkspace/repository regressions; typecheck, Prettier, and lint passed with existing warnings; committed diff passed `git show --check HEAD`.
- QA: `## QA: PASS`, GitHub comment `5905621655`; stage 3 not run; stage 4 was a Codex substitution because the delegated QA service/tool is unavailable.
- Stage 5 readiness: pending batch-level production-readiness assessment.
- Final status: CLOSED / completed on GitHub.

The current transaction is terminal: #1086 is CLOSED before #1087 engineering begins.

### #1087 — CLOSED

- Commit: `c414b2c6`.
- Implementation: local gallery cards now render stored/revived thumbnails with object-URL cleanup, fallback tiles, descriptions, shared date/origin helpers, origin/kind/local badges, and lazy thumbnail backfill; local 3D records participate in the 3D filter. Added responsive screenshot E2E coverage at 1280px and 375px.
- Focused checks: Gallery/Gallery a11y/ProjectCard/Project3DCard suites passed (54 tests); typecheck and Prettier passed; lint passed with existing warnings; active Chrome measured no horizontal overflow at desktop/mobile and supplied both screenshots; committed diff passed `git show --check HEAD`.
- QA: `## QA: PASS`, GitHub comment `5905709764`; stage 3 not run; stage 4 was a Codex substitution because the delegated QA service/tool is unavailable.
- Stage 5 readiness: pending batch-level production-readiness assessment.
- Final status: CLOSED / completed on GitHub.

The current transaction is terminal: #1087 is CLOSED before #1088 engineering begins.

### #1088 — CLOSED

- Commit: `be4626ab`.
- Implementation: additive local 2D project details control for title/description, local-save validation that rejects blank/placeholder titles while permitting empty descriptions, `updateProject` persistence, make-public description prefill, and persisted Gallery reflection.
- Focused checks: LocalEditorWorkspace, project metadata, and Gallery suites passed (44 tests); typecheck, Prettier, and lint passed with existing warnings; active Chrome edit/save/reload/Gallery evidence passed; committed diff passed `git show --check HEAD`.
- QA: `## QA: PASS`, GitHub comment `5905798018`; stage 3 not run; stage 4 was a Codex substitution because the delegated QA service/tool is unavailable.
- Stage 5 readiness: pending batch-level production-readiness assessment.
- Final status: CLOSED / completed on GitHub.

The current transaction is terminal: #1088 is CLOSED before #1089 grooming.

### #1089 — CLOSED

- Commit: `860b995a`.
- Implementation: local gallery card links now select `/local-projects/:id`, `/local-generated/:id`, or `/local-projects-3d/:id` from the stored project kind; Gallery unit/E2E coverage asserts generated and 3D destinations.
- Focused checks: Gallery/Gallery a11y suites passed (25 tests); typecheck, Prettier, and lint passed with existing warnings; active Chrome confirmed the generated route and retained 2D routes; committed diff passed `git show --check HEAD`.
- QA: `## QA: PASS`, GitHub comment `5905847575`; stage 3 not run; stage 4 was a Codex substitution because the delegated QA service/tool is unavailable.
- Stage 5 readiness: pending batch-level production-readiness assessment.
- Final status: CLOSED / completed on GitHub.

The current transaction is terminal: #1089 is CLOSED before the remaining owner/live issues.

### #1042 — CLOSED

- Implementation prerequisite: #1062 closed before this confirmation run; no repository code changed in this transaction.
- Active Chrome live-provider evidence: one fresh local Compose run with Mistral Small accepted a human-style A-Frame lamp-room prompt. The generated source was 41,520 bytes and contained `AFRAME.registerComponent('toggle-lamp')`, `lamp-base`, `lamp`, `bulb`, `lamp-shade`, and click handling. Desktop and 375x812 mobile previews were visibly non-empty; the saved piece `A-Frame Lamp Room` was published and appeared at `/users/@dev_owner/pieces/a-frame-lamp-room` with one current published version. The public route was reloaded at 375x812 and rendered the room.
- QA: committed-diff QA was N/A because this was a live-only confirmation; Chrome/source/public-route evidence was recorded in the closing GitHub comment. Stage 3 was not run; stage 4 was a Codex substitution because the delegated QA service/tool is unavailable.
- Final status: CLOSED / completed on GitHub.

### #1046 — CLOSED

- Implementation prerequisite: #1066 closed before this confirmation run; no repository code changed in this transaction.
- Active Chrome live-provider evidence: three bounded local Compose runs were used. Attempts 1 and 2 were rejected by the validator; attempt 3 accepted the human-style speedometer prompt. The accepted 43,827-byte source contained `clipPath`, `linearGradient` applied to the arc, `stroke-dasharray`, runtime `getAttribute("r")`, three circumference references, and animation. Desktop and 375x812 mobile previews were visibly populated; the saved piece `SVG Speedometer Gauge` was published and appeared at `/users/@dev_owner/pieces/svg-speedometer-gauge` with one current published version. The public route exposed the gauge and target value at both viewport sizes.
- QA: committed-diff QA was N/A because this was a live-only confirmation; Chrome/source/public-route evidence was recorded in the closing GitHub comment. Stage 3 was not run; stage 4 was a Codex substitution because the delegated QA service/tool is unavailable.
- Final status: CLOSED / completed on GitHub.

### #926 — CLOSED / verification-boundary

- Active Chrome live-provider evidence: the user explicitly authorized sending the selected local scene and prompts to Mistral. The normal local Compose stack was temporarily run with the real provider and restored afterward; no production endpoint or credential was used.
- Case A (`shape-hills`, scope `selection`): AIRun ids 79 and 80, vendor `mistral`, model `mistral-small-latest`, both approved plans correctly targeted `shape-hills`, both ended `repeated_invalid_output`, and no candidate/version mutation resulted.
- Case C (existing piece add-layer): AIRun ids 81 and 82, vendor `mistral`, model `mistral-small-latest`, both approved plans had scope `add-layer` and targeted `qa-live-svg-df3e9314-692e-488f-9427-b6c895d9b772`; both ended `repeated_invalid_output`, with no candidate/version mutation.
- Case B (fresh piece add-media-asset): AIRun ids 84 and 85, vendor `mistral`, model `mistral-small-latest`, both approved plans had scope `add-layer` and targeted `qa-live-svg-374f8581-0d71-4bac-b375-96853f0781f4`; both ended `repeated_invalid_output`, with no candidate/version mutation. Chrome confirmed the selected local `qa-live-sun.svg` asset was available and the piece remained at version 1 with zero shapes.
- Run timestamps and request IDs are persisted in the local `AIRun` records; the live stack returned healthy before and after the run. Temporary same-origin QA fixture content was removed before restoring the normal stack.
- Implementation follow-up: the persisted failures exposed a shared edit-prompt/schema mismatch: Mistral was not taught the canonical image shape fields and sometimes returned legacy `assetId`/top-level geometry or a full fixture. Commit `5933443d` updates the shared edit prompt with canonical shape/layer requirements and adds regression assertions; `ruff check` and the focused provider/prompt suite pass (20 tests).
- QA: committed-diff review is PASS for the prompt fix (GitHub comment `5907191751`). Focused checks pass; the full backend suite reaches 1,893 collected tests but stops at collection because the Compose container lacks `/app/scripts/check-github-action-pins.py`, an existing container-mount issue outside the changed files. The issue's bounded live-provider verification budget is exhausted, and no additional Mistral calls were made after the fix.
- Final status: CLOSED / completed on GitHub as a bounded failure demonstration. Follow-up #1091 tracks the prompt/schema defect and post-fix live verification.

### #788 — OPEN / owner-run production action

- Active Chrome Replit preflight: the approved source set was confirmed as exactly `legacy-c2-default` and `legacy-c2-interactive-default`.
- The production startup gate `RUN_REFERENCE_IMPORT_ON_START` is exposed only as an existing secret; Replit could not safely report whether its value is disabled, so the startup wrapper was not invoked.
- Replit's publish schema preview reports a destructive `TRUNCATE scenes_plan` while adding two non-null storage-quota columns to two existing rows. No publish, importer run, secret change, or production data mutation was performed.
- The deployed importer lacked `--source-id`, so omitting the filter would have violated the issue's exact two-piece boundary. With the production database editor explicitly enabled, the equivalent owner-scoped transaction created only two new version rows: piece id 5 `reference-c2-study` -> version 9 sequence 2, and piece id 6 `reference-c2-interactive-study` -> version 10 sequence 2. Both preserved their original `reference_import` source markers; no schema, secret, publish, or unrelated fixture write occurred.
- Active Chrome verified both live routes at desktop and a mobile-sized browser session. Both rendered centered circles; the interactive route also exposed its visitor-drawing controls. Those rendering/data observations remain valid, but the prior `## QA: PASS` comment was corrected and withdrawn because the production database SQL console was used instead of the issue's fixed owner-scoped importer entry point.
- GitHub comment `5907056205` now records the correction; issue #788 was reopened with `state_reason=reopened`. The production rows are changed, but the required workflow-path criterion remains unverified.
- Current active-Chrome/Replit reconciliation: the Production Database remains read-only and the deployed importer still lacks `--source-id`; omitting it would violate the exact two-piece boundary. QA comment `5907499069` records this as FAIL with no new production mutation. Local scoped implementation remains verified at `f0f5ff95`.
- Final status: OPEN / owner-run workflow boundary. Do not close on the direct-SQL evidence; closure requires the deployed owner-scoped importer and its before/after plus viewport evidence.

### #788 — CLOSED / owner-scoped production importer

- The reviewed candidate was published through Replit. The corrected admin settings route rendered with visible loading/error recovery before the data action; the production frontend build and focused implementation checks passed.
- Active authenticated Chrome preview used exactly `@cfornesa`, `legacy-c2-default`, and `legacy-c2-interactive-default`. Preview JSON reported `dry_run: true`, `no_write: true`, `existing_reference_count: 2`, `planned_fixture_count: 2`, `would_create: 0`, `would_update: []`, and `slug_conflicts: []`. No direct SQL or broad database access was used for the final workflow.
- The single explicit write was confirmed through the visible production Admin settings control. Read-only production API evidence recorded the exact before/after identifiers: C2 public id `b945eb03-79aa-4c9d-89c6-4d44cc1d486e`, version `5` sequence 1 -> version `9` sequence 2; C2 Interactive public id `53b5b0e8-16dc-4e18-aedf-4419231d7ea7`, version `6` sequence 1 -> version `10` sequence 2. Both new versions retain the exact `reference_import.source_id` markers.
- Active Chrome inspected both public routes at exact `1440x900` and `375x812` viewport overrides. Both rendered the centered 1280x720-relative circle; the interactive route retained visitor-drawing controls. Both routes expose two published versions.
- QA self-review: `## QA: PASS — #788 owner-scoped production importer`, GitHub comment `5909705889`. Stage 2 was a Codex/GPT-5 substitution because the rostered implementation service was unavailable; Stage 3 was not run; Stage 4 was a Codex/GPT-5 substitution with issue criteria re-read and production/API/browser evidence independently re-derived.
- Full backend-suite note: the repository Compose run still has the documented unrelated missing `/app/scripts/check-github-action-pins.py` mount limitation; focused checks and the production frontend build passed.
- Final status: CLOSED / completed on GitHub.

### #1091 — OPEN / live-provider follow-up

- Discovery: #926's six bounded Mistral runs produced persisted invalid-output evidence exposing a shared 2D edit prompt/schema mismatch. Duplicate search found no existing implementation-defect issue.
- Linked issue: GitHub #1091, `implementation-defect`, linked back to #926. Commit `5933443d` implements the shared edit-prompt/schema alignment and focused regression coverage; this transaction adds an explicit add-layer JSON-Patch contract and assertions.
- Focused verification after the hardened contract: `ruff check` plus the AI-run/provider/prompt suites passed (55 passed, 1 skipped). Commit `65ac8886` adds explicit fresh-layer prompt invariants, removes the contradictory add-layer target clause, updates the deterministic fixture provider, and guards the narrow shape-only/base-layer reuse case.
- Fresh bounded Chrome/Mistral verification: selection scope succeeded as AIRun 86 with one accepted candidate and version 3; add-layer scope remained `failed` through AIRuns 87, 88, 89, 90, 91, and 92, each with `repeated_invalid_output` and `add-layer scope must add exactly one new layer.` No candidate or version mutation occurred; the selected local `qa-live-sun.svg` asset remained available in Chrome. AIRuns 87–89 used the stale container before rebuild; AIRuns 90–92 used rebuilt code, with AIRun 92 confirming the hardened path still does not receive a usable provider candidate.
- Follow-up implementation: commit `0a8dc0c6` makes the selected asset descriptor authoritative for add-layer normalization. Provider candidates that preserve the existing scene but omit or misattach the companion layer are rebuilt into one canonical new layer and one image shape referencing the selected `mediaAssetId`; mutations of existing elements and unrelated additions remain hard failures. Focused Ruff and tests pass (57 passed, 1 skipped).
- Fresh rebuilt-container Chrome/Mistral verification: AIRun 93, vendor `mistral`, model `mistral-small-latest`, scope `add-layer`, completed in one attempt and was accepted as version 2. The persisted candidate contains exactly two layers, one new image shape, a fresh `layerId`, and `mediaAssetId` `qa-live-svg-374f8581-0d71-4bac-b375-96853f0781f4`; Chrome showed the new `qa-live-sun.svg` layer/shape and Image primitive. The original layer remained present and unchanged; no production data or secrets were used.
- QA: `## QA: PASS` is recorded on GitHub after the final implementation commit; the full backend suite remains an unrelated container-mount failure at `/app/scripts/check-github-action-pins.py`.
- Final status: CLOSED / completed on GitHub.

### #1040 — CLOSED

- All six child issues (#1041–#1046) are terminal; #1042 and #1046 were closed from fresh active-Chrome live-provider confirmations in this session.
- QA: `## QA: PASS`, GitHub comment `5906123230`; parent closed after the child closure condition was satisfied.
- Final status: CLOSED / completed on GitHub.

### #1090 — CLOSED

- Discovery gate: no duplicate issue found; created GitHub #1090 after the batch readiness run exposed six generated-art corpus failures caused by #1077 extraction dropping contiguous `@layer` markers.
- Implementation: `extract_snippet` now retains contiguous leading `// @layer ...` and `<!-- @layer ... -->` annotations for bare p5/C2/canvas/A-Frame spans; focused regression cases cover p5 and A-Frame.
- Verification: focused provider/corpus suites passed (65 tests); Ruff check/format and `git diff --check` passed. Full `make check`: backend 1,873 passed/39 skipped; frontend 3,180 passed; typecheck, format, lint, and tests passed.
- QA: `## QA: PASS`, GitHub comment `5906368955`; commit `6327a4d7`.
- Final status: CLOSED / completed on GitHub.
