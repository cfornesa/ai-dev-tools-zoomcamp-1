import type { ArtPieceCapabilitySet, ArtPieceLibrary } from '../api/artPieces';

/**
 * Issue #428: shared between `ArtPieceStudio.tsx` (new piece) and
 * `ArtPieceEditor.tsx` (#429, new version on an existing piece) --
 * hand-steering and immersive navigation need a registered engine camera
 * (`window.__registerArtPieceCamera`), which only the Three.js and
 * A-Frame sandbox documents ever call (see `artPieceSandbox.ts`'s
 * `pieceLibrary` gate). `ImmersiveArtPieceViewer.tsx` and
 * `standaloneArtPieceRuntimeSource.ts` each still hold their own copy of
 * this same set for their own narrower purpose (deciding whether to
 * offer navigation at all, not which capabilities a save form may pick).
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
  { key: 'hand_steering', label: 'Hand steering', spatialOnly: true },
  { key: 'immersive', label: 'Immersive settings', spatialOnly: true },
];

/** Drops any capability that `library` cannot support -- defense in depth
 * alongside disabling those checkboxes in the UI, so a stale selection
 * carried over from a previous library choice (or a previous version's
 * capabilities, pre-filled into an edit form) can never reach the save
 * request. */
export function sanitizeCapabilities(
  capabilities: ArtPieceCapabilitySet,
  library: ArtPieceLibrary,
): ArtPieceCapabilitySet {
  if (SPATIAL_LIBRARIES.has(library)) return capabilities;
  const { hand_steering: _handSteering, immersive: _immersive, ...rest } = capabilities;
  return rest;
}
