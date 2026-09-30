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
| #1088 | 13; #1085 | 2a frontend | GROOMED | process after dependency |
| #788 | owner-scoped production action | owner-run | OPEN / owner-run | use named production workflow and Chrome evidence |
| #926 | #924/#925/#920 | live-provider Chrome | OPEN / live-provider | process after prerequisites |
| #1040 | tracking parent | children #1041–#1046 | OPEN / reconciliation container | close only after children terminal |
| #1042 | live-provider / #1076–#1080 | owner-run QA | OPEN | revisit after generator contract |
| #1046 | live-provider / #1076–#1080 | owner-run QA | OPEN | revisit after generator contract |

## Duplicate and blocker report

- No duplicate was found among the 18 open GitHub issues returned for `cfornesa/ai-dev-tools-zoomcamp-1`.
- #1040 is a tracking/reconciliation parent, not an implementation unit.
- #788 is a narrowly authorized production-data workflow and must not be replaced by local evidence.
- #926, #1042, and #1046 require bounded live-provider/browser evidence; they remain in the ordered manifest and are not silently omitted.
- No new follow-up issue was discovered during distillation; newly discovered actionable work will be filed before leaving the current issue.

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
