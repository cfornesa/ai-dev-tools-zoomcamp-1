# Authored-piece parity distillation manifest

Date: 2026-09-03  
Project: `cfornesa/ai-dev-tools-zoomcamp-1`  
Status: DISTILLATION COMPLETE — #348 is the sole current handoff and remains
open pending publication/review; no later issue may begin before its closure.

## Current-state evidence

- The exact authenticated editor URL currently serves
  `assets/index-WKdMIR98.js`, not the latest reviewed source revision
  (`0f5834b`, containing code revision `51e27b8`). At `375x812`, authenticated
  Chrome shows the stage hamburger and, after opening it, named Screenshot,
  Download, Immersive, Sound, Piece controls, Steer, Guide, Draft/Published,
  Save, AI, and Fullscreen affordances. This disproves “no controls exist” for
  that exact route/state, but does not prove the requested final authoring
  layout because the deployed bundle predates the latest #348 correction.
- The exact public URL currently serves the same asset. Its closed page shows a
  stage hamburger; opening it renders Screenshot, Download, Piece controls,
  and Fullscreen in a full-viewport translucent overlay. Piece controls then
  exposes the camera and demo disclosures. Public absence of editor-only
  Draft/Published/Save/AI controls is correct privacy behavior. This proves
  the controls are discoverable through the requested entry point, but does not
  prove downloaded-runtime behavior or every public/embed/immersive surface.
- At `375x812`, the authenticated editor has no document horizontal overflow,
  but the live overlay still reflects the older action composition. At the
  current default public viewport the document width is 1265px in a 1280px
  viewport. Exact screenshots and route-specific evidence remain required.
- The current live/private-route evidence and the owner report differ because
  the browser is authenticated in Chrome while the in-app browser is
  anonymous, and because the published asset is older than the pushed branch.
  This is a deployment identity and verification-boundary problem, not a basis
  for closing either #348 or the route children.
- Replit's authenticated `creatrweb` workspace currently reports an older
  published checkpoint (`8d8f70e`, approximately one hour old) and exposes a
  `Republish` action. GitHub `main` is at `2d239f9`. The dashboard observation
  is release evidence, not proof that the workspace source exactly matches
  that commit; the next action is workspace Pull/Sync followed by Republish,
  then asset-hash verification.
- The public route's current measured document width is 947px at a 962px
  viewport. The authenticated editor's current `375x812` measurement has
  body/root width 360px, workspace width 326px, and no horizontal overflow;
  this does not disprove the owner's supplied screenshot because that report
  must be reconciled against the exact browser, route, viewport, and asset.
- The local fix for stale 3D camera projection on resize is committed/pushed as
  `89e8706` (including `0a43b0b`) but has not yet been proven on the exact
  published revision. #349 remains open.
- Full local checks passed on the current checkout: 888 backend tests passed,
  22 skipped, and 2,398 frontend tests passed, with existing lint warnings.
  Local green checks cannot close deployed-route issues.

## Manifest and order

| Issue | Boundary | Status | Order/dependency | Closure evidence owner |
|---|---|---|---|---|
| [#274](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/274) | Historical parity epic/container | OPEN, reopened false closure | Reconcile last | #320 |
| [#320](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/320) | Parent release reconciliation | OPEN | After all children | Orchestrator |
| [#324](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/324) | Historical multi-route verification container | OPEN, reopened false closure | Reconcile last; superseded by children | #325–#337 |
| [#347](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/347) | Shared stage command overlay and explicit publication affordance | COMPLETED / CLOSED after QA | Reconciled first | Shared component + fixed published evidence |
| [#348](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/348) | Shared editor authoring overlay/layout | HANDED-OFF / DEPLOYMENT-BLOCKED | Replit Pull/Sync + Republish required | Shared component + manual 2D QA |
| [#349](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/349) | Responsive 3D projection and mobile clipping | OPEN | Independent of #347; can follow current distillation | Manual 3D/public 3D QA |
| [#325](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/325) | `/projects/:id` manual 2D editor | OPEN | #347/#348 then route QA | Route QA |
| [#326](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/326) | `/ai-projects/:id` AI 2D editor | OPEN | Shared implementation then route QA | Route QA |
| [#327](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/327) | `/projects3d/:id` manual 3D editor | OPEN | #347/#348/#349 then route QA | Route QA |
| [#328](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/328) | `/ai-projects3d/:id` AI 3D editor | OPEN | Shared implementation then route QA | Route QA |
| [#329](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/329) | `/p/:id` anonymous public 2D | OPEN | Shared implementation then anonymous QA | Route QA |
| [#330](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/330) | `/p3d/:id` anonymous public 3D | OPEN | Published 3D fixture + shared implementation | Route QA |
| [#331](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/331) | `/embed/p/:id` anonymous 2D embed | OPEN | Shared implementation then embed QA | Route QA |
| [#332](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/332) | `/embed/p3d/:id` anonymous 3D embed | OPEN | Published 3D fixture + shared implementation | Route QA |
| [#333](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/333) | `/immersive/p3d/:id` regular immersive 3D | OPEN | #343 and shared implementation | Route QA |
| [#334](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/334) | Custom immersive 3D embed | OPEN | Immersive capability + published fixture | Route QA |
| [#335](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/335) | CMS immersive 3D embed | OPEN | Immersive capability + published fixture | Route QA |
| [#336](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/336) | Portable 2D Full/Non-Camera downloads | OPEN | Downloaded artifact test boundary | Artifact QA |
| [#337](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/337) | Portable 3D Full/Non-Camera downloads | OPEN | 3D exporter + artifact browser boundary | Artifact QA |
| [#338](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/338) | Manual 2D publication implementation | OPEN | Shared publication affordance | Local implementation QA |
| [#339](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/339) | AI 3D publication implementation | OPEN | Shared publication affordance | Local implementation QA |
| [#340](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/340) | AI 2D publication implementation | OPEN | Shared publication affordance | Local implementation QA |
| [#341](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/341) | Manual 3D publication implementation | OPEN | Shared publication affordance | Local implementation QA |
| [#343](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/343) | Immersive 3D touch d-pad | CLOSED / COMPLETED | Independent capability; before #333 route closure | Capability QA passed; GitHub closed |
| [#344](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/344) | Immersive 3D hand move/strafe | OPEN | Physical-input boundary; before affected route closure | Physical QA |
| [#345](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/345) | 3D per-voice instrument selectors | OPEN, reopened | Audio dependency #306/#310 | Capability QA |

Issue #342 is retained as a completed narrow camera-view capability only; its
route and downloaded-artifact consumers remain open. #346 is retained as a
completed structured-2D sound foundation only; it does not prove consumer
route or artifact parity.

## Duplicate/already-covered report

- No duplicate was created for the owner’s absent/visually unusable shared
  controls: #347 owns that exact shared capability.
- No duplicate was created for the bulky editor action row or mobile editor
  layout: #348 owns the shared implementation; #325–#328 own route evidence.
- No duplicate was created for the sphere/mobile issue: search found no open
  equivalent, so #349 was filed with fixed routes/viewports and finite criteria.
- #274 and #324 are not completed work. They are reopened reconciliation
  containers and must not be used as implementation or closure units.
- Closed #342/#346 remain narrow capability prerequisites only; they are not
  evidence that every consuming route, public boundary, or download works.

## Blocker and verification-boundary triage

1. `implementation-defect`: the owner reports absent/undiscoverable controls,
   bulky editor actions, and missing visible publication state. Current source
   and current live DOM show a partial hamburger implementation, but the
   fixed rendered parity contract remains unproven. Owner: engineering/QA.
   Next action: synchronize/publish the exact reviewed revision, then verify
   #348's fixed rendered criteria and reconcile/close it only if every criterion
   has exact evidence. No new product implementation may begin before that
   handoff is resolved.
2. `implementation-defect`: #349's prior screenshot shows a distorted sphere;
   camera-resize synchronization is implemented locally but needs exact live
   rendered proof. Owner: #349 QA. Next action: republish and inspect both
   fixed routes/viewports.
3. `verification-boundary`: exact public 3D/embed/immersive checks require a
   published 3D fixture and authenticated owner access. Owner: Replit/owner.
   Keep #327/#330/#332–#335 open until the exact consumer is reachable.
4. `verification-boundary`: Full/Non-Camera downloaded artifacts require
   extraction and behavior checks in an approved browser/file context. Owner:
   artifact QA. Keep #336/#337 open; do not infer artifact parity from a
   download button.
5. `dependency-blocked`: #333–#335 depend on the immersive capabilities they
   consume, including #343/#344 where their criteria require those controls.
   Skip only dependent route work; continue independent issues.
6. `verification-boundary`: the Replit workspace/published checkpoint does not
   match reviewed GitHub `main` (`8d8f70e` reported in Replit versus `9565974` in
   GitHub). Owner/context: Replit workspace and release operator. No new issue
   is warranted because #320/#321 own deployment identity. Next action: Pull/
   Sync the reviewed GitHub revision into the workspace, Republish, and verify
   the resulting asset before #348 QA or any route closure.

## Handoff

Distillation is complete only after this manifest, the linked GitHub issues,
`docs/tasks.md`, and memory agree. #343's engineering, QA, evidence, and
GitHub closure transaction is complete. #348 remains deployment-blocked while
#349 is the next independent engineering/QA handoff. Engineering and testing
must still be performed and reconciled for one issue before another begins.
Every issue stays open until its QA evidence is posted and the GitHub issue is
closed.
