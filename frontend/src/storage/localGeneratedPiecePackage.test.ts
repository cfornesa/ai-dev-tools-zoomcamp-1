import { describe, expect, it } from 'vitest';

import { parsePiecePackage } from './piecePackage';
import {
  buildLocalGeneratedPiecePackage,
  localGeneratedPackageFilename,
} from './localGeneratedPiecePackage';

describe('local generated piece packages', () => {
  it('round-trips generated source and version history without server data', async () => {
    const bytes = await buildLocalGeneratedPiecePackage({ title: 'Local SVG' }, [
      {
        id: 'v1',
        projectId: 'p1',
        sequence: 1,
        byteSize: 12,
        createdAt: '2026-01-01',
        payload: { source: '<svg/>', engine: 'svg' },
      },
      {
        id: 'v2',
        projectId: 'p1',
        sequence: 2,
        byteSize: 18,
        createdAt: '2026-01-02',
        payload: { source: '<svg><circle/></svg>', engine: 'svg' },
      },
    ]);
    const parsed = await parsePiecePackage(bytes);
    expect(parsed.kind).toBe('generated');
    expect(parsed.records).toHaveLength(2);
    expect(parsed.source).toEqual({ engine: 'svg', source: '<svg><circle/></svg>' });
  });

  it('uses a safe local filename', () => {
    expect(localGeneratedPackageFilename(' Hello / SVG ')).toBe('hello-svg-local-package.zip');
  });
});
