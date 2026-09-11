/**
 * Issue #512: export/import of a complete local project package, exactly
 * per the format baked into the issue -- a single JSON file (no zip/archive
 * package introduced) with blobs re-encoded as base64. Import re-validates
 * every asset's checksum against the decoded bytes before accepting it,
 * generates fresh local UUIDs for the project/scenes/assets (collision-safe
 * -- ids from the file are never reused), and rejects the whole import
 * atomically if any checksum fails or `formatVersion` is unrecognized: no
 * partial project is ever created, and the caller's last known-good local
 * state is untouched by a rejected import.
 */

import {
  LocalRepositoryException,
  MAX_PROJECT_BYTES,
  MAX_PROJECT_FILES,
  STORE_MEDIA_ASSETS,
  STORE_MEDIA_BLOBS,
  STORE_PROJECTS,
  STORE_SCENES,
  computeChecksum,
  getProject,
  listMediaAssetsForProject,
  listScenesForProject,
  getMediaBlob,
  type LocalMediaAssetRecord,
  type LocalProjectRecord,
  type LocalSceneRecord,
} from './localProjectRepository';

export const EXPORT_FORMAT_VERSION = 1;

export type ExportedScene = {
  name: string;
  position: number;
  sceneJson: Record<string, unknown>;
};

export type ExportedMediaAsset = {
  mimeType: string;
  byteSize: number;
  checksum: string;
  filename: string;
  altText: string;
  dataBase64: string;
};

export type LocalProjectExportPackage = {
  formatVersion: 1;
  exportedAt: string;
  project: { title: string };
  scenes: ExportedScene[];
  mediaAssets: ExportedMediaAsset[];
};

function corruptData(message: string): LocalRepositoryException {
  return new LocalRepositoryException({ kind: 'corrupt-data', message });
}

// --- base64 helpers ----------------------------------------------------

/** Encodes an `ArrayBuffer` as base64 without going through `FileReader`'s
 * (async, DOM-only) data-URL path -- `btoa`/binary-string chunking works
 * identically in the browser and in jsdom/vitest, and avoids the 2^31-ish
 * call-stack-argument limits of naively spreading a huge byte array into
 * `String.fromCharCode`. */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// --- Export --------------------------------------------------------------

/** Builds a complete export package for one local project: its title,
 * every scene (name/position/sceneJson only -- no ids, since import always
 * mints fresh ones), and every media asset's metadata plus its blob
 * re-encoded as base64. */
export async function exportLocalProject(
  db: IDBDatabase,
  ownerId: string,
  projectId: string,
): Promise<LocalProjectExportPackage> {
  const project = await getProject(db, ownerId, projectId);
  if (!project) {
    throw corruptData(`Local project "${projectId}" was not found for this owner.`);
  }
  const scenes = await listScenesForProject(db, projectId);
  const assets = await listMediaAssetsForProject(db, projectId);

  const orderedScenes = [...scenes].sort((a, b) => a.position - b.position);
  const exportedScenes: ExportedScene[] = orderedScenes.map((scene) => ({
    name: scene.name,
    position: scene.position,
    sceneJson: scene.sceneJson,
  }));

  const exportedAssets: ExportedMediaAsset[] = [];
  for (const asset of assets) {
    const blob = await getMediaBlob(db, asset.id);
    if (!blob) {
      throw corruptData(`Local media asset "${asset.id}" is missing its blob.`);
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    exportedAssets.push({
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      checksum: asset.checksum,
      filename: asset.filename,
      altText: asset.altText,
      dataBase64: bytesToBase64(bytes),
    });
  }

  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    project: { title: project.title },
    scenes: exportedScenes,
    mediaAssets: exportedAssets,
  };
}

// --- Import --------------------------------------------------------------

function isExportedScene(value: unknown): value is ExportedScene {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<ExportedScene>;
  return (
    typeof s.name === 'string' &&
    typeof s.position === 'number' &&
    typeof s.sceneJson === 'object' &&
    s.sceneJson !== null
  );
}

function isExportedMediaAsset(value: unknown): value is ExportedMediaAsset {
  if (!value || typeof value !== 'object') return false;
  const a = value as Partial<ExportedMediaAsset>;
  return (
    typeof a.mimeType === 'string' &&
    typeof a.byteSize === 'number' &&
    typeof a.checksum === 'string' &&
    typeof a.filename === 'string' &&
    typeof a.altText === 'string' &&
    typeof a.dataBase64 === 'string'
  );
}

/** Validates the *shape* of a decoded package (before touching any bytes or
 * the database) -- an unrecognized `formatVersion` or a structurally
 * malformed package is rejected immediately as corrupt data, atomically
 * (nothing has been written yet). */
function validatePackageShape(value: unknown): asserts value is LocalProjectExportPackage {
  if (!value || typeof value !== 'object') {
    throw corruptData('Import package is not a valid JSON object.');
  }
  const pkg = value as Partial<LocalProjectExportPackage>;
  if (pkg.formatVersion !== EXPORT_FORMAT_VERSION) {
    throw corruptData(`Unrecognized import package formatVersion: ${String(pkg.formatVersion)}.`);
  }
  if (!pkg.project || typeof pkg.project.title !== 'string') {
    throw corruptData('Import package is missing a valid project title.');
  }
  if (!Array.isArray(pkg.scenes) || !pkg.scenes.every(isExportedScene)) {
    throw corruptData('Import package has malformed scene entries.');
  }
  if (!Array.isArray(pkg.mediaAssets) || !pkg.mediaAssets.every(isExportedMediaAsset)) {
    throw corruptData('Import package has malformed media asset entries.');
  }
}

export type ImportLocalProjectResult = {
  project: LocalProjectRecord;
  scenes: LocalSceneRecord[];
  mediaAssets: LocalMediaAssetRecord[];
};

/**
 * Restores an export package into a brand-new local project owned by
 * `ownerId`. Every checksum is re-validated against the decoded bytes
 * *before* anything is written; a single mismatch (or any other structural
 * problem) rejects the whole import with no partial project created. Fresh
 * UUIDs are generated for the project, every scene, and every media asset
 * -- ids are never carried over from the file, which is what makes
 * importing the same package twice (or into a database that already has
 * ids matching the file, however unlikely) always collision-safe.
 */
export async function importLocalProject(
  db: IDBDatabase,
  ownerId: string,
  raw: unknown,
): Promise<ImportLocalProjectResult> {
  validatePackageShape(raw);
  const pkg = raw;

  // Decode + re-validate every asset's checksum up front, before any
  // IndexedDB write starts -- a single bad checksum must reject the whole
  // import atomically.
  const decodedAssets: Array<{ meta: ExportedMediaAsset; bytes: Uint8Array }> = [];
  for (const assetMeta of pkg.mediaAssets) {
    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(assetMeta.dataBase64);
    } catch {
      throw corruptData(`Media asset "${assetMeta.filename}" has invalid base64 data.`);
    }
    if (bytes.byteLength !== assetMeta.byteSize) {
      throw corruptData(
        `Media asset "${assetMeta.filename}" byte size does not match its recorded size.`,
      );
    }
    const recomputed = await computeChecksum(bytes);
    if (recomputed !== assetMeta.checksum) {
      throw corruptData(`Media asset "${assetMeta.filename}" failed checksum validation.`);
    }
    decodedAssets.push({ meta: assetMeta, bytes });
  }

  // Same project-level quota importMediaAsset enforces, applied to the
  // package as a whole: an import that would create a project already over
  // either limit is rejected atomically, before any write starts.
  const totalBytes = decodedAssets.reduce((sum, a) => sum + a.bytes.byteLength, 0);
  if (totalBytes > MAX_PROJECT_BYTES) {
    throw new LocalRepositoryException({
      kind: 'quota-exceeded',
      message: `Local project storage quota exceeded: the bytes limit (${MAX_PROJECT_BYTES} bytes) was reached.`,
      limit: 'bytes',
      currentUsage: totalBytes,
    });
  }
  if (decodedAssets.length > MAX_PROJECT_FILES) {
    throw new LocalRepositoryException({
      kind: 'quota-exceeded',
      message: `Local project storage quota exceeded: the files limit (${MAX_PROJECT_FILES} files) was reached.`,
      limit: 'files',
      currentUsage: decodedAssets.length,
    });
  }

  const now = new Date().toISOString();
  const projectId = crypto.randomUUID();

  const sceneRecords: LocalSceneRecord[] = pkg.scenes
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((scene, index) => ({
      id: crypto.randomUUID(),
      projectId,
      name: scene.name,
      position: index,
      sceneJson: scene.sceneJson,
      updatedAt: now,
    }));

  const assetRecords: LocalMediaAssetRecord[] = decodedAssets.map(({ meta }) => ({
    id: crypto.randomUUID(),
    projectId,
    mimeType: meta.mimeType,
    byteSize: meta.byteSize,
    checksum: meta.checksum,
    filename: meta.filename,
    altText: meta.altText,
    createdAt: now,
    refCount: 1,
  }));

  const projectRecord: LocalProjectRecord = {
    id: projectId,
    ownerId,
    title: pkg.project.title,
    sceneOrder: sceneRecords.map((s) => s.id),
    activeSceneId: sceneRecords[0]?.id ?? null,
    createdAt: now,
    updatedAt: now,
  };

  // Single atomic transaction across every affected store: either the
  // entire project (metadata + scenes + assets + blobs) commits, or (on
  // any failure) nothing does, leaving whatever local projects already
  // existed untouched.
  await new Promise<void>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(
        [STORE_PROJECTS, STORE_SCENES, STORE_MEDIA_ASSETS, STORE_MEDIA_BLOBS],
        'readwrite',
      );
    } catch (err) {
      reject(err instanceof LocalRepositoryException ? err : corruptData(String(err)));
      return;
    }
    tx.objectStore(STORE_PROJECTS).put(projectRecord);
    for (const scene of sceneRecords) {
      tx.objectStore(STORE_SCENES).put(scene);
    }
    for (let i = 0; i < assetRecords.length; i += 1) {
      const assetRecord = assetRecords[i];
      const bytes = decodedAssets[i].bytes;
      tx.objectStore(STORE_MEDIA_ASSETS).put(assetRecord);
      tx.objectStore(STORE_MEDIA_BLOBS).put({
        assetId: assetRecord.id,
        blob: new Blob([bytes.slice()], { type: assetRecord.mimeType }),
      });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new DOMException('Import was interrupted.', 'AbortError'));
  }).catch((err) => {
    if (err instanceof LocalRepositoryException) throw err;
    const name = err instanceof DOMException ? err.name : undefined;
    if (name === 'QuotaExceededError') {
      throw new LocalRepositoryException({
        kind: 'quota-exceeded',
        message: 'The browser storage quota was exceeded while importing this project.',
      });
    }
    throw new LocalRepositoryException({
      kind: 'interrupted-write',
      message: 'Import was interrupted before it completed; no project was created.',
    });
  });

  return { project: projectRecord, scenes: sceneRecords, mediaAssets: assetRecords };
}
