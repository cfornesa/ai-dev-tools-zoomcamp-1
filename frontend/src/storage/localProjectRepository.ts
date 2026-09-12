/**
 * Issue #512: the local-authoritative browser repository for multi-scene
 * projects and project-owned media assets, per #507's recorded local-first
 * decision. Unlike `draftAutosave.ts` (a best-effort, single-record crash
 * recovery cache layered on top of the server as the real source of truth),
 * this module *is* the source of truth for local-only projects: it owns the
 * full project/scene collection and the media asset library (metadata +
 * blobs), enforces the project-level storage quota before any write lands,
 * and classifies every failure into one of five caller-actionable kinds so a
 * failed write never corrupts or discards the last known-good project.
 *
 * Database: `creatrart-local-projects`, version 1. Five object stores --
 * `projects`, `scenes`, `mediaAssets`, `mediaBlobs`, `meta` -- exactly as
 * specified in issue #512. Every future schema change ships as a new,
 * numbered upgrade step appended to `UPGRADE_STEPS` below (keyed to the
 * target version), so upgrades compose instead of rewriting history; this
 * issue ships only step 1 (the initial schema).
 */

export const DB_NAME = 'creatrart-local-projects';
export const DB_VERSION = 1;

export const STORE_PROJECTS = 'projects';
export const STORE_SCENES = 'scenes';
export const STORE_MEDIA_ASSETS = 'mediaAssets';
export const STORE_MEDIA_BLOBS = 'mediaBlobs';
export const STORE_META = 'meta';

const OBJECT_STORE_NAMES = [
  STORE_PROJECTS,
  STORE_SCENES,
  STORE_MEDIA_ASSETS,
  STORE_MEDIA_BLOBS,
  STORE_META,
] as const;

/** #512's recorded quota: exactly 50MB of blob bytes and 100 media assets,
 * per project. Deduplicated (identical-checksum) assets never count twice
 * against either limit -- see `checkQuotaForImport` below. */
export const MAX_PROJECT_BYTES = 52_428_800;
export const MAX_PROJECT_FILES = 100;

/** #512's deliberately small, explicit allowlist of importable media MIME
 * types. Not specified in the issue's schema section itself, but required
 * by its "unsupported file type" acceptance criterion; scoped to the raster/
 * vector image types the renderer already knows how to draw (see e.g.
 * `artPieceSandbox.ts`'s and `generateHtmlExport.ts`'s existing `image/png`/
 * `image/svg+xml` handling) rather than inventing a broader media policy
 * this issue was never asked to define. */
export const SUPPORTED_MEDIA_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

// --- Classified errors ---------------------------------------------------

export type LocalRepositoryErrorKind =
  'quota-exceeded' | 'unavailable' | 'corrupt-data' | 'unsupported-file-type' | 'interrupted-write';

export type LocalRepositoryError = {
  kind: LocalRepositoryErrorKind;
  message: string;
  /** Only set for `quota-exceeded`: which limit was hit. */
  limit?: 'bytes' | 'files';
  /** Only set for `quota-exceeded`: current usage against that limit,
   * before the rejected write. */
  currentUsage?: number;
};

export class LocalRepositoryException extends Error {
  readonly kind: LocalRepositoryErrorKind;
  readonly limit?: 'bytes' | 'files';
  readonly currentUsage?: number;

  constructor(error: LocalRepositoryError) {
    super(error.message);
    this.name = 'LocalRepositoryException';
    this.kind = error.kind;
    this.limit = error.limit;
    this.currentUsage = error.currentUsage;
  }

  toError(): LocalRepositoryError {
    return {
      kind: this.kind,
      message: this.message,
      limit: this.limit,
      currentUsage: this.currentUsage,
    };
  }
}

function quotaExceeded(limit: 'bytes' | 'files', currentUsage: number): LocalRepositoryException {
  const label = limit === 'bytes' ? `${MAX_PROJECT_BYTES} bytes` : `${MAX_PROJECT_FILES} files`;
  return new LocalRepositoryException({
    kind: 'quota-exceeded',
    message: `Local project storage quota exceeded: the ${limit} limit (${label}) was reached.`,
    limit,
    currentUsage,
  });
}

function unavailable(
  message = 'Local project storage is not available in this browser.',
): LocalRepositoryException {
  return new LocalRepositoryException({ kind: 'unavailable', message });
}

function corruptData(message: string): LocalRepositoryException {
  return new LocalRepositoryException({ kind: 'corrupt-data', message });
}

function unsupportedFileType(mimeType: string): LocalRepositoryException {
  return new LocalRepositoryException({
    kind: 'unsupported-file-type',
    message: `"${mimeType}" is not a supported media file type.`,
  });
}

function interruptedWrite(
  message = 'The write was interrupted before it completed.',
): LocalRepositoryException {
  return new LocalRepositoryException({ kind: 'interrupted-write', message });
}

/** Classifies a thrown/rejected value from an IndexedDB request or
 * transaction into one of #512's five error kinds. Mirrors
 * `draftAutosave.ts`'s `classifyFailure`, extended with the two kinds that
 * module doesn't need (`unsupported-file-type` and `interrupted-write` are
 * raised explicitly at their call sites instead, since they're detected
 * before/around the IndexedDB call rather than reported by it). */
function classifyDbFailure(err: unknown): LocalRepositoryException {
  if (err instanceof LocalRepositoryException) return err;
  const name = err instanceof DOMException ? err.name : undefined;
  if (name === 'QuotaExceededError') {
    // The browser's own storage quota (distinct from #512's project-level
    // cap, but still classified the same way since it's the same caller-
    // facing concern: "you're out of room").
    return new LocalRepositoryException({
      kind: 'quota-exceeded',
      message: 'The browser storage quota was exceeded.',
    });
  }
  if (
    name === 'SecurityError' ||
    name === 'InvalidStateError' ||
    name === 'UnknownError' ||
    err instanceof ReferenceError
  ) {
    return unavailable();
  }
  if (name === 'AbortError' || name === 'TransactionInactiveError') {
    return interruptedWrite(err instanceof Error ? err.message : undefined);
  }
  if (name === 'VersionError' || name === 'ConstraintError') {
    return corruptData(
      err instanceof Error ? err.message : 'Local project storage record was inconsistent.',
    );
  }
  return interruptedWrite(
    err instanceof Error ? err.message : 'Local project storage write failed.',
  );
}

function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

// --- Record shapes ---------------------------------------------------------

export type LocalProjectRecord = {
  id: string;
  ownerId: string;
  title: string;
  sceneOrder: string[];
  activeSceneId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalSceneRecord = {
  id: string;
  projectId: string;
  name: string;
  position: number;
  sceneJson: Record<string, unknown>;
  updatedAt: string;
};

export type LocalMediaAssetRecord = {
  id: string;
  projectId: string;
  mimeType: string;
  byteSize: number;
  checksum: string;
  filename: string;
  altText: string;
  createdAt: string;
  refCount: number;
};

export type LocalMediaBlobRecord = {
  assetId: string;
  blob: Blob;
};

type MetaSchemaVersionRecord = {
  key: 'schemaVersion';
  value: number;
};

type MetaProjectUsageRecord = {
  key: string; // `usage:${projectId}`
  projectId: string;
  bytesUsed: number;
  fileCount: number;
};

function usageMetaKey(projectId: string): string {
  return `usage:${projectId}`;
}

// --- Database open + migration steps ---------------------------------------

/** One isolated migration step per target DB version. Step `n` runs when
 * upgrading *to* version `n` (i.e. `event.oldVersion < n <= DB_VERSION`),
 * receiving the open upgrade transaction and the database handle. This
 * issue ships only step 1 (the initial schema); a future schema change
 * appends a new step here rather than editing this one. */
const UPGRADE_STEPS: Array<(db: IDBDatabase, tx: IDBTransaction) => void> = [
  // Step 1 (version 1): initial schema.
  (db) => {
    if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
      const projects = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      projects.createIndex('by_owner', 'ownerId', { unique: false });
    }
    if (!db.objectStoreNames.contains(STORE_SCENES)) {
      const scenes = db.createObjectStore(STORE_SCENES, { keyPath: 'id' });
      scenes.createIndex('by_project', 'projectId', { unique: false });
    }
    if (!db.objectStoreNames.contains(STORE_MEDIA_ASSETS)) {
      const mediaAssets = db.createObjectStore(STORE_MEDIA_ASSETS, { keyPath: 'id' });
      mediaAssets.createIndex('by_project', 'projectId', { unique: false });
    }
    if (!db.objectStoreNames.contains(STORE_MEDIA_BLOBS)) {
      db.createObjectStore(STORE_MEDIA_BLOBS, { keyPath: 'assetId' });
    }
    if (!db.objectStoreNames.contains(STORE_META)) {
      db.createObjectStore(STORE_META, { keyPath: 'key' });
    }
  },
];

function runUpgrade(db: IDBDatabase, tx: IDBTransaction, oldVersion: number): void {
  for (let version = oldVersion + 1; version <= DB_VERSION; version += 1) {
    const step = UPGRADE_STEPS[version - 1];
    if (step) step(db, tx);
  }
  const metaStore = tx.objectStore(STORE_META);
  metaStore.put({ key: 'schemaVersion', value: DB_VERSION } satisfies MetaSchemaVersionRecord);
}

/** Verifies every expected object store exists and the recorded schema
 * version matches. A mismatch here (missing store, or a version stamp that
 * doesn't match `DB_VERSION`) is treated as corruption per #512's
 * acceptance criterion -- never a silent wipe -- and surfaced as a
 * `corrupt-data` error instead of allowed to fail confusingly deeper in a
 * later read/write. */
async function verifySchema(db: IDBDatabase): Promise<void> {
  for (const name of OBJECT_STORE_NAMES) {
    if (!db.objectStoreNames.contains(name)) {
      db.close();
      throw corruptData(`Local project storage is missing the "${name}" object store.`);
    }
  }
  const recorded = await new Promise<number | undefined>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get('schemaVersion');
      req.onsuccess = () => resolve((req.result as MetaSchemaVersionRecord | undefined)?.value);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  }).catch((err) => {
    db.close();
    throw classifyDbFailure(err);
  });
  if (recorded !== undefined && recorded !== DB_VERSION) {
    db.close();
    throw corruptData(
      `Local project storage schema version mismatch: expected ${DB_VERSION}, found ${recorded}.`,
    );
  }
}

/** Opens (creating/upgrading on first use) the local project database.
 * Rejects with a classified `LocalRepositoryException` -- never throws
 * synchronously and never resolves with a database whose schema doesn't
 * match what this module expects. */
export async function openLocalProjectDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    throw unavailable();
  }
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(classifyDbFailure(err));
      return;
    }
    request.onupgradeneeded = (event) => {
      try {
        runUpgrade(request.result, request.transaction as IDBTransaction, event.oldVersion);
      } catch (err) {
        reject(classifyDbFailure(err));
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(classifyDbFailure(request.error));
    request.onblocked = () =>
      reject(unavailable('Local project storage upgrade was blocked by another open tab.'));
  });
  await verifySchema(db);
  return db;
}

// --- Persistent storage / quota estimate (acceptance criterion 3) ----------

export type PersistentStorageResult = {
  supported: boolean;
  persisted: boolean;
};

/** Requests persistent browser storage where supported, and reports the
 * real granted/unsupported state -- never fakes a "granted" result the
 * browser didn't actually report. */
export async function requestPersistentStorage(): Promise<PersistentStorageResult> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage || typeof storage.persist !== 'function') {
    return { supported: false, persisted: false };
  }
  try {
    const persisted = await storage.persist();
    return { supported: true, persisted };
  } catch {
    return { supported: true, persisted: false };
  }
}

export type StorageEstimateResult = {
  supported: boolean;
  usage?: number;
  quota?: number;
};

/** Exposes the browser's overall storage usage/quota estimate, in addition
 * to (not instead of) the project-level 50MB/100-file cache this module
 * enforces itself. */
export async function getStorageEstimate(): Promise<StorageEstimateResult> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage || typeof storage.estimate !== 'function') {
    return { supported: false };
  }
  try {
    const estimate = await storage.estimate();
    return { supported: true, usage: estimate.usage, quota: estimate.quota };
  } catch {
    return { supported: false };
  }
}

// --- Small transaction helpers ----------------------------------------------

function reqPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(classifyDbFailure(req.error));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(classifyDbFailure(tx.error));
    tx.onabort = () =>
      reject(classifyDbFailure(tx.error ?? new DOMException('aborted', 'AbortError')));
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

// --- Projects ----------------------------------------------------------------

export async function createProject(
  db: IDBDatabase,
  input: { ownerId: string; title: string },
): Promise<LocalProjectRecord> {
  const record: LocalProjectRecord = {
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    title: input.title,
    sceneOrder: [],
    activeSceneId: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  try {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    tx.objectStore(STORE_PROJECTS).put(record);
    await txDone(tx);
  } catch (err) {
    throw classifyDbFailure(err);
  }
  return record;
}

/** Returns the stable local mirror for an editor project, creating it with
 * the caller's supplied id when this is the first local-media interaction.
 * Server-backed editor projects use this bridge until the full local-first
 * project route becomes the editor's source of truth. */
export async function ensureProject(
  db: IDBDatabase,
  input: { id: string; ownerId: string; title: string },
): Promise<LocalProjectRecord> {
  const existing = await getProject(db, input.ownerId, input.id);
  if (existing) return existing;
  const record: LocalProjectRecord = {
    id: input.id,
    ownerId: input.ownerId,
    title: input.title,
    sceneOrder: [],
    activeSceneId: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  try {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    tx.objectStore(STORE_PROJECTS).put(record);
    await txDone(tx);
  } catch (err) {
    throw classifyDbFailure(err);
  }
  return record;
}

function isWellFormedProject(value: unknown): value is LocalProjectRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<LocalProjectRecord>;
  return (
    typeof r.id === 'string' &&
    typeof r.ownerId === 'string' &&
    typeof r.title === 'string' &&
    Array.isArray(r.sceneOrder) &&
    (r.activeSceneId === null || typeof r.activeSceneId === 'string') &&
    typeof r.createdAt === 'string' &&
    typeof r.updatedAt === 'string'
  );
}

/** Fetches one project by id, scoped to `ownerId` -- a project owned by a
 * different owner (or absent) resolves to `null`, never another owner's
 * row. A malformed stored record is treated as corrupt data (surfaced, not
 * silently returned) since -- unlike `draftAutosave.ts`'s best-effort
 * cache -- this module is the source of truth and must not paper over
 * inconsistent state. */
export async function getProject(
  db: IDBDatabase,
  ownerId: string,
  projectId: string,
): Promise<LocalProjectRecord | null> {
  let raw: unknown;
  try {
    const tx = db.transaction(STORE_PROJECTS, 'readonly');
    raw = await reqPromise(tx.objectStore(STORE_PROJECTS).get(projectId));
  } catch (err) {
    throw classifyDbFailure(err);
  }
  if (raw === undefined) return null;
  if (!isWellFormedProject(raw)) {
    throw corruptData(`Local project record "${projectId}" failed shape validation.`);
  }
  if (raw.ownerId !== ownerId) return null;
  return raw;
}

/** Lists every project belonging to `ownerId`, via the `by_owner` index --
 * a query scoped to one owner never returns another owner's rows. */
export async function listProjectsForOwner(
  db: IDBDatabase,
  ownerId: string,
): Promise<LocalProjectRecord[]> {
  let rows: unknown[];
  try {
    const tx = db.transaction(STORE_PROJECTS, 'readonly');
    const index = tx.objectStore(STORE_PROJECTS).index('by_owner');
    rows = await reqPromise(index.getAll(ownerId));
  } catch (err) {
    throw classifyDbFailure(err);
  }
  for (const row of rows) {
    if (!isWellFormedProject(row)) {
      throw corruptData('A local project record failed shape validation.');
    }
  }
  return rows as LocalProjectRecord[];
}

export async function updateProject(
  db: IDBDatabase,
  ownerId: string,
  projectId: string,
  patch: Partial<Pick<LocalProjectRecord, 'title' | 'sceneOrder' | 'activeSceneId'>>,
): Promise<LocalProjectRecord> {
  const existing = await getProject(db, ownerId, projectId);
  if (!existing) {
    throw corruptData(`Local project "${projectId}" was not found for this owner.`);
  }
  const updated: LocalProjectRecord = { ...existing, ...patch, updatedAt: nowIso() };
  try {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    tx.objectStore(STORE_PROJECTS).put(updated);
    await txDone(tx);
  } catch (err) {
    throw classifyDbFailure(err);
  }
  return updated;
}

/** Deletes a project and every scene/media asset/blob it owns. Runs as one
 * atomic transaction across all four data stores -- either everything is
 * removed, or (on any failure) nothing is, leaving the project intact. */
export async function deleteProject(
  db: IDBDatabase,
  ownerId: string,
  projectId: string,
): Promise<void> {
  const existing = await getProject(db, ownerId, projectId);
  if (!existing) return;
  let sceneIds: string[];
  let assetIds: string[];
  try {
    const readTx = db.transaction([STORE_SCENES, STORE_MEDIA_ASSETS], 'readonly');
    const scenes = (await reqPromise(
      readTx.objectStore(STORE_SCENES).index('by_project').getAll(projectId),
    )) as LocalSceneRecord[];
    const assets = (await reqPromise(
      readTx.objectStore(STORE_MEDIA_ASSETS).index('by_project').getAll(projectId),
    )) as LocalMediaAssetRecord[];
    sceneIds = scenes.map((s) => s.id);
    assetIds = assets.map((a) => a.id);
  } catch (err) {
    throw classifyDbFailure(err);
  }
  try {
    const tx = db.transaction(
      [STORE_PROJECTS, STORE_SCENES, STORE_MEDIA_ASSETS, STORE_MEDIA_BLOBS, STORE_META],
      'readwrite',
    );
    tx.objectStore(STORE_PROJECTS).delete(projectId);
    for (const id of sceneIds) tx.objectStore(STORE_SCENES).delete(id);
    for (const id of assetIds) tx.objectStore(STORE_MEDIA_ASSETS).delete(id);
    for (const id of assetIds) tx.objectStore(STORE_MEDIA_BLOBS).delete(id);
    tx.objectStore(STORE_META).delete(usageMetaKey(projectId));
    await txDone(tx);
  } catch (err) {
    throw classifyDbFailure(err);
  }
}

// --- Scenes --------------------------------------------------------------

export async function listScenesForProject(
  db: IDBDatabase,
  projectId: string,
): Promise<LocalSceneRecord[]> {
  try {
    const tx = db.transaction(STORE_SCENES, 'readonly');
    const rows = await reqPromise(
      tx.objectStore(STORE_SCENES).index('by_project').getAll(projectId),
    );
    return rows as LocalSceneRecord[];
  } catch (err) {
    throw classifyDbFailure(err);
  }
}

export async function createScene(
  db: IDBDatabase,
  ownerId: string,
  input: { projectId: string; name: string; sceneJson: Record<string, unknown> },
): Promise<LocalSceneRecord> {
  const project = await getProject(db, ownerId, input.projectId);
  if (!project) {
    throw corruptData(`Local project "${input.projectId}" was not found for this owner.`);
  }
  const record: LocalSceneRecord = {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    name: input.name,
    position: project.sceneOrder.length,
    sceneJson: input.sceneJson,
    updatedAt: nowIso(),
  };
  try {
    const tx = db.transaction([STORE_SCENES, STORE_PROJECTS], 'readwrite');
    tx.objectStore(STORE_SCENES).put(record);
    const nextProject: LocalProjectRecord = {
      ...project,
      sceneOrder: [...project.sceneOrder, record.id],
      activeSceneId: project.activeSceneId ?? record.id,
      updatedAt: nowIso(),
    };
    tx.objectStore(STORE_PROJECTS).put(nextProject);
    await txDone(tx);
  } catch (err) {
    throw classifyDbFailure(err);
  }
  return record;
}

export async function updateScene(
  db: IDBDatabase,
  sceneId: string,
  patch: Partial<Pick<LocalSceneRecord, 'name' | 'sceneJson' | 'position'>>,
): Promise<LocalSceneRecord> {
  let existing: LocalSceneRecord | undefined;
  try {
    const tx = db.transaction(STORE_SCENES, 'readonly');
    existing = (await reqPromise(tx.objectStore(STORE_SCENES).get(sceneId))) as
      LocalSceneRecord | undefined;
  } catch (err) {
    throw classifyDbFailure(err);
  }
  if (!existing) {
    throw corruptData(`Local scene "${sceneId}" was not found.`);
  }
  const updated: LocalSceneRecord = { ...existing, ...patch, updatedAt: nowIso() };
  try {
    const tx = db.transaction(STORE_SCENES, 'readwrite');
    tx.objectStore(STORE_SCENES).put(updated);
    await txDone(tx);
  } catch (err) {
    throw classifyDbFailure(err);
  }
  return updated;
}

/** Deletes a scene and decrements the reference count of every media asset
 * it referenced (via `referencedAssetIds`), deleting a blob whose
 * `refCount` reaches zero. */
export async function deleteScene(
  db: IDBDatabase,
  ownerId: string,
  projectId: string,
  sceneId: string,
  referencedAssetIds: string[] = [],
): Promise<void> {
  const project = await getProject(db, ownerId, projectId);
  if (!project) {
    throw corruptData(`Local project "${projectId}" was not found for this owner.`);
  }
  try {
    const tx = db.transaction(
      [STORE_SCENES, STORE_PROJECTS, STORE_MEDIA_ASSETS, STORE_MEDIA_BLOBS, STORE_META],
      'readwrite',
    );
    tx.objectStore(STORE_SCENES).delete(sceneId);
    const nextSceneOrder = project.sceneOrder.filter((id) => id !== sceneId);
    const nextProject: LocalProjectRecord = {
      ...project,
      sceneOrder: nextSceneOrder,
      activeSceneId:
        project.activeSceneId === sceneId ? (nextSceneOrder[0] ?? null) : project.activeSceneId,
      updatedAt: nowIso(),
    };
    tx.objectStore(STORE_PROJECTS).put(nextProject);
    for (const assetId of referencedAssetIds) {
      await decrementAssetRefInTx(tx, projectId, assetId);
    }
    await txDone(tx);
  } catch (err) {
    throw classifyDbFailure(err);
  }
}

async function decrementAssetRefInTx(
  tx: IDBTransaction,
  projectId: string,
  assetId: string,
): Promise<void> {
  const assetStore = tx.objectStore(STORE_MEDIA_ASSETS);
  const asset = (await reqPromise(assetStore.get(assetId))) as LocalMediaAssetRecord | undefined;
  if (!asset) return;
  const nextRefCount = Math.max(0, asset.refCount - 1);
  if (nextRefCount === 0) {
    assetStore.delete(assetId);
    tx.objectStore(STORE_MEDIA_BLOBS).delete(assetId);
    await adjustUsageInTx(tx, projectId, -asset.byteSize, -1);
  } else {
    assetStore.put({ ...asset, refCount: nextRefCount });
  }
}

// --- Media assets ----------------------------------------------------------

/** SHA-256 hex checksum via `crypto.subtle.digest`, per #512's exact spec.
 * Accepts anything `Uint8Array`/`ArrayBuffer`-shaped; TS's typed arrays are
 * generic over `ArrayBufferLike` (which also covers `SharedArrayBuffer`,
 * not accepted by the DOM `BufferSource` typings), so the cast here is
 * purely to satisfy that mismatch -- every real caller always passes a
 * plain, non-shared buffer. */
export async function computeChecksum(bytes: Uint8Array | ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Public read of the cached `{ bytesUsed, fileCount }` usage for one
 * project (recomputed from `mediaAssets` first if the cache is missing or
 * inconsistent). Useful for callers that want to show remaining quota
 * without importing anything. */
export async function getProjectUsage(
  db: IDBDatabase,
  projectId: string,
): Promise<{ bytesUsed: number; fileCount: number }> {
  let recorded: MetaProjectUsageRecord | undefined;
  try {
    const tx = db.transaction(STORE_META, 'readonly');
    recorded = (await reqPromise(tx.objectStore(STORE_META).get(usageMetaKey(projectId)))) as
      MetaProjectUsageRecord | undefined;
  } catch (err) {
    throw classifyDbFailure(err);
  }
  if (
    recorded &&
    typeof recorded.bytesUsed === 'number' &&
    typeof recorded.fileCount === 'number'
  ) {
    return { bytesUsed: recorded.bytesUsed, fileCount: recorded.fileCount };
  }
  // Missing or inconsistent cache: recompute from `mediaAssets`, per #512's
  // spec for the `meta` store.
  return recomputeProjectUsage(db, projectId);
}

/** Recomputes and persists the `{ bytesUsed, fileCount }` cache for one
 * project directly from its `mediaAssets` rows. Used when the cache is
 * missing/inconsistent at repository open, and exposed for callers/tests
 * that want to verify the cache never drifts from ground truth. */
export async function recomputeProjectUsage(
  db: IDBDatabase,
  projectId: string,
): Promise<{ bytesUsed: number; fileCount: number }> {
  let assets: LocalMediaAssetRecord[];
  try {
    const tx = db.transaction(STORE_MEDIA_ASSETS, 'readonly');
    assets = (await reqPromise(
      tx.objectStore(STORE_MEDIA_ASSETS).index('by_project').getAll(projectId),
    )) as LocalMediaAssetRecord[];
  } catch (err) {
    throw classifyDbFailure(err);
  }
  const usage = {
    bytesUsed: assets.reduce((sum, a) => sum + a.byteSize, 0),
    fileCount: assets.length,
  };
  try {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({
      key: usageMetaKey(projectId),
      projectId,
      ...usage,
    } satisfies MetaProjectUsageRecord);
    await txDone(tx);
  } catch (err) {
    throw classifyDbFailure(err);
  }
  return usage;
}

async function adjustUsageInTx(
  tx: IDBTransaction,
  projectId: string,
  byteDelta: number,
  fileDelta: number,
): Promise<void> {
  const metaStore = tx.objectStore(STORE_META);
  const recorded = (await reqPromise(metaStore.get(usageMetaKey(projectId)))) as
    MetaProjectUsageRecord | undefined;
  const current = recorded ?? {
    key: usageMetaKey(projectId),
    projectId,
    bytesUsed: 0,
    fileCount: 0,
  };
  metaStore.put({
    key: usageMetaKey(projectId),
    projectId,
    bytesUsed: Math.max(0, current.bytesUsed + byteDelta),
    fileCount: Math.max(0, current.fileCount + fileDelta),
  } satisfies MetaProjectUsageRecord);
}

export type ImportMediaAssetInput = {
  projectId: string;
  blob: Blob;
  mimeType: string;
  filename: string;
  altText: string;
};

/** Imports one media asset: validates the MIME type is supported, computes
 * its checksum, and either (a) attaches a new reference to an existing
 * asset with the same checksum in this project (deduplication -- never
 * double-counted against the quota, never a duplicated blob) or (b) checks
 * the project's quota and, only if there's room, writes a new
 * `mediaAssets` row and its `mediaBlobs` row together in one transaction.
 * Quota is checked *before* any write commits; a rejected import leaves the
 * project's existing media untouched. */
export async function importMediaAsset(
  db: IDBDatabase,
  input: ImportMediaAssetInput,
): Promise<LocalMediaAssetRecord> {
  if (!SUPPORTED_MEDIA_MIME_TYPES.has(input.mimeType)) {
    throw unsupportedFileType(input.mimeType);
  }
  const bytes = await input.blob.arrayBuffer();
  const checksum = await computeChecksum(bytes);

  // Everything from here on runs inside one readwrite transaction spanning
  // all three affected stores, so the checksum-dedup check, the quota
  // check against the `meta` cache, and the resulting write(s) are all
  // atomic with respect to each other -- no other import can race between
  // "checked quota" and "committed write."
  try {
    const tx = db.transaction([STORE_MEDIA_ASSETS, STORE_MEDIA_BLOBS, STORE_META], 'readwrite');
    const assetStore = tx.objectStore(STORE_MEDIA_ASSETS);
    const assets = (await reqPromise(
      assetStore.index('by_project').getAll(input.projectId),
    )) as LocalMediaAssetRecord[];
    const existingByChecksum = assets.find((a) => a.checksum === checksum);

    if (existingByChecksum) {
      const updated: LocalMediaAssetRecord = {
        ...existingByChecksum,
        refCount: existingByChecksum.refCount + 1,
      };
      assetStore.put(updated);
      await txDone(tx);
      return updated;
    }

    const metaStore = tx.objectStore(STORE_META);
    const recorded = (await reqPromise(metaStore.get(usageMetaKey(input.projectId)))) as
      MetaProjectUsageRecord | undefined;
    const usage =
      recorded && typeof recorded.bytesUsed === 'number' && typeof recorded.fileCount === 'number'
        ? { bytesUsed: recorded.bytesUsed, fileCount: recorded.fileCount }
        : {
            bytesUsed: assets.reduce((sum, a) => sum + a.byteSize, 0),
            fileCount: assets.length,
          };

    if (usage.bytesUsed + bytes.byteLength > MAX_PROJECT_BYTES) {
      tx.abort();
      throw quotaExceeded('bytes', usage.bytesUsed);
    }
    if (usage.fileCount + 1 > MAX_PROJECT_FILES) {
      tx.abort();
      throw quotaExceeded('files', usage.fileCount);
    }

    const record: LocalMediaAssetRecord = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      mimeType: input.mimeType,
      byteSize: bytes.byteLength,
      checksum,
      filename: input.filename,
      altText: input.altText,
      createdAt: nowIso(),
      refCount: 1,
    };
    assetStore.put(record);
    tx.objectStore(STORE_MEDIA_BLOBS).put({
      assetId: record.id,
      blob: input.blob,
    } satisfies LocalMediaBlobRecord);
    metaStore.put({
      key: usageMetaKey(input.projectId),
      projectId: input.projectId,
      bytesUsed: usage.bytesUsed + record.byteSize,
      fileCount: usage.fileCount + 1,
    } satisfies MetaProjectUsageRecord);
    await txDone(tx);
    return record;
  } catch (err) {
    if (err instanceof LocalRepositoryException) throw err;
    throw classifyDbFailure(err);
  }
}

/** Increments a media asset's reference count (a second scene referencing
 * an already-imported asset), without duplicating the blob or the quota
 * cost. */
export async function addMediaReference(
  db: IDBDatabase,
  assetId: string,
): Promise<LocalMediaAssetRecord> {
  let asset: LocalMediaAssetRecord | undefined;
  try {
    const tx = db.transaction(STORE_MEDIA_ASSETS, 'readonly');
    asset = (await reqPromise(tx.objectStore(STORE_MEDIA_ASSETS).get(assetId))) as
      LocalMediaAssetRecord | undefined;
  } catch (err) {
    throw classifyDbFailure(err);
  }
  if (!asset) throw corruptData(`Local media asset "${assetId}" was not found.`);
  const updated: LocalMediaAssetRecord = { ...asset, refCount: asset.refCount + 1 };
  try {
    const tx = db.transaction(STORE_MEDIA_ASSETS, 'readwrite');
    tx.objectStore(STORE_MEDIA_ASSETS).put(updated);
    await txDone(tx);
  } catch (err) {
    throw classifyDbFailure(err);
  }
  return updated;
}

/** Decrements a media asset's reference count; the blob (and its metadata
 * row) is deleted only once `refCount` reaches zero. */
export async function removeMediaReference(db: IDBDatabase, assetId: string): Promise<void> {
  let asset: LocalMediaAssetRecord | undefined;
  try {
    const tx = db.transaction(STORE_MEDIA_ASSETS, 'readonly');
    asset = (await reqPromise(tx.objectStore(STORE_MEDIA_ASSETS).get(assetId))) as
      LocalMediaAssetRecord | undefined;
  } catch (err) {
    throw classifyDbFailure(err);
  }
  if (!asset) return;
  try {
    const tx = db.transaction([STORE_MEDIA_ASSETS, STORE_MEDIA_BLOBS, STORE_META], 'readwrite');
    await decrementAssetRefInTx(tx, asset.projectId, assetId);
    await txDone(tx);
  } catch (err) {
    throw classifyDbFailure(err);
  }
}

export async function listMediaAssetsForProject(
  db: IDBDatabase,
  projectId: string,
): Promise<LocalMediaAssetRecord[]> {
  try {
    const tx = db.transaction(STORE_MEDIA_ASSETS, 'readonly');
    const rows = await reqPromise(
      tx.objectStore(STORE_MEDIA_ASSETS).index('by_project').getAll(projectId),
    );
    return rows as LocalMediaAssetRecord[];
  } catch (err) {
    throw classifyDbFailure(err);
  }
}

export async function updateMediaAssetMetadata(
  db: IDBDatabase,
  assetId: string,
  patch: Pick<LocalMediaAssetRecord, 'filename' | 'altText'>,
): Promise<LocalMediaAssetRecord> {
  let asset: LocalMediaAssetRecord | undefined;
  try {
    const tx = db.transaction(STORE_MEDIA_ASSETS, 'readonly');
    asset = (await reqPromise(tx.objectStore(STORE_MEDIA_ASSETS).get(assetId))) as
      LocalMediaAssetRecord | undefined;
  } catch (err) {
    throw classifyDbFailure(err);
  }
  if (!asset) throw corruptData(`Local media asset "${assetId}" was not found.`);
  const updated = { ...asset, ...patch };
  try {
    const tx = db.transaction(STORE_MEDIA_ASSETS, 'readwrite');
    tx.objectStore(STORE_MEDIA_ASSETS).put(updated);
    await txDone(tx);
  } catch (err) {
    throw classifyDbFailure(err);
  }
  return updated;
}

export async function getMediaBlob(db: IDBDatabase, assetId: string): Promise<Blob | null> {
  try {
    const tx = db.transaction(STORE_MEDIA_BLOBS, 'readonly');
    const row = (await reqPromise(tx.objectStore(STORE_MEDIA_BLOBS).get(assetId))) as
      LocalMediaBlobRecord | undefined;
    return row?.blob ?? null;
  } catch (err) {
    throw classifyDbFailure(err);
  }
}
