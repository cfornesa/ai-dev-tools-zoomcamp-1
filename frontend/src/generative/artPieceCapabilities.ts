import {
  ART_PIECE_ENGINE_CAPABILITIES,
  type ArtPieceCapabilitySet,
  type ArtPieceLibrary,
} from '../api/artPieces';

/**
 * Issue #428: shared between `ArtPieceStudio.tsx` (new piece) and
 * `ArtPieceEditor.tsx` (#429, new version on an existing piece).
 * `SPATIAL_LIBRARIES` gates capabilities that need a spatial presentation.
 * Three.js/A-Frame use native registered cameras; flat engines use the
 * sandbox's lazy synthetic room shell.
 *
 * Hand steering is deliberately *not* gated by this set as of #449:
 * `artPieceSandbox.ts` now lazily builds a CSS 3D presentation of a flat
 * Canvas2D/SVG piece's own existing artwork and registers a *synthetic*
 * camera adapter through that same hook on first activation, so steering
 * and immersive navigation work for every registered engine.
 */
export const SPATIAL_LIBRARIES = new Set<ArtPieceLibrary>([
  'canvas2d',
  'svg',
  'p5js',
  'c2js',
  'c2js-interactive',
  'threejs',
  'aframe',
]);

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
 * request. `immersive` and `download` are engine-surface gated; `hand_steering`
 * remains supported for every engine. */
export function sanitizeCapabilities(
  capabilities: ArtPieceCapabilitySet,
  library: ArtPieceLibrary,
): ArtPieceCapabilitySet {
  const engine = ART_PIECE_ENGINE_CAPABILITIES[library];
  const sanitized = { ...capabilities };
  if (!engine.immersive) delete sanitized.immersive;
  if (!engine.download) delete sanitized.download;
  return sanitized;
}
