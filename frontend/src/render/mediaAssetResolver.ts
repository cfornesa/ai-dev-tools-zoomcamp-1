/**
 * Issue #508: a settable, renderer-scoped hook for resolving an `image`
 * shape's `mediaAssetId` to its `Blob` bytes.
 *
 * #512's local media library lives only in this browser's IndexedDB
 * (`frontend/src/storage/localProjectRepository.ts`'s `getMediaBlob`,
 * scoped to one project). The renderer adapters (`canvas2dAdapter.ts`,
 * `p5Adapter.ts`, `svgAdapter.ts`) are deliberately storage-agnostic, like
 * every other renderer input (they only ever see `ScenePlan`/`AnyShape`
 * data, never a database handle) -- so they cannot reach IndexedDB
 * directly, and this module exists as the one narrow seam between them.
 *
 * A call site that owns an open project's IndexedDB handle (the editor
 * workspace, once #513's media-library UI lets a user actually attach an
 * `image` shape to a scene) registers a resolver bound to that handle/
 * project via `setActiveMediaAssetResolver` before rendering. Every
 * renderer adapter instance created afterward calls whatever resolver is
 * currently active at the moment it needs to resolve a given
 * `mediaAssetId`.
 *
 * No resolver registered -- the default, and always the case for the
 * public viewer (`/p/:id`) and export artifacts, which run in a different
 * browser/device with no access to the authoring session's IndexedDB, per
 * #508's own architecture note -- means every `image` shape renders its
 * "broken asset" fallback, deterministically and without throwing. This is
 * accepted, documented current behavior for those two consumers, not a
 * defect: see `schema/README.md`'s cross-reference and this issue's
 * "Out of scope" section for why building a public/export resolution
 * strategy is deferred to a future issue (cloud sync via #509, or an
 * export-bundling format).
 */
export type MediaAssetResolver = (mediaAssetId: string) => Promise<Blob | null>;

let activeResolver: MediaAssetResolver | null = null;

/** Registers (or clears, via `null`) the resolver every renderer adapter
 * consults for `image` shapes from this point on. Not scoped per adapter
 * instance -- there is only ever one "current session's local media
 * library" a renderer could plausibly resolve against at a time. */
export function setActiveMediaAssetResolver(resolver: MediaAssetResolver | null): void {
  activeResolver = resolver;
}

export function getActiveMediaAssetResolver(): MediaAssetResolver | null {
  return activeResolver;
}
