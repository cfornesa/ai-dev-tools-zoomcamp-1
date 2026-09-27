import { describe, expect, it } from 'vitest';
import { unzipSync, zipSync } from 'fflate';

import {
  buildPiecePackage,
  convertLegacyDatabaseArchive,
  convertLegacyJsonPackage,
  PiecePackageError,
  parsePiecePackage,
  validatePiecePackageManifest,
  type PiecePackageInput,
} from './piecePackage';

import valid2d from '../../../schema/fixtures/piece-package/valid-2d.json';
import valid3d from '../../../schema/fixtures/piece-package/valid-3d.json';
import validGenerated from '../../../schema/fixtures/piece-package/valid-generated.json';
import blank2d from '../../../schema/fixtures/valid/blank.json';
import blank3d from '../../../schema/fixtures3d/valid/renderer_threejs.json';
import invalidExecutable from '../../../schema/fixtures/piece-package/invalid-executable-extra-file.json';
import invalidOversize from '../../../schema/fixtures/piece-package/invalid-oversize.json';
import invalidPath from '../../../schema/fixtures/piece-package/invalid-path-traversal.json';
import invalidVersion from '../../../schema/fixtures/piece-package/invalid-unknown-version.json';

const input = (kind: PiecePackageInput['kind']): PiecePackageInput => ({
  kind,
  title: `Fixture ${kind}`,
  description: 'Portable package fixture.',
  tags: ['fixture'],
  appVersion: 'test',
  records: [
    {
      schemaVersion: 1,
      data: kind === '2d' ? blank2d : kind === '3d' ? blank3d : { schemaVersion: 1, kind },
    },
  ],
  source: kind === 'generated' ? { engine: 'svg', code: '<svg></svg>' } : null,
  mediaAssets: [
    {
      filename: 'dot.png',
      altText: 'A dot',
      mimeType: 'image/png',
      bytes: new Uint8Array([137, 80, 78, 71]),
    },
  ],
});

describe('piece package', () => {
  it('accepts the shared valid manifest fixtures', () => {
    expect(() => validatePiecePackageManifest(valid2d)).not.toThrow();
    expect(() => validatePiecePackageManifest(valid3d)).not.toThrow();
    expect(() => validatePiecePackageManifest(validGenerated)).not.toThrow();
  });

  it('rejects the shared invalid manifest fixtures', () => {
    for (const fixture of [invalidExecutable, invalidOversize, invalidPath, invalidVersion]) {
      expect(() => validatePiecePackageManifest(fixture)).toThrow(PiecePackageError);
    }
  });

  it.each(['2d', '3d', 'generated'] as const)('round-trips %s packages', async (kind) => {
    const restored = await parsePiecePackage(await buildPiecePackage(input(kind)));
    expect(restored.kind).toBe(kind);
    expect(restored.records[0].data).toEqual(
      kind === '2d' ? blank2d : kind === '3d' ? blank3d : { schemaVersion: 1, kind },
    );
    expect([...restored.mediaAssets[0].bytes]).toEqual([137, 80, 78, 71]);
    expect(restored.visibilityIntent).toBe('private');
  });

  it('rejects a tampered payload atomically before returning a package', async () => {
    const archive = await buildPiecePackage(input('2d'));
    const entries = unzipSync(archive);
    entries['files/1.bin'][0] ^= 1;
    const tampered = zipSync(entries, { level: 0 });
    await expect(parsePiecePackage(tampered)).rejects.toBeInstanceOf(PiecePackageError);
  });

  it('keeps user-controlled names out of ZIP paths', async () => {
    const archive = await buildPiecePackage({
      ...input('2d'),
      mediaAssets: [
        {
          ...input('2d').mediaAssets![0],
          filename: '../../escape.png',
        },
      ],
    });
    const restored = await parsePiecePackage(archive);
    expect(restored.mediaAssets[0].filename).toBe('../../escape.png');
  });

  it('converts the #512 JSON package shape', () => {
    const legacy = convertLegacyJsonPackage({
      formatVersion: 1,
      project: { title: 'Legacy' },
      scenes: [{ sceneJson: { schemaVersion: 1, shapes: [] } }],
      mediaAssets: [
        {
          filename: 'x.bin',
          altText: '',
          mimeType: 'application/octet-stream',
          byteSize: 1,
          checksum: 'x',
          dataBase64: 'AQ==',
        },
      ],
    });
    expect(legacy.records).toHaveLength(1);
    expect([...legacy.mediaAssets![0].bytes]).toEqual([1]);
  });

  it('converts a one-project #526 archive shape', () => {
    const scene = new TextEncoder().encode(JSON.stringify({ schemaVersion: 1, shapes: [] }));
    const manifest = {
      formatVersion: 1,
      projects: [{ index: 0, title: 'Legacy archive', scenes: [{ index: 0 }], mediaAssets: [] }],
    };
    const legacy = convertLegacyDatabaseArchive(
      zipSync(
        {
          'manifest.json': new TextEncoder().encode(JSON.stringify(manifest)),
          'projects/0/scenes/0.json': scene,
        },
        { level: 0 },
      ),
    );
    expect(legacy.title).toBe('Legacy archive');
    expect(legacy.records[0].data).toEqual({ schemaVersion: 1, shapes: [] });
  });
});
