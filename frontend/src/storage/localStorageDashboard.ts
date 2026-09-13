/**
 * Issue #525: an honest, read-only view over this origin's app-owned
 * browser storage -- both the browser-wide usage/quota picture
 * (`navigator.storage`, `indexedDB.databases()`) and a per-database
 * inventory built from this app's own known databases, never claiming
 * visibility into other origins or databases this app doesn't own.
 *
 * The app-owned database list is a small, versioned, in-code catalog
 * (`getAppDatabaseCatalog`) rather than something purely discovered via
 * `indexedDB.databases()` -- that API is not universally supported, and
 * even where it is, it can't tell us which of "every database on this
 * origin" this app actually owns and understands the schema of. `kind`
 * classifies each entry: `'active'` (the current local-first project
 * repository), `'legacy_recovery'` (the best-effort draft-autosave
 * cache, not a project store), or `'archived'` (issue #526's future
 * export/archive databases -- recorded via `recordArchivedDatabaseName`
 * below, never invented here; this issue ships the extension point, not
 * the archival feature itself).
 */

import {
  DB_NAME as DRAFT_DB_NAME,
  DB_VERSION as DRAFT_DB_VERSION,
  STORE_NAME as DRAFT_STORE_NAME,
  openDraftDatabase,
  type DraftRecord,
} from './draftAutosave';
import {
  DB_NAME as PROJECTS_DB_NAME,
  DB_VERSION as PROJECTS_DB_VERSION,
  STORE_META,
  getProjectUsage,
  getStorageEstimate,
  listProjectsForOwner,
  listScenesForProject,
  openLocalProjectDatabase,
  requestPersistentStorage,
  type StorageEstimateResult,
  type PersistentStorageResult,
} from './localProjectRepository';

export type AppDatabaseKind = 'active' | 'legacy_recovery' | 'archived';

export type AppDatabaseCatalogEntry = {
  name: string;
  expectedVersion: number;
  kind: AppDatabaseKind;
  label: string;
};

const ARCHIVED_DATABASES_META_KEY = 'archivedDatabases';

/** The two databases this app always knows about. Archived entries (from
 * `listArchivedDatabaseNames`) are appended at read time -- see
 * `getAppDatabaseCatalog`. */
const STATIC_CATALOG: AppDatabaseCatalogEntry[] = [
  {
    name: PROJECTS_DB_NAME,
    expectedVersion: PROJECTS_DB_VERSION,
    kind: 'active',
    label: 'Local projects',
  },
  {
    name: DRAFT_DB_NAME,
    expectedVersion: DRAFT_DB_VERSION,
    kind: 'legacy_recovery',
    label: 'Crash-recovery drafts',
  },
];

type ArchivedDatabaseMetaRecord = {
  key: typeof ARCHIVED_DATABASES_META_KEY;
  names: string[];
};

/** Reads the (possibly empty) list of archived database names recorded so
 * far -- issue #526's extension point. Never throws: a missing or
 * corrupted record reads as no archives, rather than failing the whole
 * dashboard. */
export async function listArchivedDatabaseNames(db: IDBDatabase): Promise<string[]> {
  try {
    const tx = db.transaction(STORE_META, 'readonly');
    const record = await new Promise<ArchivedDatabaseMetaRecord | undefined>((resolve, reject) => {
      const request = tx.objectStore(STORE_META).get(ARCHIVED_DATABASES_META_KEY);
      request.onsuccess = () => resolve(request.result as ArchivedDatabaseMetaRecord | undefined);
      request.onerror = () => reject(request.error);
    });
    return Array.isArray(record?.names) ? record.names : [];
  } catch {
    return [];
  }
}

/** Records a newly created archived database's name so future dashboard
 * reads include it. Issue #526 is expected to call this once it actually
 * creates an archive database; this issue does not create any itself. */
export async function recordArchivedDatabaseName(db: IDBDatabase, name: string): Promise<void> {
  const existing = await listArchivedDatabaseNames(db);
  if (existing.includes(name)) return;
  const tx = db.transaction(STORE_META, 'readwrite');
  tx.objectStore(STORE_META).put({
    key: ARCHIVED_DATABASES_META_KEY,
    names: [...existing, name],
  } satisfies ArchivedDatabaseMetaRecord);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** The full catalog: the two always-present databases plus any recorded
 * archives. Reading the archive list requires opening the projects
 * database; if that fails, the catalog still reports the two static
 * entries (the caller's own per-database open attempt reports that
 * failure for the `'active'` entry itself). */
export async function getAppDatabaseCatalog(): Promise<AppDatabaseCatalogEntry[]> {
  let archivedNames: string[] = [];
  try {
    const db = await openLocalProjectDatabase();
    try {
      archivedNames = await listArchivedDatabaseNames(db);
    } finally {
      db.close();
    }
  } catch {
    archivedNames = [];
  }
  return [
    ...STATIC_CATALOG,
    ...archivedNames.map((name): AppDatabaseCatalogEntry => ({
      name,
      expectedVersion: PROJECTS_DB_VERSION,
      kind: 'archived',
      label: `Archive: ${name}`,
    })),
  ];
}

export type DatabaseSummary = AppDatabaseCatalogEntry & {
  opened: boolean;
  /** Set only when `opened` is false: a short, user-safe reason (e.g. a
   * `LocalRepositoryErrorKind`, or `'unsupported'` when IndexedDB itself
   * isn't available in this browser). */
  errorKind?: string;
  actualVersion?: number;
  projectCount?: number;
  sceneCount?: number;
  mediaFileCount?: number;
  byteTotal?: number;
  lastActivity?: string | null;
};

function maxIso(a: string | null, b: string | null | undefined): string | null {
  if (!b) return a;
  if (!a) return b;
  return a > b ? a : b;
}

async function summarizeActiveDatabase(
  entry: AppDatabaseCatalogEntry,
  ownerId: string,
): Promise<DatabaseSummary> {
  let db: IDBDatabase;
  try {
    db = await openLocalProjectDatabase();
  } catch (err) {
    return { ...entry, opened: false, errorKind: (err as { kind?: string }).kind ?? 'unavailable' };
  }
  try {
    const projects = await listProjectsForOwner(db, ownerId);
    let sceneCount = 0;
    let byteTotal = 0;
    let mediaFileCount = 0;
    let lastActivity: string | null = null;
    for (const project of projects) {
      lastActivity = maxIso(lastActivity, project.updatedAt);
      const scenes = await listScenesForProject(db, project.id);
      sceneCount += scenes.length;
      for (const scene of scenes) lastActivity = maxIso(lastActivity, scene.updatedAt);
      const usage = await getProjectUsage(db, project.id);
      byteTotal += usage.bytesUsed;
      mediaFileCount += usage.fileCount;
    }
    return {
      ...entry,
      opened: true,
      actualVersion: db.version,
      projectCount: projects.length,
      sceneCount,
      mediaFileCount,
      byteTotal,
      lastActivity,
    };
  } catch (err) {
    return {
      ...entry,
      opened: false,
      errorKind: (err as { kind?: string }).kind ?? 'corrupt-data',
    };
  } finally {
    db.close();
  }
}

async function summarizeDraftDatabase(entry: AppDatabaseCatalogEntry): Promise<DatabaseSummary> {
  let db: IDBDatabase;
  try {
    db = await openDraftDatabase();
  } catch (err) {
    return { ...entry, opened: false, errorKind: (err as { kind?: string }).kind ?? 'unavailable' };
  }
  try {
    const drafts = await new Promise<DraftRecord[]>((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readonly');
      const request = tx.objectStore(DRAFT_STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result ?? []) as DraftRecord[]);
      request.onerror = () => reject(request.error);
    });
    let lastActivity: string | null = null;
    let byteTotal = 0;
    for (const draft of drafts) {
      lastActivity = maxIso(lastActivity, draft.savedAt);
      byteTotal += new TextEncoder().encode(JSON.stringify(draft.sceneJson)).length;
    }
    return {
      ...entry,
      opened: true,
      actualVersion: db.version,
      projectCount: new Set(drafts.map((d) => d.projectId)).size,
      sceneCount: drafts.length,
      mediaFileCount: 0,
      byteTotal,
      lastActivity,
    };
  } catch (err) {
    return {
      ...entry,
      opened: false,
      errorKind: (err as { kind?: string }).kind ?? 'corrupt-data',
    };
  } finally {
    db.close();
  }
}

/** Summarizes one catalog entry. An `'archived'` entry is reported as
 * present-but-unopened for now (issue #526 owns actually reading an
 * archive's contents) -- #525's job is only to list it, never to fail
 * the rest of the dashboard trying to open a schema it doesn't know. */
async function summarizeEntry(entry: AppDatabaseCatalogEntry, ownerId: string) {
  if (entry.kind === 'active') return summarizeActiveDatabase(entry, ownerId);
  if (entry.kind === 'legacy_recovery') return summarizeDraftDatabase(entry);
  return { ...entry, opened: false, errorKind: 'not_yet_supported' } satisfies DatabaseSummary;
}

export type LocalStorageDashboardSnapshot = {
  indexedDbSupported: boolean;
  estimate: StorageEstimateResult;
  persistentStorage: PersistentStorageResult;
  browserReportedDatabases: Array<{ name: string; version: number }> | null;
  databases: DatabaseSummary[];
};

/** `indexedDB.databases()` is optional per spec; report `null` (not `[]`,
 * which would falsely claim "zero databases") when it's unavailable. */
async function listBrowserReportedDatabases(): Promise<Array<{
  name: string;
  version: number;
}> | null> {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return null;
  try {
    const infos = await indexedDB.databases();
    return infos
      .filter((info): info is { name: string; version: number } => typeof info.name === 'string')
      .map((info) => ({ name: info.name as string, version: info.version ?? 0 }));
  } catch {
    return null;
  }
}

const NEAR_QUOTA_FRACTION = 0.9;

export function isNearQuota(estimate: StorageEstimateResult): boolean {
  if (!estimate.supported || estimate.quota === undefined || estimate.usage === undefined) {
    return false;
  }
  if (estimate.quota <= 0) return false;
  return estimate.usage / estimate.quota >= NEAR_QUOTA_FRACTION;
}

export async function getLocalStorageDashboardSnapshot(
  ownerId: string,
): Promise<LocalStorageDashboardSnapshot> {
  const indexedDbSupported = typeof indexedDB !== 'undefined';
  const [estimate, persistentStorage, browserReportedDatabases, catalog] = await Promise.all([
    getStorageEstimate(),
    requestPersistentStorage(),
    listBrowserReportedDatabases(),
    getAppDatabaseCatalog(),
  ]);
  const databases = await Promise.all(catalog.map((entry) => summarizeEntry(entry, ownerId)));
  return { indexedDbSupported, estimate, persistentStorage, browserReportedDatabases, databases };
}
