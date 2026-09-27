import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import { validateScene } from '../validation/scene';
import { validateScene3D } from '../validation/scene3d';

export const PIECE_PACKAGE_FORMAT_VERSION = 1;
export const PIECE_PACKAGE_MAX_BYTES = 52_428_800;
export const PIECE_PACKAGE_MAX_FILES = 100;

export type PiecePackageKind = '2d' | '3d' | 'generated';
export type PiecePackageRecord = {
  schemaVersion: number;
  data: Record<string, unknown>;
};
export type PiecePackageMedia = {
  filename: string;
  altText: string;
  mimeType: string;
  bytes: Uint8Array;
};
export type PiecePackageInput = {
  kind: PiecePackageKind;
  title: string;
  description: string;
  tags?: string[];
  visibilityIntent?: 'private' | 'public' | 'unpublished';
  appVersion: string;
  records: PiecePackageRecord[];
  mediaAssets?: PiecePackageMedia[];
  source?: Record<string, unknown> | null;
  ink?: Record<string, unknown> | null;
  sonic?: Record<string, unknown> | null;
  capabilities?: Record<string, unknown> | null;
};

export type PiecePackage = Omit<PiecePackageInput, 'mediaAssets' | 'records'> & {
  records: PiecePackageRecord[];
  mediaAssets: PiecePackageMedia[];
  exportedAt: string;
};

type ManifestFile = { index: number; path: string; byteSize: number; sha256: string };
type PackageManifest = {
  formatVersion: 1;
  kind: PiecePackageKind;
  metadata: {
    title: string;
    description: string;
    tags: string[];
    visibilityIntent: 'private' | 'public' | 'unpublished';
    origin: { appVersion: string; exportedAt: string };
  };
  records: Array<{ index: number; schemaVersion: number; fileIndex: number }>;
  mediaAssets: Array<{
    index: number;
    fileIndex: number;
    filename: string;
    altText: string;
    mimeType: string;
    byteSize: number;
    sha256: string;
  }>;
  files: ManifestFile[];
  source?: Record<string, unknown> | null;
  ink?: Record<string, unknown> | null;
  sonic?: Record<string, unknown> | null;
  capabilities?: Record<string, unknown> | null;
};

export class PiecePackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PiecePackageError';
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new PiecePackageError(message);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function jsonBytes(value: unknown): Uint8Array {
  return strToU8(JSON.stringify(value));
}

function assertRecordForKind(kind: PiecePackageKind, data: Record<string, unknown>): void {
  if (kind === '2d') {
    const result = validateScene(data);
    assert(result.valid, `2D record is invalid: ${result.errors[0]?.message ?? 'unknown error'}.`);
  } else if (kind === '3d') {
    const result = validateScene3D(data);
    assert(result.valid, `3D record is invalid: ${result.errors[0]?.message ?? 'unknown error'}.`);
  }
}

function isSafeFilePath(path: unknown): path is `files/${number}.json` | `files/${number}.bin` {
  return typeof path === 'string' && /^files\/\d+\.(json|bin)$/.test(path);
}

export function validatePiecePackageManifest(value: unknown): asserts value is PackageManifest {
  assert(value && typeof value === 'object', 'Package manifest is not an object.');
  const manifest = value as Partial<PackageManifest>;
  assert(manifest.formatVersion === PIECE_PACKAGE_FORMAT_VERSION, 'Unsupported package format.');
  assert(
    manifest.kind === '2d' || manifest.kind === '3d' || manifest.kind === 'generated',
    'Invalid package kind.',
  );
  assert(
    manifest.metadata && typeof manifest.metadata === 'object',
    'Package metadata is missing.',
  );
  assert(typeof manifest.metadata.title === 'string', 'Package title is invalid.');
  assert(typeof manifest.metadata.description === 'string', 'Package description is invalid.');
  assert(Array.isArray(manifest.records), 'Package records are missing.');
  assert(Array.isArray(manifest.mediaAssets), 'Package media assets are missing.');
  assert(Array.isArray(manifest.files), 'Package file manifest is missing.');
  assert(manifest.files.length <= PIECE_PACKAGE_MAX_FILES, 'Package contains too many files.');
  assert(
    new Set(manifest.files.map((file) => file.index)).size === manifest.files.length,
    'Package file indexes must be unique.',
  );
  for (const file of manifest.files) {
    assert(isSafeFilePath(file.path), `Unsafe package path: ${String(file.path)}.`);
    assert(
      typeof file.index === 'number' && typeof file.byteSize === 'number',
      'Invalid package file entry.',
    );
    assert(file.byteSize <= PIECE_PACKAGE_MAX_BYTES, 'Package file exceeds the byte limit.');
    assert(
      typeof file.sha256 === 'string' && /^[a-f0-9]{64}$/.test(file.sha256),
      'Invalid package checksum.',
    );
  }
}

export async function buildPiecePackage(input: PiecePackageInput): Promise<Uint8Array> {
  const exportedAt = new Date().toISOString();
  const files: Record<string, Uint8Array> = {};
  const fileEntries: ManifestFile[] = [];
  const addFile = async (bytes: Uint8Array, extension: 'json' | 'bin'): Promise<number> => {
    const index = fileEntries.length;
    const path = `files/${index}.${extension}` as const;
    files[path] = bytes;
    fileEntries.push({ index, path, byteSize: bytes.byteLength, sha256: await sha256(bytes) });
    return index;
  };

  const records: PackageManifest['records'] = [];
  for (const [index, record] of input.records.entries()) {
    assertRecordForKind(input.kind, record.data);
    const fileIndex = await addFile(jsonBytes(record.data), 'json');
    records.push({ index, schemaVersion: record.schemaVersion, fileIndex });
  }
  const mediaAssets: PackageManifest['mediaAssets'] = [];
  for (const [index, asset] of (input.mediaAssets ?? []).entries()) {
    const fileIndex = await addFile(asset.bytes, 'bin');
    mediaAssets.push({
      index,
      fileIndex,
      filename: asset.filename,
      altText: asset.altText,
      mimeType: asset.mimeType,
      byteSize: asset.bytes.byteLength,
      sha256: fileEntries[fileIndex].sha256,
    });
  }
  const manifest: PackageManifest = {
    formatVersion: PIECE_PACKAGE_FORMAT_VERSION,
    kind: input.kind,
    metadata: {
      title: input.title,
      description: input.description,
      tags: input.tags ?? [],
      visibilityIntent: input.visibilityIntent ?? 'private',
      origin: { appVersion: input.appVersion, exportedAt },
    },
    records,
    mediaAssets,
    files: fileEntries,
    source: input.source ?? null,
    ink: input.ink ?? null,
    sonic: input.sonic ?? null,
    capabilities: input.capabilities ?? null,
  };
  const manifestBytes = jsonBytes(manifest);
  files['manifest.json'] = manifestBytes;
  assert(
    Object.values(files).reduce((total, payload) => total + payload.byteLength, 0) <=
      PIECE_PACKAGE_MAX_BYTES,
    'Package exceeds the byte limit.',
  );
  const result = zipSync(files, { level: 0 });
  assert(result.byteLength <= PIECE_PACKAGE_MAX_BYTES, 'Package exceeds the byte limit.');
  return result;
}

export async function parsePiecePackage(bytes: Uint8Array): Promise<PiecePackage> {
  assert(bytes.byteLength <= PIECE_PACKAGE_MAX_BYTES, 'Package exceeds the byte limit.');
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new PiecePackageError('Package is not a readable ZIP archive.');
  }
  const paths = Object.keys(entries);
  assert(paths.length <= PIECE_PACKAGE_MAX_FILES + 1, 'Package contains too many files.');
  assert(
    paths.reduce((total, path) => total + entries[path].byteLength, 0) <= PIECE_PACKAGE_MAX_BYTES,
    'Package exceeds the byte limit.',
  );
  assert(
    paths.every((path) => path === 'manifest.json' || isSafeFilePath(path)),
    'Package contains an unsafe path.',
  );
  assert(entries['manifest.json'], 'Package manifest is missing.');
  let manifest: unknown;
  try {
    manifest = JSON.parse(strFromU8(entries['manifest.json']));
  } catch {
    throw new PiecePackageError('Package manifest is not valid JSON.');
  }
  validatePiecePackageManifest(manifest);
  const byIndex = new Map(manifest.files.map((file) => [file.index, file]));
  for (const file of manifest.files) {
    const payload = entries[file.path];
    assert(payload, `Package payload is missing: ${file.path}.`);
    assert(payload.byteLength === file.byteSize, `Package byte size mismatch: ${file.path}.`);
    assert((await sha256(payload)) === file.sha256, `Package checksum mismatch: ${file.path}.`);
  }
  const records = await Promise.all(
    manifest.records.map(async (record) => {
      const file = byIndex.get(record.fileIndex);
      assert(file, `Record references missing file ${record.fileIndex}.`);
      assert(file.path.endsWith('.json'), 'Record payload must be JSON.');
      try {
        return {
          schemaVersion: record.schemaVersion,
          data: JSON.parse(strFromU8(entries[file.path])),
        };
      } catch {
        throw new PiecePackageError(`Record ${record.index} is not valid JSON.`);
      }
    }),
  );
  const mediaAssets = manifest.mediaAssets.map((asset) => {
    const file = byIndex.get(asset.fileIndex);
    assert(file, `Media asset references missing file ${asset.fileIndex}.`);
    assert(file.path.endsWith('.bin'), 'Media asset payload must be binary.');
    return {
      filename: asset.filename,
      altText: asset.altText,
      mimeType: asset.mimeType,
      bytes: entries[file.path],
    };
  });
  return {
    kind: manifest.kind,
    title: manifest.metadata.title,
    description: manifest.metadata.description,
    tags: manifest.metadata.tags,
    visibilityIntent: manifest.metadata.visibilityIntent,
    appVersion: manifest.metadata.origin.appVersion,
    exportedAt: manifest.metadata.origin.exportedAt,
    records,
    mediaAssets,
    source: manifest.source ?? null,
    ink: manifest.ink ?? null,
    sonic: manifest.sonic ?? null,
    capabilities: manifest.capabilities ?? null,
  };
}

function legacyBase64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function legacyExtensionForMime(mimeType: string): string {
  return (
    {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
    }[mimeType] ?? '.bin'
  );
}

/** Convert the pre-#930 single-project JSON package (#512) into V1 input. */
export function convertLegacyJsonPackage(value: unknown): PiecePackageInput {
  assert(value && typeof value === 'object', 'Legacy package is not an object.');
  const legacy = value as Record<string, any>;
  assert(legacy.formatVersion === 1, 'Unsupported legacy JSON package.');
  assert(legacy.project && typeof legacy.project.title === 'string', 'Legacy project is invalid.');
  assert(
    Array.isArray(legacy.scenes) && Array.isArray(legacy.mediaAssets),
    'Legacy package is incomplete.',
  );
  return {
    kind: '2d',
    title: legacy.project.title,
    description: '',
    appVersion: 'legacy-512',
    records: legacy.scenes.map((scene: any) => ({
      schemaVersion: 1,
      data: scene.sceneJson,
    })),
    mediaAssets: legacy.mediaAssets.map((asset: any) => ({
      filename: asset.filename,
      altText: asset.altText,
      mimeType: asset.mimeType,
      bytes: legacyBase64ToBytes(asset.dataBase64),
    })),
  };
}

/** Convert the pre-#930 local database archive (#526) into V1 input. */
export function convertLegacyDatabaseArchive(bytes: Uint8Array): PiecePackageInput {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new PiecePackageError('Legacy archive is not a readable ZIP archive.');
  }
  assert(entries['manifest.json'], 'Legacy archive manifest is missing.');
  const manifest = JSON.parse(strFromU8(entries['manifest.json'])) as Record<string, any>;
  assert(
    manifest.formatVersion === 1 && Array.isArray(manifest.projects),
    'Unsupported legacy archive.',
  );
  assert(manifest.projects.length === 1, 'Legacy archive must contain exactly one project.');
  const project = manifest.projects[0];
  return {
    kind: '2d',
    title: project.title,
    description: '',
    appVersion: 'legacy-526',
    records: project.scenes.map((scene: any) => ({
      schemaVersion: 1,
      data: JSON.parse(strFromU8(entries[`projects/${project.index}/scenes/${scene.index}.json`])),
    })),
    mediaAssets: project.mediaAssets.map((asset: any) => ({
      filename: asset.filename,
      altText: asset.altText,
      mimeType: asset.mimeType,
      bytes:
        entries[
          `projects/${project.index}/media/${asset.index}${legacyExtensionForMime(asset.mimeType)}`
        ],
    })),
  };
}
