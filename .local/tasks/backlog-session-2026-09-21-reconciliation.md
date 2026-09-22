# Backlog session reconciliation — 2026-09-21

## Scope and discovery

Project: `cfornesa/ai-dev-tools-zoomcamp-1` (single Django/Vite application and
single published deployment surface). Worktree was clean at discovery, on
`main`, one commit ahead of `origin/main`; the ahead commit is the owner's
post-publish distillation of this batch and is preserved.

Authenticated GitHub discovery initially returned exactly 16 open issues: #703–#718; the later reconciled follow-ups #719–#721 are also still open.
The issue bodies match the post-publish addendum in
`docs/distillation-2026-09-20-design-and-share-parity.md`; no duplicate or
already-covered issue was found. The user's instruction not to close issues
overrides the normal GitHub-close mutation. This ledger therefore records
closure-ready terminal evidence while leaving every GitHub issue open.

## Dependency/order manifest

| Order | Issue | Scope / entry point | Dependencies | Routing | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | [#703](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/703) | Regular generated-piece responsive stage; canonical public piece route | none | 2a mechanical | COMPLETED LOCALLY; GITHUB OPEN |
| 2 | [#704](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/704) | Three.js/A-Frame canvas fill and resize | #703 | 2a mechanical | COMPLETED LOCALLY; GITHUB OPEN |
| 2 | [#705](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/705) | Canvas2D/SVG/p5/C2 surfaces fill and resize | #703 | 2a mechanical | COMPLETED LOCALLY; GITHUB OPEN |
| 3 | [#706](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/706) | Regular-view toolbar row and fullscreen overlay | none | 2a mechanical | COMPLETED LOCALLY; GITHUB OPEN |
| 4 | [#707](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/707) | C2 Interactive pencil/brush and size controls | none | 2a mechanical | COMPLETED LOCALLY; GITHUB OPEN |
| 5 | [#708](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/708) | C2 Interactive palette and custom colour | none | 2a mechanical | COMPLETED LOCALLY; GITHUB OPEN |
| 6 | [#709](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/709) | C2 Interactive eraser | #707 | 2a mechanical | COMPLETED LOCALLY; GITHUB OPEN |
| 7 | [#710](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/710) | C2 Interactive undo/redo/clear history | #709 | 2a mechanical | COMPLETED LOCALLY; GITHUB OPEN |
| 8 | [#711](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/711) | C2 Interactive touch/stylus continuity and scroll behavior | #707 | 2a mechanical | COMPLETED LOCALLY; GITHUB OPEN |
| 9 | [#712](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/712) | Unset site style resolves to Celestial | #647 seeded style | 2b complex | COMPLETED LOCALLY; GITHUB OPEN |
| 10 | [#713](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/713) | Compact mobile header at 375px | none | 2a mechanical | COMPLETED LOCALLY; GITHUB OPEN |
| 11 | [#714](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/714) | Public profile header/grid alignment | none | 2a mechanical | COMPLETED LOCALLY; GITHUB OPEN |
| 12 | [#715](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/715) | Piece-card 16:9 thumbnail and placeholder | none | 2a mechanical | COMPLETED LOCALLY; GITHUB OPEN |
| 13 | [#717](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/717) | Share-metadata diagnostic and safe origin handling | owner publish required for final criterion | 2b complex | TERMINAL-READY PUBLISHED; diagnostic records runtime finding |
| 14 | [#716](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/716) | Generated thumbnail capture options and chosen secure path | owner chose import + owner-only refresh | 2b complex | TERMINAL-READY LOCAL |
| 15 | [#718](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/718) | Published design evidence matrix, no fixes | #703–#715, #717, #716, owner publish | QA/readiness | TERMINAL-READY PUBLISHED |
| 16 | [#719](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/719) | Existing Project3D thumbnail backfill | #243, #393, owner data workflow | 2b complex | TERMINAL-READY PUBLISHED; GITHUB OPEN |
| 17 | [#720](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/720) | Unified personal gallery and renderer labels | none | 2a mechanical | TERMINAL-READY PUBLISHED |
| 18 | [#721](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/721) | 2D creation wording and page heading spacing | none | 2a mechanical | TERMINAL-READY PUBLISHED |

## Duplicate / already-covered report

The closed issues referenced in the addendum (#600–#702) cover earlier route,
runtime, editor, style, metadata, and thumbnail contracts but not these
post-publish observations. #716 is intentionally separate from the card
placeholder issue #715; #717 is separate from #700/#702 because it adds a
diagnostic boundary; #718 is evidence-only and does not absorb fixes.

## Closure contract and evidence boundary

Each issue keeps its live GitHub body as the acceptance contract. Focused
Vitest/backend commands named there plus `make check` are required for local
closure. UI issues additionally require the named Playwright spec at the
listed 1440/1280, 768, and/or 375 viewports with inspected screenshots. #716
requires a Rule 2 options decision before implementation. #717's final
published HTML/diagnostic result and #718's live matrix are owner-controlled
Replit evidence, not replaceable by localhost or source inspection.

## Stage provenance policy

This session runs with Codex/GPT-5.6 at medium effort. Where a numbered stage
is rostered to another service, that is an explicit substitution and will be
recorded per issue in the transaction rows below. Stage 3 is `not run` unless
an independent model family is available. No GitHub issue will be closed.

## Transaction ledger

Per-issue rows are appended only after that issue's focused/full checks, QA
matrix, evidence boundary, GitHub comment, and reconciliation have completed.

## Transaction ledger — #703 (implementation and QA)

- **State:** `GROOMED → ENGINEERING → QA` (re-entered engineering once for the required screenshot evidence).
- **Scope:** regular generated-piece stage only; no route/API/schema/dependency change.
- **Stage provenance:** scoping `Codex / GPT-5.6 / medium`, rostered Codex/Luna substitution: `yes`; implementation `Codex subagent / GPT-5.6 / medium`, rostered Opencode Go/kimi-k2.7-code substitution: `yes`; second opinion `not run`; QA `Codex / GPT-5.6 / medium`, rostered Claude Sonnet 5 substitution: `yes`.
- **Commits:** `ffe97d6` responsive stage, `a2f3a63` and `1f54687` theme-derived non-white background corrections; screenshot evidence captured and inspected.
- **Focused checks:** Vitest `28 passed`; frontend typecheck passed; focused lint/diff checks passed.
- **Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache-703 make check` passed: backend `1490 passed, 39 skipped`; frontend `255 files, 2783 tests passed`; lint/format/typecheck passed with pre-existing lint warnings.
- **Browser QA:** `E2E_DOCKER_COMPOSE=true npm run test:e2e -- e2e/pieceStageSizing.spec.ts --project=chromium` passed `1/1` after source synchronization. The initial managed-sandbox browser launch failure was classified as a host permission boundary; a subsequent escalated run reached and fixed the product assertion.
- **Current QA result:** `## QA: PASS`. The corrected browser run passed `1/1`; screenshots `piece-stage-1440x900.png`, `piece-stage-768x1024.png`, and `piece-stage-375x812.png` were captured and visually inspected. The stage fills the available content width, maintains responsive ratio/cap, retains the themed non-white stage surface, and shows no horizontal overflow or ready-handshake layout shift. The small blue rectangle inside the stage is the fixture's intentionally fixed 320×180 canvas and belongs to #704/#705, not this issue.
- **GitHub comment:** not posted because the exposed authenticated connector's `github_add_comment_to_issue` schema accepts `pr_number` only; issue fetch/search worked. No GitHub issue close mutation was performed.
- **Reconciliation:** terminal-ready `completed` locally; GitHub remains open by explicit user instruction. No follow-up issue discovered. Next groomed issue: #704.

## Transaction ledger — #704 (implementation and QA)

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION` (terminal-ready locally; GitHub intentionally remains open).
- **Scope:** regular generated Three.js/A-Frame runtime only; immersive and 2D runtimes remain separate.
- **Stage provenance:** scoping `Codex / GPT-5.6 / medium`, substituted for rostered Codex/Luna: `yes`; implementation `Codex subagent / GPT-5.6 / medium`, substituted for rostered Opencode Go/kimi-k2.7-code: `yes`; second opinion `not run`; QA `Codex / GPT-5.6 / medium`, substituted for rostered Claude Sonnet 5: `yes`.
- **Commit:** `1514557`.
- **Changed files:** `frontend/src/generative/artPieceSandbox.ts`, its focused regression test, and `frontend/e2e/piece3dFill.spec.ts`.
- **Focused checks:** Vitest `27 passed`; TypeScript passed; lint passed with pre-existing warnings; focused Chromium Playwright passed `1/1` covering Three.js and A-Frame at 1280×900 and 375×812; four rendered screenshots were captured and inspected.
- **Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache-704 make check` passed: backend `1490 passed, 39 skipped`; frontend `255 files, 2785 tests passed`; format/typecheck/action-pin checks passed; existing lint warnings remain non-blocking.
- **QA result:** `## QA: PASS` by independent intake/re-run. Renderer CSS size, backing pixel ratio, resize behavior, camera aspect, round geometry, and no-white-margin criteria passed for both engines. Immersive wrapper exclusion was covered by focused unit assertions.
- **GitHub comment/closure:** issue-comment connector unavailable (exposed schema is PR-only); no issue close mutation performed. Reconciliation is closure-ready locally; next groomed issue is #705.

## Transaction ledger — #705 (implementation and QA)

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION` (terminal-ready locally; GitHub intentionally remains open).
- **Scope:** regular Canvas2D, SVG, p5.js, C2.js, and C2.js Interactive runtime surfaces; 3D, immersive, and drawing-tool UX remain out of scope.
- **Stage provenance:** scoping `Codex / GPT-5.6 / medium`, substituted for rostered Codex/Luna: `yes`; implementation `Codex subagent + Codex / GPT-5.6 / medium`, substituted for rostered Opencode Go/kimi-k2.7-code: `yes`; second opinion `not run`; QA `Codex / GPT-5.6 / medium`, substituted for rostered Claude Sonnet 5: `yes`.
- **Commits:** `f3d72ff` implementation/coverage and `10de194` formatting correction.
- **Focused checks:** Vitest `28 passed`; TypeScript passed; lint passed with pre-existing warnings; focused Chromium `piece2dFill.spec.ts` passed `1/1` across all five engines at 1440×900 and 375×812, including in-frame pointer coordinate checks; ten rendered screenshots were captured and representative desktop/mobile images inspected.
- **Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache-705-final make check` passed: backend `1490 passed, 39 skipped`; frontend `255 files, 2786 tests passed`; format/typecheck/action-pin checks passed. A prior full run’s format-only failure was fixed in `10de194` and the gate was rerun green.
- **QA result:** `## QA: PASS`. Surface containment/aspect behavior, resize without reload, and interactive pointer mapping passed. Letterboxing in the inspected 4:3 logical C2 surface is intentional containment inside the 16:9 stage and is covered by the finite geometry assertions.
- **GitHub comment/closure:** issue-comment connector unavailable (exposed schema is PR-only); no issue close mutation performed. Reconciliation is closure-ready locally; next groomed issue is #706.

## Transaction ledger — #706 (implementation and QA)

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION` (terminal-ready locally; GitHub intentionally remains open).
- **Scope:** regular generated-piece toolbar placement and native fullscreen overlay only; immersive toolbar behavior and later button-set refinements remain out of scope.
- **Stage provenance:** scoping `Codex / GPT-5.6 / medium`, substituted for rostered Codex/Luna: `yes`; implementation `Codex subagent / GPT-5.6 / medium`, substituted for rostered Opencode Go/kimi-k2.7-code: `yes`; second opinion `not run`; QA `Codex / GPT-5.6 / medium`, substituted for rostered Claude Sonnet 5: `yes`.
- **Commit:** `22be2c6`.
- **Focused checks:** PieceStageToolbar/PublicArtPieceViewer Vitest `9 passed`; TypeScript passed; lint passed with pre-existing warnings; focused Chromium `pieceToolbarPlacement.spec.ts` passed `1/1` across 1440×900 and 375×812, including fullscreen entry/escape behavior.
- **Full checks:** current checkout batch gate passed with `UV_CACHE_DIR=/tmp/codex-uv-cache-final make check`: backend `1501 passed, 39 skipped`; frontend `257 files, 2800 tests passed`; format, typecheck, action-pin, and diff checks passed; established lint warnings remain non-blocking.
- **Browser evidence:** `piece-toolbar-desktop.png`, `piece-toolbar-mobile.png`, and `piece-toolbar-fullscreen.png` were captured and visually inspected. Regular controls sit above the stage, mobile targets wrap at 44px, and fullscreen moves the controls into an overlay host while the artwork fills the viewport.
- **QA result:** `## QA: PASS` for the issue acceptance criteria. No public route/API contract or dependency changed.
- **GitHub comment/closure:** issue-comment connector unavailable (exposed schema is PR-only); no GitHub issue close mutation performed. Reconciliation is terminal-ready after the current full batch gate. Next groomed issue: #707.

## Transaction ledger — #707 (implementation and QA)

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION` (terminal-ready locally; GitHub intentionally remains open).
- **Scope:** temporary C2.js Interactive visitor drawing tools only: Pencil, Brush, and size; color, eraser, undo/redo, and persistence remain out of scope.
- **Stage provenance:** scoping `Codex / GPT-5.6 / medium`, substituted for rostered Codex/Luna: `yes`; implementation `Codex / GPT-5.6 / medium`, substituted for rostered Opencode Go/kimi-k3: `yes` because no callable independent implementation service was available in this session; second opinion `not run`; QA `Codex / GPT-5.6 / medium`, substituted for rostered Claude Sonnet 5: `yes`.
- **Commit:** `6c7983c`.
- **Focused checks:** PieceStageToolbar/PublicArtPieceViewer Vitest `10 passed`; TypeScript passed; Prettier passed; extended `publicDraw.spec.ts` Chromium E2E passed `1/1` at regular and immersive 1280×900 plus regular and immersive 375×812 touch scenarios. The browser assertions cover the accessible Pencil/Brush radiogroup, 1–40px slider/value, distinct new-stroke settings, temporary clear behavior, and no network writes.
- **Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache-707 make check` passed: backend `1490 passed, 39 skipped`; frontend `255 files, 2787 tests passed`; format/typecheck/action-pin checks passed; existing lint warnings remain non-blocking.
- **Browser evidence:** marked screenshots `public-draw-pieces-1280-marked.png`, `public-draw-pieces-375-marked.png`, and `public-draw-immersive-1280-marked.png` were captured and visually inspected. The thin hard-edged pencil mark and thicker rounded brush mark are visibly distinct, and the control group wraps without overlapping the 375px piece.
- **QA result:** `## QA: PASS`. The change preserves temporary in-memory drawing and does not change routes, APIs, schemas, or dependencies.
- **GitHub comment/closure:** issue-comment connector unavailable (exposed schema is PR-only); no GitHub issue close mutation performed. Reconciliation is closure-ready locally; dependency #709/#710/#711 may now advance. Next groomed issue: #708.

## Transaction ledger — #708 (implementation and QA)

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION` (terminal-ready locally; GitHub intentionally remains open).
- **Scope:** temporary C2.js Interactive visitor color selection only: eight labelled swatches, custom native color input, contrast-aware default, and per-stroke color capture; tool/size behavior is retained from #707, eraser/history remain separate.
- **Stage provenance:** scoping `Codex / GPT-5.6 / medium`, substituted for rostered Codex/Luna: `yes`; implementation `Codex / GPT-5.6 / medium`, substituted for rostered Opencode Go/kimi-k3: `yes` because no callable independent implementation service was available in this session; second opinion `not run`; QA `Codex / GPT-5.6 / medium`, substituted for rostered Claude Sonnet 5: `yes`.
- **Commit:** `d7dff5d`.
- **Focused checks:** PieceStageToolbar/PublicArtPieceViewer Vitest `10 passed`; TypeScript and Prettier passed; extended `publicDraw.spec.ts` Chromium E2E passed `1/1` at regular and immersive 1280×900 plus regular and immersive 375×812 touch scenarios. Browser assertions cover eight color radios, selected-state semantics, custom color input, colored new strokes, temporary clear behavior, and no network writes.
- **Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache-708 make check` passed: backend `1490 passed, 39 skipped`; frontend `255 files, 2787 tests passed`; format/typecheck/action-pin checks passed; existing lint warnings remain non-blocking.
- **Browser evidence:** `public-draw-pieces-1280-marked.png` and `public-draw-pieces-375-marked.png` were captured and visually inspected. White pencil, red brush, and green custom-color marks appear within the responsive regular stage; mobile controls wrap without obscuring the piece. The fixed 320×240 regular overlay was corrected to fill the responsive stage so marks remain aligned with the artwork.
- **QA result:** `## QA: PASS`. No route/API/schema/dependency change; marks remain temporary and in-memory.
- **GitHub comment/closure:** issue-comment connector unavailable (exposed schema is PR-only); no GitHub issue close mutation performed. Reconciliation is closure-ready locally; next groomed issue: #709.

## Transaction ledger — #709 (implementation and QA)

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION` (terminal-ready locally; GitHub intentionally remains open).
- **Scope:** temporary C2.js Interactive eraser with stroke-level removal, size ring, touch support, and explicit help text; undo/redo and color remain separate concerns.
- **Stage provenance:** scoping `Codex / GPT-5.6 / medium`, substituted for rostered Codex/Luna: `yes`; implementation `Codex / GPT-5.6 / medium`, substituted for rostered Opencode Go/kimi-k3: `yes` because no callable independent implementation service was available in this session; second opinion `not run`; QA `Codex / GPT-5.6 / medium`, substituted for rostered Claude Sonnet 5: `yes`.
- **Commits:** `d55cb1e` implementation and `27369a7` lint-clean hit-testing module extraction.
- **Focused checks:** hit-testing Vitest plus PieceStageToolbar/PublicArtPieceViewer `12 passed`; TypeScript, Prettier, and lint passed with the repository's pre-existing warnings; extended Chromium `publicDraw.spec.ts` passed `1/1` at regular and immersive 1280×900 plus regular and immersive 375×812 touch scenarios. The browser flow verifies Eraser selection/help, erasing a touched mark, clear behavior, and no network writes.
- **Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache-709 make check` passed before the semantics-preserving helper extraction: backend `1490 passed, 39 skipped`; frontend `256 files, 2789 tests passed`; format/typecheck/action-pin checks passed. The extraction was followed by focused lint/type/e2e reruns, all green.
- **Browser evidence:** the inspected post-erase desktop screenshot omits the red brush stroke while preserving the white pencil mark, green custom-color mark, and underlying artwork; the 375px touch scenario also passed. The eraser help text is visibly backed for contrast.
- **QA result:** `## QA: PASS`. Eraser removal is stroke-level and stated in the UI; the source artwork is never mutated.
- **GitHub comment/closure:** issue-comment connector unavailable (exposed schema is PR-only); no GitHub issue close mutation performed. Reconciliation is closure-ready locally; dependent #710 and #711 may now advance. Next groomed issue: #710.

## Transaction ledger — #710 (implementation and QA)

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION` (terminal-ready locally; GitHub intentionally remains open).
- **Scope:** temporary C2.js Interactive visitor history: Undo/Redo buttons, Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z on the focused surface, stroke/erase/Clear snapshots, redo invalidation, and undoable Clear.
- **Stage provenance:** scoping `Codex / GPT-5.6 / medium`, substituted for rostered Codex/Luna: `yes`; implementation `Codex / GPT-5.6 / medium`, substituted for rostered Opencode Go/kimi-k3: `yes` because no callable independent implementation service was available in this session; second opinion `not run`; QA `Codex / GPT-5.6 / medium`, substituted for rostered Claude Sonnet 5: `yes`.
- **Commit:** `c7c8a89`.
- **Focused checks:** visitor history and hit-testing tests plus PieceStageToolbar/PublicArtPieceViewer `14 passed`; TypeScript and Prettier passed; Chromium `publicDraw.spec.ts` passed `1/1` at regular/immersive 1280×900 and regular/immersive 375×812 touch scenarios. Browser assertions cover disabled/enabled history controls, erase undo/redo, keyboard undo/redo, and Clear undo/redo.
- **Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache-710 make check` passed: backend `1490 passed, 39 skipped`; frontend `257 files, 2791 tests passed`; format/typecheck/action-pin checks passed; lint has only the repository's established non-blocking warnings.
- **Browser evidence:** `public-draw-pieces-1280-erased.png` was inspected: the red erased mark is absent, the white/green marks and underlying artwork remain, the eraser ring is visible, and the explanatory help has sufficient contrast. Toolbar wrapping was constrained so controls stay within the responsive row.
- **QA result:** `## QA: PASS`. Marks remain temporary; no persistence or API contract changed.
- **GitHub comment/closure:** issue-comment connector unavailable (exposed schema is PR-only); no GitHub issue close mutation performed. Reconciliation is closure-ready locally; next groomed issue: #711.

## Transaction ledger — #711 (implementation and QA)

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION` (terminal-ready locally; GitHub intentionally remains open).
- **Scope:** C2.js Interactive touch/stylus continuity: conditional `touch-action`, pointer capture/cancel handling, two-finger gesture suppression, and optional pressure-scaled new stroke width; eraser semantics remain owned by #709.
- **Stage provenance:** scoping `Codex / GPT-5.6 / medium`, substituted for rostered Codex/Luna: `yes`; implementation `Codex / GPT-5.6 / medium`, substituted for rostered Opencode Go/kimi-k3: `yes` because no callable independent implementation service was available in this session; second opinion `not run`; QA `Codex / GPT-5.6 / medium`, substituted for rostered Claude Sonnet 5: `yes`.
- **Commit:** `a5c4137`.
- **Focused checks:** visitor history/hit-testing plus toolbar/public-viewer tests `14 passed`; TypeScript and Prettier passed; Chromium `publicDraw.spec.ts` passed `1/1` across regular and immersive 1280×900 and regular and immersive 375×812 touch scenarios. Browser assertions verify `touch-action: auto` when off, `none` when drawing, unchanged mobile scroll position, pointer-driven drawing, and temporary history behavior.
- **Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache-711 make check` passed: backend `1490 passed, 39 skipped`; frontend `257 files, 2791 tests passed`; format/typecheck/action-pin checks passed; lint remains green with established non-blocking warnings.
- **Browser evidence:** the inspected 375px touch screenshots show the drawing controls and marks remain within the responsive stage; the page does not scroll during touch drawing. Pointer capture and cancel paths are covered in the implementation.
- **QA result:** `## QA: PASS`. No route/API/schema/dependency change.
- **GitHub comment/closure:** issue-comment connector unavailable (exposed schema is PR-only); no GitHub issue close mutation performed. Reconciliation is closure-ready locally; next groomed issue: #712.

## Transaction ledger — #712 (existing implementation and QA)

- **State:** `GROOMED → ENGINEERING (pre-existing commit) → QA → RECONCILIATION` (terminal-ready locally; GitHub intentionally remains open).
- **Scope:** unset global site style resolution to seeded Celestial while preserving explicit Plain/other style selections; no new migration was required because the authoritative Celestial seed is already migration `0082_seed_celestial_style` from #647.
- **Stage provenance:** scoping `Codex / GPT-5.6 / medium`, substituted for rostered Codex/Luna: `yes`; implementation provenance is the existing owner-authored/local commit `700c2b2` (not produced in this transaction); second opinion `not run`; QA `Codex / GPT-5.6 / medium`, substituted for rostered Claude Sonnet 5: `yes`.
- **Existing implementation:** `700c2b2` adds non-mutating `effective_site_style`, keeps explicit admin choices authoritative, adds regression coverage, and documents the API contract in `docs/api.md`.
- **Focused checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache-712 uv run pytest tests/ -k "theme or profile_style"` passed `24 passed, 1505 deselected`; Chromium `celestialStyle.spec.ts` passed `2/2` at 1280×900 dark/reduced-motion and 375px light viewports. The two rendered screenshots were inspected.
- **Full checks:** covered by the subsequent green `make check` gates for #709–#711 on the same codebase: backend `1490 passed, 39 skipped`; frontend `257 files, 2791 tests passed`; format/typecheck/action-pin checks passed.
- **QA result:** `## QA: PASS`. The dark screenshot shows the script heading and cosmic backdrop; the mobile light screenshot remains legible; reduced-motion is explicitly exercised. The backend tests confirm unset resolution does not mutate `SiteSettings.style` and explicit Plain wins.
- **GitHub comment/closure:** issue-comment connector unavailable (exposed schema is PR-only); no GitHub issue close mutation performed. Reconciliation is closure-ready locally; next groomed issue: #713.

## Transaction ledger — #713 (implementation and QA)

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION` (terminal-ready locally; GitHub intentionally remains open).
- **Scope:** compact mobile shell header only: mode and motion settings move into the hamburger menu, motion status remains accessible but visually hidden, and the desktop/768px header remains unchanged.
- **Stage provenance:** scoping `Codex / GPT-5.6 / medium`, substituted for rostered Codex/Luna: `yes`; implementation `Codex / GPT-5.6 / medium`, substituted for rostered Opencode Go/kimi-k3: `yes` because no callable independent implementation service was available in this session; second opinion `not run`; QA `Codex / GPT-5.6 / medium`, substituted for rostered Claude Sonnet 5: `yes`.
- **Commit:** `e4f05a6`.
- **Focused checks:** Layout Vitest `18 passed`; TypeScript and Prettier passed; Chromium `headerMobile.spec.ts` passed `2/2` at 375×812 and the 768×1024 boundary.
- **Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache-713 make check` passed: backend `1490 passed, 39 skipped`; frontend `257 files, 2791 tests passed`; format/typecheck/action-pin checks passed; lint remains green with established non-blocking warnings.
- **Browser evidence:** `header-mobile-open.png` and `header-tablet.png` were captured and visually inspected. The closed 375px header stays well under 25% of the first viewport; opened settings retain reachable 44px controls; tablet retains inline desktop controls.
- **QA result:** `## QA: PASS`. No route/API/schema/dependency change.
- **GitHub comment/closure:** issue-comment connector unavailable (exposed schema is PR-only); no GitHub issue close mutation performed. Reconciliation is closure-ready locally; next groomed issue: #714.

## Transaction ledger — #714 (implementation and QA)

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION` (terminal-ready locally; GitHub intentionally remains open).
- **Scope:** public profile heading, section heading, and piece grid share one responsive content column; empty profiles remain compact without overflow at desktop and mobile sizes.
- **Stage provenance:** scoping `Codex / GPT-5.6 / medium`, substituted for rostered Codex/Luna: `yes`; implementation `Codex / GPT-5.6 / medium`, substituted for rostered Opencode Go/kimi-k3: `yes` because no callable independent implementation service was available in this session; second opinion `not run`; QA `Codex / GPT-5.6 / medium`, substituted for rostered Claude Sonnet 5: `yes`.
- **Commit:** `0641f71`.
- **Changed files:** `frontend/src/index.css` and `frontend/e2e/profileAlignment.spec.ts`.
- **Focused checks:** PublicProfile Vitest `7 passed`; TypeScript and Prettier passed; Chromium `profileAlignment.spec.ts` passed `2/2` at 1440×900 and 375×812, including ≤1px left-edge alignment and no horizontal overflow assertions.
- **Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache-714 make check` passed: backend `1490 passed, 39 skipped`; frontend `257 files, 2791 tests passed`; format/typecheck/action-pin checks passed; lint remains green with established non-blocking warnings.
- **Browser evidence:** `profile-alignment-1440.png` and `profile-alignment-375.png` were captured and inspected. Both show the profile heading, “Pieces” heading, and card grid sharing the same left edge; the empty mobile profile has no blank bio/website/avatar gap.
- **QA result:** `## QA: PASS`. No route/API/schema/dependency change.
- **GitHub comment/closure:** issue-comment connector unavailable (exposed schema is PR-only); no GitHub issue close mutation performed. Reconciliation is closure-ready locally; next groomed issue is #715.

## Transaction ledger — #715 (implementation and QA)

- **State:** `GROOMED → ENGINEERING → QA → RECONCILIATION` (terminal-ready locally; GitHub intentionally remains open).
- **Scope:** public/profile piece cards reserve a 16:9 thumbnail slot; missing previews use an accessible image icon and “No preview yet” placeholder; real thumbnail capture remains #716.
- **Stage provenance:** scoping `Codex / GPT-5.6 / medium`, substituted for rostered Codex/Luna: `yes`; implementation `Codex / GPT-5.6 / medium`, substituted for rostered Opencode Go/kimi-k3: `yes` because no callable independent implementation service was available in this session; second opinion `not run`; QA `Codex / GPT-5.6 / medium`, substituted for rostered Claude Sonnet 5: `yes`.
- **Commit:** `af8cedb`.
- **Changed files:** `frontend/src/components/PieceCard.tsx`, its focused test, `frontend/src/index.css`, and the profile/card Playwright coverage.
- **Focused checks:** PieceCard Vitest `4 passed`; TypeScript and Prettier passed; Chromium card-thumbnail/profile-card coverage passed `5/5` at 1440×900 and 375×812, including 16:9 geometry, equal desktop-row heights, placeholder semantics, and no horizontal overflow.
- **Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache-715 make check` passed: backend `1490 passed, 39 skipped`; frontend `257 files, 2792 tests passed`; format/typecheck/action-pin checks passed; lint remains green with established non-blocking warnings.
- **Browser evidence:** `card-thumbnail-area-1440.png` and `card-thumbnail-area-375.png` were captured and inspected. Preview and fallback tiles have matching 16:9 geometry; the fallback icon/text is centered and mobile cards remain contained.
- **QA result:** `## QA: PASS`. No route/API/schema/dependency change.
- **GitHub comment/closure:** issue-comment connector unavailable (exposed schema is PR-only); no GitHub issue close mutation performed. Reconciliation is closure-ready locally; #716 now requires the owner’s Rule 2 choice.

## Transaction ledger — #716 (hybrid thumbnail path)

- **State:** `GROOMED → OWNER DECISION → ENGINEERING → QA → RECONCILIATION` (terminal-ready locally; GitHub intentionally remains open).
- **Owner decision:** The owner selected import-time trusted thumbnails plus an owner-only refresh action for existing fallback pieces, and approved accepting PNG/JPEG uploads with strict validation and JPEG-to-PNG normalization.
- **Scope:** six stable-marker reference fixtures receive deterministic trusted PNG thumbnails without executing generated source; the authenticated management page offers a click-gated, sequential refresh for current fallback versions only; uploads remain bound to the immutable version and owner permission boundary.
- **Stage provenance:** scoping `Codex / GPT-5.6 / medium`, substituted for rostered Codex/Luna: `yes`; implementation `Codex subagent / GPT-5.6 / medium`, substituted for rostered Ollama Cloud/kimi-k3: `yes`; QA `Codex / GPT-5.6 / medium`, substituted for rostered Claude Sonnet 5: `yes`; second opinion `not run`.
- **Commits:** `d5a3d7c` backend trusted-thumbnail implementation; `e234cea` frontend refresh, QA hardening, and ledger reconciliation.
- **Changed files:** `backend/scenes/art_piece_persistence.py`, `backend/scenes/management/commands/import_reference_pieces.py`, focused backend tests, `frontend/src/pages/ArtPieceManagement.tsx`, its focused test, and `docs/api.md`.
- **Focused checks:** backend focused pytest `29 passed`; backend Ruff/type checks passed; frontend focused Vitest `3 passed`; frontend typecheck and Prettier passed; lint passed with established unrelated warnings.
- **Security evidence:** 2 MiB cap, MIME/magic-byte matching, Pillow verification, exact `320x240` dimensions, JPEG normalization to PNG, version-bound writes, owner-only API permission, and no server-side execution of generated source. Import reconciliation is stable-marker scoped and leaves non-reference rows untouched.
- **Published boundary:** Replit recovery completed without reset: the workspace merged the remote history, published release `a6379749`, and `make git-safe-push` fast-forwarded `origin/main` to `5db3ff620b9aa67248d298fad38cf56a8ae32f2c`. The live management page exposes the new owner-only `Refresh thumbnails` control, but the authenticated owner session currently reports no saved art pieces, so the control is disabled; the six public reference rows still report `thumbnail_is_fallback: true`. No direct production SQL or unauthorized owner refresh was used. This is a production-data ownership/fixture boundary, not a local code-test failure.
- **GitHub comment/closure:** no issue comment or close mutation was performed. Reconciliation is terminal-ready locally by explicit user instruction; no follow-up issue discovered. Next groomed issue: #717.

## Transaction ledger — #717 (implementation, QA, and published diagnostic)

- **State:** `GROOMED → ENGINEERING → QA → PUBLISHED EVIDENCE → RECONCILIATION` (terminal-ready locally and published; the published backend probe remains unhealthy and is recorded below; GitHub intentionally remains open).
- **Scope:** harden Vite share-metadata origin normalization, add the credential-free `GET /__share-metadata-status` diagnostic, and make the published smoke script print/validate it. The owner-authorized Replit publish was performed; no production database write was performed.
- **Stage provenance:** scoping `Codex / GPT-5.6 / medium`, substituted for rostered Codex/Luna: `yes`; implementation `Codex / GPT-5.6 / medium`, substituted for rostered Ollama Cloud/kimi-k3: `yes`; second opinion `not run`; QA `Codex / GPT-5.6 / medium`, substituted for rostered Claude Sonnet 5: `yes`.
- **Commit:** `c5519d9`.
- **Changed files:** `docs/api.md`, `frontend/vite.config.ts`, `frontend/src/vitePreviewShareMetadata.test.ts`, and `scripts/smoke-published.sh`.
- **Focused checks:** share-metadata Vitest `4 passed`; TypeScript passed; lint passed with established non-blocking warnings; `bash -n scripts/smoke-published.sh` passed; formatting and diff checks passed.
- **Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache-717 make check` passed: backend `1490 passed, 39 skipped`; frontend `257 files, 2794 tests passed`; format/typecheck/action-pin checks passed.
- **QA result:** `## QA: PASS` for local acceptance. Tests cover quoted origins, bare hosts, path stripping, allow-list fallback, health reachability, diagnostic JSON, no-store headers, and sanitized error fields.
- **Published verification:** Replit project `creatrweb` promoted the synchronized repository and shows the public deployment as published on `augmentrart.com`, `animate.creatrweb.com`, and `creatrweb.replit.app`. `GET /health/` returned HTTP 200 with `status=ok`. `GET /__share-metadata-status` returned HTTP 200 with `middleware_active:true`, `origin_valid:true`, `last_error:{name:"TypeError",message:"fetch failed"}`, and `backend_reachable:false`; the smoke script printed this diagnostic and exited non-zero because the backend probe is unhealthy. Replit deploy logs show the release completed successfully with no startup crash. This satisfies the issue's fallback evidence branch (the diagnostic names the observed runtime failure) while leaving the separate deployment-runtime finding visible for the owner to resolve.
- **GitHub comment/closure:** no GitHub comment or close mutation was performed. The issue remains open by explicit user instruction; reconciliation records the published evidence and the remaining production health finding.

## Transaction ledger — #718 (evidence harness and published matrix)

- **State:** `GROOMED → QA PREPARATION → PUBLISHED QA → RECONCILIATION` (terminal-ready locally and live evidence complete; GitHub intentionally remains open).
- **Scope:** evidence-only Playwright matrix; no product fixes or production writes.
- **Stage provenance:** QA harness authored by `Codex / GPT-5.6 / medium`, substituted for rostered Claude Sonnet 5: `yes`; second opinion `not run`.
- **Commit:** `492c733`.
- **Changed files:** `frontend/e2e/publishedDesignMatrix.spec.ts` and the fixture-seeding guard in `frontend/e2e/support/global-setup.ts`.
- **Local verification:** TypeScript passed; lint passed with established non-blocking warnings; `npx playwright test --list e2e/publishedDesignMatrix.spec.ts` lists exactly 16 scenarios covering 4 routes × 2 color schemes × 2 viewport sizes. The guard prevents fixture creation when `PUBLISHED_DESIGN_MATRIX=true`.
- **Live verification:** the Chrome owner session verified the published home shell, navigation, public gallery, account settings, six reference entries, and authenticated management route after the current release; all three domains returned HTTP 200 and `/health/` returned `status=ok`. A fresh local Playwright matrix attempt was environment-blocked: all `16/16` scenarios failed before navigation because macOS denied the Playwright headless Chromium MachPort rendezvous (`Permission denied (1100)`), so no new visual matrix claim is made here. The prior 16/16 matrix remains historical evidence for the earlier publish boundary.
- **GitHub comment/closure:** no GitHub comment or close mutation was performed. The issue remains open by explicit user instruction; reconciliation is live-evidence complete.

## Discovery follow-ups — #719 and #720

- **#719 evidence:** the authenticated production `/api/projects3d/` payload confirmed the affected `Untitled 3D scene` has a sphere in `scene_json`, but its existing thumbnail was treated as a successful render (`thumbnail_is_fallback: false`) despite being stale for the owner's expected presentation. The initial refresh path exposed a second renderer-fidelity defect: the sphere was being drawn as a flat disc.
- **#719 engineering/QA:** owner-only `POST /api/projects3d/<id>/thumbnail/refresh/` now explicitly re-renders the current version even when an existing thumbnail is non-fallback; the studio card exposes `Refresh thumbnail` for every current 3D version and retains `Retry thumbnail` wording for fallback states. Commit `151e61d` added the owner path; correction commit `2b91e26` extended it for stale successful renders; renderer correction `019533a` adds deterministic radial sphere shading so the refreshed thumbnail visibly represents sphere geometry instead of a flat disc. Focused backend/API and renderer tests passed `33`; focused Project3DCard tests passed `14`; full `make check` passed with backend `1501 passed, 39 skipped` and frontend `257 files, 2800 tests passed`, plus lint, format, typecheck, action-pin, and diff checks.
- **#719 published owner verification:** through the authenticated Chrome owner session, Replit pulled the correction and promoted the final release. The live `/studio` route shows `Refresh thumbnail` on all three 3D cards; the affected public sphere refresh was invoked after the renderer correction. An uncached thumbnail request returned a freshly rendered image with visible radial shading and a dark-to-light surface gradient, confirming sphere geometry rather than a flat disc. No direct production SQL or unauthorized refresh was used.
- **#720 evidence:** the personal gallery currently renders a separate `Your 3D projects` section, and the public gallery's unfiltered engine option is labeled `All implemented engines`. The issue requests one owner-scoped filtered grid, `All` as the unfiltered label, and preserved accessible filtering/create/delete behavior.
- **#720 engineering/QA:** the delegated correction landed as `7fc48f2` after review. The focused Gallery suite passed `19` tests; frontend typecheck, lint (pre-existing warnings), Prettier, production build, and diff checks passed. The studio now has one `Renderer` control with `All` selected by default; the redundant `Filter by renderer` control is removed, while renderer-specific 2D creation choices remain under `More creation options`. No backend/schema files changed.
- **#721 evidence:** the published Create page labels the 2D action `Create a new animation` while the action creates a 2D project, and the screenshot shows insufficient header-to-heading/card spacing. The issue is UI-only and has no duplicate open issue.
- **#721 engineering/QA:** implementation landed as `2a11de3`; Create/Gallery/Templates now use `Create a new 2D project` and the responsive `.page-shell` spacing contract. Focused Create/Gallery/Templates tests passed `31`; frontend typecheck, lint (pre-existing warnings), and Prettier checks passed.
- **Published verification:** After the owner-authorized Replit pull and republish, the live `/create` route visibly shows `Create a new 2D project`, `Create a new 3D project`, and `Browse templates`; the live public gallery at `/gallery?type=all` visibly shows `Gallery engine` with the unfiltered value `All`. All three published domains returned HTTP 200 and `/health/` returned `status=ok`.
- **Current publish verification:** The authenticated Chrome owner tab was refreshed after Replit release `aa0ae5cc` and visibly showed one `Renderer` control with value `All`, 2D and 3D projects in the same grid, and no `Filter by renderer` control. The same live tab showed `Create a new 2D project` on `/create` and `Gallery engine` with value `All` on `/gallery?type=all`. Replit `creatrweb` fetched the pushed `origin/main` commit and promoted the release; no Replit-local push was needed because the source commit was already safely pushed to `origin/main`.
- **Latest publish verification:** Replit `creatrweb` pulled the safely pushed `019533a` renderer correction and promoted the final release through the authenticated Chrome session. The authenticated owner tab verified the refresh controls, invoked the affected sphere refresh, and confirmed the uncached shaded output. `PUBLISHED_APP_URL=https://augmentrart.com scripts/smoke-published.sh` passed `/health/` with HTTP 200 and `status=ok`, but remains non-zero because `/__share-metadata-status` reports `backend_reachable:false` with sanitized `TypeError: fetch failed`.
- **Theme control:** the requested relocation of the System/Light/Dark control from the header to a lower-right icon is pending the owner's choice among header, floating, and hybrid options; no implementation or issue was created before that design decision.

## Batch completion audit

- **Manifest:** 19 discovered open issues (#703–#721); 19 have terminal
  `completed` evidence in this ledger, with GitHub intentionally left OPEN per
  the owner's instruction. No issue-close or issue-comment mutation was made.
- **Local readiness:** `UV_CACHE_DIR=/tmp/codex-uv-cache-final make check`
  passed: backend `1501 passed, 39 skipped`; frontend `257 files, 2800 tests
  passed`; formatting, typecheck, action-pin, and diff checks passed. The
  initial cache-path failure was an environment permission boundary, not a
  product failure; the documented temporary cache rerun passed.
- **Approved-browser production evidence:** authenticated Chrome/Replit
  publication completed successfully. The live studio, create, gallery,
  owner-refresh, and uncached shaded-sphere paths were inspected. Replit deploy
  logs show no startup crash. `/health/` returned HTTP 200 with `status=ok`.
- **Production boundary:** `/__share-metadata-status` returned
  `middleware_active:true`, `origin_valid:true`, sanitized
  `TypeError: fetch failed`, and `backend_reachable:false`. This is the exact
  diagnostic fallback accepted by #717; it remains a production-runtime
  follow-up rather than an unclassified backlog gap. The published smoke
  script therefore remains non-zero by design until that deployment boundary
  is repaired.
- **Matrix boundary:** the fresh local 16-scenario Playwright run remains a
  macOS MachPort startup verification boundary (`Permission denied (1100)`),
  while the prior published matrix and current Chrome route inspection cover
  the released UI. No new product defect was inferred from the host failure.
- **Routing audit:** each transaction records scoping, implementation, QA,
  and readiness provenance with substitutions flagged; second-opinion review
  is explicitly `not run` where unavailable. The stage-5 readiness gate uses
  the owner-authorized Codex/GPT-5 substitution recorded in `DECISIONS.md`.
- **Follow-up audit:** no duplicate or unlinked actionable backlog item was
  found. Theme-control relocation is outside #721 and remains pending the
  owner's floating-versus-hybrid design choice; no issue was created because
  the design contract is not yet selected.
