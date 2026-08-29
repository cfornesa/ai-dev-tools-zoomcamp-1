/**
 * Task 59 (issue #59): captures one deterministic, artwork-only social
 * thumbnail for a scene document, sized/cropped to exactly 1200x630.
 *
 * ## Reuse, not reimplementation
 *
 * This module drives whichever scene renderer adapter the scene itself
 * selects (`../render/createScenePreview.ts`, Task 25/issue #206 --
 * `p5Adapter.ts`'s p5.js adapter or `canvas2dAdapter.ts`'s native Canvas2D
 * adapter) exactly the way the editor preview and `generateHtmlExport.ts`'s
 * exported page both do: it builds one off-screen `<div>` container, hands
 * it to `createScenePreview`, and calls `render(scene)` -- no particles
 * argument (Task 39's live particle snapshot is ephemeral runtime state,
 * not part of the saved scene document, and this module never has one to
 * pass). Nothing here reimplements scene drawing, seeding, or validation;
 * every one of those concerns already lives in the chosen adapter/
 * `sceneDrawPlan.ts` and is exercised identically here.
 *
 * ## Why this is always "stable demo mode," never the camera
 *
 * The chosen adapter reads `scene.randomness` (Task 40's seeded PRNG) and
 * the static shape/layer/group tree. A supplied still-frame overlay is
 * passed to that same renderer, so it participates in the artwork layer
 * order before the cover crop. This function never reads a live camera
 * stream or a tracking frame; `generateSocialThumbnailZip.ts` supplies
 * only an already-captured `CameraOverlayExport`.
 *
 * ## Why the result contains only artwork
 *
 * The off-screen container this module creates is never populated with
 * anything but the renderer-created `<canvas>` -- no title/description
 * text, no demo-controls panel, no camera-controls section, no attribution
 * footer, none of `generateHtmlExport.ts`'s DOM. It is a structurally
 * separate capture path from that module's full export document, not a
 * stripped-down copy of it.
 *
 * ## Cropping to exactly 1200x630
 *
 * A scene's own `canvas.width`/`canvas.height` (validated, but otherwise
 * unconstrained beyond `schema/limits.json`) will rarely already be
 * 1200x630. This module draws the rendered scene canvas onto a second,
 * fixed-size 1200x630 canvas using a centered "cover" crop (scale up
 * evenly on both axes to fully cover 1200x630, then crop whichever axis
 * overflows) -- the same visual convention as CSS `background-size:
 * cover`. This never introduces letterboxing/pillarboxing bars that
 * would ship a non-artwork band in the PNG.
 *
 * ## Cleanup on every path
 *
 * The off-screen container and its p5 instance are always torn down in a
 * `finally` block, whether capture succeeds or throws, so a failed
 * capture never leaves a dangling canvas in the DOM. This module never
 * creates an object URL itself (only a `Blob`), so there is nothing to
 * revoke here either way.
 */
import type { SceneDocument } from '../api/projects';
import { createScenePreview, resolveSceneRendererId } from '../render/createScenePreview';
import type { CameraOverlayExport } from '../editor/cameraOverlayGeometry';

export const SOCIAL_THUMBNAIL_WIDTH = 1200;
export const SOCIAL_THUMBNAIL_HEIGHT = 630;

/** Thrown for any capture/encoding failure -- malformed scene, missing
 * canvas 2D context, or PNG encoding producing no data. Always carries a
 * specific, human-readable message naming what failed (never a generic
 * "capture failed"). */
export class ThumbnailCaptureError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ThumbnailCaptureError';
  }
}

function coverCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const sw = targetWidth / scale;
  const sh = targetHeight / scale;
  return {
    sx: (sourceWidth - sw) / 2,
    sy: (sourceHeight - sh) / 2,
    sw,
    sh,
  };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) {
    throw new ThumbnailCaptureError('Thumbnail capture failed: malformed PNG data URL.');
  }
  const header = dataUrl.slice(0, commaIndex);
  const base64 = dataUrl.slice(commaIndex + 1);
  const mimeMatch = /data:(.*?);base64/.exec(header);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/** Encodes `canvas` as a PNG `Blob`. Prefers the standard, async
 * `canvas.toBlob` (real browsers); falls back to the synchronous
 * `toDataURL` + manual decode (some `<canvas>` polyfills, including the
 * `canvas` package used by this repo's own jsdom test environment, don't
 * implement `toBlob`). */
function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(
            new ThumbnailCaptureError('Thumbnail capture failed: PNG encoding produced no data.'),
          );
        }
      }, 'image/png');
      return;
    }
    try {
      resolve(dataUrlToBlob(canvas.toDataURL('image/png')));
    } catch (error) {
      reject(
        new ThumbnailCaptureError(
          `Thumbnail capture failed: PNG encoding failed. ${
            error instanceof Error ? error.message : String(error)
          }`,
          { cause: error },
        ),
      );
    }
  });
}

/**
 * Renders `scene` off-screen in stable demo mode (see module doc comment)
 * and returns a PNG `Blob` cropped/scaled to exactly 1200x630 containing
 * only the rendered artwork. Rejects with `ThumbnailCaptureError` --
 * never partially resolves -- on any capture/encoding failure, and always
 * removes its off-screen container/canvas before returning or rejecting.
 */
export async function captureSocialThumbnail(
  scene: SceneDocument,
  cameraOverlay?: CameraOverlayExport | null,
): Promise<Blob> {
  const container = document.createElement('div');
  // Off-screen, not `display: none` (some renderers skip layout for
  // display:none elements) -- positioned far outside the viewport instead,
  // and never appended anywhere visible to a user.
  container.style.position = 'fixed';
  container.style.top = '-100000px';
  container.style.left = '-100000px';
  container.style.width = '0';
  container.style.height = '0';
  container.style.overflow = 'hidden';
  container.setAttribute('aria-hidden', 'true');
  document.body.appendChild(container);

  let preview: ReturnType<typeof createScenePreview> | null = null;
  try {
    let cameraImage: HTMLImageElement | undefined;
    if (cameraOverlay) {
      cameraImage = new Image();
      cameraImage.src = cameraOverlay.frameDataUrl;
      await new Promise<void>((resolve, reject) => {
        cameraImage!.onload = () => resolve();
        cameraImage!.onerror = () => reject(new Error('Camera still frame could not be decoded.'));
      });
    }

    preview = createScenePreview(container, resolveSceneRendererId(scene));
    try {
      preview.render(
        scene,
        [],
        [],
        false,
        cameraOverlay && cameraImage
          ? {
              source: cameraImage,
              geometry: cameraOverlay.geometry,
              opacity: cameraOverlay.opacity,
              mirrored: cameraOverlay.mirrored,
              layerOrder: cameraOverlay.layerOrder,
            }
          : undefined,
      );
    } catch (error) {
      throw new ThumbnailCaptureError(
        `Thumbnail capture failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }

    const sourceCanvas = preview.getCanvasElement();
    if (!sourceCanvas || sourceCanvas.width <= 0 || sourceCanvas.height <= 0) {
      throw new ThumbnailCaptureError('Thumbnail capture failed: renderer produced no canvas.');
    }

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = SOCIAL_THUMBNAIL_WIDTH;
    outputCanvas.height = SOCIAL_THUMBNAIL_HEIGHT;
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) {
      throw new ThumbnailCaptureError('Thumbnail capture failed: 2D canvas context unavailable.');
    }

    const { sx, sy, sw, sh } = coverCrop(
      sourceCanvas.width,
      sourceCanvas.height,
      SOCIAL_THUMBNAIL_WIDTH,
      SOCIAL_THUMBNAIL_HEIGHT,
    );
    ctx.drawImage(
      sourceCanvas,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      SOCIAL_THUMBNAIL_WIDTH,
      SOCIAL_THUMBNAIL_HEIGHT,
    );

    return await canvasToPngBlob(outputCanvas);
  } catch (error) {
    if (error instanceof ThumbnailCaptureError) throw error;
    throw new ThumbnailCaptureError(
      `Thumbnail capture failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  } finally {
    preview?.destroy();
    container.remove();
  }
}
