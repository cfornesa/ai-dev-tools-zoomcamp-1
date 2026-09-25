import { describe, expect, it } from 'vitest';

import { buildArtPieceTargetOptions, buildArtPieceTargetOptionsForPiece } from './artPieceTargets';

describe('generated art-piece refinement targets', () => {
  it('discovers stable part and asset IDs from markup and comments', () => {
    const options = buildArtPieceTargetOptions(
      '<div data-augmentr-part="background"></div><!-- @augmentr-part particles -->' +
        '<script>// @augmentr-asset logo.png</script>',
    );
    expect(options).toEqual([
      expect.objectContaining({ id: 'background', type: 'part' }),
      expect.objectContaining({ id: 'particles', type: 'part' }),
      expect.objectContaining({ id: 'logo.png', type: 'media' }),
    ]);
  });

  it('returns no part targets for an unmarked source', () => {
    expect(buildArtPieceTargetOptions('<canvas id="art-piece-canvas"></canvas>')).toEqual([]);
  });

  it('keeps marked assets available when no parts are declared', () => {
    expect(buildArtPieceTargetOptions('<img data-augmentr-asset="logo.png" />')).toEqual([
      expect.objectContaining({ id: 'logo.png', type: 'media' }),
    ]);
  });

  it('discovers layer regions, SVG ids, and the ink layer with mention kinds', () => {
    const options = buildArtPieceTargetOptionsForPiece(
      '<svg>\n<g id="Sky"><circle /></g>\n<!-- @layer Hills -->\n</svg>',
      'svg',
      true,
    );
    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ink', mentionKind: 'ink' }),
        expect.objectContaining({ id: 'Sky', mentionKind: 'element' }),
        expect.objectContaining({ id: 'Hills', mentionKind: 'region' }),
      ]),
    );
  });

  it('keeps an unmarked source as a plain prompt with no discovered targets', () => {
    expect(buildArtPieceTargetOptionsForPiece('const sketch = 1;', 'p5js', false)).toEqual([]);
  });
});
