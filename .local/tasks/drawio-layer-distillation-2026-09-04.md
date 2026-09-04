# Draw.io layer distillation — 2026-09-04

## Request and phase boundary

Investigate and backlog the ability to create draw.io layers with object-level
drawing and erasing, existing layer movement controls, and participation in
downloads and other project surfaces.

This was a distillation-only pass. No product source or product tests were
changed.

## Current-state evidence

Repository search found no draw.io, diagrams.net, mxGraph, or maxGraph
implementation, dependency, document model, or test.

The current native layer implementation is separate:

- `schema/scene.schema.json` defines layers with `id`, `name`, `order`,
  `visible`, and `locked`; renderers are p5, canvas2d, and svg.
- `frontend/src/pages/sceneOutline.ts`, `useSceneEditor.ts`, and
  `frontend/src/components/LayersPanel.tsx` implement native layer creation,
  selection, ordering, visibility, locking, and deletion.
- `frontend/src/components/EditorWorkspace.tsx` and the scene-shape helpers
  provide native circle, rectangle, line, and polygon tools plus selection,
  transforms, duplication, deletion, and styling.
- `frontend/src/export/generateHtmlExport.ts` and
  `sceneExportStripping.ts` preserve native scene playback data in HTML
  downloads; they do not create editable draw.io files.
- `frontend/src/pages/PublicProjectViewer.tsx` and the embed route render
  native scene JSON read-only. They have no draw.io editor/runtime.
- Backend save/restore/fork paths validate and persist canonical native scene
  JSON; no draw.io payload boundary exists.

Therefore the requested capability is an implementation gap, not a test-only
verification gap.

## Duplicate and already-covered report

- The authenticated GitHub audit found the existing open vendor issues
  #404–#408; none mentions draw.io or diagram editing.
- Existing native layer issues and tests (#5, #6, #8, #14, #22–#26, #41,
  #51, #55–#59, #62, #65, #69, #76, #80, #111, #127, #131, #142, #163,
  #194, #206, and #207) are already complete or scoped to native layers.
  They should be reused as behavioral references, not reopened or treated as
  draw.io implementation.
- Existing public/viewer/export issues cover native transport mechanisms only.
  They do not provide draw.io XML interoperability, an object editor, or an
  editable draw.io download.
- No local task or memory topic covered true draw.io content, so no duplicate
  local record was found.

## Criterion-ready issue manifest

| Issue | URL | Capability boundary | Dependencies / order | Status | Next action |
| --- | --- | --- | --- | --- | --- |
| #409 | [safe versioned draw.io document layer](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/409) | Define the supported draw.io representation, safety limits, validation, save/restore, and fork behavior | First; no implementation dependency | open | Engineer the persistence and validation contract |
| #410 | [draw.io editor tools and object interaction](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/410) | Select, add shapes, draw/connect, erase/delete selected objects, and transform them individually | Depends on #409 | open; dependency-blocked | Implement after #409 |
| #411 | [outer layer controls](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/411) | Create, rename, move, reorder, hide, lock, and delete draw.io-backed layers | Depends on #409 and #410 | open; dependency-blocked | Integrate with native layer controls after object editing |
| #412 | [public, embed, render, export, and download surfaces](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/412) | Render supported draw.io layers and package safe editable/static outputs | Depends on #409/#410; final ordering parity needs #411 | open; dependency-blocked | Implement one shared render/export adapter |
| #413 | [compatibility, accessibility, and regression gate](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/413) | Close the integrated native-vs-draw.io workflow with deterministic and browser evidence | Depends on #409–#412 | open; dependency-blocked | Add the final narrow regression/accessibility matrix |

Each issue names an entry point, finite acceptance criteria, focused/full
commands, explicit out-of-scope behavior, duplicate findings, and evidence
boundaries. #409 is the single next issue.

## Blocker triage

- #409 is closure-ready and has no dependency blocker.
- #410 and #411 are `dependency-blocked` by #409, with #411 also depending on
  the object interaction contract in #410.
- #412 is `dependency-blocked` by the document and editor contracts; final
  layer-order claims depend on #411.
- #413 is `dependency-blocked` by the four implementation/surface issues.
- Interoperability with every official draw.io feature is a
  `verification-boundary` unless a supported corpus and adapter format are
  explicitly pinned in #409.
- No workflow/infrastructure defect was found.
- Mistral/native-layer issues are already-covered or duplicate evidence, not
  new draw.io work.

## Dependency rationale and next queue item

1. #409 establishes a bounded, versioned, safe document format and persistence
   contract.
2. #410 maps that document to an editor with object-level tools.
3. #411 connects the draw.io-backed layer to the existing layer stack.
4. #412 consumes the persisted content in viewers, embeds, thumbnails, and
   downloads.
5. #413 closes accessibility, compatibility, and cross-surface regressions.

Process exactly #409 next. After its terminal result, reconcile and select
#410; do not begin implementation of #410–#413 while #409 lacks a terminal
result.

## Durable context

The shared rule for this feature is recorded in
`.agents/memory/drawio-layer-integration.md`.