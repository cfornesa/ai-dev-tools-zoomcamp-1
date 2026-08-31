/**
 * Issues #285 (2D)/#286 (3D): captures the *currently rendered* live
 * preview canvas as a PNG -- unlike `captureSocialThumbnail.ts`, which
 * re-renders the scene off-screen in stable demo mode, this reads
 * whatever the on-screen canvas already shows right now (mid-gesture,
 * mid-behavior-animation, an in-progress AI proposal preview, etc.), with
 * no re-render of its own. Purely read-only against the canvas -- only
 * ever calls `toBlob`/`toDataURL`, never anything that could mutate
 * render state.
 */
import { canvasToPngBlob } from './captureSocialThumbnail';

export class LiveScreenshotError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LiveScreenshotError';
  }
}

/** Encodes `canvas`'s current contents as a PNG `Blob`. Throws
 * `LiveScreenshotError` if there is no canvas to capture (preview not
 * mounted, WebGL/renderer unavailable, etc.) or it has zero size. */
export async function captureLiveScreenshot(canvas: HTMLCanvasElement | null): Promise<Blob> {
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
    throw new LiveScreenshotError('Screenshot failed: no preview canvas is available to capture.');
  }
  try {
    return await canvasToPngBlob(canvas);
  } catch (error) {
    if (error instanceof Error && error.name === 'ThumbnailCaptureError') {
      throw new LiveScreenshotError(error.message, { cause: error });
    }
    throw new LiveScreenshotError(
      `Screenshot failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

/** Builds a sensible, filesystem-safe screenshot filename from a free-form
 * title/id (e.g. the project's own title) -- lowercased, non-alphanumeric
 * runs collapsed to a single `-`, with a timestamp so repeated captures of
 * the same scene never silently overwrite one another. */
export function screenshotFilename(base: string): string {
  const safe = base
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${safe || 'scene'}-screenshot-${Date.now()}.png`;
}
