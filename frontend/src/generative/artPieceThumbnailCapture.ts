/**
 * Issue #438: captures a real thumbnail from the currently-rendered
 * sandboxed preview iframe (the same one `ArtPieceStudio.tsx`/
 * `ArtPieceEditor.tsx` already show the user), crops it to
 * `THUMBNAIL_WIDTH`x`THUMBNAIL_HEIGHT`, and uploads the result. This is
 * the *only* place a piece's thumbnail is ever produced from its actual
 * artwork -- Django never executes generated source to render one (see
 * `backend/scenes/art_piece_persistence.py`'s module doc comment), so a
 * failed or skipped capture here just leaves the neutral fallback
 * placeholder the backend already stored at creation time. Every step is
 * best-effort: a network hiccup, a slow render, or a crashed piece must
 * never block or fail the save/revise flow that triggers this.
 */
import { uploadArtPieceThumbnail } from '../api/artPieces';
import { ART_PIECE_BRIDGE_VERSION, ART_PIECE_SANDBOX_MESSAGE_SOURCE } from './artPieceSandbox';

export const THUMBNAIL_WIDTH = 320;
export const THUMBNAIL_HEIGHT = 240;

const CAPTURE_TIMEOUT_MS = 8000;

/** Requests a screenshot from `iframe`'s sandboxed content and resolves
 * with the raw `data:image/...;base64,...` payload the sandbox reports
 * back (see `artPieceSandbox.ts`'s `reportScreenshot`), or rejects on a
 * reported error or timeout -- a crashed/hung generation must not hang
 * the caller indefinitely. */
function requestSandboxScreenshot(iframe: HTMLIFrameElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const contentWindow = iframe.contentWindow;
    if (!contentWindow) {
      reject(new Error('The preview has no content window to capture from.'));
      return;
    }
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('Thumbnail capture timed out.'));
    }, CAPTURE_TIMEOUT_MS);
    function onMessage(event: MessageEvent) {
      if (event.source !== contentWindow) return;
      const data = event.data as
        { source?: string; status?: string; data?: string; message?: string } | null | undefined;
      if (data?.source !== ART_PIECE_SANDBOX_MESSAGE_SOURCE) return;
      if (data.status === 'screenshot' && typeof data.data === 'string') {
        window.clearTimeout(timeoutId);
        window.removeEventListener('message', onMessage);
        resolve(data.data);
      } else if (data.status === 'error') {
        window.clearTimeout(timeoutId);
        window.removeEventListener('message', onMessage);
        reject(new Error(data.message || 'The preview could not be captured.'));
      }
    }
    window.addEventListener('message', onMessage);
    contentWindow.postMessage(
      {
        source: 'art-piece-parent',
        version: ART_PIECE_BRIDGE_VERSION,
        type: 'screenshot',
        filename: 'thumbnail-capture.png',
      },
      '*',
    );
  });
}

/** Decodes a `data:` URL PNG/JPEG capture and re-encodes it as an
 * exact `THUMBNAIL_WIDTH`x`THUMBNAIL_HEIGHT` PNG, aspect-preserving
 * "cover" crop (scale to fill both dimensions, centered, overflow
 * cropped) -- never a stretched/distorted thumbnail, and never a size
 * the backend's own contract would reject. */
async function cropToThumbnail(dataUrl: string): Promise<Blob> {
  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('The captured image could not be decoded.'));
  });
  image.src = dataUrl;
  await loaded;

  const canvas = document.createElement('canvas');
  canvas.width = THUMBNAIL_WIDTH;
  canvas.height = THUMBNAIL_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the thumbnail canvas.');

  const scale = Math.max(THUMBNAIL_WIDTH / image.width, THUMBNAIL_HEIGHT / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = (THUMBNAIL_WIDTH - drawWidth) / 2;
  const offsetY = (THUMBNAIL_HEIGHT - drawHeight) / 2;
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode the thumbnail as PNG.'));
    }, 'image/png');
  });
}

/** Captures a thumbnail from `iframe`'s currently-rendered piece and
 * uploads it for `versionId` on `publicId`. Never throws -- every
 * failure (capture timeout/error, decode failure, network/validation
 * failure on upload) is swallowed, since the neutral fallback the
 * backend already stored is always a safe, already-present result. */
export async function captureAndUploadArtPieceThumbnail(
  iframe: HTMLIFrameElement,
  publicId: string,
  versionId: number,
): Promise<boolean> {
  try {
    const dataUrl = await requestSandboxScreenshot(iframe);
    const blob = await cropToThumbnail(dataUrl);
    await uploadArtPieceThumbnail(publicId, versionId, blob);
    return true;
  } catch {
    return false;
  }
}
