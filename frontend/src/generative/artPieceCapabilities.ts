import type { ArtPieceCapabilitySet, ArtPieceLibrary } from '../api/artPieces';

/**
 * Issue #428: shared between `ArtPieceStudio.tsx` (new piece) and
 * `ArtPieceEditor.tsx` (#429, new version on an existing piece).
 * `SPATIAL_LIBRARIES` gates capabilities that need a *native* registered
 * engine camera (`window.__registerArtPieceCamera` called by the
 * generated Three.js/A-Frame snippet itself) -- walkable immersive
 * navigation (#434) is the only one left; `ImmersiveArtPieceViewer.tsx`
 * and `standaloneArtPieceRuntimeSource.ts` each still hold their own
 * copy of this same set for that same narrower purpose.
 *
 * Hand steering is deliberately *not* gated by this set as of #449:
 * `artPieceSandbox.ts` now lazily builds a CSS 3D presentation of a flat
 * Canvas2D/SVG piece's own existing artwork and registers a *synthetic*
 * camera adapter through that same hook on first activation, so steering
 * works for every engine -- only walkable navigation still requires a
 * real spatial scene to fly through.
 */
export const SPATIAL_LIBRARIES = new Set<ArtPieceLibrary>(['threejs', 'aframe']);

export const CAPABILITY_OPTIONS: Array<{
  key: keyof ArtPieceCapabilitySet;
  label: string;
  spatialOnly?: boolean;
}> = [
  { key: 'screenshot', label: 'Screenshot' },
  { key: 'download', label: 'Download' },
  { key: 'fullscreen', label: 'Fullscreen' },
  { key: 'sound', label: 'Sound' },
  { key: 'keyboard', label: 'Keyboard' },
  { key: 'microphone', label: 'Microphone' },
  { key: 'camera_view', label: 'Camera view' },
  { key: 'hand_steering', label: 'Hand steering' },
  { key: 'immersive', label: 'Immersive settings', spatialOnly: true },
];

/** Drops any capability that `library` cannot support -- defense in depth
 * alongside disabling those checkboxes in the UI, so a stale selection
 * carried over from a previous library choice (or a previous version's
 * capabilities, pre-filled into an edit form) can never reach the save
 * request. Only `immersive` (walkable navigation) is spatial-only as of
 * #449 -- `hand_steering` is supported for every engine. */
export function sanitizeCapabilities(
  capabilities: ArtPieceCapabilitySet,
  library: ArtPieceLibrary,
): ArtPieceCapabilitySet {
  if (SPATIAL_LIBRARIES.has(library)) return capabilities;
  const { immersive: _immersive, ...rest } = capabilities;
  return rest;
}
