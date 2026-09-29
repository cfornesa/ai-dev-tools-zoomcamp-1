import {
  getMediaBlob,
  importMediaAsset,
  listMediaAssetsForProject,
  openLocalProjectDatabase,
  SUPPORTED_MEDIA_MIME_TYPES,
  type LocalMediaAssetRecord,
} from '../storage/localProjectRepository';

/**
 * Issue #847/#1049: the ambient-sample audio asset is bound to a
 * server-backed piece's own id, reusing the local-first media store
 * (`localProjectRepository.ts`'s `mediaAssets`/`mediaBlobs`, which key
 * generically on any string id -- not type-constrained to a 2D `Project`).
 * This module is the one seam a 3D/generated piece's editor needs; no
 * storage-schema change was required (see
 * `.agents/memory/piece-scoped-media-binding-already-generic.md`).
 */

export class AmbientSampleUnsupportedType extends Error {
  constructor(mimeType: string) {
    super(`"${mimeType}" is not a supported audio type for an ambient sample.`);
    this.name = 'AmbientSampleUnsupportedType';
  }
}

const AUDIO_MIME_TYPES = new Set(
  [...SUPPORTED_MEDIA_MIME_TYPES].filter((type) => type.startsWith('audio/')),
);
export const MAX_AMBIENT_SAMPLE_BYTES = 10 * 1024 * 1024;

/** Imports `file` as the piece's ambient-sample asset, returning the new
 * local asset id to store in `scene.sonic.extras.ambient_sample`. Throws
 * `AmbientSampleUnsupportedType` for a non-audio file (checked before any
 * IndexedDB write) or whatever `importMediaAsset` itself throws for a
 * quota/storage failure. */
export async function uploadAmbientSample(pieceId: string, file: File): Promise<string> {
  if (!AUDIO_MIME_TYPES.has(file.type)) {
    throw new AmbientSampleUnsupportedType(file.type);
  }
  if (file.size > MAX_AMBIENT_SAMPLE_BYTES) {
    throw new Error('Ambient samples must be 10MB or smaller.');
  }
  const db = await openLocalProjectDatabase();
  try {
    const record = await importMediaAsset(db, {
      projectId: pieceId,
      blob: file,
      mimeType: file.type,
      filename: file.name,
      altText: '',
    });
    return record.id;
  } finally {
    db.close();
  }
}

/** Resolves an ambient-sample asset id to its blob, or `null` if the
 * asset no longer exists locally (fail-soft callers fall back to the
 * synthesized ambient walk rather than throwing). Public viewers do not
 * provide a remote resolver: ambient samples are export-only (#1067). */
export async function resolveAmbientSample(
  assetId: string,
  remoteResolver?: (assetId: string) => Promise<Blob | null>,
): Promise<Blob | null> {
  try {
    const db = await openLocalProjectDatabase();
    try {
      const local = await getMediaBlob(db, assetId);
      if (local) return local;
    } finally {
      db.close();
    }
  } catch {
    // Public viewers may have no IndexedDB (blocked storage, private mode,
    // or a browser that never opened a local editor). They still need the
    // anonymous server asset boundary as a fallback.
  }
  return remoteResolver ? remoteResolver(assetId) : null;
}

/** The stored metadata (filename, size) for an ambient-sample asset, for
 * display -- `null` if the piece has no media assets or the specific id
 * is no longer present. */
export async function getAmbientSampleMetadata(
  pieceId: string,
  assetId: string,
): Promise<LocalMediaAssetRecord | null> {
  const db = await openLocalProjectDatabase();
  try {
    const assets = await listMediaAssetsForProject(db, pieceId);
    return assets.find((asset) => asset.id === assetId) ?? null;
  } finally {
    db.close();
  }
}
