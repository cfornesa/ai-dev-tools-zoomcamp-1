import { describe, expect, it } from 'vitest';

import { summarizeLocalPublicUpdate } from './localPublicUpdate';

describe('summarizeLocalPublicUpdate', () => {
  it('reports scene edits and media additions/removals deterministically', () => {
    const before = { shapes: [{ id: 'shape-1', type: 'rect', mediaAssetId: 'asset-old' }] };
    const after = { shapes: [{ id: 'shape-1', type: 'circle', mediaAssetId: 'asset-new' }] };

    expect(summarizeLocalPublicUpdate(before, after)).toEqual({
      sceneSummary: '1 shape changed',
      mediaAdded: 1,
      mediaRemoved: 1,
      summary: '1 shape changed; 1 media asset added; 1 media asset removed',
      changed: true,
    });
  });

  it('returns a no-op summary for identical scene and media state', () => {
    expect(summarizeLocalPublicUpdate({ shapes: [] }, { shapes: [] })).toEqual({
      sceneSummary: 'No scene changes',
      mediaAdded: 0,
      mediaRemoved: 0,
      summary: 'No changes detected',
      changed: false,
    });
  });
});
