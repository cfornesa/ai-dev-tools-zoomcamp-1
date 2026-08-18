import JSZip from 'jszip';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { baseScene, circleShape } from '../render/testSceneFixtures';
import * as captureModule from './captureSocialThumbnail';
import { generateHtmlExport } from './generateHtmlExport';
import {
  generateSocialThumbnailZip,
  SocialThumbnailZipError,
  triggerZipDownload,
} from './generateSocialThumbnailZip';

function validScene() {
  return baseScene({
    canvas: { width: 64, height: 64, backgroundColor: '#224488' },
    shapes: [circleShape()],
    randomness: { seed: 7, enabled: true },
  });
}

function baseInput() {
  return {
    scene: validScene(),
    title: 'My animation',
    description: 'A description.',
    interactionMode: 'demo' as const,
    includeAttribution: false,
  };
}

async function pngDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateSocialThumbnailZip', () => {
  it('produces a ZIP with exactly two entries, index.html and thumbnail.png, at the root', async () => {
    const result = await generateSocialThumbnailZip(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    const zip = await JSZip.loadAsync(result.zipBlob);
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(['index.html', 'thumbnail.png']);
    // No nested folders: every entry's own name matches its full path.
    for (const name of names) {
      expect(zip.files[name].dir).toBe(false);
    }
  });

  it('the index.html entry is byte-identical to a plain generateHtmlExport() call with the same config', async () => {
    const input = baseInput();
    const plain = generateHtmlExport(input);
    expect(plain.ok).toBe(true);
    if (!plain.ok) throw new Error('unreachable');

    const result = await generateSocialThumbnailZip(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    const zip = await JSZip.loadAsync(result.zipBlob);
    const html = await zip.file('index.html')!.async('string');
    expect(html).toBe(plain.html);
  });

  it('the thumbnail.png entry is exactly 1200x630', async () => {
    const result = await generateSocialThumbnailZip(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    const zip = await JSZip.loadAsync(result.zipBlob);
    const pngBuffer = await zip.file('thumbnail.png')!.async('arraybuffer');
    const dims = await pngDimensions(new Blob([pngBuffer]));
    expect(dims).toEqual({ width: 1200, height: 630 });
  });

  it('returns { ok: false, reasons } for an incompatible scene without attempting capture', async () => {
    const captureSpy = vi.spyOn(captureModule, 'captureSocialThumbnail');
    const input = {
      ...baseInput(),
      scene: {
        ...validScene(),
        shapes: [{ id: 's1', type: 'sprite3d', layerId: 'layer-1' } as never],
      },
    };

    const result = await generateSocialThumbnailZip(input);
    expect(result.ok).toBe(false);
    expect(captureSpy).not.toHaveBeenCalled();
  });

  it('rejects with SocialThumbnailZipError and produces no zip when thumbnail capture fails', async () => {
    vi.spyOn(captureModule, 'captureSocialThumbnail').mockRejectedValue(
      new captureModule.ThumbnailCaptureError('Thumbnail capture failed: simulated failure.'),
    );

    await expect(generateSocialThumbnailZip(baseInput())).rejects.toThrow(SocialThumbnailZipError);
  });

  it('rejects with SocialThumbnailZipError when ZIP encoding fails', async () => {
    vi.spyOn(JSZip.prototype, 'generateAsync').mockRejectedValue(new Error('encoding boom'));

    await expect(generateSocialThumbnailZip(baseInput())).rejects.toThrow(SocialThumbnailZipError);
  });
});

describe('triggerZipDownload', () => {
  it('creates an object URL, clicks a synthetic download link, and always revokes the URL', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-zip-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const blob = new Blob(['zip-bytes'], { type: 'application/zip' });
    triggerZipDownload(blob, 'export.zip');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-zip-url');

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('still revokes the object URL even if the click throws', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-zip-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('click failed');
    });

    const blob = new Blob(['zip-bytes'], { type: 'application/zip' });
    expect(() => triggerZipDownload(blob, 'export.zip')).toThrow('click failed');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-zip-url');

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
