# Backlog session — 2026-09-22 — public piece parity (#728–#738)

## Scope and provenance

Project: `cfornesa/ai-dev-tools-zoomcamp-1` (single Django/Vite application,
single published surface). Open-issue discovery used the authenticated GitHub
connector and returned exactly #728–#738. The existing distillation in
`docs/tasks.md` is retained as the PM manifest and was rechecked against live
issue bodies. Session profile: Codex / GPT-5 / medium. Stage substitutions are
recorded per transaction below; stage 3 is `not run` unless an independent
model family becomes available. User did not answer the scope question, so
this run includes every currently open issue and gives blocked items terminal
handoff status rather than omitting them.

## Dependency/order manifest

| Order | Issue | Scope | Dependencies | Routing | Status | Blocker / next action |
|---:|---|---|---|---|---|---|
| 1 | #728 | Public 3D full-stage camera overlay | — | 2a | GROOMED | — |
| 2 | #729 | Public 3D camera opacity/mirror while live | #728 | 2a | GROOMED | — |
| 3 | #730 | Public 3D stage toolbar overlay placement | — | 2a | GROOMED | — |
| 4 | #738 | Themed public piece title and top padding | — | 2a | GROOMED | — |
| 5 | #731 | Public 3D description/version API | — | 2b | GROOMED | — |
| 6 | #732 | Public 3D metadata layout | #731 | 2a | GROOMED | — |
| 7 | #733 | 3D immersive metadata below canvas | #731, #732 | 2a | GROOMED | — |
| 8 | #734 | 3D immersive camera overlay/controls | #728, #729 | 2a | GROOMED | — |
| 9 | #735 | Full ZIP 3D camera/toolset | — | 2a | GROOMED | — |
| 10 | #736 | Generated piece metadata/version layout | — | 2b | GROOMED | — |
| 11 | #737 | 2D piece metadata/version layout | — | 2b | GROOMED | — |

## Transaction ledger

Each issue must record: state, commit, changed files, focused checks, full
checks, QA verdict/comment, evidence boundary, GitHub reconciliation, stage
owners (`service / model / effort`) and substitution flags, and terminal
status. No next issue begins before the current one is terminal.

## Duplicate / already-covered report

The prior distillation in `docs/tasks.md` records closed history #297/#342
(camera), #369–#371/#436/#482 (ZIP camera/steer), and #294/#432/#455 (steer).
They are not duplicates of the current owner-reported public canonical surfaces.

