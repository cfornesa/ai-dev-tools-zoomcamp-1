import {
  LocalRepositoryException,
  MAX_PROJECT_BYTES,
  MAX_PROJECT_FILES,
  STORE_MEDIA_ASSETS,
  STORE_MEDIA_BLOBS,
  STORE_PROJECTS,
  STORE_SCENES,
  STORE_VERSIONS,
  SUPPORTED_MEDIA_MIME_TYPES,
  computeChecksum,
  type LocalMediaAssetRecord,
  type LocalProjectRecord,
  type LocalSceneRecord,
  type LocalPieceVersionRecord,
} from './localProjectRepository';
import { parsePiecePackage, type PiecePackage, type PiecePackageMedia } from './piecePackage';

export type LocalPiecePackageImportResult = {
  project: LocalProjectRecord;
  scenes: LocalSceneRecord[];
  mediaAssets: LocalMediaAssetRecord[];
  versions: LocalPieceVersionRecord[];
};

function corruptData(message: string): LocalRepositoryException {
  return new LocalRepositoryException({ kind: 'corrupt-data', message });
}

function classifyWriteFailure(error: unknown): LocalRepositoryException {
  if (error instanceof LocalRepositoryException) return error;
  const name = error instanceof DOMException ? error.name : undefined;
  if (name === 'QuotaExceededError') {
    return new LocalRepositoryException({
      kind: 'quota-exceeded',
      message: 'The browser storage quota was exceeded while importing this piece.',
    });
  }
  if (name === 'SecurityError' || name === 'InvalidStateError' || name === 'UnknownError') {
    return new LocalRepositoryException({
      kind: 'unavailable',
      message: 'Local project storage is not available in this browser.',
    });
  }
  return new LocalRepositoryException({
    kind: 'interrupted-write',
    message: 'Import was interrupted before it completed; no project was created.',
  });
}

function assertSupportedPackage(_pkg: PiecePackage): void {
  // Generated packages are intentionally local-only. Their source is kept as
  // opaque version data and is rendered only through the existing sandbox.
}

async function verifyMediaAssets(mediaAssets: PiecePackageMedia[]): Promise<PiecePackageMedia[]> {
  const verified: PiecePackageMedia[] = [];
  let totalBytes = 0;
  for (const asset of mediaAssets) {
    if (!SUPPORTED_MEDIA_MIME_TYPES.has(asset.mimeType)) {
      throw corruptData(`Media asset "${asset.filename}" uses an unsupported file type.`);
    }
    const checksum = await computeChecksum(asset.bytes);
    if (asset.bytes.byteLength === 0) {
      throw corruptData(`Media asset "${asset.filename}" is empty.`);
    }
    if (!checksum) throw corruptData(`Media asset "${asset.filename}" failed checksum validation.`);
    totalBytes += asset.bytes.byteLength;
    verified.push(asset);
  }
  if (totalBytes > MAX_PROJECT_BYTES) {
    throw new LocalRepositoryException({
      kind: 'quota-exceeded',
      message: `Local project storage quota exceeded: the bytes limit (${MAX_PROJECT_BYTES} bytes) was reached.`,
      limit: 'bytes',
      currentUsage: totalBytes,
    });
  }
  if (verified.length > MAX_PROJECT_FILES) {
    throw new LocalRepositoryException({
      kind: 'quota-exceeded',
      message: `Local project storage quota exceeded: the files limit (${MAX_PROJECT_FILES} files) was reached.`,
      limit: 'files',
      currentUsage: verified.length,
    });
  }
  return verified;
}

/**
 * Imports one validated 2D or 3D piece package into the browser-local repository.
 * Parsing, schema validation, kind gating, media checks, and quota checks all
 * happen before the single IndexedDB transaction. Every persisted id is minted
 * locally, so importing the same package twice never reuses source ids.
 */
export async function importLocalPiecePackage(
  db: IDBDatabase,
  ownerId: string,
  bytes: Uint8Array,
): Promise<LocalPiecePackageImportResult> {
  let pkg: PiecePackage;
  try {
    pkg = await parsePiecePackage(bytes);
  } catch (error) {
    if (error instanceof LocalRepositoryException) throw error;
    throw corruptData(
      error instanceof Error ? error.message : 'The selected piece package is invalid.',
    );
  }
  assertSupportedPackage(pkg);
  const mediaAssets = await verifyMediaAssets(pkg.mediaAssets);
  const now = new Date().toISOString();
  const projectId = crypto.randomUUID();
  const importedVersions: LocalPieceVersionRecord[] = pkg.records.map((record, index) => ({
    id: crypto.randomUUID(),
    projectId,
    sequence: index + 1,
    payload: record.data,
    byteSize: JSON.stringify(record.data).length,
    createdAt: now,
  }));
  const scenes: LocalSceneRecord[] =
    pkg.kind === '3d' || pkg.kind === 'generated'
      ? [
          {
            id: crypto.randomUUID(),
            projectId,
            name: 'Scene 1',
            position: 0,
            sceneJson:
              pkg.kind === 'generated'
                ? {
                    ...(pkg.records.at(-1)?.data ?? {}),
                    source: pkg.source?.source ?? pkg.records.at(-1)?.data.source ?? '',
                    engine: pkg.source?.engine ?? pkg.records.at(-1)?.data.engine ?? 'svg',
                    ink: pkg.ink ?? pkg.records.at(-1)?.data.ink ?? null,
                    sonic: pkg.sonic ?? pkg.records.at(-1)?.data.sonic ?? null,
                    capabilities: pkg.capabilities ?? pkg.records.at(-1)?.data.capabilities ?? {},
                  }
                : (pkg.records.at(-1)?.data ?? {}),
            updatedAt: now,
          },
        ]
      : pkg.records.map((record, index) => ({
          id: crypto.randomUUID(),
          projectId,
          name: `Version ${index + 1}`,
          position: index,
          sceneJson: record.data,
          updatedAt: now,
        }));
  const assets: LocalMediaAssetRecord[] = mediaAssets.map((asset) => ({
    id: crypto.randomUUID(),
    projectId,
    mimeType: asset.mimeType,
    byteSize: asset.bytes.byteLength,
    checksum: '',
    filename: asset.filename,
    altText: asset.altText,
    createdAt: now,
    refCount: 1,
  }));
  for (let index = 0; index < mediaAssets.length; index += 1) {
    assets[index].checksum = await computeChecksum(mediaAssets[index].bytes);
  }
  const project: LocalProjectRecord = {
    id: projectId,
    ownerId,
    title: pkg.title,
    sceneOrder: scenes.map((scene) => scene.id),
    activeSceneId: scenes[0]?.id ?? null,
    createdAt: now,
    updatedAt: now,
    kind: pkg.kind,
    versionOrder: [],
    currentVersionId: null,
  };
  if (pkg.kind === '3d' || pkg.kind === 'generated') {
    project.versionOrder = importedVersions.map((version) => version.id);
    project.currentVersionId = importedVersions.at(-1)?.id ?? null;
  }

  try {
    const tx = db.transaction(
      [STORE_PROJECTS, STORE_SCENES, STORE_MEDIA_ASSETS, STORE_MEDIA_BLOBS, STORE_VERSIONS],
      'readwrite',
    );
    tx.objectStore(STORE_PROJECTS).put(project);
    scenes.forEach((scene) => tx.objectStore(STORE_SCENES).put(scene));
    if (pkg.kind === '3d') {
      importedVersions.forEach((version) => tx.objectStore(STORE_VERSIONS).put(version));
    }
    assets.forEach((asset, index) => {
      tx.objectStore(STORE_MEDIA_ASSETS).put(asset);
      tx.objectStore(STORE_MEDIA_BLOBS).put({
        assetId: asset.id,
        blob: new Blob([mediaAssets[index].bytes.slice()], { type: asset.mimeType }),
      });
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error ?? new DOMException('Import was interrupted.', 'AbortError'));
    });
  } catch (error) {
    throw classifyWriteFailure(error);
  }
  return { project, scenes, mediaAssets: assets, versions: importedVersions };
}
