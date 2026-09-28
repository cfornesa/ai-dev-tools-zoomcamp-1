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

## Issue #980 transaction ledger

- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Centralize HTML/CSS and JS code-tab synchronization in the
  parameterized `useCodeTabSync` hook without changing round-trip behavior.
- **Implementation commit:** `f5866d72`.
- **Changed files:** `frontend/src/pages/EditorWorkspace.tsx`,
  `frontend/src/pages/useCodeTabSync.ts`.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Checks:** `npx vitest run src/pages/EditorWorkspace*.test.tsx` — 35 files,
  399 tests passed; `npm run typecheck` passed; `npm run lint` exited 0 with
  pre-existing warnings; `npm run format:check` passed.
- **QA matrix:** All four acceptance criteria PASS. JSON remains on its
  existing sync hook; HTML/CSS retain their coupled parser/save semantics;
  JS retains its unchanged-save no-op and error behavior.
- **GitHub closure evidence:** QA comment publication was rejected by the
  connector's external-publication risk policy. The issue was closed through
  the typed issue-state update after this local ledger captured the complete
  evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #982 transaction ledger

- **Issue:** [#982](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/982)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Extract the AI-fix and AI-layer panel open/seed state into
  `useAiAssistPanels` without changing panel behavior.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `a70fbcd7` (`refactor(editor): extract AI
  assist panel state`).
- **Changed files:** `frontend/src/pages/EditorWorkspace.tsx`,
  `frontend/src/pages/useAiAssistPanels.ts`.
- **Checks:** `npx vitest run src/pages/EditorWorkspace*.test.tsx` — 35 files,
  399 tests passed; `npm run typecheck` passed; `npm run lint -- --quiet`
  passed; `npm run format:check` passed.
- **QA matrix:** All finite automated criteria PASS. Fix and layer panel
  opening, prompt seeding, closing, and preview-error auto-close behavior
  remained covered by the unchanged EditorWorkspace matrix. No live browser
  session was available for an additional manual interaction check.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.

## Issue #981 transaction ledger

- **Issue:** [#981](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/981)
- **Phase:** CLOSED; GitHub issue state updated to `completed` after local QA.
- **Transaction:** Extract the canvas viewport's zoom, pan, fit-scale, wheel,
  resize, and fit-to-viewport behavior from `EditorWorkspace.tsx` into
  `useCanvasViewport` without changing the editor contract.
- **Stage provenance:** Scoping — Codex / GPT-5 / default effort / substituted:
  no. Engineer/QA/readiness stage: Codex (substitution for the rostered
  service — see `DISPATCH.md`). Second opinion: not run.
- **Implementation commit:** `a4a1e4f4` (`refactor(editor): extract canvas
  viewport hook`).
- **Changed files:** `frontend/src/pages/EditorWorkspace.tsx`,
  `frontend/src/pages/useCanvasViewport.ts`.
- **Checks:** `npx vitest run src/pages/EditorWorkspace*.test.tsx` — 35 files,
  399 tests passed; `npm run typecheck` passed; `npm run lint -- --quiet`
  passed; `npm run format:check` passed; `git diff --check` passed.
- **QA matrix:** All finite automated criteria PASS. Existing zoom/pan,
  wheel, fit, keyboard, gesture, and editor behavior remained covered by the
  unchanged EditorWorkspace matrix. The required manual live-Chrome check was
  not available because no running local stack/browser session was provided;
  this is recorded as an environment boundary, not claimed as performed.
- **GitHub closure evidence:** The attempted QA comment was rejected by the
  authenticated connector's external-publication risk policy. The issue was
  closed through the typed issue-state update after this ledger captured the
  complete evidence; no workaround was attempted.
- **New gaps:** None.
