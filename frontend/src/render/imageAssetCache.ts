/**
 * Issue #508: a small per-preview-instance cache that resolves an `image`
 * shape's `mediaAssetId` (via `mediaAssetResolver.ts`'s currently-active
 * resolver) into a decoded `HTMLImageElement`, exactly once per asset id,
 * and reports pending/ready/error state synchronously so a renderer
 * adapter's immediate-mode draw call never blocks on the async resolution
 * -- it draws the "broken asset" fallback for `pending` and `error` alike,
 * then redraws (via the caller-supplied `onReady` callback, invoked at
 * most once per `get()` call that actually kicks off a resolution) once
 * the asset settles into `ready` or `error`.
 *
 * One cache instance belongs to exactly one `create*ScenePreview()`
 * instance (each adapter constructs its own via `createImageAssetCache()`)
 * rather than being a module-level singleton: each instance owns the
 * object URLs it creates and must revoke them on `destroy()`, and each
 * instance's `onReady` callback is that specific preview's own redraw
 * function -- resolving an asset for one open preview must never trigger
 * a redraw in an unrelated one.
 */
import { getActiveMediaAssetResolver } from './mediaAssetResolver';

export type ImageAssetState =
  | { status: 'pending' }
  | {
      status: 'ready';
      image: HTMLImageElement;
      /** The object URL backing `image.src` -- exposed (rather than kept
       * purely internal) so `svgAdapter.ts` can set it as an `<image>`
       * element's `href` directly; the raster adapters (`canvas2dAdapter.ts`,
       * `p5Adapter.ts`) ignore it and draw `image` itself instead. Owned by
       * this cache: never revoke it yourself, it's revoked by `destroy()`. */
      objectUrl: string;
      naturalWidth: number;
      naturalHeight: number;
    }
  | { status: 'error' };

type CacheRecord = ImageAssetState & { objectUrl?: string };

export type ImageAssetCache = {
  /** Returns the current cached state for `assetId`, kicking off
   * resolution on first call (and every call after a state change, since
   * a settled `ready`/`error` entry is always returned unchanged rather
   * than resolved twice). Calls `onReady` exactly once per resolution that
   * completes after this call started it, never synchronously within this
   * same call. */
  get(assetId: string, onReady: () => void): ImageAssetState;
  /** Revokes every object URL this cache created and forgets all state.
   * Call once when the owning preview is destroyed. */
  destroy(): void;
};

export function createImageAssetCache(): ImageAssetCache {
  const cache = new Map<string, CacheRecord>();

  function get(assetId: string, onReady: () => void): ImageAssetState {
    const existing = cache.get(assetId);
    if (existing) return existing;

    // Mark pending immediately so a second draw call in the same frame (or
    // before the async resolver settles) doesn't kick off a duplicate
    // resolution for the same asset id.
    const pendingRecord: CacheRecord = { status: 'pending' };
    cache.set(assetId, pendingRecord);

    const resolver = getActiveMediaAssetResolver();
    if (!resolver) {
      // No resolver registered: the public/export path, or an editor that
      // hasn't opened a local project database. Every image is
      // deterministically "error" (fallback) rather than staying pending
      // forever -- see mediaAssetResolver.ts's doc comment.
      cache.set(assetId, { status: 'error' });
      return cache.get(assetId)!;
    }

    resolver(assetId)
      .then((blob) => {
        if (!blob) {
          // Missing, cross-project, deleted, or otherwise unresolvable in
          // this browser's IndexedDB -- the renderer cannot distinguish
          // which; that distinction is the frontend validation layer's job
          // (scene.ts's checkImageMediaReferences), not the renderer's.
          cache.set(assetId, { status: 'error' });
          onReady();
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => {
          cache.set(assetId, {
            status: 'ready',
            image,
            naturalWidth: image.naturalWidth || 1,
            naturalHeight: image.naturalHeight || 1,
            objectUrl,
          });
          onReady();
        };
        image.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          cache.set(assetId, { status: 'error' });
          onReady();
        };
        image.src = objectUrl;
      })
      .catch(() => {
        cache.set(assetId, { status: 'error' });
        onReady();
      });

    return pendingRecord;
  }

  function destroy(): void {
    for (const record of cache.values()) {
      if (record.objectUrl) URL.revokeObjectURL(record.objectUrl);
    }
    cache.clear();
  }

  return { get, destroy };
}
