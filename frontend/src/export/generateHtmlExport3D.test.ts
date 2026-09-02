import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Scene3DDocument } from '../pages/scene3dTypes';
import {
  generateScene3DBundle,
  Scene3DBundleError,
  triggerScene3DBundleDownload,
} from './generateHtmlExport3D';

/**
 * Issue #289: the 3D counterpart of `../generative/artPieceBundle.test.ts`'s
 * coverage, adapted for the canonical `scene3d` document family.
 */

const RUNTIME_BYTES = new TextEncoder().encode('/* fake three.js runtime */').buffer;

function fileNames(zip: JSZip): string[] {
  return Object.keys(zip.files)
    .filter((name) => !zip.files[name].dir)
    .sort();
}

function validScene(overrides: Partial<Scene3DDocument> = {}): Scene3DDocument {
  return {
    schemaVersion: 1,
    documentType: 'scene3d',
    id: 'scene3d-export-test',
    scene: { backgroundColor: '#101018' },
    camera: {
      position: { x: 0, y: 5, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
      near: 0.1,
      far: 1000,
    },
    lights: [{ id: 'sun', type: 'ambient', color: '#ffffff', intensity: 1 }],
    groups: [],
    objects: [
      {
        id: 'obj-1',
        type: 'box',
        groupId: null,
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          opacity: 1,
        },
        material: { color: '#ff0000' },
        visible: true,
        width: 1,
        height: 1,
        depth: 1,
      },
    ],
    randomness: { seed: 1, enabled: false },
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => RUNTIME_BYTES,
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('generateScene3DBundle', () => {
  it('produces README, styles, index.html, scripts/piece.js, and a vendored runtime', async () => {
    const result = await generateScene3DBundle(validScene(), 'My 3D Scene');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.filename).toBe('my-3d-scene.zip');
    const zip = await JSZip.loadAsync(result.zipBlob);
    expect(fileNames(zip)).toEqual([
      'README.txt',
      'index.html',
      'runtime/three.min.js',
      'scripts/piece.js',
      'styles/piece.css',
    ]);

    const html = await zip.files['index.html'].async('string');
    expect(html).toContain('runtime/three.min.js');
    expect(html).toContain('scripts/piece.js');
    expect(html).toContain('scene3d-canvas-host');
    expect(html).toContain('piece-screenshot');
    expect(html).toContain('piece-fullscreen');

    const script = await zip.files['scripts/piece.js'].async('string');
    expect(script).toContain('window.__SCENE3D_DATA__');
    expect(script).toContain('"id":"obj-1"');

    const runtime = await zip.files['runtime/three.min.js'].async('string');
    expect(runtime).toBe('/* fake three.js runtime */');
  });

  it('embeds the exact scene document -- output reflects the input, no stale caching', async () => {
    const sceneA = validScene({ id: 'scene-a' });
    const sceneB = validScene({ id: 'scene-b', scene: { backgroundColor: '#ff00ff' } });

    const resultA = await generateScene3DBundle(sceneA, 'scene');
    const resultB = await generateScene3DBundle(sceneB, 'scene');
    expect(resultA.ok && resultB.ok).toBe(true);
    if (!resultA.ok || !resultB.ok) return;

    const zipA = await JSZip.loadAsync(resultA.zipBlob);
    const zipB = await JSZip.loadAsync(resultB.zipBlob);
    const scriptA = await zipA.files['scripts/piece.js'].async('string');
    const scriptB = await zipB.files['scripts/piece.js'].async('string');

    expect(scriptA).toContain('scene-a');
    expect(scriptA).not.toContain('scene-b');
    expect(scriptB).toContain('scene-b');
    expect(scriptB).toContain('#ff00ff');
  });

  it('rejects with the exact validation-failure reasons for an invalid scene, producing no bundle', async () => {
    const invalid = { not: 'a valid scene3d document' } as unknown as Scene3DDocument;
    const result = await generateScene3DBundle(invalid, 'broken');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to a sensible filename for an unusable base name', async () => {
    const result = await generateScene3DBundle(validScene(), '   ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filename).toBe('export.zip');
  });

  it('raises Scene3DBundleError when the runtime fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, arrayBuffer: async () => RUNTIME_BYTES })),
    );
    await expect(generateScene3DBundle(validScene(), 'scene')).rejects.toBeInstanceOf(
      Scene3DBundleError,
    );
  });
});

describe('triggerScene3DBundleDownload', () => {
  it('is the shared downloadBlob helper (issue #285), not a fourth hand-rolled copy', async () => {
    const { downloadBlob } = await import('./downloadBlob');
    expect(triggerScene3DBundleDownload).toBe(downloadBlob);
  });
});
