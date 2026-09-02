# Authored-piece parity distillation — 2026-09-02 re-audit

Project: `ai-dev-tools-zoomcamp-1`; behavioral reference:
`../augment-humankind/docs/piece-surface-parity.md`.

## Distillation gate

No product source or product-test changes are authorized during this audit.
Every implementation or verification issue must have one entry point, one
fixture/precondition, finite named controls/states, exact agent-runnable
checks, explicit N/A decisions, and one evidence boundary. Completion means
GitHub closure after QA; local implementation, green tests, or a shared
component never close a deployed route.

## Current authoritative evidence

- The checkout and `origin/main` contain `PieceStageToolbar` consumers in the
  2D and 3D editor/public surfaces. The published Replit commit `050fe8e`
  descends from `d142430`, so the earlier “not pushed” explanation is stale.
- Fresh anonymous inspection of the supplied public fixture
  `https://animate.creatrweb.com/p/7b2ecd2b-0a46-4031-b4a2-bb6b9cd74df2`
  renders a visible `Piece actions` toolbar at non-zero bounds with
  screenshot, download, Piece controls, and fullscreen. Asset:
  `assets/index-CKhsUQOh.js`.
- Fresh inspection of the supplied editor URL
  `https://animate.creatrweb.com/projects3d/f3863d2f-d3a5-41ad-9883-7b8441af6217`
  is anonymous and returns “This project doesn't exist, or you don't have
  access to it.” It proves neither presence nor absence of editor controls.
- The public gallery currently exposes only the 2D fixture. The corresponding
  `/p3d/<id>` and `/embed/p3d/<id>` targets have no published 3D fixture.
- Production Full and Non-Camera 2D downloads were captured as standalone
  HTML, but the approved in-app browser rejects `file://` navigation. Static
  inspection is therefore not artifact execution evidence.
- The PHP reference requires stage-associated compact controls, capability-
  driven sound/camera/hand behavior, privacy-safe permission timing, and
  working downloaded runtimes. The React 2D capability contract currently
  sets `sound: false`; this is a confirmed parity question requiring an
  explicit product decision or implementation task, not an implicit N/A.

## Complete manifest and order

| Issue | Entry/scope | Dependencies | Status | Exact next action |
| --- | --- | --- | --- | --- |
| #320 | Parent authored-piece reconciliation | all children | open roll-up | reconcile only after children pass |
| #346 | Shared structured 2D sound capability | #320; existing audio foundation | open / newly filed | groom and engineer only after this distillation exits |
| #325 | authenticated manual 2D `/projects/:id` | owner browser access | open | verify stage-local authoring/runtime/publication controls |
| #326 | authenticated AI 2D `/ai-projects/:id` | owner browser access | open | verify stage-local AI/publication controls |
| #327 | authenticated manual 3D `/projects3d/:id` | owner browser + 3D fixture | open | verify exact editor route and status transitions |
| #328 | authenticated AI 3D `/ai-projects3d/:id` | owner browser + 3D fixture | closed | deployed route, focused tests, browser QA, and Draft restoration recorded |
| #329 | anonymous public 2D `/p/:id` | published 2D fixture | reopened / disputed | reconcile user-visible conflict at exact URL/viewport/cache |
| #330 | anonymous public 3D `/p3d/:id` | published 3D fixture | closed | deployed anonymous controls/privacy and local browser QA recorded |
| #331 | anonymous 2D `/embed/p/:id` | published 2D fixture | reopened / disputed | reconcile user-visible conflict independently |
| #332 | anonymous 3D `/embed/p3d/:id` | published 3D fixture | closed | deployed chrome-less embed and local browser QA recorded |
| #333 | regular immersive 3D | published 3D fixture | closed | deployed route, controls/privacy, and local browser QA recorded |
| #334 | custom immersive `?embed=1` | published 3D fixture | closed | deployed chrome-less query variant and local browser QA recorded |
| #335 | CMS immersive `?embed=1&cms=1` | published 3D fixture | closed | deployed chrome-less CMS variant and local browser QA recorded |
| #335 | CMS immersive `?embed=1&cms=1` | published 3D fixture | dependency-blocked | verify exact query variant after fixture |
| #336 | extracted standalone 2D artifact | approved file-capable browser | blocked | execute captured Full/Non-Camera files |
| #337 | extracted Full/Non-Camera 3D artifacts | published 3D fixture + file browser | dependency-blocked | download, extract, execute both variants |
| #295 | five-slide 3D hand guide | published 3D fixture | closed | deployed guide, focused tests, and route QA recorded |
| #342 | independent 3D camera view | published 3D consumer | dependency-blocked | verify exact deployed consumer |
| #344 | 3D hand Move/strafe | published 3D + physical/manual camera | dependency-blocked | run movement evidence and guide consistency |

Local-only closed records #338–#341, #343, and #345 remain historical
implementation prerequisites. They do not satisfy the open route/artifact
contracts above and are not reopened unless their own explicit local scope is
found false. Historical umbrellas #274/#323/#324 remain non-implementation
containers. #321 is closed and is not a duplicate deployment task.

## Confirmed gap definitions

1. Public 2D user-visible discrepancy (#329): one fresh browser sees the
   toolbar while the owner reports no controls. Pass requires exact URL,
   viewport/cache/device evidence, non-zero visible control bounds, and
   functional named actions; fail must identify the differing asset or CSS/
   runtime condition. `publishingAndRemix.spec.ts` is supplementary local
   evidence only.
2. Embedded 2D discrepancy (#331): same finite contract and fixture as the
   chrome-less `/embed/p/:id` entry, independently checked for absent site
   chrome and visible stage controls.
3. Authenticated editor parity (#325–#328): each route gets its own owner
   fixture and browser transaction. The finite checklist includes exact
   stage-local runtime controls, authoring/AI actions, Draft → Published →
   Draft, no duplicate page-level bulky action row, and rendered containment.
4. 3D publication dependency (#330–#335, #337, #295, #342, #344): no local
   or anonymous evidence can close a route without a published 3D fixture.
5. Download execution (#336/#337): static HTML markers and download clicks do
   not prove parity; extracted Full and Non-Camera artifacts must be opened
   and controls exercised in an approved browser.
6. 2D sound capability: PHP parity offers capability-driven sound controls;
   React currently declares 2D sound unavailable. Groom either a finite
   2D sound implementation slice or a documented product decision that the
   structured 2D contract is intentionally silent. Do not silently mark it
   N/A.

## Duplicate and coverage report

- #320 owns roll-up reconciliation; it is not an implementation issue.
- #325–#337 already cover each route/artifact independently; no new route
  issue is warranted.
- #338–#341 cover local implementation only; they do not duplicate deployed
  verification. #295/#342/#344 cover shared 3D capabilities.
- #306/#343/#345 are narrow local prerequisites and cannot prove consumer
  parity. #321 covers Compose identity. No duplicate issue is created in this
  distillation pass. #346 is the only newly discovered implementation gap:
  the existing 2D capability declaration explicitly disables sound while the
  PHP contract makes it capability-driven.

## Blocker triage and handoff

- Missing published 3D fixture: `dependency-blocked` / deployment boundary;
  owner is publication environment; next action is to publish one fixture.
- Anonymous editor access: `verification-boundary`; owner is the authenticated
  browser session; next action is an approved owner-authenticated inspection.
- `file://` browser policy: `verification-boundary`; owner/context is the
  approved browser capability; next action is an approved Chromium context.
- User report versus fresh public DOM: unresolved evidence conflict, not a
  product pass or fail. Keep #329/#331 open until reconciled.

## Re-audit after authenticated Chrome verification — 2026-09-02

The connected owner Chrome session verified the exact private 3D editor's
stage-local screenshot, download, sound, Piece controls, steering, guide,
fullscreen, camera-view, and Draft → Published → Draft controls. Camera
activation and safe stop were verified after the owner authorized that flow;
the five guide steps were advanced end-to-end.

This is not complete parity evidence: the deployed editor still reports zero
`View immersive piece` links, while the reviewed checkout contains that wiring
in `4f912c9`. The evidence handoff is `28ece99`, and local Docker-backed
`manual3dStageChrome.spec.ts` passes 1/1. #327 remains open as a
deployment/revision handoff. Its exact next action is authorized push,
republish, and recheck of the exact route before closure.

The supplied public 2D route was independently rechecked in the same Chrome
session and showed non-zero stage-local controls and functional screenshot,
Full/Non-Camera downloads, Piece controls, and fullscreen. This route-specific
evidence does not transfer to 3D or extracted artifacts; #336 remains open
because the captured standalone files have not been executed in an approved
file-capable browser.

No new issue or further decomposition is warranted. #327 owns the
authenticated manual 3D route, #329 the public 2D route, and #336 the extracted
2D artifact. The remaining route and artifact issues retain their own
dependencies and closure contracts.

## Independent editor-route handoffs — 2026-09-02

#325's exact authenticated `/projects/:id` route passed live layout/control
inspection, focused `EditorWorkspace` tests 30/30, full `make check`, and
Docker-backed route QA 1/1. It remains open because its already-Published
fixture was not toggled to Draft: the available user authorization covered
only the temporary 3D publication flow.

#326's exact authenticated `/ai-projects/:id` route passed Docker-backed
`ai2dPublication.spec.ts` 1/1 and live inspection of the route-local AI
region plus the compact Piece actions toolbar. It remains open for the same
unperformed live publication transition boundary. These are independent
handoffs; neither is closed from local evidence or from the other route.

## Distillation exit

The manifest is complete, duplicates are reconciled, every actionable gap is
linked to an existing issue, and no product change is authorized yet. The next
phase may begin only with exactly one groomed issue after the access/fixture
boundary is resolved; engineering and QA must then finish and close that issue
before the next one begins.
