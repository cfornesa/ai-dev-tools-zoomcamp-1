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
