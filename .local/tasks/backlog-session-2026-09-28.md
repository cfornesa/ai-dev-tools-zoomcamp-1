# Backlog session 2026-09-28

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
