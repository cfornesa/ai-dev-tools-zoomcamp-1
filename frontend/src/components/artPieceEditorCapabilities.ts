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

const MANUAL_TOOL_REASON =
  'Manual source editing for this engine is not available yet; use AI edit or wait for the engine-specific manual tools.';

function manualTools(): Omit<ArtPieceEditorCapabilities, 'ai-edit'> {
  return {
    'add-shape': { enabled: false, reason: MANUAL_TOOL_REASON },
    'add-ellipse': { enabled: false, reason: MANUAL_TOOL_REASON },
    'add-line': { enabled: false, reason: MANUAL_TOOL_REASON },
    'freehand-draw': { enabled: false, reason: MANUAL_TOOL_REASON },
    erase: { enabled: false, reason: MANUAL_TOOL_REASON },
    transform: { enabled: false, reason: MANUAL_TOOL_REASON },
    media: { enabled: false, reason: MANUAL_TOOL_REASON },
  };
}

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

/**
 * Issue #666: the editor tool contract is explicit per engine. Unsupported
 * manual tools stay visible and explain the boundary; later tool issues may
 * change one engine's entry without changing the editor component's policy.
 */
export const ART_PIECE_EDITOR_CAPABILITIES: Record<ArtPieceLibrary, ArtPieceEditorCapabilities> = {
  canvas2d: { ...supported2DManualTools(), 'ai-edit': { enabled: true } },
  svg: { ...supported2DManualTools(), 'ai-edit': { enabled: true } },
  p5js: { ...manualTools(), 'ai-edit': { enabled: true } },
  c2js: { ...manualTools(), 'ai-edit': { enabled: true } },
  'c2js-interactive': { ...manualTools(), 'ai-edit': { enabled: true } },
  threejs: { ...manualTools(), 'ai-edit': { enabled: true } },
  aframe: { ...manualTools(), 'ai-edit': { enabled: true } },
};

export function getArtPieceEditorCapabilities(engine: ArtPieceLibrary): ArtPieceEditorCapabilities {
  return ART_PIECE_EDITOR_CAPABILITIES[engine];
}
