import { describe, expect, it } from 'vitest';

import {
  ART_PIECE_EDITOR_CAPABILITIES,
  ART_PIECE_EDITOR_TOOL_KEYS,
  getArtPieceEditorCapabilities,
} from './artPieceEditorCapabilities';

describe('art piece editor capability matrix (issue #666)', () => {
  it('declares every editor tool for every supported engine', () => {
    expect(Object.keys(ART_PIECE_EDITOR_CAPABILITIES)).toEqual([
      'canvas2d',
      'svg',
      'p5js',
      'c2js',
      'c2js-interactive',
      'threejs',
      'aframe',
    ]);
    for (const [engine, capabilities] of Object.entries(ART_PIECE_EDITOR_CAPABILITIES)) {
      expect(Object.keys(capabilities)).toEqual(ART_PIECE_EDITOR_TOOL_KEYS);
      expect(capabilities['ai-edit'].enabled).toBe(true);
      for (const tool of ART_PIECE_EDITOR_TOOL_KEYS.slice(0, -1)) {
        if (engine === 'canvas2d' || engine === 'svg') {
          expect(capabilities[tool].reason || capabilities[tool].enabled).toBeTruthy();
        } else {
          expect(capabilities[tool]).toMatchObject({ enabled: false });
          expect(capabilities[tool].reason).toBeTruthy();
        }
      }
    }
  });

  it('returns the matrix entry without deriving support from the display label', () => {
    expect(getArtPieceEditorCapabilities('c2js-interactive')['ai-edit']).toEqual({ enabled: true });
  });
});
