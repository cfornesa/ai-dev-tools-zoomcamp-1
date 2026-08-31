/**
 * Issue #285: extracted from `generateSocialThumbnailZip.ts`'s
 * `triggerZipDownload`/`generateHtmlExport.ts`'s `triggerHtmlDownload` --
 * three call sites (those two, plus `artPieceBundle.ts`) had already
 * hand-rolled the identical "object URL + synthetic `<a download>` click"
 * pattern before this. This is the single shared helper going forward for
 * any new caller (starting with #285's 2D screenshot capture and #286's
 * 3D equivalent); the pre-existing call sites are left as-is since
 * touching them isn't required by either issue's scope.
 */
export function downloadBlob(blob: Blob, filename: string): void {
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
