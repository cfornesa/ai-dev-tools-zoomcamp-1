import type { ArtPieceLibrary } from '../api/artPieces';

export const ART_PIECE_EDITOR_TOOL_KEYS = [
  'add-shape',
  'add-ellipse',
  'add-line',
  'freehand-draw',
  'erase',
  'transform',
  'media',
  'ai-edit',
] as const;

export type ArtPieceEditorToolKey = (typeof ART_PIECE_EDITOR_TOOL_KEYS)[number];

export type ArtPieceEditorToolCapability = {
  enabled: boolean;
  reason?: string;
};

export type ArtPieceEditorCapabilities = Record<
  ArtPieceEditorToolKey,
  ArtPieceEditorToolCapability
>;

/** #776: drawing tools on a 2D piece open its ink layer, which works for every 2D engine. */
function supported2DManualTools(): Omit<ArtPieceEditorCapabilities, 'ai-edit'> {
  return {
    'add-shape': { enabled: true },
    'add-ellipse': { enabled: true },
    'add-line': { enabled: true },
    'freehand-draw': { enabled: true },
    erase: { enabled: true },
    transform: {
      enabled: false,
      reason: 'Transform editing is planned for a later manual-tool slice.',
    },
    media: { enabled: false, reason: 'Media editing is planned for a later manual-tool slice.' },
  };
}

function supported3DManualTools(): Omit<ArtPieceEditorCapabilities, 'ai-edit'> {
  return {
    'add-shape': { enabled: true },
    'add-ellipse': { enabled: false, reason: 'Ellipse editing is only available for 2D engines.' },
    'add-line': { enabled: false, reason: 'Line editing is only available for 2D engines.' },
    'freehand-draw': {
      enabled: false,
      reason: 'Freehand editing is only available for 2D engines.',
    },
    erase: { enabled: false, reason: 'Erase editing is only available for 2D engines.' },
    transform: { enabled: true },
    media: { enabled: false, reason: 'Media editing is planned for a later manual-tool slice.' },
  };
}

/**
 * Issue #666: the editor tool contract is explicit per engine. Unsupported
 * manual tools stay visible and explain the boundary; later tool issues may
 * change one engine's entry without changing the editor component's policy.
 */
export const ART_PIECE_EDITOR_CAPABILITIES: Record<ArtPieceLibrary, ArtPieceEditorCapabilities> = {
  canvas2d: { ...supported2DManualTools(), 'ai-edit': { enabled: true } },
  svg: { ...supported2DManualTools(), 'ai-edit': { enabled: true } },
  p5js: { ...supported2DManualTools(), 'ai-edit': { enabled: true } },
  c2js: { ...supported2DManualTools(), 'ai-edit': { enabled: true } },
  'c2js-interactive': { ...supported2DManualTools(), 'ai-edit': { enabled: true } },
  threejs: { ...supported3DManualTools(), 'ai-edit': { enabled: true } },
  aframe: { ...supported3DManualTools(), 'ai-edit': { enabled: true } },
};

export function getArtPieceEditorCapabilities(engine: ArtPieceLibrary): ArtPieceEditorCapabilities {
  return ART_PIECE_EDITOR_CAPABILITIES[engine];
}
