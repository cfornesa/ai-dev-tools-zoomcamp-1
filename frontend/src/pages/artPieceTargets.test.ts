import { describe, expect, it } from 'vitest';

import { buildArtPieceTargetOptions } from './artPieceTargets';

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
});
