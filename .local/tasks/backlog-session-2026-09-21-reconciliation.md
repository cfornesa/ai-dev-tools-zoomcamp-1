# Backlog session reconciliation — 2026-09-21

## Scope and discovery

Project: `cfornesa/ai-dev-tools-zoomcamp-1` (single Django/Vite application and
single published deployment surface). Worktree was clean at discovery, on
`main`, one commit ahead of `origin/main`; the ahead commit is the owner's
post-publish distillation of this batch and is preserved.

Authenticated GitHub discovery returned exactly 16 open issues: #703–#718.
The issue bodies match the post-publish addendum in
`docs/distillation-2026-09-20-design-and-share-parity.md`; no duplicate or
already-covered issue was found. The user's instruction not to close issues
overrides the normal GitHub-close mutation. This ledger therefore records
closure-ready terminal evidence while leaving every GitHub issue open.

## Dependency/order manifest

| Order | Issue | Scope / entry point | Dependencies | Routing | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | [#703](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/703) | Regular generated-piece responsive stage; canonical public piece route | none | 2a mechanical | GROOMED |
| 2 | [#704](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/704) | Three.js/A-Frame canvas fill and resize | #703 | 2a mechanical | GROOMED |
| 2 | [#705](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/705) | Canvas2D/SVG/p5/C2 surfaces fill and resize | #703 | 2a mechanical | GROOMED |
| 3 | [#706](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/706) | Regular-view toolbar row and fullscreen overlay | none | 2a mechanical | GROOMED |
| 4 | [#707](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/707) | C2 Interactive pencil/brush and size controls | none | 2a mechanical | GROOMED |
| 5 | [#708](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/708) | C2 Interactive palette and custom colour | none | 2a mechanical | GROOMED |
| 6 | [#709](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/709) | C2 Interactive eraser | #707 | 2a mechanical | DEPENDENCY-BLOCKED until #707 |
| 7 | [#710](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/710) | C2 Interactive undo/redo/clear history | #709 | 2a mechanical | DEPENDENCY-BLOCKED until #709 |
| 8 | [#711](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/711) | C2 Interactive touch/stylus continuity and scroll behavior | #707 | 2a mechanical | DEPENDENCY-BLOCKED until #707 |
| 9 | [#712](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/712) | Unset site style resolves to Celestial | #647 seeded style | 2b complex | DEPENDENCY-BLOCKED if #647 seed is absent |
| 10 | [#713](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/713) | Compact mobile header at 375px | none | 2a mechanical | GROOMED |
| 11 | [#714](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/714) | Public profile header/grid alignment | none | 2a mechanical | GROOMED |
| 12 | [#715](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/715) | Piece-card 16:9 thumbnail and placeholder | none | 2a mechanical | GROOMED |
| 13 | [#717](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/717) | Share-metadata diagnostic and safe origin handling | owner publish required for final criterion | 2b complex | HANDED-OFF after local implementation/QA |
| 14 | [#716](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/716) | Generated thumbnail capture options and chosen secure path | Rule 2 gallery/owner choice required | 2b complex | HANDED-OFF pending owner decision |
| 15 | [#718](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/718) | Published design evidence matrix, no fixes | #703–#715, #717, #716, owner publish | QA/readiness | DEPENDENCY-BLOCKED |

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
- **Commits:** `ffe97d6` responsive stage, `a2f3a63` and `1f54687` theme-derived non-white background corrections; screenshot evidence addition pending.
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
- **Full checks:** pending the batch gate after #706 (the prior #705 full gate was green before this scoped change).
- **Browser evidence:** `piece-toolbar-desktop.png`, `piece-toolbar-mobile.png`, and `piece-toolbar-fullscreen.png` were captured and visually inspected. Regular controls sit above the stage, mobile targets wrap at 44px, and fullscreen moves the controls into an overlay host while the artwork fills the viewport.
- **QA result:** `## QA: PASS` for the issue acceptance criteria. No public route/API contract or dependency changed.
- **GitHub comment/closure:** issue-comment connector unavailable (exposed schema is PR-only); no GitHub issue close mutation performed. Reconciliation is locally terminal-ready pending the full batch gate. Next groomed issue: #707.

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
