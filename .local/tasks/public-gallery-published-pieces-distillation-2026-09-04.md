# Owner-reported authored-piece parity distillation — 2026-09-03

## Request and classification

Owner report: thumbnails do not reflect 3D artwork; 3D private/public
controls are not discoverable; 2D/3D layer selection cannot be clearly
deselected; and 2D/3D editor canvases overlap surrounding content.

Classification: six `implementation-defect` candidates, each requiring its
own route/capability contract. The `/gallery` route lists only structured 2D
`Project` rows; 3D thumbnail/card, publication discoverability, selection,
and rendered layout have separate owner-visible boundaries. The separate
generated-art gallery is not the same surface.

## Evidence

- `frontend/src/pages/PublicGallery.tsx` renders `listPublicGallery()`.
- `frontend/src/api/projects.ts` maps that call to `/api/public/projects/`.
- `backend/scenes/gallery.py` and `PublicProjectListView` query only `Project`.
- `frontend/src/api/projects3d.ts` has publish/detail calls but no public list call; `backend/scenes/api3d.py` has public detail but no list view.
- `frontend/src/App.tsx` links the header's Public gallery to `/gallery`.
- `frontend/src/pages/PublicArtPieceGallery.tsx` is a separate direct route at `/art-pieces/gallery`, not the header gallery.

## Issue manifest

| Issue | Surface/goal | Status | Dependency/order | Duplicate or coverage result |
|---|---|---|---|---|
| [#46](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/46) | Original 2D public gallery | closed/completed | Historical prerequisite | Already covered 2D-only contract; immutable |
| [#134](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/134) | Existing-project thumbnail backfill | closed/completed | Independent | Not the listing omission; no duplicate |
| [#296](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/296) | 3D publish/public viewer/embed | closed/completed | Historical prerequisite | Explicitly deferred 3D gallery listing; follow-up warranted |
| [#315](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/315) | Generated `ArtPiece` management/public gallery/viewer | closed/completed | Separate domain | Not the `/gallery` structured-piece route |
| [#319](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/319) | Generated-art browser/privacy reconciliation | closed/completed | Separate domain | Not a duplicate |
| [#320](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/320) | Authored-piece parity reconciliation container | closed/completed | Historical parent | No gallery-listing child; immutable |
| [#324](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/324) | Deployed authored route reconciliation container | closed/completed | Historical parent | No `/gallery` mixed-list contract; immutable |
| [#392](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/392) | Mixed published 2D/3D authored-piece `/gallery` listing | open/PROPOSED | Next independent transaction | New criterion-ready issue |
| [#393](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/393) | Actual current-scene 3D gallery thumbnails | open/PROPOSED | After #392 or independent | New post-#243 owner-visible follow-up |
| [#394](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/394) | Discoverable 3D private/public controls | open/PROPOSED | Independent after #392 | New post-#296/#376 discoverability follow-up |
| [#395](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/395) | Clearable 2D layer selection | open/PROPOSED | Independent | New post-#152/#183 interaction follow-up |
| [#396](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/396) | Clearable 3D outline/layer-equivalent selection | open/PROPOSED | Independent | New 3D selection boundary; no closed issue reopened |
| [#397](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/397) | Contained 2D Preview canvas | open/PROPOSED | Independent; reference for #398 | New post-#325/#338 rendered-layout follow-up |
| [#398](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/398) | Non-overlapping responsive 3D editor parity layout | open/PROPOSED | Independent; informed by #397 | New post-#304/#377 rendered-layout follow-up |

## Criterion-ready handoffs

Issues #393–#398 each have complete closure contracts in their GitHub issue
bodies: one route/capability, fixed fixture and viewports, finite criteria,
exact checks, evidence boundary, and explicit out-of-scope links. The next
and only engineering handoff is #392 below.

### #392 — next handoff

Entry point: anonymous `/gallery` at 1280x900 and 375x812.

Fixed fixtures: one published, non-deleted, current-version 2D `Project` and
one published, non-deleted, current-version 3D `Project3D`; private, draft,
archived, and deleted exclusion fixtures should also be used where the
harness supports them. Restore every fixture to its original state.

Finite criteria: mixed 2D/3D cards appear; each card contains only approved
public fields and a safe thumbnail; card links target `/p/:id` or `/p3d/:id`;
ordering and pagination are deterministic without duplicates/skips;
unpublish removes a card on the next request; anonymous and signed-in lists
match; loading, empty, error, thumbnail-failure, and pagination-end states
remain accessible and recoverable; fixed-viewport browser screenshots and
interactions are inspected.

Exact checks: `uv run pytest tests/test_public_gallery_api.py
tests/test_project3d_publish_api.py` from `backend/`; `npm test -- --run
src/pages/PublicGallery.test.tsx src/pages/PublicGallery.a11y.test.tsx` from
`frontend/`; `BROWSER_QA_E2E_SPEC=e2e/publicGalleryMixedPieces.spec.ts make
browser-qa`; then `make check`.

Evidence boundary: only the anonymous `/gallery` mixed structured-piece list
is in scope. Generated `/art-pieces/gallery`, viewer controls, gesture/camera
behavior, embeds, immersive routes, and artifacts are excluded.

## Blockers and follow-up triage

- No environment blocker was found for backlog definition.
- Deployment publication is not required to define the issue; exact deployed
  verification is a later QA criterion. If the browser harness or deployment
  is unavailable, classify it as `verification-boundary` or
  `workflow/infrastructure-defect`, record owner/next action, and do not
  close #392 on local unit tests alone.
- No separate follow-up issue is created for generated `ArtPiece` listing;
  that is duplicate/already-covered work under #315/#319 and a separate
  route. No closed issue is reopened.

## #392 transaction ledger — 2026-09-03

State: `ENGINEERING/QA → BLOCKED`

- Commit: `c2cc1c8` — mixed public 2D/3D gallery API, safe card payloads,
  renderer-aware links, frontend regression coverage, and browser spec.
- Focused: backend 33 passed; frontend gallery/accessibility 18 passed;
  backend lint/typecheck and frontend typecheck/lint passed.
- Full relevant checks: frontend 2,407 tests passed and production build
  passed. `make check` reached 887 passed/22 skipped but had five unrelated
  macOS sandbox failures in git socket binding and startup subprocess tests;
  frontend format-check also reports four pre-existing unformatted E2E files.
- Browser QA: `BROWSER_QA_E2E_SPEC=e2e/publicGalleryMixedPieces.spec.ts
  make browser-qa` was attempted and stopped before provisioning because the
  Docker daemon is unavailable. This is a verification-boundary/workflow
  blocker, not a gallery test result.
- GitHub QA comment: pending this reconciliation call; #392 stays open.
- Evidence boundary: local implementation only; not deployed or browser-
  verified.

Next action: rerun the exact browser runner with Docker available, inspect
the fixed desktop/mobile evidence, and close #392 only if every criterion
passes. Do not start #393–#398 engineering before #392 reaches a terminal
status.

## #393 transaction ledger — 2026-09-03

State: `ENGINEERING/QA → BLOCKED`

- Commits: `85c39d4`, `41acbc5` — explicit fallback metadata, fallback
  regeneration on owner detail/thumbnail access, card retry/retry-error UI,
  and 4:3 320x240 3D card framing.
- Focused: backend thumbnail/API suite 28 passed; frontend 3D card suite 11
  passed; frontend typecheck/lint and targeted formatting passed.
- Full relevant checks: `make check` reached 888 passed/22 skipped but had
  the same five unrelated macOS sandbox failures in git socket binding and
  startup subprocess tests. These are classified as a host verification
  boundary, not a thumbnail regression.
- Browser QA: the required
  `BROWSER_QA_E2E_SPEC=e2e/project3dThumbnailCard.spec.ts make browser-qa`
  was attempted and stopped before setup because Docker is unavailable.
- GitHub QA comment: pending this reconciliation call; #393 stays open.
- Evidence boundary: implementation is local only; deployed owner-card and
  fixed-viewport visual evidence remain unverified.

Next action: with Docker or an equivalent disposable PostgreSQL browser
runner available, execute the exact browser spec, inspect both card images,
then close #393 only if every criterion passes. Per the owner's instruction,
stop after this reconciliation and do not start #394–#398.
