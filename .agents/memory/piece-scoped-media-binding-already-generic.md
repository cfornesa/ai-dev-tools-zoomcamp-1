---
name: piece-scoped-media-binding-already-generic
description: frontend/src/storage/localProjectRepository.ts's mediaAssets/mediaBlobs stores are already keyed by any string id, not type-constrained to a 2D Project — a filed issue (#1049) wrongly diagnosed this as a schema gap.
metadata:
  type: project
---

Discovered 2026-09-28/29 while implementing #1049 ("piece-scoped audio/media
binding for generated ArtPiece and 3D projects"). The issue was filed with
the routing "Stage 2b — data-layer/local-storage-schema extension," on the
assumption that `mediaAssets`/`mediaBlobs`' `by_project` index only worked
for 2D `Project` records.

**That assumption was wrong.** `listMediaAssetsForProject`/`getMediaBlob`/
`importMediaAsset` (`frontend/src/storage/localProjectRepository.ts`) all
take a bare `projectId: string` and never check `LocalProjectRecord.kind`
or even verify a `projects` row exists for that id. The `by_project` IDBIndex
is keyed on a plain string field — a server-backed `Project3D`/`ArtPiece`'s
`public_id` indexes and queries identically to a local 2D project's id. No
schema or index change was needed.

**The real gap was UI wiring**, not storage: `ProjectMediaLibraryPanel`
(the only existing media-library UI) is only rendered in
`EditorWorkspace.tsx` (2D). `Scene3DPreview.tsx`/`ArtPieceEditor.tsx` had no
media-library panel, no `mediaAssetResolver.ts` registration, and nothing
resolved `sonicContract.ts`'s already-typed `ambient_sample` field at all.
`frontend/src/audio/ambientSampleAsset.ts` is the resulting seam: it calls
the existing generic storage functions directly, keyed by the piece's own
`public_id`, with no schema change.

**How to apply:** before scoping a "local-first storage doesn't support X
for piece kind Y" issue as a schema/data-layer change, actually read
`localProjectRepository.ts`'s read/write functions for the field in
question — several of them (media assets in particular) were designed
generically from the start and only need a *caller*, not a new index or
column. See also [[structured-3d-scene-vs-artpiece-engine-code-models]] for
a related case of a filed issue's diagnosis not matching the actual code.
