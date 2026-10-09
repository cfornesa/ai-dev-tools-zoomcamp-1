# PR #1310 batch record — Stage 4 evidence (supplementary)

**Nature of this record.** A point-in-time evidence record for PR #1310 only, written after implementation, QA and CI. It is supplementary: it does not replace the repository's normal ledger in `docs/tasks.md` or the issue/task parity entries (see "Ledger location"). Nothing in it describes work done before implementation unless it says so. The owner decision that governs it is the 2026-10-09 entry in `DECISIONS.md`.

## 1. Identity

| Item | Value |
|---|---|
| PR | #1310 (draft at the time of writing), `codex/augmentrart-batch-1291-1293-1239-1241-1180-review-20261009` into `main` |
| Reviewed head | `9c9e1b8bd18c534b87cfe17d5b9416c40cdd618e` |
| Base | `77461bd36a34542c5dcbccc5b8cc915e4ec8fb58` (equal to `origin/main` when reviewed) |
| Scope | 13 files, +439/−53, five commits (all authored as Fornesus, 2026-10-08 23:23 local; commit messages carry no model or effort) |
| Issues | #1291, #1293, #1239, #1241, #1180 (denial coverage) |
| Environment for local checks | disposable PostgreSQL 16 container, Django and Vite served from the PR worktree, `AI_PROVIDER=fake`, local Chromium. No production access and no paid provider. |

## 2. Ledger rows

Attribution is from `git show --stat` of each commit. Each commit was not tested separately; all checks below ran on the head.

| Issue | Milestone (as read) | Commit | Files in the commit | State | GitHub QA comment | Status |
|---|---|---|---|---|---|---|
| #1293 whole-scene AI action reveals its panel | Batch 19: production verification (2026-10-05) | `a5cb0c4a` | `EditorWorkspace.tsx`, `AIProposalPanel.tsx`, `MentionPromptField.tsx`, `EditorWorkspace.askAiChangeLayer.test.tsx`, `EditorWorkspace.previewErrorLocalization.test.tsx`, `e2e/wholeSceneAiAction.spec.ts` | QA | posted | awaiting reconciliation |
| #1291 export dialog from stage toolbar | Batch 19: production verification (2026-10-05) | `e62b34d5` | `EditorWorkspace.tsx`, `ExportConfigDialog.tsx`, `ExportConfigDialog.test.tsx`, `e2e/exportConfigDialog.spec.ts` | QA | posted | awaiting reconciliation |
| #1239 owner flow without the shim | Batch 14: matching-ref CI stabilization (2026-09-30) | `9e5b7e3f` | `e2e/authoringOwnershipGate.spec.ts` | QA | posted | awaiting reconciliation |
| #1241 public profile empty-state assertion | Batch 14: matching-ref CI stabilization (2026-09-30) | `365660cf` | `e2e/publicProfiles.spec.ts`, `e2e/known-failures.json` (removes the #1230-attributed `publicProfiles` entry, owner-approved) | QA | posted | awaiting reconciliation |
| #1180 owner-editor denial coverage | Batch 14: matching-ref CI stabilization (2026-09-30) | `9c9e1b8b` | `backend/tests/test_canonical_piece.py` (+4 parametrized tests), `e2e/known-failures.json` (removes the #1180 entry for the 2D ownership test) | QA | posted | awaiting reconciliation |

`EditorWorkspace.tsx` is shared by the #1293 and #1291 commits. No issue is closed. Issue labels and milestones were not changed by this PR.

## 3. Posted QA comments (2026-10-09, posted with the `gh` CLI under an explicit owner authorization because the session had no GitHub connector)

- #1291: https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1291#issuecomment-6074997923
- #1293: https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1293#issuecomment-6074998545
- #1239: https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1239#issuecomment-6074998855
- #1241: https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1241#issuecomment-6074999135
- #1180: https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1180#issuecomment-6074999432

Each is headed `## QA: PASS (local portion; closure gates open)`. Each was read back through the API; the body matched the sent text apart from a trailing newline.

## 4. Provenance

| Stage | Service / model / effort | Substituted | Note |
|---|---|---|---|
| 0 Distillation and backlog edits | Claude `claude-sonnet-5-5`, medium | no | portable dispatch |
| 1 Issue scoping | unrecorded | unknown | the five issue bodies pre-date this review and do not record their author |
| 2 Implementation | Codex; model and effort unrecorded | yes (roster is Opencode; owner-directed) | commits carry no trailers |
| 3 Second-opinion review | not run | n/a | optional stage; never recorded as covered by QA, by Claude reviews or by authorship |
| 4 QA | Claude `claude-sonnet-5-5`, medium (Claude Code desktop) | no | all reported results were re-run; an advisory Claude review earlier in the work is not counted as Stage 4 |
| 5 Production readiness | not run | n/a | preconditions unmet; model policy is an open owner question |
| 6 Batch reconciliation | not run | n/a | |

## 5. Retrospective impact matrix

**This matrix is retrospective.** It was built after implementation from the actual diff, callers, shared state and open issues. It is not work performed before implementation, and no earlier PM work is claimed.

**Owner acceptance.** For PR #1310 only, the owner accepted this retrospective matrix as a substitute for the missing pre-code impact matrix (owner statement, 2026-10-09). The acceptance does not waive any test, any release requirement, or the impact-matrix requirement for any future change or batch.

| Changed surface | Kind | Callers and shared state | Open issues that reference it | Collision or invalidation | Re-verification evidence |
|---|---|---|---|---|---|
| `EditorWorkspace.tsx`: controlled/uncontrolled `TopLevelPanel` open state, `layersPanelOpen`, `aiLayerPromptInputRef`, `editorWorkspaceRef`, the whole-scene handler, the Export button and the relocated export dialog | code | the 2D editor only (`TopLevelPanel` is local to the file); shared state is `activePanel`, the Layers disclosure and `exportDialogOpenSignal` | #1291, #1293, #1298 (pan overlay), #1187 (shim), #1170, #1252, #1096 | none found; #1298 and #1187 untouched | local: affected browser set and full Vitest; Linux: full matrix |
| `ExportConfigDialog.tsx`: `showTrigger`, `getReturnFocusFallback`, return-focus ownership, focus on load | code | imported only by `EditorWorkspace` | #1291, #1096 | none; the direct Inspector path is preserved and asserted | local: dialog unit tests and `exportConfigDialog` spec |
| `AIProposalPanel.tsx` `promptInputRef` and `MentionPromptField.tsx` `textareaRef` | code (optional props) | `AIProposalPanel` is used by `EditorWorkspace` (three instances) and by the unrouted `AiEditorWorkspace`; `MentionPromptField` is used by `AIProposalPanel`, `AIProposalPanel3D` and `ArtPieceEditor`, which pass no ref | #1170 (for `AIProposalPanel`); none for `MentionPromptField` | behavior-neutral where no ref is passed; `piece2dFill` does not use these panels, but its cause is still uncertain | local: `aiMention2d`, `aiIntentNotes`, `artPieceRefine`, `artPieceFakeRefinement` pass; 3D AI and stage specs only via Linux |
| `authoringOwnershipGate.spec.ts` | test | none | #1239, #1180, #1187, #1096 | the spec no longer uses the shim (#1187 consumers) | local 3/3; Linux 3/3 |
| `publicProfiles.spec.ts` | test | none | #1241, #1164, #1096 | #1164 profile PATCH is separate | local 1/1; Linux 1/1 |
| `backend/tests/test_canonical_piece.py` (+4 denial tests) | test | `OwnerArtPieceBySlugView`, unchanged | #1180, #1305 | none; no backend source change | local full pytest; owner-gate mutation fails 4/4 |
| `known-failures.json` (−2 entries: #1180 and #1230 `publicProfiles`) | ratchet baseline | ratchet script and the CI matrix | #1180, #1239, #1241, #1230 (closed), #1096 | all other entries preserved | local ratchet on browser reports; Linux shards report no new failure for these specs |
| New and strengthened tests: `wholeSceneAiAction.spec.ts`, `exportConfigDialog.spec.ts`, the `askAiChangeLayer` test, `ExportConfigDialog.test.tsx`, the `previewErrorLocalization` test | tests | none | #1293, #1291 | none | local |

E2E consumers that name the changed controls (17 specs). The 2D ones were re-run locally; the 3D ones (`ai3dStageChrome`, `aiAgent3d`, `aiDrawingPlane784`, `project3dLifecycle`, `manual3dStageChrome`, `project3dSettingsAccordion`, `savedModels`, `vividDesignMatrix`, `aiMedia*`, `createChooser`) were not re-run locally. In the Linux matrix they passed except `project3dLifecycle`, which also fails on the base. No `index.css`, route, dependency, migration or `App.tsx` change is in the PR.

## 6. Exact-head local evidence (reproduced by the QA reviewer at `9c9e1b8b`; Chromium on macOS)

- `make check` exit 0: workflow pin check; backend ruff, format, mypy and pytest (2065 passed, 44 skipped); frontend oxlint (0 errors), prettier, tsc, Vitest (325 files, 3331 tests) and the ratchet script tests (7/7).
- Browser, targeted: 11/11 (`authoringOwnershipGate` 3, `exportConfigDialog` 5, `publicProfiles` 1, `wholeSceneAiAction` 2), 0 skipped. The ratchet script evaluated that browser JSON report against the PR `known-failures.json`: new 0, fixed 0, expired 0.
- Browser, affected editor and AI-panel set: 33/33 over 15 spec files (`layersPanel`, `aiLayerTargetExisting`, `aiRegionTargetExisting`, `aiPanelLayout2d`, `aiAgent2d`, `aiMention2d`, `aiIntentNotes`, `manual2dStageChrome`, `unifiedEditor2d`, `editOutputConsistency`, `structuredExportSound`, `regularToolbar2d768`, `legacy2dToolset`, `artPieceFakeRefinement`, `artPieceRefine`), ratchet clean.
- Rendered inspection (screenshots viewed): the export dialog at 1280×900 and 375×812; the whole-scene assistant at 375×812 and at 1280×900 with Layers collapsed.
- Mutations of the shipped mechanism in a scratch copy, each failing only its own tests: dropping the ref prop (5 failures), the panel ignoring the ref (5), dropping the panel switch (4), dropping the Layers expansion (1), dropping the focus fallback (1), dropping the recorded opener (1). Removing the owner gate in a scratch backend failed the 4 denial tests (earlier run, identical test content).
- `piece2dFill`: 3/3 passes locally at the head.
- Not re-run at the head: an Escape and repeat-open probe (run on the earlier tree with an identical `ExportConfigDialog.tsx`).

## 7. Exact-head Linux CI evidence (GitHub Actions)

- PR run 37883706667 (pull_request, head `9c9e1b8b`): success. Workflow validation, Backend checks, Frontend checks, Browser acceptance E2E (shard 1) and the disposable published routing smoke check passed. The published routing, disposable staging authenticated and hosted safe-push smoke jobs were skipped because their repository variables are absent.
- Matrix run 37883759171 (workflow_dispatch, head `9c9e1b8b`): 10 of 16 shards passed; shards 2, 9, 10, 11, 12 and 13 failed. For the touched specs: `authoringOwnershipGate` 3 passed (shard 6), `exportConfigDialog` 5 passed (shard 8), `publicProfiles` 1 passed (shard 14), `wholeSceneAiAction` 2 passed (shard 16); those shards' other skips are other specs.
- Base evidence (existing, no new run): scheduled run 37880010718 on `main` at `77461bd3` failed in shards 2, 6, 7, 9, 10, 11, 12 and 13, with 39 distinct failing cases.

### Full-matrix failures (37 distinct failing cases on the head; first failing step from the job logs; compared by spec and title, not shard number)

| Spec (cases) | Shard on head | First failing step | Ratchet class on head | On base run |
|---|---|---|---|---|
| `adminContent` (1) | 2 | `toBeVisible` | new | fails |
| `ai2dPublication` (1) | 2 | `toBe` | baselined #1170, expires 2026-10-25 | fails |
| `localFirstCreate2d` (2), `localFirstCreate3d` (2), `localFirstCreateGenerated` (2), `localOnlyNetworkAudit` (1), `localOwnerKeyMismatch` (2), `localPieceRoundTripPublish` (6) | 9 | `locator.click` timeout 10000 ms | new | fail (some in shard 10 on base) |
| `localPieceUploadOffer` (2) | 10 | `locator.click` timeout 10000 ms | new | fails |
| `offlineOwnershipRecovery` (8) | 11 | `toMatch` on an undefined `sessionGeneration` (first case); `toBeVisible` (others) | new | fail |
| `pieceExportLocal2d` (2), `pieceImport` (1) | 11 | `locator.click` timeout 10000 ms | new | fail |
| `piece2dFill` (1) | 11 | test timeout 30000 ms in `waitForPreviewSurface` | new | **passes on base (25.2 s)** |
| `pieceTemplateParity2d` (1), `pieceTemplateParity3d` (1) | 12 | `toBeVisible` | baselined #1166, expires 2026-10-24 | fail |
| `profileHandles` (2) | 12 | `toBeVisible` | baselined #1230, expires 2026-10-24 | fail |
| `project3dLifecycle` (1) | 12 | `locator.click` timeout 10000 ms | new | fails |
| `public3dImmersiveCameraOverlay734` (1) | 13 | `toBeVisible` | new | fails |

Counts: 5 existing baselined failures; 31 failures reproduced on the base run but not baselined; 1 newly observed on the head (`piece2dFill`); no candidate regression is evidenced. Failing on the base but not on the head: `authoringOwnershipGate` (the baselined #1180 case and one unbaselined case) and `editOutputConsistency` (shard 7, cause unknown, possibly flaky).

**`piece2dFill` (#705) causality is uncertain.** It timed out at 30.3 s on the head against a 30 s limit and passed in 25.2 s on the base run; it passes 3/3 locally at the head. The spec is listed among older timing-sensitive cases in `docs/ci-failure-map-run1126.md` and `docs/e2e-suite-audit.md`. `ArtPieceEditor` imports `MentionPromptField` (changed only by an optional ref prop). It is not claimed to be unrelated. The smallest diagnostic would compare its duration and failure rate on CI at the head and the base across several runs, which needs owner approval to dispatch.

## 8. Verdicts

**Issue-level QA (local portion, exact head, with Linux support for the touched specs):**

| Issue | Verdict |
|---|---|
| #1291 | PASS |
| #1293 | PASS |
| #1239 | PASS |
| #1241 | PASS |
| #1180 | PASS |

**Formal batch gate: NOT COMPLETE.** Publishing the QA comments does not complete it. Open items:
1. `session-completion` batch reconciliation has not run.
2. The tracked `docs/tasks.md` ledger and parity entries for the five issues are deferred (see section 10).
3. The pre-code impact matrix does not exist; the owner accepted the retrospective matrix in section 5 for this PR only.
4. The Linux full matrix is red (advisory); 36 of 37 failing cases also fail on the base and `piece2dFill` is uncertain.
5. Stage 3 is optional and was not run.
6. Tier 1 must pass on the final revision, including the documentation commit.

## 9. Remaining requirements

- Merge: requires a separate, explicit owner approval; none exists. The 2026-10-09 `DECISIONS.md` entry does not authorize it.
- Issue closure: not authorized; each issue closes only after its own gate and reconciliation pass.
- Release: blocked on its actual gates: Stage 5 (model policy unresolved), a ratchet-clean full run on the exact release revision, `scripts/smoke-published.sh`, and the required production checks.
- No baselining of failures, ratchet expiry changes or gate waivers are authorized.

## 10. Ledger location

This file is supplementary. The repository's normal ledger is `docs/tasks.md` (see `docs/tasks-index.md` and `docs/process.md`, "Ledger and discovery"). Its entries and the issue/task parity entries for #1291, #1293, #1239, #1241 and #1180 remain required and are deferred only until the owner's uncommitted `docs/tasks.md` edits are reconciled. This file does not replace them.
