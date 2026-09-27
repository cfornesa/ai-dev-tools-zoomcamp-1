## QA: PASS

The parent contract is reconciled by the implementation checks and its two
dedicated browser scenarios.

| Criterion | Result | Evidence |
|---|---|---|
| Library target options and metadata-only request | PASS | Focused `aiTargeting`, `useAIRun`, and mention-field tests cover placed/unplaced metadata, keyboard selection, stable IDs, and no blob bytes. |
| Candidate/accept/reject and resolver-backed rendering | PASS | #924 passed desktop/mobile Chromium with candidate and accepted screenshots; the accepted canvas contains visible fixture pixels. `AIProposalPanel` focused tests cover Reject without accept. |
| Existing-piece preservation, restore, and mixed-target boundary | PASS | #925 passed desktop/mobile Chromium with deep layer equality, untouched pixel equality, visible asset pixels, exact restore equality, and a prompt asking for an asset plus `@Hills` that leaves Hills unchanged. |
| Undo/version behavior | PASS | Focused EditorWorkspace/useSceneEditor tests cover one-step undo; #924/#925 API assertions verify the accepted version increment and restore path. |
| Keyboard/mobile usability and fallback | PASS | Existing focused listbox/renderer tests cover keyboard interaction and missing/undecodable fallback; #924/#925 inspected 1280x900 and 375x812 screenshots. |

Exact browser commands:

```text
E2E_DOCKER_COMPOSE=true npx playwright test e2e/aiMediaAssetNewPiece.spec.ts --project=chromium — 2 passed
E2E_DOCKER_COMPOSE=true npx playwright test e2e/aiMediaAssetExistingPiece.spec.ts --project=chromium — 2 passed
```

`make check` passed after the browser fixes. Evidence is local disposable Compose plus approved host-level Chromium only; no deployed URL or production database evidence is claimed. Implementation commit: `175a8eb0`; resolver fix: `51105db8`; browser coverage: `79842414`, `cfbeab2e`.
