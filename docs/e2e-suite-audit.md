# E2E suite audit (241 specs, 536 tests)

Status: PROPOSAL for owner review, generated 2026-10-03 from CI history and static analysis. **Nothing is deleted or changed by this document**; retirements need the owner's explicit approval. Related: #1096, `docs/ci-failure-map-run1126.md`, `docs/process.md` "CI tiers and E2E suite standards".

## Summary

- **Size:** 241 spec files, 536 tests (`npx playwright test --list`), 5 specs run on more than Chromium. Summed test time of a full run is about 90 minutes across 16 shards (not the 327 minutes quoted in older workflow comments).
- **Not flaky, stale:** 70 specs (144 tests, 26%) failed in **all three** full runs analysed (2026-10-01 SHA `ef5771b7`, 2026-10-02 SHA `41e45142`, 2026-10-03 SHA `78ee6c79`); 106 specs passed in all three. Only 10 tests changed status between the last two runs (7 fixed, 3 broken).
- **Young and issue-driven:** every spec was last changed between 2026-08 and 2026-10 (the suite grew in about six weeks); 196 specs carry an issue number in their test titles, so they encode what one issue's UI looked like when it closed.
- **Low reuse of shared helpers:** 49 specs use a shared setup helper; 54 contain at least one legacy-contract signal (legacy AI routes, Gallery-click creation, the sr-only piece-controls shim, `summary` locators, `/projects3d/`). The three largest files are `publishingAndRemix.spec.ts` (1738 lines), `exportArtifacts.spec.ts` and `aiAndRecovery.spec.ts`.
- **Failures are slow:** stale selectors burn the full test timeout (30-186 s); the eight slowest tests in the latest run are all failures (#1191).

## Method and limits

Sources: per-test results and durations parsed from the completed job logs of three full 16-shard runs; `npx playwright test --list`; static regex signals over each spec (geometry/`boundingBox`, pixel/`getImageData`, `toHaveCSS`, exact-copy `getByText`, legacy-contract strings, shared-helper use, viewports, largest `setTimeout`); `git log` last-change date. **Classification is a heuristic by filename and signals, not a reading of every test**; the owner-facing decisions are the groups in "Proposed actions", and a class can be overridden spec by spec. A pass proves a spec agrees with today's UI, not that its contract is right. No run was green, so there is no known-good history to compare against.

Classes: **A** core journey (login, create, save, publish, offline, lifecycle); **B** current contract probe; **C** geometry/pixel probe (three or more geometry/pixel/CSS assertions, or a geometry-oriented name); **D** export or security audit (ZIP/export artifacts, injection, ownership, account deletion, auth policy). **E?** marks a persistently failing spec with legacy-contract signals: a rewrite-or-retire candidate. Classes **F** (duplicated by lower-level tests) was not assigned automatically; it needs a human comparison with the Vitest suite and is listed as an open follow-up.

## Counts by class

| Class | Specs | Tests | Failing in all 3 runs |
|---|---|---|---|
| A core journey | 14 | 52 | 8 specs |
| B current contract | 160 | 319 | 41 specs |
| C geometry/pixel probe | 47 | 105 | 18 specs |
| D export/security audit | 20 | 60 | 3 specs |
| E? rewrite-or-retire candidates (subset of the above) | 20 | 33 | all |

## Findings

1. **The failing set is a coherent backlog, not noise.** The persistently failing specs map to the 26 children of #1096; the signatures are renamed controls, removed routes and menus, local-first Gallery creation, replaced header controls, and moved layout, not timing.
2. **A stable core exists, but half the core journeys are failing.** 106 specs (228 tests) pass in every run. Of the 14 class A core-journey specs, 8 fail in every run (`accountSettings`, `aiAndRecovery`, `authoringWorkflow740`, `localPieceRoundTripPublish`, `manual3dPublicationLifecycle`, `project3dLifecycle`, `publicProfiles`, `unpublishRetention`); the PR gate's four smoke specs are not among them. Class A specs that pass in the two latest runs and are not yet in the PR gate, the natural widening once the gate is stable: `offlineConflictResolution` (15 s), `offlineMediaTransfer` (16 s), `offlineSync` (16 s).
3. **Geometry and pixel probes are the most fragile and the least explained.** Class C specs assert exact ratios, pixel counts and bounding boxes; the failures in this class (stage ratio, toolbar row, panel shadow height, drawing-plane pixels) each needed a decision about the intended contract. Require a recorded rationale and tolerance (standard 3).
4. **Per-issue probes accumulate without retirement.** There is no step that retires a probe when a later issue changes the same surface; the batch impact analysis now searches `frontend/e2e` (standard 4) to close that gap.
5. **Missing: a lower-level safety net decision.** Many class B specs assert copy or labels that a component test could cover in milliseconds; moving them down a level is the main way to shrink the browser suite without losing coverage (class F follow-up).

## Proposed actions (owner decisions marked)

1. **Now:** merge on the PR gate once #1179 is fixed; treat the full matrix as advisory (done in policy; branch protection is owner action #1192).
2. **Ratchet (#1190) and fast-fail timeouts (#1191):** make the advisory run quiet and fast.
3. **Fix the mapped children** (#1160-#1186); each child removes its baseline entries.
4. **Owner decision A:** approve the 20 E? candidates as "rewrite" (default) or "retire" per spec; retirement removes coverage of a journey that may be re-homed in the unified editor.
5. **Owner decision B:** approve the PR-smoke widening (item 2 above) after the PR gate is green for a week.
6. **Follow-up issue (to file after approval):** class F audit comparing class B specs with Vitest coverage, moving copy/label-only assertions down.
7. **Follow-up issue (to file after approval):** a short `README` in `frontend/e2e/` mapping each shared helper to the contract it owns, plus a lint rule or CI check flagging new specs that re-derive helper-owned locators.

## Per-spec table

`Runs` = passed/failed/skipped for 2026-10-03, 2026-10-02, 2026-10-01 runs. `Sig` = geometry/pixel/css/legacy/helper counts. `s` = seconds in the 2026-10-03 run.

| Spec | Tests | Browsers | Class | Runs (10-03 / 10-02 / 10-01) | s | Sig (g/p/c/l/h) | Last change | Proposed action |
|---|---|---|---|---|---|---|---|---|
| `accountSettings` | 4 | chromium | A | 0/4/0 / 0/4/0 / 0/4/0 | 36 | 0/0/0/0/0 | 2026-09-19 | Fix via #1160 |
| `aiAndRecovery` | 7 | chromium | A | 6/1/0 / 6/1/0 / 0/7/0 | 270 | 0/0/0/0/31 | 2026-10-02 | Fix via #1186 |
| `authoringWorkflow740` | 1 | chromium | A | 0/1/0 / 0/1/0 / 0/1/0 | 186 | 0/0/0/0/0 | 2026-09-23 | Fix via #1185 |
| `localPieceRoundTripPublish` | 3 | chromium | A | 0/3/0 / 0/3/0 / 0/3/0 | 53 | 0/0/0/0/0 | 2026-09-28 | Fix via #1174 |
| `manual3dPublicationLifecycle` | 1 | chromium | A | 0/1/0 / 0/1/0 / 0/1/0 | 31 | 1/0/0/2/0 | 2026-09-03 | Fix via #1168 |
| `offlineConflictResolution` | 2 | chromium | A | 2/0/0 / 2/0/0 / 0/2/0 | 15 | 0/0/0/0/0 | 2026-09-30 | Failed in an earlier run, passes now: confirm fixed, no action |
| `offlineMediaTransfer` | 4 | chromium | A | 4/0/0 / 4/0/0 / 0/4/0 | 16 | 0/0/0/0/0 | 2026-09-30 | Failed in an earlier run, passes now: confirm fixed, no action |
| `offlineSync` | 2 | chromium | A | 2/0/0 / 2/0/0 / 0/2/0 | 16 | 0/0/0/0/0 | 2026-09-30 | Failed in an earlier run, passes now: confirm fixed, no action |
| `project3dLifecycle` | 4 | chromium | A | 0/4/0 / 0/4/0 / 0/4/0 | 122 | 1/0/0/14/0 | 2026-09-03 | Fix via #1168, #1170 |
| `projectLifecycle` | 6 | chromium | A | 6/0/0 / 6/0/0 / 2/4/0 | 83 | 3/0/0/0/16 | 2026-10-01 | Failed in an earlier run, passes now: confirm fixed, no action |
| `publicProfiles` | 1 | chromium | A | 0/1/0 / 0/1/0 / 0/1/0 | 6 | 0/0/0/0/0 | 2026-09-19 | Fix via #1164 |
| `publishingAndRemix` | 13 | chromium | A | 13/0/0 / 12/1/0 / 0/10/3 | 239 | 1/1/4/1/25 | 2026-10-02 | Failed in an earlier run, passes now: confirm fixed, no action |
| `responsiveShell` | 3 | chromium | A | 3/0/0 / 3/0/0 / 2/1/0 | 41 | 5/0/3/1/6 | 2026-10-02 | Failed in an earlier run, passes now: confirm fixed, no action |
| `unpublishRetention` | 1 | chromium | A | 0/1/0 / 0/1/0 / 0/1/0 | 30 | 0/0/0/0/0 | 2026-09-28 | Fix via #1168 |
| `accountBilling` | 5 | chromium | B | 5/0/0 / 5/0/0 / 5/0/0 | 20 | 2/0/0/0/0 | 2026-09-18 | Keep (nightly) |
| `accountBillingManagement` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 6 | 0/0/0/0/0 | 2026-09-16 | Keep (nightly) |
| `accountCloudSyncToggle` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 6 | 0/0/0/0/0 | 2026-09-27 | Keep (nightly) |
| `accountDataExport` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 5 | 0/0/0/1/0 | 2026-09-05 | Keep (nightly) |
| `accountEntitlements` | 4 | chromium | B | 4/0/0 / 4/0/0 / 4/0/0 | 11 | 0/0/0/0/0 | 2026-09-18 | Keep (nightly) |
| `accountIdentities` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 6 | 0/0/0/0/0 | 2026-09-16 | Keep (nightly) |
| `accountSessions` | 6 | chromium | B | 6/0/0 / 6/0/0 / 6/0/0 | 24 | 0/0/0/0/0 | 2026-09-18 | Keep (nightly) |
| `accountSettingsLayout` | 2 | chromium | B | 0/2/0 / 0/2/0 / 0/2/0 | 12 | 0/0/0/0/0 | 2026-09-18 | Fix via #1161 |
| `accountSettingsProgressiveDisclosure` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 12 | 0/0/0/0/0 | 2026-09-18 | Keep (nightly) |
| `adminContent` | 2 | chromium | B | 2/0/0 / 2/0/0 / 1/1/0 | 12 | 0/0/0/0/0 | 2026-09-19 | Failed in an earlier run, passes now: confirm fixed, no action |
| `adminEntitlementDowngrade` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 12 | 0/0/0/0/0 | 2026-09-16 | Keep (nightly) |
| `adminNavigation` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 14 | 0/0/0/0/0 | 2026-09-18 | Keep (nightly) |
| `adminPages` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 12 | 0/0/0/0/0 | 2026-09-17 | Keep (nightly) |
| `adminRoster` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 23 | 0/0/0/0/0 | 2026-09-19 | Keep (nightly) |
| `adminThemeGeneration` | 1 | chromium | B | 0/1/0 / 0/1/0 / 1/0/0 | 10 | 0/0/0/0/0 | 2026-09-22 | New or intermittent failure: bisect via #1184 |
| `aframeStructured772` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 20 | 0/1/0/0/0 | 2026-09-24 | Keep (nightly) |
| `ai2dPublication` | 1 | chromium | B/E? | 0/1/0 / 0/1/0 / 0/1/0 | 30 | 2/0/0/4/0 | 2026-09-03 | Rewrite via #1170 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `ai2dResponsive` | 1 | chromium | B/E? | 0/1/0 / 0/1/0 / 0/1/0 | 30 | 1/0/0/2/0 | 2026-09-03 | Rewrite via #1170 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `ai3dStageChrome` | 1 | chromium | B | 1/0/0 / 1/0/0 / 0/1/0 | 9 | 2/0/0/1/2 | 2026-09-30 | Failed in an earlier run, passes now: confirm fixed, no action |
| `aiAgent2d` | 4 | chromium | B | 4/0/0 / 4/0/0 / 0/4/0 | 40 | 0/0/0/0/5 | 2026-10-02 | Failed in an earlier run, passes now: confirm fixed, no action |
| `aiAgent3d` | 4 | chromium | B | 4/0/0 / 4/0/0 / 0/4/0 | 39 | 0/0/0/2/5 | 2026-10-01 | Failed in an earlier run, passes now: confirm fixed, no action |
| `aiAuthoringSixEngine743` | 1 | chromium | B | 0/1/0 / 0/1/0 / 0/1/0 | 186 | 0/0/0/0/0 | 2026-09-23 | Fix via #1171 |
| `aiDecisionReason2d` | 2 | chromium | B | 2/0/0 / 2/0/0 / 0/0/0 | 39 | 2/0/0/0/0 | 2026-10-01 | Keep (nightly) |
| `aiDrawingPlane784` | 4 | chromium | B | 4/0/0 / 4/0/0 / 0/4/0 | 54 | 0/0/0/4/2 | 2026-10-01 | Failed in an earlier run, passes now: confirm fixed, no action |
| `aiIntentNotes` | 1 | chromium | B | 1/0/0 / 1/0/0 / 0/0/0 | 11 | 0/0/0/0/2 | 2026-10-02 | Keep (nightly) |
| `aiLayerTargetExisting` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 11 | 0/1/0/1/0 | 2026-09-26 | Keep (nightly) |
| `aiMediaAssetExistingPiece` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 21 | 0/2/0/1/3 | 2026-09-27 | Keep (nightly) |
| `aiMediaAssetNewPiece` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 19 | 0/1/0/1/3 | 2026-09-27 | Keep (nightly) |
| `aiMention2d` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 16 | 0/0/0/1/0 | 2026-09-26 | Keep (nightly) |
| `aiMention3d` | 2 | chromium | B/E? | 0/2/0 / 0/2/0 / 0/2/0 | 61 | 0/0/0/2/0 | 2026-09-21 | Rewrite via #1170 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `aiPlanReview2d` | 1 | chromium | B/E? | 0/1/0 / 0/1/0 / 0/1/0 | 30 | 0/0/0/1/0 | 2026-09-21 | Rewrite via #1170 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `aiPlanReview3d` | 1 | chromium | B/E? | 0/1/0 / 0/1/0 / 0/1/0 | 30 | 0/0/0/3/0 | 2026-09-21 | Rewrite via #1170 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `aiRegionTargetExisting` | 4 | chromium | B | 3/1/0 / 3/1/0 / 3/1/0 | 43 | 0/0/0/0/0 | 2026-09-27 | Fix via #1171 |
| `artPiece2dEditor` | 1 | chromium | B | 0/1/0 / 0/1/0 / 0/1/0 | 90 | 0/0/0/0/0 | 2026-09-24 | Fix via #1171 |
| `artPiece3dEditor` | 1 | chromium | B | 0/1/0 / 0/1/0 / 0/1/0 | 90 | 0/0/0/0/0 | 2026-09-21 | Fix via #1171 |
| `artPieceCameraRuntime` | 6 | chromium+webkit | B | 2/3/1 / 2/3/1 / 2/3/1 | 25 | 0/0/1/0/0 | 2026-09-08 | Fix via #1166 |
| `artPieceCapabilities` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 30 | 0/0/0/0/0 | 2026-09-19 | Keep (nightly) |
| `artPieceEmbed` | 3 | chromium | B | 3/0/0 / 3/0/0 / 3/0/0 | 13 | 0/0/0/0/0 | 2026-09-24 | Keep (nightly) |
| `artPieceFakeRefinement` | 1 | chromium | B | 0/1/0 / 0/1/0 / 0/1/0 | 120 | 0/0/0/0/0 | 2026-09-21 | Fix via #1171 |
| `artPieceFlatSpatial` | 4 | chromium | B | 4/0/0 / 2/2/0 / 2/2/0 | 19 | 1/0/1/0/0 | 2026-10-02 | Failed in an earlier run, passes now: confirm fixed, no action |
| `artPieceImmersiveCms` | 3 | chromium | B | 3/0/0 / 3/0/0 / 3/0/0 | 14 | 0/0/0/0/0 | 2026-09-26 | Keep (nightly) |
| `artPieceImmersiveCustom` | 4 | chromium | B | 4/0/0 / 4/0/0 / 4/0/0 | 28 | 0/0/0/0/0 | 2026-09-26 | Keep (nightly) |
| `artPieceImmersiveRuntime` | 4 | chromium | B | 4/0/0 / 4/0/0 / 4/0/0 | 29 | 1/0/0/0/0 | 2026-09-29 | Keep (nightly) |
| `artPieceOwnerEditing` | 5 | chromium | B | 5/0/0 / 5/0/0 / 5/0/0 | 43 | 0/0/0/0/0 | 2026-09-29 | Keep (nightly) |
| `artPieceRefine` | 3 | chromium | B | 3/0/0 / 3/0/0 / 3/0/0 | 20 | 0/0/0/0/0 | 2026-09-29 | Keep (nightly) |
| `artPieceSixEngineEmbed` | 1 | chromium | B | 0/1/0 / 0/1/0 / 0/1/0 | 16 | 1/0/0/0/0 | 2026-09-26 | Fix via #1175 |
| `artPieceSixEngineImmersive` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 26 | 1/0/0/0/0 | 2026-09-26 | Keep (nightly) |
| `artPieceSixEngineRegular` | 1 | chromium | B | 0/1/0 / 0/1/0 / 0/1/0 | 25 | 1/0/0/0/0 | 2026-09-28 | Fix via #1175 |
| `artPieceSixEngineThumbnails` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 26 | 0/1/0/0/0 | 2026-09-28 | Keep (nightly) |
| `artPieceSoundRuntime` | 10 | chromium+webkit | B | 9/0/1 / 9/0/1 / 9/0/1 | 63 | 0/0/0/0/0 | 2026-09-29 | Keep (nightly) |
| `artPieceSteeringRuntime` | 8 | chromium+firefox | B | 4/1/3 / 4/1/3 / 4/1/3 | 25 | 0/0/0/0/0 | 2026-09-09 | Fix via #1166 |
| `artPieceSvgCapture` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 8 | 0/0/0/0/0 | 2026-09-05 | Keep (nightly) |
| `artPieceThumbnailCapture` | 3 | chromium | B | 1/2/0 / 1/2/0 / 1/2/0 | 69 | 0/0/0/0/0 | 2026-09-28 | Fix via #1171 |
| `artPieces` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 10 | 0/0/0/0/0 | 2026-09-29 | Keep (nightly) |
| `buildOutputCredentialScan` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 24 | 0/0/0/0/0 | 2026-08-19 | Keep (nightly) |
| `cameraPreview3d` | 1 | chromium | B | 1/0/0 / 1/0/0 / 0/1/0 | 6 | 0/0/0/0/2 | 2026-09-30 | Failed in an earlier run, passes now: confirm fixed, no action |
| `canonicalArtPieceSlug` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 11 | 0/0/0/0/0 | 2026-09-18 | Keep (nightly) |
| `canonicalImmersiveStructuredPiece` | 1 | chromium | B/E? | 0/1/0 / 0/1/0 / 0/1/0 | 11 | 0/0/0/4/0 | 2026-09-20 | Rewrite via #1173 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `canonicalStructuredPieceSlug` | 1 | chromium | B/E? | 0/1/0 / 0/1/0 / 0/1/0 | 12 | 0/0/0/5/0 | 2026-09-20 | Rewrite via #1173 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `capabilityConsistency` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 11 | 0/0/0/0/0 | 2026-09-13 | Keep (nightly) |
| `cardThumbnailArea` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 5 | 2/0/0/0/0 | 2026-09-21 | Keep (nightly) |
| `cloudRetention` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 10 | 0/0/0/0/0 | 2026-09-13 | Keep (nightly) |
| `collectionContext` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 16 | 0/0/0/0/0 | 2026-09-21 | Keep (nightly) |
| `collections` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 26 | 0/0/0/0/0 | 2026-09-21 | Keep (nightly) |
| `collectionsApi` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 10 | 0/0/0/0/0 | 2026-09-16 | Keep (nightly) |
| `drawioPublicSurfaces` | 1 | chromium | B | 1/0/0 / 1/0/0 / 0/0/0 | 11 | 0/0/0/0/2 | 2026-10-01 | Keep (nightly) |
| `editOutputConsistency` | 1 | chromium | B | 0/1/0 / 0/1/0 / 0/0/0 | 14 | 0/0/0/0/0 | 2026-09-21 | New or intermittent failure: bisect via #1171 |
| `embedToolbarOrder` | 1 | chromium | B | 0/1/0 / 0/1/0 / 0/0/0 | 4 | 2/0/0/0/0 | 2026-09-24 | New or intermittent failure: bisect via #1166 |
| `exportConfigDialog` | 4 | chromium | B | 4/0/0 / 4/0/0 / 0/4/0 | 34 | 0/0/0/0/11 | 2026-10-01 | Failed in an earlier run, passes now: confirm fixed, no action |
| `generatedInkControlsLayout` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 6 | 2/0/0/0/0 | 2026-09-27 | Keep (nightly) |
| `headerChrome` | 3 | chromium | B | 0/3/0 / 0/3/0 / 0/3/0 | 28 | 1/0/0/0/0 | 2026-09-21 | Fix via #1172 |
| `headerNav` | 4 | chromium | B | 4/0/0 / 4/0/0 / 4/0/0 | 12 | 0/0/0/0/0 | 2026-09-21 | Keep (nightly) |
| `homeHero` | 2 | chromium | B | 0/2/0 / 0/2/0 / 0/2/0 | 13 | 0/0/1/0/0 | 2026-09-20 | Fix via #1184 |
| `immersive3dRouteParity` | 1 | chromium | B | 1/0/0 / 1/0/0 / 0/1/0 | 21 | 0/0/1/0/2 | 2026-09-30 | Failed in an earlier run, passes now: confirm fixed, no action |
| `immersive3dToolbar769` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 4 | 1/0/0/0/0 | 2026-09-24 | Keep (nightly) |
| `immersiveArtPieceToolset` | 4 | chromium | B/E? | 1/3/0 / 1/3/0 / 1/3/0 | 24 | 1/0/0/1/0 | 2026-09-24 | Rewrite via #1166 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `immersiveCollection` | 2 | chromium | B | 0/2/0 / 0/2/0 / 0/2/0 | 21 | 0/0/0/0/0 | 2026-09-20 | Fix via #1173 |
| `immersiveEmbedFraming` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 23 | 1/0/0/0/0 | 2026-09-24 | Keep (nightly) |
| `inkLayer2d` | 2 | chromium | B | 2/0/0 / 2/0/0 / 0/2/0 | 25 | 1/1/0/0/7 | 2026-10-01 | Failed in an earlier run, passes now: confirm fixed, no action |
| `interactionRuntime` | 3 | chromium | B | 3/0/0 / 3/0/0 / 0/3/0 | 83 | 0/0/0/0/22 | 2026-10-02 | Failed in an earlier run, passes now: confirm fixed, no action |
| `legacy2dToolset` | 1 | chromium | B | 1/0/0 / 1/0/0 / 0/1/0 | 11 | 0/0/0/0/2 | 2026-10-02 | Failed in an earlier run, passes now: confirm fixed, no action |
| `legacy3dToolset` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 6 | 0/0/0/4/0 | 2026-09-21 | Keep (nightly) |
| `livePreview` | 1 | chromium | B | 0/1/0 / 0/1/0 / 0/1/0 | 90 | 0/2/0/0/0 | 2026-09-24 | Fix via #1171 |
| `localFirstCreate2d` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 14 | 0/0/0/0/0 | 2026-09-26 | Keep (nightly) |
| `localFirstCreate3d` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 29 | 1/0/0/0/0 | 2026-09-27 | Keep (nightly) |
| `localFirstCreateGenerated` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 14 | 0/0/0/0/0 | 2026-09-27 | Keep (nightly) |
| `localGalleryCards` | 1 | chromium | B | 0/1/0 / 0/1/0 / 0/1/0 | 10 | 0/0/0/0/0 | 2026-09-30 | Fix via #1181 |
| `localOnlyNetworkAudit` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 5 | 0/0/0/0/0 | 2026-09-27 | Keep (nightly) |
| `localPieceUploadOffer` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 21 | 0/0/0/0/0 | 2026-09-27 | Keep (nightly) |
| `localTemplateCreate` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 18 | 0/0/0/0/0 | 2026-09-26 | Keep (nightly) |
| `localWorkspaceDurableSave` | 6 | chromium | B | 6/0/0 / 6/0/0 / 6/0/0 | 41 | 0/0/0/0/0 | 2026-09-15 | Keep (nightly) |
| `localWorkspaceFolderBridge` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 13 | 0/0/0/0/0 | 2026-09-15 | Keep (nightly) |
| `loginProviderGrouping` | 1 | chromium | B | 1/0/0 / 1/0/0 / 0/0/0 | 1 | 0/0/0/0/0 | 2026-10-01 | Keep (nightly) |
| `manual2dMediaLibrary` | 1 | chromium | B | 1/0/0 / 1/0/0 / 0/1/0 | 6 | 0/0/0/0/2 | 2026-10-01 | Failed in an earlier run, passes now: confirm fixed, no action |
| `manual2dStageChrome` | 6 | chromium+firefox+webkit | B | 6/0/0 / 6/0/0 / 3/3/0 | 28 | 0/0/0/0/2 | 2026-10-01 | Failed in an earlier run, passes now: confirm fixed, no action |
| `manual3dLayoutParity` | 1 | chromium | B/E? | 0/1/0 / 0/1/0 / 0/1/0 | 31 | 1/0/0/2/0 | 2026-09-03 | Rewrite via #1168 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `manual3dOutlineSelection` | 1 | chromium | B | 1/0/0 / 1/0/0 / 0/1/0 | 15 | 1/0/0/1/2 | 2026-09-30 | Failed in an earlier run, passes now: confirm fixed, no action |
| `manualEdit3d` | 1 | chromium | B | 0/1/0 / 0/1/0 / 0/1/0 | 11 | 0/0/0/0/0 | 2026-09-21 | Fix via #1171 |
| `mistralCredential` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 13 | 1/0/0/0/0 | 2026-09-18 | Keep (nightly) |
| `notFound` | 3 | chromium | B | 3/0/0 / 3/0/0 / 3/0/0 | 8 | 0/0/0/0/0 | 2026-09-08 | Keep (nightly) |
| `offlineConflictResolutionLive` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 6 | 0/0/0/0/0 | 2026-09-15 | Keep (nightly) |
| `offlineLiveTransport` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 8 | 0/0/0/0/0 | 2026-09-15 | Keep (nightly) |
| `offlineMediaTransferLive` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 14 | 0/0/0/0/0 | 2026-09-19 | Keep (nightly) |
| `piece3dFill` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 14 | 2/0/0/0/0 | 2026-09-21 | Keep (nightly) |
| `pieceExportLocal2d` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 11 | 0/0/0/0/0 | 2026-09-26 | Keep (nightly) |
| `pieceExportServer2d` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 13 | 0/0/0/1/3 | 2026-09-27 | Keep (nightly) |
| `pieceImport` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 9 | 0/0/0/1/0 | 2026-09-27 | Keep (nightly) |
| `pieceRuntimeErrorTemplate` | 1 | chromium | B | 0/1/0 / 0/1/0 / 0/1/0 | 3 | 0/0/0/0/0 | 2026-09-24 | Fix via #1164 |
| `pieceSlugEdit750` | 2 | chromium | B | 2/0/0 / 2/0/0 / 0/2/0 | 26 | 0/0/0/3/5 | 2026-10-01 | Failed in an earlier run, passes now: confirm fixed, no action |
| `pieceTemplateParity2d` | 1 | chromium | B | 0/1/0 / 0/1/0 / 0/1/0 | 2 | 0/0/0/0/0 | 2026-09-24 | Fix via #1164 |
| `pieceTemplateParity3d` | 1 | chromium | B | 0/1/0 / 0/1/0 / 0/1/0 | 3 | 0/0/0/0/0 | 2026-09-24 | Fix via #1164 |
| `privateCanonicalPiece745` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 17 | 0/0/0/0/0 | 2026-09-23 | Keep (nightly) |
| `privateIntentNote` | 1 | chromium | B | 1/0/0 / 1/0/0 / 0/0/0 | 10 | 2/0/0/0/2 | 2026-10-02 | Keep (nightly) |
| `privatePieceToolbar773` | 3 | chromium | B | 3/0/0 / 3/0/0 / 0/3/0 | 34 | 0/0/0/0/6 | 2026-10-01 | Failed in an earlier run, passes now: confirm fixed, no action |
| `profileAlignment` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 4 | 1/0/0/0/0 | 2026-09-21 | Keep (nightly) |
| `profileFeeds` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 5 | 0/0/1/0/0 | 2026-09-21 | Keep (nightly) |
| `profileHandles` | 2 | chromium | B | 0/2/0 / 0/2/0 / 0/2/0 | 9 | 0/0/0/0/0 | 2026-09-19 | Fix via #1164 |
| `profilePhotoUpload` | 2 | chromium | B | 0/2/0 / 0/2/0 / 0/2/0 | 24 | 0/0/0/0/0 | 2026-09-24 | Fix via #1165 |
| `profilePieceCards` | 4 | chromium | B | 4/0/0 / 4/0/0 / 4/0/0 | 10 | 0/0/2/0/0 | 2026-09-21 | Keep (nightly) |
| `profileStyleInheritance` | 1 | chromium | B | 0/1/0 / 0/1/0 / 0/1/0 | 12 | 0/0/2/0/0 | 2026-09-22 | Fix via #1172 |
| `profileStyles` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 19 | 0/0/0/0/0 | 2026-09-18 | Keep (nightly) |
| `project3dPublicationDiscoverability` | 1 | chromium | B/E? | 0/1/0 / 0/1/0 / 0/1/0 | 30 | 0/0/0/2/0 | 2026-09-03 | Rewrite via #1168 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `project3dSettingsAccordion` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 10 | 2/0/0/3/0 | 2026-09-28 | Keep (nightly) |
| `project3dThumbnailCard` | 2 | chromium | B/E? | 0/2/0 / 0/2/0 / 0/2/0 | 61 | 0/0/0/5/0 | 2026-09-03 | Rewrite via #1168 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `projectActivityHistory` | 1 | chromium | B | 1/0/0 / 1/0/0 / 0/0/0 | 13 | 2/0/0/0/2 | 2026-10-01 | Keep (nightly) |
| `public2dPiecePage737` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 9 | 0/0/0/0/0 | 2026-09-22 | Keep (nightly) |
| `public2dRouteStageChrome` | 1 | chromium | B | 1/0/0 / 1/0/0 / 0/1/0 | 26 | 1/0/1/2/2 | 2026-10-02 | Failed in an earlier run, passes now: confirm fixed, no action |
| `public3dImmersiveInfoArchitecture733` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 9 | 0/0/0/4/0 | 2026-09-24 | Keep (nightly) |
| `public3dInfoArchitecture732` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 10 | 0/0/0/4/0 | 2026-09-22 | Keep (nightly) |
| `public3dMaterialWarnings` | 1 | chromium | B | 1/0/0 / 1/0/0 / 0/1/0 | 12 | 0/0/0/0/2 | 2026-09-30 | Failed in an earlier run, passes now: confirm fixed, no action |
| `public3dProportions` | 1 | chromium | B | 1/0/0 / 1/0/0 / 0/1/0 | 10 | 1/0/0/0/2 | 2026-10-02 | Failed in an earlier run, passes now: confirm fixed, no action |
| `publicArtPieceMobileLayout` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 6 | 2/0/0/0/0 | 2026-09-30 | Keep (nightly) |
| `publicArtPiecePromptOverflow` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 6 | 1/0/0/0/0 | 2026-09-30 | Keep (nightly) |
| `publicArtPieceToolset` | 3 | chromium | B/E? | 0/3/0 / 0/3/0 / 0/3/0 | 23 | 0/0/0/1/0 | 2026-09-24 | Rewrite via #1166 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `publicCollectionDownload` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 14 | 0/0/0/0/0 | 2026-09-24 | Keep (nightly) |
| `publicGalleryCollections` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 12 | 0/0/0/0/0 | 2026-09-20 | Keep (nightly) |
| `publicGalleryEngine` | 2 | chromium | B | 0/2/0 / 0/2/0 / 0/2/0 | 18 | 0/0/0/0/0 | 2026-09-16 | Fix via #1182 |
| `publicGalleryMixedPieces` | 2 | chromium | B/E? | 1/1/0 / 1/1/0 / 1/1/0 | 33 | 0/0/0/6/0 | 2026-09-19 | Rewrite via #1170 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `publicGeneratedArtPiecePage736` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 10 | 0/0/0/0/0 | 2026-09-22 | Keep (nightly) |
| `publicMediaAssets` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 2 | 0/0/0/0/0 | 2026-09-27 | Keep (nightly) |
| `publicMediaAssetsEmbed` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 4 | 0/1/0/1/2 | 2026-09-27 | Keep (nightly) |
| `publicMediaAssetsImmersive` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 4 | 0/0/0/0/2 | 2026-09-28 | Keep (nightly) |
| `publicMediaAssetsRegular` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 6 | 0/0/0/0/2 | 2026-09-27 | Keep (nightly) |
| `publicPieceSurfaceContract744` | 2 | chromium | B | 1/1/0 / 1/1/0 / 1/1/0 | 50 | 0/0/0/0/0 | 2026-09-26 | Fix via #1185 |
| `publicProfileHeader` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 5 | 0/0/0/0/0 | 2026-09-20 | Keep (nightly) |
| `publicProfileSections` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 5 | 0/0/2/0/0 | 2026-09-20 | Keep (nightly) |
| `publicShell` | 2 | chromium | B | 2/0/0 / 0/2/0 / 0/2/0 | 5 | 0/0/1/0/0 | 2026-10-02 | Failed in an earlier run, passes now: confirm fixed, no action |
| `referenceImport` | 1 | chromium | B | 0/0/1 / 0/0/1 / 0/0/1 | 0 | 0/0/0/0/0 | 2026-09-18 | All cases skipped in the latest run: check the skip condition |
| `regularToolbar2d768` | 3 | chromium | B | 3/0/0 / 3/0/0 / 3/0/0 | 15 | 0/0/0/0/0 | 2026-09-24 | Keep (nightly) |
| `regularToolbar3d767` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 5 | 0/0/0/0/0 | 2026-09-24 | Keep (nightly) |
| `savedModels` | 2 | chromium | B | 2/0/0 / 2/0/0 / 0/2/0 | 16 | 0/0/0/0/2 | 2026-10-01 | Failed in an earlier run, passes now: confirm fixed, no action |
| `shareMetadata` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 3 | 0/0/0/0/0 | 2026-09-21 | Keep (nightly) |
| `sonicTelemetry` | 1 | chromium | B | 0/1/0 / 0/1/0 / 0/1/0 | 6 | 0/0/0/0/0 | 2026-09-26 | Fix via #1183 |
| `soundEngine3d` | 1 | chromium | B | 1/0/0 / 1/0/0 / 0/1/0 | 9 | 0/0/0/0/2 | 2026-09-30 | Failed in an earlier run, passes now: confirm fixed, no action |
| `structuredExportSound` | 1 | chromium | B | 1/0/0 / 1/0/0 / 1/0/0 | 8 | 0/0/0/3/0 | 2026-09-25 | Keep (nightly) |
| `themeCustomization` | 1 | chromium | B | 0/1/0 / 0/1/0 / 0/1/0 | 6 | 0/0/0/0/0 | 2026-09-18 | Fix via #1184 |
| `themeToggle` | 2 | chromium | B | 1/1/0 / 1/1/0 / 1/1/0 | 9 | 0/0/0/0/0 | 2026-09-20 | Fix via #1172 |
| `unifiedEditor2d` | 2 | chromium | B | 2/0/0 / 2/0/0 / 2/0/0 | 13 | 0/0/0/1/0 | 2026-09-21 | Keep (nightly) |
| `unifiedEditor3d` | 2 | chromium | B | 2/0/0 / 2/0/0 / 0/2/0 | 12 | 0/0/0/2/0 | 2026-09-30 | Failed in an earlier run, passes now: confirm fixed, no action |
| `versionHistoryCompare` | 1 | chromium | B | 1/0/0 / 1/0/0 / 0/0/0 | 14 | 0/0/0/0/2 | 2026-10-01 | Keep (nightly) |
| `accountComponentStyles` | 1 | chromium | C | 0/1/0 / 0/1/0 / 0/0/0 | 12 | 1/0/24/0/0 | 2026-10-01 | New or intermittent failure: bisect via #1162 |
| `accountPagesDesignParity` | 1 | chromium | C | 1/0/0 / 1/0/0 / 0/0/0 | 19 | 0/0/12/0/0 | 2026-10-01 | Keep (nightly); keep thresholds documented |
| `accountSettingsReorder` | 2 | chromium | C | 1/1/0 / 1/1/0 / 1/1/0 | 15 | 2/0/1/0/0 | 2026-09-21 | Fix via #1161; add tolerance rationale for geometry/pixel thresholds |
| `accountShell` | 1 | chromium | C | 1/0/0 / 1/0/0 / 0/0/0 | 4 | 6/0/0/0/0 | 2026-10-01 | Keep (nightly); keep thresholds documented |
| `accountThemeParity` | 2 | chromium | C | 2/0/0 / 2/0/0 / 0/0/0 | 66 | 0/0/5/0/0 | 2026-10-01 | Keep (nightly); keep thresholds documented |
| `adminSettings` | 7 | chromium | C | 7/0/0 / 6/0/0 / 6/0/0 | 71 | 4/0/1/0/0 | 2026-10-02 | Keep (nightly); keep thresholds documented |
| `aiPanelLayout2d` | 3 | chromium | C/E? | 0/3/0 / 0/3/0 / 0/3/0 | 30 | 4/0/1/1/0 | 2026-09-21 | Rewrite via #1170 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `aiPanelLayout3d` | 3 | chromium | C/E? | 0/3/0 / 0/3/0 / 0/3/0 | 24 | 4/0/1/2/0 | 2026-09-21 | Rewrite via #1170 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `appShellStyle` | 2 | chromium | C | 2/0/0 / 2/0/0 / 2/0/0 | 10 | 0/0/3/0/0 | 2026-09-21 | Keep (nightly); keep thresholds documented |
| `artPieceStudioLayout` | 2 | chromium | C | 2/0/0 / 2/0/0 / 2/0/0 | 10 | 2/0/1/0/0 | 2026-09-30 | Keep (nightly); keep thresholds documented |
| `celestialStyle` | 2 | chromium | C | 1/1/0 / 1/1/0 / 1/1/0 | 10 | 0/0/3/0/0 | 2026-09-20 | Fix via #1172; add tolerance rationale for geometry/pixel thresholds |
| `collectionParityMatrix` | 2 | chromium | C | 2/0/0 / 2/0/0 / 2/0/0 | 14 | 0/0/0/0/0 | 2026-09-24 | Keep (nightly); keep thresholds documented |
| `contentPanelShadow` | 1 | chromium | C | 0/1/0 / 1/0/0 / 0/0/0 | 27 | 1/0/4/0/0 | 2026-10-01 | New or intermittent failure: bisect via #1177 |
| `cosmicBackdropStars` | 4 | chromium | C | 2/2/0 / 2/2/0 / 2/2/0 | 16 | 0/0/5/0/0 | 2026-09-24 | Fix via #1172; add tolerance rationale for geometry/pixel thresholds |
| `designSchemeMatrix` | 1 | chromium | C | 0/1/0 / 0/1/0 / 0/1/0 | 14 | 0/0/0/0/0 | 2026-09-21 | Fix via #1172; add tolerance rationale for geometry/pixel thresholds |
| `drawingPlane3d` | 2 | chromium | C | 1/1/0 / 1/1/0 / 1/1/0 | 19 | 0/3/0/0/0 | 2026-09-24 | Fix via #1178; add tolerance rationale for geometry/pixel thresholds |
| `drawingPlaneAframe796` | 2 | chromium | C | 2/0/0 / 2/0/0 / 0/2/0 | 22 | 3/6/0/1/2 | 2026-09-30 | Failed in an earlier run, passes now: confirm fixed, no action |
| `drawingPlaneDraw3d` | 2 | chromium | C | 2/0/0 / 2/0/0 / 0/2/0 | 22 | 6/1/0/1/2 | 2026-10-01 | Failed in an earlier run, passes now: confirm fixed, no action |
| `drawingPlaneTransform782` | 2 | chromium | C | 2/0/0 / 2/0/0 / 0/2/0 | 29 | 2/4/0/1/2 | 2026-10-01 | Failed in an earlier run, passes now: confirm fixed, no action |
| `drawingPlaneViewers785` | 4 | chromium | C | 4/0/0 / 4/0/0 / 4/0/0 | 60 | 2/2/0/0/0 | 2026-09-24 | Keep (nightly); keep thresholds documented |
| `drawioEditor` | 2 | chromium+firefox | C/E? | 0/2/0 / 0/2/0 / 0/1/0 | 63 | 2/1/0/4/0 | 2026-10-01 | Rewrite via #1166 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `handGestureGuide` | 1 | chromium | C | 1/0/0 / 1/0/0 / 0/1/0 | 12 | 5/0/3/0/2 | 2026-10-02 | Failed in an earlier run, passes now: confirm fixed, no action |
| `headerMobile` | 2 | chromium | C | 2/0/0 / 0/2/0 / 0/2/0 | 4 | 1/0/2/0/0 | 2026-10-02 | Failed in an earlier run, passes now: confirm fixed, no action |
| `inkLayerGenerated2d` | 6 | chromium | C | 6/0/0 / 6/0/0 / 6/0/0 | 66 | 2/1/0/0/0 | 2026-09-24 | Keep (nightly); keep thresholds documented |
| `inlineStageToolbarGeometry` | 2 | chromium | C | 2/0/0 / 2/0/0 / 0/0/0 | 27 | 13/0/7/1/3 | 2026-10-01 | Keep (nightly); keep thresholds documented |
| `inlineStageToolbarGeometry2d` | 2 | chromium | C | 2/0/0 / 2/0/0 / 0/0/0 | 11 | 2/0/9/0/5 | 2026-10-01 | Keep (nightly); keep thresholds documented |
| `layersPanel` | 3 | chromium | C | 2/1/0 / 3/0/0 / 0/3/0 | 32 | 5/0/0/0/20 | 2026-10-02 | New or intermittent failure: bisect via #1185 |
| `manual2dCanvasContainment` | 1 | chromium | C | 1/0/0 / 1/0/0 / 0/1/0 | 11 | 4/0/0/0/5 | 2026-10-01 | Failed in an earlier run, passes now: confirm fixed, no action |
| `manual3dStageChrome` | 1 | chromium | C | 1/0/0 / 1/0/0 / 0/1/0 | 8 | 5/0/8/0/2 | 2026-09-30 | Failed in an earlier run, passes now: confirm fixed, no action |
| `mobile3dAuthoringPanel` | 1 | chromium | C | 1/0/0 / 1/0/0 / 0/0/0 | 10 | 3/0/0/0/2 | 2026-09-30 | Keep (nightly); keep thresholds documented |
| `objectAnimation3d` | 2 | chromium | C | 2/0/0 / 2/0/0 / 2/0/0 | 14 | 0/4/0/0/0 | 2026-09-24 | Keep (nightly); keep thresholds documented |
| `piece2dFill` | 1 | chromium | C | 0/1/0 / 0/1/0 / 0/1/0 | 30 | 3/0/0/0/0 | 2026-09-24 | Fix via #1171; add tolerance rationale for geometry/pixel thresholds |
| `pieceStageSizing` | 1 | chromium | C | 0/1/0 / 0/1/0 / 0/1/0 | 11 | 3/0/1/0/0 | 2026-09-21 | Fix via #1175; add tolerance rationale for geometry/pixel thresholds |
| `pieceToolbarPlacement` | 1 | chromium | C | 0/1/0 / 0/1/0 / 0/1/0 | 5 | 4/0/0/0/0 | 2026-09-21 | Fix via #1175; add tolerance rationale for geometry/pixel thresholds |
| `profileParityMatrix` | 2 | chromium | C | 2/0/0 / 2/0/0 / 2/0/0 | 14 | 0/0/3/0/0 | 2026-09-24 | Keep (nightly); keep thresholds documented |
| `public3dCameraOverlay728` | 1 | chromium | C/E? | 0/1/0 / 0/1/0 / 0/1/0 | 31 | 2/0/4/2/0 | 2026-09-24 | Rewrite via #1169 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `public3dCameraPlacement742` | 1 | chromium | C | 0/1/0 / 0/1/0 / 0/1/0 | 7 | 2/0/2/0/0 | 2026-09-24 | Fix via #1166; add tolerance rationale for geometry/pixel thresholds |
| `public3dImmersiveCameraOverlay734` | 1 | chromium | C/E? | 0/1/0 / 0/1/0 / 0/1/0 | 31 | 3/0/3/2/0 | 2026-09-24 | Rewrite via #1169 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `public3dRouteStageChrome` | 1 | chromium | C | 1/0/0 / 1/0/0 / 0/1/0 | 28 | 4/0/1/3/2 | 2026-09-30 | Failed in an earlier run, passes now: confirm fixed, no action |
| `public3dToolbar730` | 1 | chromium | C/E? | 0/1/0 / 0/1/0 / 0/1/0 | 31 | 3/0/0/2/0 | 2026-09-22 | Rewrite via #1169 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `publicDraw` | 1 | chromium | C | 0/1/0 / 0/1/0 / 0/1/0 | 120 | 1/0/2/0/0 | 2026-09-21 | Fix via #1171; add tolerance rationale for geometry/pixel thresholds |
| `publishedDesignMatrix` | 16 | chromium | C | 0/0/16 / 0/0/16 / 0/0/16 | 0 | 5/0/0/0/0 | 2026-09-21 | All cases skipped in the latest run: check the skip condition |
| `regularToolbarMatrix` | 5 | chromium | C | 1/4/0 / 1/4/0 / 1/4/0 | 15 | 0/0/0/0/0 | 2026-09-24 | Fix via #1166; add tolerance rationale for geometry/pixel thresholds |
| `relatedPublicProjects` | 1 | chromium | C | 0/1/0 / 0/1/0 / 0/0/0 | 32 | 4/0/0/0/2 | 2026-10-01 | New or intermittent failure: bisect via #1174 |
| `spacingAccount` | 1 | chromium | C | 1/0/0 / 1/0/0 / 1/0/0 | 12 | 0/0/5/0/0 | 2026-09-21 | Keep (nightly); keep thresholds documented |
| `spacingAdmin` | 1 | chromium | C | 1/0/0 / 1/0/0 / 1/0/0 | 20 | 4/0/6/0/0 | 2026-09-21 | Keep (nightly); keep thresholds documented |
| `vividDesignMatrix` | 1 | chromium | C/E? | 0/1/0 / 0/1/0 / 0/1/0 | 13 | 2/0/0/1/0 | 2026-09-21 | Rewrite via #1172 (legacy route/menu/helper targets); retire only if the owner judges the journey superseded |
| `accountDataExportZip` | 1 | chromium | D | 1/0/0 / 1/0/0 / 1/0/0 | 3 | 0/0/0/0/0 | 2026-09-28 | Keep (export/security tier) |
| `accountDeletion` | 5 | chromium | D | 5/0/0 / 5/0/0 / 5/0/0 | 19 | 0/0/0/0/0 | 2026-10-01 | Keep (export/security tier) |
| `accountSecurityFlows` | 2 | chromium | D | 2/0/0 / 2/0/0 / 2/0/0 | 9 | 0/0/0/0/0 | 2026-09-16 | Keep (export/security tier) |
| `artPieceFlatZip` | 1 | chromium | D | 1/0/0 / 1/0/0 / 1/0/0 | 4 | 0/0/0/0/0 | 2026-09-24 | Keep (export/security tier) |
| `artPieceFullZipRuntime` | 2 | chromium | D | 2/0/0 / 2/0/0 / 2/0/0 | 9 | 0/0/0/0/0 | 2026-09-24 | Keep (export/security tier) |
| `artPieceGeneratedPackageExport` | 2 | chromium | D | 2/0/0 / 2/0/0 / 2/0/0 | 7 | 0/0/0/0/0 | 2026-09-27 | Keep (export/security tier) |
| `artPieceImmersiveZip` | 3 | chromium | D | 3/0/0 / 3/0/0 / 3/0/0 | 19 | 0/0/0/0/0 | 2026-09-24 | Keep (export/security tier) |
| `artPieceNonCameraZip` | 2 | chromium | D | 2/0/0 / 2/0/0 / 2/0/0 | 11 | 0/1/0/0/0 | 2026-09-24 | Keep (export/security tier) |
| `artPieceSixEngineZip` | 1 | chromium | D | 1/0/0 / 0/1/0 / 1/0/0 | 35 | 0/0/0/0/0 | 2026-09-26 | Failed in an earlier run, passes now: confirm fixed, no action |
| `artPieceZipDrawing757` | 1 | chromium | D | 1/0/0 / 1/0/0 / 1/0/0 | 14 | 1/2/0/0/0 | 2026-09-24 | Keep (export/security tier) |
| `authPolicy` | 2 | chromium | D | 0/2/0 / 0/2/0 / 2/0/0 | 10 | 0/0/2/0/0 | 2026-09-13 | New or intermittent failure: bisect via #1179 |
| `authoringOwnershipGate` | 3 | chromium | D | 1/2/0 / 1/2/0 / 1/2/0 | 34 | 0/0/0/13/0 | 2026-09-05 | Fix via #1180 |
| `c2ZipCanvas764` | 1 | chromium | D | 1/0/0 / 1/0/0 / 1/0/0 | 14 | 1/1/0/0/0 | 2026-09-24 | Keep (export/security tier) |
| `c2ZipRuntime760` | 1 | chromium | D | 1/0/0 / 1/0/0 / 1/0/0 | 8 | 0/1/0/0/0 | 2026-09-24 | Keep (export/security tier) |
| `drawingPlaneZip787` | 4 | chromium | D | 4/0/0 / 4/0/0 / 0/2/0 | 49 | 0/1/0/1/2 | 2026-09-30 | Failed in an earlier run, passes now: confirm fixed, no action |
| `exportArtifacts` | 10 | chromium | D | 9/1/0 / 9/1/0 / 0/0/0 | 4 | 4/0/5/2/0 | 2026-09-24 | New or intermittent failure: bisect via #1176 |
| `injectionArtifacts` | 8 | chromium | D | 3/5/0 / 3/5/0 / 3/5/0 | 1 | 0/0/0/0/0 | 2026-09-08 | Fix via #1163 |
| `offlineOwnershipRecovery` | 8 | chromium | D | 8/0/0 / 8/0/0 / 6/2/0 | 59 | 0/0/0/0/0 | 2026-09-30 | Failed in an earlier run, passes now: confirm fixed, no action |
| `project3dServerPackageExport` | 2 | chromium | D | 0/2/0 / 0/2/0 / 0/2/0 | 61 | 0/0/0/6/0 | 2026-09-27 | Fix via #1168 |
| `publicMediaAssetsZip` | 1 | chromium | D | 1/0/0 / 1/0/0 / 1/0/0 | 3 | 0/0/0/0/2 | 2026-09-28 | Keep (export/security tier) |
