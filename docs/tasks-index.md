# Closed-backlog index

`docs/tasks.md` is the full, chronological, per-issue ledger (24,000+ lines
as of 2026-09-27) — it is the source of truth for what was actually
implemented and verified, but it isn't something anyone should scroll
through to get oriented. This file is that orientation layer: one row per
GitHub Milestone (added 2026-09-27, grouping the repo's ~937 closed issues
by the week they closed), so you can jump straight to a themed slice of the
history in GitHub's own UI instead of the raw ledger. No closed issue's
content, title, or evidence was changed to build this — a milestone
assignment is additive metadata, not a rewrite of what happened.

| Milestone | Issue range | Count | What it covers |
|---|---|---|---|
| [Batch 1](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/milestone/1) | #1–#19 | 18 | Project foundation: metadata editing, gallery shell, blank-scene project creation. |
| [Batch 2](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/milestone/2) | #18–#139 | 116 | 2D editor build-out and PostgreSQL-semantics hardening (concurrency/trigger test suite, Republish fixes). |
| [Batch 3](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/milestone/3) | #140–#253 | 113 | 3D projects introduced; database-portability review; 3D delete/default-scene parity with 2D. |
| [Batch 4](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/milestone/4) | #123–#480 | 207 | A-Frame/3D authoring, AI 3D editor scene object creation, camera-registration fixes. |
| [Batch 5](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/milestone/5) | #419–#530 | 54 | Cloud sync/snapshot policy: free-vs-paid quotas, scheduled snapshots, local IndexedDB archive/restore. |
| [Batch 6](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/milestone/6) | #527–#636 | 108 | Canonical user-facing piece routes; CI feedback-time reduction; Replit Vitest security gate. |
| [Batch 7](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/milestone/7) | #637–#971 | 315 | The largest and most active week: full backlog reconciliation, cross-surface (regular/embed/immersive/ZIP) parity across six render engines, piece-package intake, editor toolbar/menu regressions. |
| [Batch 8](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/milestone/8) | #860–#978 | 6 | Public media follow-up verification and the first code-health finding (superseded, see below). |

Each milestone's own description on GitHub repeats its issue range and a
few sample titles. For the exact criteria, evidence, and verification each
issue closed on, follow the issue link (every closed issue keeps its full
history) or search `docs/tasks.md` for the issue number.

## After 2026-09-27 (not yet milestoned — too recent for a weekly batch)

This session's own issue actions aren't retroactively bucketed into the
weekly milestones above (they're this week's work, not history to file
away yet):
- Closed: #874, #886, #860, #861, #978, #906, #1012, #1019–#1033.
- Remaining open issues are reconciled as owner-run, dependency-blocked, or
  verification-boundary work in the active backlog-session ledger.
- Filed: #979–#986 (atomic code-health issues, replacing #978), plus
  tracking-only parents #987 (microphone stream) and #988 (code-health
  decomposition), each with real GitHub sub-issue links to their children.
- `owner-priority` label added to code-quality/control-flow/found-defect
  issues (#976, #977, #979–#986, #988) — see `docs/tasks.md`'s "Owner
  priority (2026-09-27)" section.

## Maintaining this index

When a future backlog-session batch closes, add one row here (issue range,
count, one-line theme) rather than expecting `docs/tasks.md` itself to serve
as the index. This file should stay well under 100 lines; if it's growing
past that, retire the oldest rows into a note pointing at the milestone list
instead of listing every batch forever.
