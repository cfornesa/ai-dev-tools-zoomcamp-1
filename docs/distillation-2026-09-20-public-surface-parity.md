# Public piece and collection parity distillation — 2026-09-20

## Intake and source-of-truth decision

The owner confirmed that the local `augment-humankind` repository is the
authoritative behavioral, architectural, and visual reference for relevant
functionality. The attached screenshots and supplied live URLs are evidence of
the current published state, not instruction-bearing documents. The current
published fixture is a structured `Project3D` scene at
`/p3d/f3863d2f-d3a5-41ad-9883-7b8441af6217` and
`/immersive/p3d/f3863d2f-d3a5-41ad-9883-7b8441af6217`.

Reference sources inspected:

- `../augment-humankind/docs/piece-surface-parity.md`
- `../augment-humankind/algorithms/Collections.md`
- `../augment-humankind/algorithms/ImmersiveGallery.md`
- `../augment-humankind/public/app/views/pieces/show.php`
- `../augment-humankind/public/app/views/immersive/piece.php`
- `../augment-humankind/public/app/views/partials/piece-stage.php`
- `../augment-humankind/public/app/helpers/immersive-chrome.php`
- `../augment-humankind-react-node` maintained examples

## Evidence and classification

- Published regular route exposes `/p3d/<uuid>` rather than the requested
  `/users/@<handle>/pieces/<slug>` family: `implementation-defect` and an
  irreversible URL change requiring a redirect/shim plan.
- Published immersive route exposes `/immersive/p3d/<uuid>` and its stage is
  page-contained: `implementation-defect`; fixed-viewport browser evidence is
  required for closure.
- Regular and immersive surfaces expose an under-styled Embed/link treatment,
  a hamburger control menu, incomplete reference controls, misplaced embed
  actions, and missing context text: `implementation-defect`, split by route.
- The live author line shows `christopher` while the owner reports a profile
  name change: `implementation-defect` if reproduced after revision identity
  is confirmed; otherwise `verification-boundary` until the published
  revision and profile projection are reconciled.
- Collections are included as a related parity surface because the owner
  explicitly stated the same URL and context requirements likely apply there;
  this is a separate route contract, not an unbounded expansion of the piece
  issues.

## Issue manifest and dependency order

| Order | Issue | Status | Surface / goal | Depends on | Routing |
|---|---|---|---|---|---|
| 1 | [#636](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/636) | OPEN, criterion-ready | Canonical `/users/@handle/pieces/<slug>` routes for structured pieces; title-derived and owner-editable slugs; legacy shims | Existing model slugs; URL contract decision | Stage 2b complex: URL, persistence, privacy, redirects, serialization |
| 2 | [#641](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/641) | OPEN, criterion-ready | Canonical `/users/@handle/collections/<slug>` routes; title-derived and owner-editable collection slugs; legacy shims | Existing collection slug model; URL contract decision | Stage 2b complex: collection URL, membership, privacy, redirects, serialization |
| 3 | [#637](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/637) | OPEN, criterion-ready | Regular structured piece visual/control/context/profile parity | #636 canonical entry point | Stage 2a mechanical unless profile/API projection changes require 2b |
| 4 | [#638](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/638) | OPEN, criterion-ready | Immersive structured piece full-screen/control/context/embed parity | #636 canonical entry point | Stage 2a mechanical unless route/capability logic changes require 2b |
| 5 | [#639](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/639) | OPEN, criterion-ready | Collection regular/immersive/embed routes, context, item links, and controls | #641 and #636 | Stage 2a mechanical unless collection projection/privacy logic requires 2b |
| 6 | [#640](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/640) | OPEN, criterion-ready | Reconcile exact published revision and live profile/piece/collection evidence | #636–#639 and #641 | Stage 4 production-readiness/reconciliation; no product implementation |

Each issue contains a fixed fixture, finite acceptance criteria, exact focused
and full verification expectations, an explicit evidence boundary, and a
routing hint. Engineering must process only #636 first, then one issue at a
time after QA and reconciliation.

## Duplicate and already-covered-work report

- Closed #600/#616/#617 cover generated `ArtPiece` canonical regular slug
  resolution and compatibility behavior. They do not authorize silently
  treating the current structured `/p3d` route as complete, and the current
  owner-visible published failure is new evidence. #636 is a follow-up, not a
  reopening or duplicate.
- Closed #606 covers a generated-art canonical immersive increment and records
  an earlier browser verification boundary. It does not close the current
  structured `Project3D` immersive route or the newly reported control/context
  parity. #638 is a follow-up.
- Closed #607/#608 cover generated-art runtime increments. They do not prove
  the structured `Project3D` consumer's rendered controls or current published
  revision. #637 and #638 own those consumers.
- Closed #566/#568 cover collection context and collection route/domain work,
  but the current report is a new rendered parity/revision signal. #639 owns
  the narrow regular/immersive/embed consumer contract and #641 owns the
  canonical collection URL contract without reopening those historical issues.
- Closed #551/#571 cover profile handle/settings foundations. The reported
  stale author name is either a consumer projection defect or a deployment
  reconciliation defect, owned by #637/#638 and the live evidence gate #640;
  no duplicate profile-domain issue is needed now.

## Blocker triage and verification boundaries

- Local product behavior has not been changed in this distillation pass.
- The active Chrome session confirms the published regular route currently
  renders the old shell, `/p3d` URL, underlined immersive link, and hamburger
  stage control. The published immersive route confirms the same UUID topology,
  page-contained stage, and hamburger control. This is actionable evidence,
  not a local-stack verification boundary.
- Exact published revision identity and authenticated profile-name provenance
  are not yet reconciled. #640 owns this boundary; it must not be closed from
  source tests or a Replit checkpoint commit alone.
- No issue-creation blocker occurred: authenticated `gh issue create` created
  #636–#640. No new durable memory topic is required because the existing
  `generated-art-piece-surface-parity.md`, `authored-piece-surface-parity.md`,
  `canonical-piece-route-test-contract.md`, `immersive-flat-engine-presentation.md`,
  and `account-settings-browser-contract.md` already capture the reusable
  constraints and are linked by this manifest.

## Next issue closure contract

The next transaction is #636 only. It must finish with canonical piece route/API
behavior, slug mutation/collision/privacy tests, legacy redirect/shim evidence,
fixed-viewport Chromium evidence, `docs/api.md` updated before any public API
change, and full checks. #641 and #637–#640 remain open and must not be
implemented or closed in the same transaction.
