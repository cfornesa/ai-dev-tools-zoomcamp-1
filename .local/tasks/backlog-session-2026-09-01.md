# Backlog session — 2026-09-01

Project: `cfornesa/ai-dev-tools-zoomcamp-1`

Pre-existing worktree changes: user-owned changes in `.agents/memory/MEMORY.md`,
`.agents/memory/generated-art-piece-surface-parity.md`, and `docs/tasks.md`.
They are preserved and are not session commits.

## Issue manifest

| Issue | URL | Backlog | Dependencies | Scope | Status | Blocker/follow-up | Owner/next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| #312 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/312 | 254 | none | Diagnose one CI E2E flake and pass browser job | completed | verification boundary resolved | closed after CI rerun and local disposable spec: 24 passed |
| #314 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/314 | 256 | none | Durable generated-art lifecycle/data/API/thumbnails | completed | — | closed; backend and browser evidence recorded |
| #315 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/315 | 257 | #314 | Owner UI, status, gallery, regular viewer | completed | — | closed; frontend and browser evidence recorded |
| #316 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/316 | 258 | #314/#315 | Overlay controls and safe runtime bridge | completed | permission/runtime hardware remains a manual boundary | closed; implementation and browser evidence recorded |
| #317 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/317 | 259 | #314/#315 | Screenshot and download/export variants | in_progress | screenshot and no-control export invariants remain | finish export/QA |
| #318 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/318 | 260 | #314/#315 | Public immersive viewer | completed | dedicated art-piece immersive browser coverage remains in #319 | closed; route implementation and full suite evidence recorded |
| #319 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/319 | 261 | #314–#318 | Full browser/privacy reconciliation | blocked | #317 exact screenshot/export invariants incomplete | remain open; finish #317 then rerun readiness |
| #313 | https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/313 | 255 | #314–#319 | Epic reconciliation | blocked | #317/#319 remain open | reconcile after remaining gates |

New follow-ups: none at manifest creation. The open issue set exactly matches
the proposed entries 254–261 in `docs/tasks.md`.
