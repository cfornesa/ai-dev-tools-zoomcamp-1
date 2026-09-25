export const DEFAULT_ART_PIECE_ASPECT_RATIO = '16 / 9';

export function aspectRatioFromMetadata(metadata: Record<string, unknown> | undefined): string {
  if (!metadata) return DEFAULT_ART_PIECE_ASPECT_RATIO;
  const declared = metadata.aspect_ratio ?? metadata.aspectRatio ?? metadata.ratio;
  if (typeof declared === 'number' && Number.isFinite(declared) && declared > 0) {
    return String(declared);
  }
  if (typeof declared === 'string' && declared.trim()) {
    const normalized = declared.trim().replace(':', ' / ');
    if (/^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/.test(normalized)) return normalized;
    const numeric = Number(normalized);
    if (Number.isFinite(numeric) && numeric > 0) return normalized;
  }

  const canvas = metadata.canvas;
  const dimensions =
    canvas && typeof canvas === 'object' ? (canvas as Record<string, unknown>) : metadata;
  const width = Number(dimensions.width);
  const height = Number(dimensions.height);
  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return `${width} / ${height}`;
  }
  return DEFAULT_ART_PIECE_ASPECT_RATIO;
}
