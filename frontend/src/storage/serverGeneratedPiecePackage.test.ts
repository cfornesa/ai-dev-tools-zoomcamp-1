import { describe, expect, it } from 'vitest';

import type { ArtPiece, ArtPieceVersion } from '../api/artPieces';
import { normalizeSonic } from '../audio/sonicContract';
import { parsePiecePackage } from './piecePackage';
import {
  buildServerGeneratedPiecePackage,
  serverGeneratedPackageFilename,
} from './serverGeneratedPiecePackage';

const version = (sequence: number, source: string): ArtPieceVersion => ({
  id: sequence,
  sequence,
  source,
  capabilities: { screenshot: true },
  thumbnail_url: '',
  thumbnail_is_fallback: false,
  created_at: `2026-09-27T00:0${sequence}:00Z`,
  generation_metadata: { prompt: `version ${sequence}` },
  sonic: normalizeSonic({ tempo: 90, root: 'C', scale: 'major' }),
  ink: null,
});

const piece = {
  title: 'Serene Generated Piece',
  description: 'A generated fixture.',
  engine: 'svg',
  status: 'published',
  current_version: version(2, '<svg />'),
} as ArtPiece;

describe('server generated piece package', () => {
  it('sanitizes the title and preserves ordered version/source metadata', async () => {
    expect(serverGeneratedPackageFilename(' Serene / Generated Piece ')).toBe(
      'serene-generated-piece-package.zip',
    );
    const result = await buildServerGeneratedPiecePackage(piece, [
      version(2, '<svg id="two" />'),
      version(1, '<svg id="one" />'),
    ]);
    const parsed = await parsePiecePackage(result.bytes);
    expect(parsed.kind).toBe('generated');
    expect(parsed.records.map((record) => record.data.sequence)).toEqual([1, 2]);
    expect(parsed.source).toMatchObject({ engine: 'svg', currentVersionId: 2 });
    expect(parsed.sonic).toMatchObject({ tempo: 90 });
    expect(result.missingAssets).toEqual([]);
  });
});
