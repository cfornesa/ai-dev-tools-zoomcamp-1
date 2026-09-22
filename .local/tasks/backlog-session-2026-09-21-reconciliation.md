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
