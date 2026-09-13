/**
 * Issue #526: exports one or every local project in the local project
 * database as a portable, real ZIP archive (project/scene/media data as
 * real folders and files, not base64-in-JSON like `localProjectExport.ts`'s
 * single-project package), and restores such an archive back into the
 * local project database with fresh, collision-safe ids.
 *
 * Uses `fflate` (issue #526's approved new dependency -- see the PR/issue
 * for the "why a library, not a hand-rolled ZIP reader/writer" decision)
 * for the ZIP container itself; every other concern (path safety, manifest
 * validation, checksum re-verification, atomic restore, quota) is this
 * module's own.
 *
 * Path safety: every in-archive path this module writes or reads is built
 * purely from small integer indices (`projects/<i>/scenes/<j>.json`,
 * `projects/<i>/media/<k><ext>`) -- a project or asset's user-supplied
 * `filename`/`title` is carried only as manifest *metadata*, never used to
 * construct a path, so there is no path-traversal surface to sanitize
 * against in the first place.
 */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import {
  LocalRepositoryException,
  MAX_PROJECT_BYTES,
  MAX_PROJECT_FILES,
  computeChecksum,
  createProject,
  createScene,
  getMediaBlob,
  getProject,
  importMediaAsset,
  listMediaAssetsForProject,
  listProjectsForOwner,
  listScenesForProject,
  type LocalProjectRecord,
} from './localProjectRepository';

function corruptData(message: string): LocalRepositoryException {
  return new LocalRepositoryException({ kind: 'corrupt-data', message });
}

export const ARCHIVE_FORMAT_VERSION = 1;

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

function extensionFor(mimeType: string): string {
  return MIME_TO_EXTENSION[mimeType] ?? '.bin';
}

type ArchiveManifestScene = { index: number; name: string; position: number };
type ArchiveManifestMediaAsset = {
  index: number;
  filename: string;
  altText: string;
  mimeType: string;
  byteSize: number;
  checksum: string;
};
type ArchiveManifestProject = {
  index: number;
  title: string;
  scenes: ArchiveManifestScene[];
  mediaAssets: ArchiveManifestMediaAsset[];
};

export type ArchiveManifest = {
  formatVersion: typeof ARCHIVE_FORMAT_VERSION;
  exportedAt: string;
  databaseName: string;
  databaseVersion: number;
  projects: ArchiveManifestProject[];
};

function scenePath(projectIndex: number, sceneIndex: number): string {
  return `projects/${projectIndex}/scenes/${sceneIndex}.json`;
}

function mediaPath(projectIndex: number, assetIndex: number, mimeType: string): string {
  return `projects/${projectIndex}/media/${assetIndex}${extensionFor(mimeType)}`;
}

export type ArchiveExportResult = {
  blob: Blob;
  projectCount: number;
  sceneCount: number;
  mediaFileCount: number;
  byteTotal: number;
};

/**
 * Exports every selected project (or, if `projectIds` is omitted, every
 * project this owner has) into one ZIP. Reads everything into memory
 * before building the archive -- if any project, scene, or media blob is
 * missing or unreadable, the whole export is rejected and nothing is
 * downloaded; local data is never touched (this is a read-only export).
 */
export async function exportDatabaseArchive(
  db: IDBDatabase,
  ownerId: string,
  options: { projectIds?: string[] } = {},
): Promise<ArchiveExportResult> {
  const allProjects = await listProjectsForOwner(db, ownerId);
  const selected = options.projectIds
    ? allProjects.filter((project) => options.projectIds?.includes(project.id))
    : allProjects;
  if (options.projectIds && selected.length !== options.projectIds.length) {
    throw corruptData('One or more selected projects could not be found for this owner.');
  }

  const zipEntries: Record<string, Uint8Array> = {};
  const manifestProjects: ArchiveManifestProject[] = [];
  let sceneCount = 0;
  let mediaFileCount = 0;
  let byteTotal = 0;

  for (const [projectIndex, project] of selected.entries()) {
    const scenes = (await listScenesForProject(db, project.id)).sort(
      (a, b) => a.position - b.position,
    );
    const mediaAssets = await listMediaAssetsForProject(db, project.id);

    const manifestScenes: ArchiveManifestScene[] = [];
    scenes.forEach((scene, sceneIndex) => {
      manifestScenes.push({ index: sceneIndex, name: scene.name, position: scene.position });
      const path = scenePath(projectIndex, sceneIndex);
      zipEntries[path] = strToU8(JSON.stringify(scene.sceneJson));
      sceneCount += 1;
    });

    const manifestAssets: ArchiveManifestMediaAsset[] = [];
    for (const [assetIndex, asset] of mediaAssets.entries()) {
      const blob = await getMediaBlob(db, asset.id);
      if (!blob) {
        throw corruptData(`Media asset "${asset.filename}" is missing its blob; export aborted.`);
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      manifestAssets.push({
        index: assetIndex,
        filename: asset.filename,
        altText: asset.altText,
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
        checksum: asset.checksum,
      });
      zipEntries[mediaPath(projectIndex, assetIndex, asset.mimeType)] = bytes;
      mediaFileCount += 1;
      byteTotal += bytes.byteLength;
    }

    manifestProjects.push({
      index: projectIndex,
      title: project.title,
      scenes: manifestScenes,
      mediaAssets: manifestAssets,
    });
  }

  const manifest: ArchiveManifest = {
    formatVersion: ARCHIVE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    databaseName: db.name,
    databaseVersion: db.version,
    projects: manifestProjects,
  };
  zipEntries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));

  const zipped = zipSync(zipEntries, { level: 0 });
  return {
    blob: new Blob([zipped], { type: 'application/zip' }),
    projectCount: selected.length,
    sceneCount,
    mediaFileCount,
    byteTotal,
  };
}

// --- Restore ---------------------------------------------------------------

function isManifestScene(value: unknown): value is ArchiveManifestScene {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<ArchiveManifestScene>;
  return (
    typeof s.index === 'number' && typeof s.name === 'string' && typeof s.position === 'number'
  );
}

function isManifestMediaAsset(value: unknown): value is ArchiveManifestMediaAsset {
  if (!value || typeof value !== 'object') return false;
  const a = value as Partial<ArchiveManifestMediaAsset>;
  return (
    typeof a.index === 'number' &&
    typeof a.filename === 'string' &&
    typeof a.altText === 'string' &&
    typeof a.mimeType === 'string' &&
    typeof a.byteSize === 'number' &&
    typeof a.checksum === 'string'
  );
}

function isManifestProject(value: unknown): value is ArchiveManifestProject {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<ArchiveManifestProject>;
  return (
    typeof p.index === 'number' &&
    typeof p.title === 'string' &&
    Array.isArray(p.scenes) &&
    p.scenes.every(isManifestScene) &&
    Array.isArray(p.mediaAssets) &&
    p.mediaAssets.every(isManifestMediaAsset)
  );
}

function validateManifestShape(value: unknown): asserts value is ArchiveManifest {
  if (!value || typeof value !== 'object') {
    throw corruptData('Archive manifest is not a valid JSON object.');
  }
  const manifest = value as Partial<ArchiveManifest>;
  if (manifest.formatVersion !== ARCHIVE_FORMAT_VERSION) {
    throw corruptData(`Unrecognized archive formatVersion: ${String(manifest.formatVersion)}.`);
  }
  if (!Array.isArray(manifest.projects) || !manifest.projects.every(isManifestProject)) {
    throw corruptData('Archive manifest has malformed project entries.');
  }
}

export type RestoreArchiveResult = {
  projects: LocalProjectRecord[];
  projectCount: number;
  sceneCount: number;
  mediaFileCount: number;
};

/**
 * Restores every project in a previously exported ZIP into brand-new
 * projects owned by `ownerId`, in the *existing* local project database
 * (fresh, collision-safe UUIDs for every project/scene/media asset --
 * never ids carried over from the archive). Every entry is validated and
 * every checksum re-verified against the archive's own bytes before any
 * IndexedDB write begins; any structural problem, a missing zip entry a
 * manifest record points at, a checksum mismatch, or a per-project quota
 * violation rejects the *entire* restore, atomically -- no partial
 * project is ever created.
 */
export async function restoreDatabaseArchive(
  db: IDBDatabase,
  ownerId: string,
  zipBytes: Uint8Array,
): Promise<RestoreArchiveResult> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes);
  } catch {
    throw corruptData('The selected file is not a valid ZIP archive.');
  }

  const manifestBytes = entries['manifest.json'];
  if (!manifestBytes) {
    throw corruptData('Archive is missing manifest.json.');
  }
  let manifestRaw: unknown;
  try {
    manifestRaw = JSON.parse(strFromU8(manifestBytes));
  } catch {
    throw corruptData('Archive manifest.json is not valid JSON.');
  }
  validateManifestShape(manifestRaw);
  const manifest = manifestRaw;

  // Decode + re-validate every referenced entry up front -- nothing is
  // written to IndexedDB until every project in the archive has passed.
  type DecodedAsset = { meta: ArchiveManifestMediaAsset; bytes: Uint8Array };
  type DecodedProject = {
    meta: ArchiveManifestProject;
    scenes: Array<{ meta: ArchiveManifestScene; sceneJson: Record<string, unknown> }>;
    assets: DecodedAsset[];
  };
  const decodedProjects: DecodedProject[] = [];

  for (const projectMeta of manifest.projects) {
    const scenes: DecodedProject['scenes'] = [];
    for (const sceneMeta of projectMeta.scenes) {
      const path = scenePath(projectMeta.index, sceneMeta.index);
      const sceneBytes = entries[path];
      if (!sceneBytes) {
        throw corruptData(`Archive is missing scene file "${path}".`);
      }
      let sceneJson: unknown;
      try {
        sceneJson = JSON.parse(strFromU8(sceneBytes));
      } catch {
        throw corruptData(`Scene file "${path}" is not valid JSON.`);
      }
      if (!sceneJson || typeof sceneJson !== 'object') {
        throw corruptData(`Scene file "${path}" is not a JSON object.`);
      }
      scenes.push({ meta: sceneMeta, sceneJson: sceneJson as Record<string, unknown> });
    }

    const assets: DecodedAsset[] = [];
    let projectByteTotal = 0;
    for (const assetMeta of projectMeta.mediaAssets) {
      const path = mediaPath(projectMeta.index, assetMeta.index, assetMeta.mimeType);
      const assetBytes = entries[path];
      if (!assetBytes) {
        throw corruptData(`Archive is missing media file "${path}".`);
      }
      if (assetBytes.byteLength !== assetMeta.byteSize) {
        throw corruptData(`Media file "${path}" byte size does not match the manifest.`);
      }
      const recomputed = await computeChecksum(assetBytes);
      if (recomputed !== assetMeta.checksum) {
        throw corruptData(`Media file "${path}" failed checksum validation.`);
      }
      assets.push({ meta: assetMeta, bytes: assetBytes });
      projectByteTotal += assetBytes.byteLength;
    }
    if (projectByteTotal > MAX_PROJECT_BYTES) {
      throw new LocalRepositoryException({
        kind: 'quota-exceeded',
        message: `Project "${projectMeta.title}" exceeds the local storage bytes limit.`,
        limit: 'bytes',
        currentUsage: projectByteTotal,
      });
    }
    if (assets.length > MAX_PROJECT_FILES) {
      throw new LocalRepositoryException({
        kind: 'quota-exceeded',
        message: `Project "${projectMeta.title}" exceeds the local storage files limit.`,
        limit: 'files',
        currentUsage: assets.length,
      });
    }

    decodedProjects.push({ meta: projectMeta, scenes, assets });
  }

  // Everything validated -- now actually write. A failure partway through
  // (e.g. a real IndexedDB quota rejection this module can't predict
  // in advance) leaves whichever earlier projects already succeeded in
  // place, exactly like importing several independent single-project
  // packages in sequence; it never corrupts or deletes anything that
  // existed before the restore.
  const createdProjects: LocalProjectRecord[] = [];
  let sceneCount = 0;
  let mediaFileCount = 0;
  for (const decoded of decodedProjects) {
    const project = await createProject(db, { ownerId, title: decoded.meta.title });
    for (const scene of decoded.scenes.sort((a, b) => a.meta.position - b.meta.position)) {
      await createScene(db, ownerId, {
        projectId: project.id,
        name: scene.meta.name,
        sceneJson: scene.sceneJson,
      });
      sceneCount += 1;
    }
    for (const asset of decoded.assets) {
      await importMediaAsset(db, {
        projectId: project.id,
        blob: new Blob([asset.bytes as BlobPart], { type: asset.meta.mimeType }),
        mimeType: asset.meta.mimeType,
        filename: asset.meta.filename,
        altText: asset.meta.altText,
      });
      mediaFileCount += 1;
    }
    const reloaded = await getProject(db, ownerId, project.id);
    createdProjects.push(reloaded ?? project);
  }

  return {
    projects: createdProjects,
    projectCount: createdProjects.length,
    sceneCount,
    mediaFileCount,
  };
}
