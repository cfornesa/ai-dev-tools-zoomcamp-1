/**
 * Task 59 (issue #59): bundles the standalone HTML export
 * (`generateHtmlExport.ts`, Task 56/57) together with one deterministic,
 * artwork-only 1200x630 social thumbnail (`captureSocialThumbnail.ts`)
 * into a single downloadable ZIP.
 *
 * ## Same HTML, not a second implementation
 *
 * `generateSocialThumbnailZip` calls `generateHtmlExport` with exactly
 * the caller's input and uses its `html` output byte-for-byte -- the same
 * function, same arguments, same result an HTML-only export would
 * produce for the same config. This is the literal mechanism behind
 * issue #59's "equivalent to the chosen Task 56 export options"
 * acceptance criterion: there is no divergent second HTML-generation path
 * here to keep in sync.
 *
 * ## Failure handling: no partial download, no leaked resources
 *
 * Three things can fail, in order: HTML generation (an incompatible/
 * invalid scene -- reported the same way `generateHtmlExport` already
 * does, via `{ ok: false, reasons }`, not a thrown error, since this is
 * an expected/handled case the dialog already renders), thumbnail
 * capture, and ZIP encoding. `generateAsync`'s in-memory `Blob` result is
 * only returned once every step above has succeeded -- if capture or ZIP
 * encoding throws, this function propagates a `SocialThumbnailZipError`
 * and returns nothing, so its caller (`ExportConfigDialog.tsx`) never
 * reaches the point where it would call `triggerZipDownload`. No object
 * URL is created anywhere in this module until `triggerZipDownload`
 * itself, and that helper follows the exact create-URL/click/revoke-in-
 * `finally` pattern `generateHtmlExport.ts`'s `triggerHtmlDownload`
 * already uses, so nothing here can leak a `blob:` URL either.
 */
import JSZip from 'jszip';

import { captureSocialThumbnail } from './captureSocialThumbnail';
import {
  generateHtmlExport,
  type GenerateHtmlExportInput,
  type GenerateHtmlExportResult,
} from './generateHtmlExport';

export type GenerateSocialThumbnailZipResult =
  { ok: true; zipBlob: Blob; filename: string } | { ok: false; reasons: string[] };

/** Thrown for a thumbnail-capture or ZIP-encoding failure -- distinct
 * from `GenerateSocialThumbnailZipResult`'s `{ ok: false }` case (an
 * incompatible/invalid scene, which `ExportConfigDialog.tsx` already
 * knows how to render as a list of specific blocking reasons via
 * `ExportGenerationBlockedError`). Callers that want the same uniform
 * "show a clear error, never download" handling for every failure mode
 * can catch this and any `Error` identically. */
export class SocialThumbnailZipError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SocialThumbnailZipError';
  }
}

function zipFilename(htmlFilename: string): string {
  return htmlFilename.replace(/\.html$/, '') + '.zip';
}

/**
 * Generates the HTML (via `generateHtmlExport`, unchanged) and the social
 * thumbnail (via `captureSocialThumbnail`, always demo-mode -- see that
 * module's doc comment; `input.interactionMode` only affects the HTML
 * export, never the thumbnail capture) for `input`, then bundles them
 * into a ZIP containing exactly `index.html` and `thumbnail.png` at the
 * root -- no nested folders, no extra entries.
 *
 * Returns `{ ok: false, reasons }` (never throws) for the same
 * scene-compatibility/validity reasons `generateHtmlExport` itself
 * reports -- capture is never attempted in that case. Rejects with
 * `SocialThumbnailZipError` if thumbnail capture or ZIP encoding itself
 * fails.
 */
export async function generateSocialThumbnailZip(
  input: GenerateHtmlExportInput,
): Promise<GenerateSocialThumbnailZipResult> {
  const htmlResult: GenerateHtmlExportResult = generateHtmlExport(input);
  if (!htmlResult.ok) {
    return { ok: false, reasons: htmlResult.reasons };
  }

  let pngBlob: Blob;
  try {
    // Deliberately does not forward `input.interactionMode` -- thumbnail
    // capture is always stable demo mode, regardless of the export's own
    // interaction mode. See `captureSocialThumbnail.ts`'s doc comment.
    pngBlob = await captureSocialThumbnail(input.scene, input.cameraOverlay);
  } catch (error) {
    throw new SocialThumbnailZipError(error instanceof Error ? error.message : String(error), {
      cause: error,
    });
  }

  let zipBlob: Blob;
  try {
    const zip = new JSZip();
    zip.file('index.html', htmlResult.html);
    zip.file('thumbnail.png', pngBlob);
    zipBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
  } catch (error) {
    throw new SocialThumbnailZipError(
      `ZIP encoding failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  return { ok: true, zipBlob, filename: zipFilename(htmlResult.filename) };
}

/** Triggers a browser download of `blob` as `filename` via an object URL
 * + synthetic `<a download>` click -- the exact same pattern
 * `generateHtmlExport.ts`'s `triggerHtmlDownload` uses, revoking the URL
 * in a `finally` block so it's never leaked even if the click itself
 * throws. */
export function triggerZipDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(url);
  }
}
