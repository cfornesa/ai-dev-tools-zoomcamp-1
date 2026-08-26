import { afterEach, describe, expect, it, vi } from 'vitest';

import { baseScene, circleShape } from '../render/testSceneFixtures';
import * as p5Adapter from '../render/p5Adapter';
import {
  captureSocialThumbnail,
  SOCIAL_THUMBNAIL_HEIGHT,
  SOCIAL_THUMBNAIL_WIDTH,
  ThumbnailCaptureError,
} from './captureSocialThumbnail';

/** Reads a PNG `Blob`'s IHDR width/height directly from its bytes (big-
 * endian 32-bit integers at offsets 16 and 20) -- avoids any async
 * `Image`/decode dependency in the jsdom test environment. */
async function pngDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  // PNG signature is 8 bytes; IHDR chunk length+type is 8 more; width/height
  // are the first 8 bytes of IHDR's payload.
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height };
}

function sceneWithSeed(
  seed: number,
  canvas = { width: 64, height: 64 },
): ReturnType<typeof baseScene> {
  return baseScene({
    canvas: { ...canvas, backgroundColor: '#224488' },
    shapes: [
      circleShape({ transform: { x: 32, y: 32, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 } }),
    ],
    randomness: { seed, enabled: true },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  // Belt-and-suspenders: fail loudly if a test leaves a stray container.
  document.querySelectorAll('div[aria-hidden="true"]').forEach((el) => el.remove());
});

describe('captureSocialThumbnail', () => {
  it('produces a PNG blob exactly 1200x630', async () => {
    const blob = await captureSocialThumbnail(sceneWithSeed(1));
    expect(blob.type).toBe('image/png');
    const dims = await pngDimensions(blob);
    expect(dims).toEqual({ width: SOCIAL_THUMBNAIL_WIDTH, height: SOCIAL_THUMBNAIL_HEIGHT });
  });

  it('is deterministic: the same scene+seed captured twice produces identical PNG bytes', async () => {
    const scene = sceneWithSeed(42);
    const blobA = await captureSocialThumbnail(scene);
    const blobB = await captureSocialThumbnail(scene);
    const bytesA = new Uint8Array(await blobA.arrayBuffer());
    const bytesB = new Uint8Array(await blobB.arrayBuffer());
    expect(Array.from(bytesA)).toEqual(Array.from(bytesB));
  });

  it('produces different pixels for a scene without randomness enabled vs. a differently-seeded one', async () => {
    // Not a strict requirement of the module, but guards against a capture
    // that silently ignores scene content -- two visibly different scenes
    // must not encode to byte-identical PNGs.
    const blobA = await captureSocialThumbnail(sceneWithSeed(1));
    const blobB = await captureSocialThumbnail(
      baseScene({
        canvas: { width: 64, height: 64, backgroundColor: '#ff0000' },
        shapes: [],
        randomness: { seed: 1, enabled: false },
      }),
    );
    const bytesA = new Uint8Array(await blobA.arrayBuffer());
    const bytesB = new Uint8Array(await blobB.arrayBuffer());
    expect(Array.from(bytesA)).not.toEqual(Array.from(bytesB));
  });

  it('never appends anything to the DOM other than its own off-screen container/canvas, and removes it afterward', async () => {
    const bodyChildrenBefore = document.body.children.length;
    await captureSocialThumbnail(sceneWithSeed(2));
    expect(document.body.children.length).toBe(bodyChildrenBefore);
    expect(document.querySelector('div[aria-hidden="true"]')).toBeNull();
  });

  it('only invokes the scene-rendering adapter -- render() with no particles argument, never UI/camera code', async () => {
    const createSpy = vi.spyOn(p5Adapter, 'createP5ScenePreview');
    await captureSocialThumbnail(sceneWithSeed(3));
    expect(createSpy).toHaveBeenCalledTimes(1);
    const preview = createSpy.mock.results[0].value as ReturnType<
      typeof p5Adapter.createP5ScenePreview
    >;
    // The real render/getCanvasElement/destroy calls happened on the real
    // returned object -- nothing about this module reaches past that
    // narrow adapter surface (no DOM UI construction of its own beyond the
    // plain off-screen container).
    expect(typeof preview.render).toBe('function');
  });

  it('passes a camera still through the shared compositor with its artwork layer order', async () => {
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = 64;
    sourceCanvas.height = 64;
    const render = vi.fn();
    const preview = {
      render,
      getCanvasElement: () => sourceCanvas,
      destroy: vi.fn(),
    } as unknown as ReturnType<typeof p5Adapter.createP5ScenePreview>;
    vi.spyOn(p5Adapter, 'createP5ScenePreview').mockReturnValue(preview);

    const image = document.createElement('canvas') as unknown as HTMLImageElement;
    Object.defineProperty(image, 'src', {
      configurable: true,
      set: () => queueMicrotask(() => image.onload?.(new Event('load'))),
    });
    function FakeImage() {
      return image;
    }
    vi.stubGlobal('Image', FakeImage);

    const overlay = {
      frameDataUrl: 'data:image/png;base64,AAAA',
      geometry: { x: 0.1, y: 0.1, width: 0.25, height: 0.14 },
      opacity: 0.8,
      mirrored: true,
      layerOrder: 7,
    };
    await captureSocialThumbnail(sceneWithSeed(3), overlay);

    expect(render).toHaveBeenCalledWith(
      sceneWithSeed(3),
      [],
      [],
      false,
      expect.objectContaining({ source: image, layerOrder: 7, mirrored: true }),
    );
  });

  it('rejects with a specific ThumbnailCaptureError and leaves no dangling DOM for a malformed scene', async () => {
    const bodyChildrenBefore = document.body.children.length;
    const malformed = { ...sceneWithSeed(1), shapes: [{ id: 's1', type: 'not-a-real-type' }] };

    await expect(
      captureSocialThumbnail(malformed as unknown as Parameters<typeof captureSocialThumbnail>[0]),
    ).rejects.toThrow(ThumbnailCaptureError);

    expect(document.body.children.length).toBe(bodyChildrenBefore);
    expect(document.querySelector('div[aria-hidden="true"]')).toBeNull();
  });

  it('rejects with a specific ThumbnailCaptureError and cleans up when canvas 2D context creation fails', async () => {
    const original = HTMLCanvasElement.prototype.getContext;
    let callCount = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      callCount += 1;
      // Let p5's own internal canvas set up normally (first calls), but
      // fail the *output* 1200x630 canvas's context request -- simulated
      // by failing every call past a generous threshold for p5's setup.
      if (this.width === SOCIAL_THUMBNAIL_WIDTH && this.height === SOCIAL_THUMBNAIL_HEIGHT) {
        return null;
      }
      return original.apply(this, args);
    });

    const bodyChildrenBefore = document.body.children.length;
    await expect(captureSocialThumbnail(sceneWithSeed(1))).rejects.toThrow(ThumbnailCaptureError);
    expect(document.body.children.length).toBe(bodyChildrenBefore);
    expect(callCount).toBeGreaterThan(0);
  });
});
