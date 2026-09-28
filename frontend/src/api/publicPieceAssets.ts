/** Anonymous media delivery for published, server-backed piece packages. */
export type PublicPieceKind = '2d' | '3d' | 'generated';

/** Fetch one intake asset without exposing the session-only local media store. */
export async function fetchPublicPieceAsset(
  kind: PublicPieceKind,
  publicId: string,
  assetId: string,
): Promise<Blob | null> {
  const response = await fetch(
    `/api/pieces/${kind}/${encodeURIComponent(publicId)}/assets/${encodeURIComponent(assetId)}/`,
    { credentials: 'include' },
  );
  if (response.status === 404 || response.status === 403) return null;
  if (!response.ok) throw new Error(`Public asset request failed with status ${response.status}.`);
  return response.blob();
}

function collectMediaAssetIds(value: unknown, result: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectMediaAssetIds(entry, result));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'mediaAssetId' && typeof child === 'string') result.add(child);
    else collectMediaAssetIds(child, result);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read public asset.'));
    reader.readAsDataURL(blob);
  });
}

/** Resolve every media reference in a scene for a self-contained export. */
export async function loadPublicSceneAssets(
  kind: Exclude<PublicPieceKind, 'generated'>,
  publicId: string,
  scene: unknown,
): Promise<Record<string, string>> {
  const ids = new Set<string>();
  collectMediaAssetIds(scene, ids);
  const entries = await Promise.all(
    [...ids].map(async (assetId) => {
      const blob = await fetchPublicPieceAsset(kind, publicId, assetId);
      return blob ? ([assetId, await blobToDataUrl(blob)] as const) : null;
    }),
  );
  return Object.fromEntries(
    entries.filter((entry): entry is readonly [string, string] => entry !== null),
  );
}
