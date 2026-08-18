import type { SceneDocument } from '../api/projects';

/**
 * Task 42: browser-local crash-recovery drafts (`_docs/plan.md`'s "Active-
 * session autosave and recovery" section). This module is the storage/
 * scheduling engine only — deliberately framework-free (no React) so it can
 * be unit-tested without mounting a component, and deliberately narrow in
 * scope: it writes/reads/clears one IndexedDB record per project and never
 * talks to the server (Task 43) or renders a recovery prompt (Task 44).
 *
 * Every public entry point here is written to fail *safely*: a thrown/
 * rejected IndexedDB operation (access denied in private browsing, quota
 * exceeded, a corrupt existing record, `indexedDB` missing entirely) is
 * caught, classified via `classifyFailure`, and swallowed — the caller
 * always gets a resolved promise back. The server-persisted version is the
 * only source of truth the rest of the app depends on; this module is
 * best-effort convenience on top of it.
 */

const DB_NAME = 'motion-editor-draft-autosave';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

/** Recommended debounce window from `_docs/plan.md`: "approximately 1-2
 * seconds after the last edit." 1500ms sits in the middle of that range. */
export const DEFAULT_DEBOUNCE_MS = 1500;

export type DraftIdentity = {
  /** The project this draft belongs to — also the IndexedDB key, so a
   * draft can never be read/written/cleared under the wrong project. */
  projectId: string;
  /** Signed-in username, or a stable placeholder when signed out (the
   * editor is login-gated in practice, but this keeps the module honest
   * about what it does when auth state is unknown). */
  userKey: string;
  /** Per-tab identifier (see `sessionIdFor` in `useDraftAutosave.ts`) so
   * two tabs editing the same project don't silently blend their drafts. */
  sessionId: string;
};

export type DraftRecord = DraftIdentity & {
  sceneJson: SceneDocument;
  /** ISO timestamp of when this draft was written. */
  savedAt: string;
  /** Deterministic, diff-derived summary of what changed since the
   * baseline (last-saved) scene — see `summarizeSceneChange` below. Never
   * LLM-generated or random: the same before/after pair always produces
   * the same string. */
  changeSummary: string;
  /** Monotonic per-controller write sequence number, stored alongside the
   * record purely as a debugging aid; the newer-write-wins guarantee
   * itself is enforced in-memory by `DraftAutosaveController`, not by
   * comparing this field on read. */
  writeSeq: number;
};

export type DraftAutosaveFailureKind =
  'unavailable' | 'quota-exceeded' | 'corrupt-data' | 'unknown';

export type DraftAutosaveFailure = {
  kind: DraftAutosaveFailureKind;
  message: string;
};

function classifyFailure(err: unknown): DraftAutosaveFailure {
  const name = err instanceof DOMException ? err.name : undefined;
  if (name === 'QuotaExceededError') {
    return { kind: 'quota-exceeded', message: 'Local storage quota was exceeded.' };
  }
  if (
    name === 'SecurityError' ||
    name === 'InvalidStateError' ||
    name === 'UnknownError' ||
    err instanceof ReferenceError
  ) {
    return { kind: 'unavailable', message: 'Local draft storage is not available.' };
  }
  return {
    kind: 'unknown',
    message: err instanceof Error ? err.message : 'Local draft storage failed.',
  };
}

function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/** Opens (and, on first use, creates) the single object store this module
 * needs. Rejects — never throws synchronously — on any failure, including
 * `indexedDB` not existing at all (e.g. some private-browsing modes). */
export function openDraftDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(classifyFailure(new ReferenceError('indexedDB is not available')));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(classifyFailure(err));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(classifyFailure(request.error));
    request.onblocked = () =>
      reject(classifyFailure(new DOMException('blocked', 'InvalidStateError')));
  });
}

export function putDraftRecord(db: IDBDatabase, record: DraftRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(classifyFailure(tx.error));
      tx.onabort = () => reject(classifyFailure(tx.error));
    } catch (err) {
      reject(classifyFailure(err));
    }
  });
}

/** A record failing shape validation (missing fields, wrong types — e.g.
 * hand-edited or partially-written storage) is treated the same as "no
 * draft," not as a crash: it is deleted so it can't wedge future reads,
 * and `null` is returned. */
function isWellFormedRecord(value: unknown): value is DraftRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<DraftRecord>;
  return (
    typeof record.projectId === 'string' &&
    typeof record.userKey === 'string' &&
    typeof record.sessionId === 'string' &&
    typeof record.savedAt === 'string' &&
    typeof record.changeSummary === 'string' &&
    typeof record.writeSeq === 'number' &&
    typeof record.sceneJson === 'object' &&
    record.sceneJson !== null
  );
}

export async function getDraftRecord(
  db: IDBDatabase,
  projectId: string,
): Promise<DraftRecord | null> {
  const raw = await new Promise<unknown>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(projectId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(classifyFailure(req.error));
    } catch (err) {
      reject(classifyFailure(err));
    }
  });
  if (raw === undefined) return null;
  if (!isWellFormedRecord(raw)) {
    // Corrupt/unreadable data: clear it rather than risk resurfacing it.
    await deleteDraftRecord(db, projectId).catch(() => undefined);
    return null;
  }
  return raw;
}

export function deleteDraftRecord(db: IDBDatabase, projectId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(projectId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(classifyFailure(tx.error));
      tx.onabort = () => reject(classifyFailure(tx.error));
    } catch (err) {
      reject(classifyFailure(err));
    }
  });
}

// --- Deterministic change summary ------------------------------------

type IdItem = { id?: unknown };

function idArray(value: unknown): IdItem[] {
  return Array.isArray(value) ? (value as IdItem[]) : [];
}

/** Buckets `after` items against `before` items (matched by `id`) into
 * added/removed/changed counts. "Changed" means the same id exists in both
 * but the serialized item differs. Comparison is by `JSON.stringify`
 * equality, which is sufficient (and fully deterministic) for the plain
 * JSON scene documents this module ever sees. */
function diffById(
  before: unknown,
  after: unknown,
): { added: number; removed: number; changed: number } {
  const beforeItems = idArray(before);
  const afterItems = idArray(after);
  const beforeById = new Map<string, IdItem>();
  for (const item of beforeItems) {
    if (typeof item?.id === 'string') beforeById.set(item.id, item);
  }
  const afterIds = new Set<string>();
  let added = 0;
  let changed = 0;
  for (const item of afterItems) {
    if (typeof item?.id !== 'string') continue;
    afterIds.add(item.id);
    const prior = beforeById.get(item.id);
    if (!prior) {
      added += 1;
    } else if (JSON.stringify(prior) !== JSON.stringify(item)) {
      changed += 1;
    }
  }
  let removed = 0;
  for (const id of beforeById.keys()) {
    if (!afterIds.has(id)) removed += 1;
  }
  return { added, removed, changed };
}

function describe(
  nounSingular: string,
  nounPlural: string,
  verb: string,
  count: number,
): string | null {
  if (count === 0) return null;
  return `${count} ${count === 1 ? nounSingular : nounPlural} ${verb}`;
}

/**
 * Deterministic, diff-based change summary: given the same `before`/`after`
 * scene pair, always produces the same string — never LLM-generated or
 * random. Modeled on `_docs/plan.md`'s example format, e.g. "3 shapes
 * changed · 1 gesture binding added."
 */
export function summarizeSceneChange(before: SceneDocument | null, after: SceneDocument): string {
  const shapes = diffById(before?.shapes, after.shapes);
  const layers = diffById(before?.layers, after.layers);
  const groups = diffById(before?.groups, after.groups);
  const bindings = diffById(before?.bindings, after.bindings);
  const beforeGraph = (before?.graph ?? null) as { nodes?: unknown; connections?: unknown } | null;
  const afterGraph = (after.graph ?? null) as { nodes?: unknown; connections?: unknown } | null;
  const nodes = diffById(beforeGraph?.nodes, afterGraph?.nodes);
  const connections = diffById(beforeGraph?.connections, afterGraph?.connections);

  const parts = [
    describe('shape', 'shapes', 'added', shapes.added),
    describe('shape', 'shapes', 'removed', shapes.removed),
    describe('shape', 'shapes', 'changed', shapes.changed),
    describe('layer', 'layers', 'added', layers.added),
    describe('layer', 'layers', 'removed', layers.removed),
    describe('layer', 'layers', 'changed', layers.changed),
    describe('group', 'groups', 'added', groups.added),
    describe('group', 'groups', 'removed', groups.removed),
    describe('group', 'groups', 'changed', groups.changed),
    describe('binding', 'bindings', 'added', bindings.added),
    describe('binding', 'bindings', 'removed', bindings.removed),
    describe('binding', 'bindings', 'changed', bindings.changed),
    describe('graph node', 'graph nodes', 'added', nodes.added),
    describe('graph node', 'graph nodes', 'removed', nodes.removed),
    describe('graph node', 'graph nodes', 'changed', nodes.changed),
    describe('graph connection', 'graph connections', 'added', connections.added),
    describe('graph connection', 'graph connections', 'removed', connections.removed),
    describe('graph connection', 'graph connections', 'changed', connections.changed),
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(', ') : 'No changes detected';
}

// --- Debounced, race-safe write scheduler -----------------------------

export type DraftAutosaveControllerOptions = {
  debounceMs?: number;
  openDb?: () => Promise<IDBDatabase>;
};

/**
 * Owns the debounce timer and the monotonic write-sequence counter that
 * together guarantee a newer edit can never be overwritten by an older,
 * still-in-flight delayed write:
 *  - `schedule()` cancels any pending timer (cancel-and-reschedule), so a
 *    burst of edits only ever leaves the *last* scheduled write pending.
 *  - Every call to `schedule()` also bumps `seq`. The write that actually
 *    fires captures its own `seq` value and checks it again immediately
 *    before opening the database and immediately before persisting; if a
 *    newer `schedule()` call has bumped `seq` in the meantime (which can
 *    happen while an earlier write is still awaiting the async DB handle),
 *    the stale write aborts instead of persisting.
 */
export class DraftAutosaveController {
  private readonly debounceMs: number;
  private readonly openDb: () => Promise<IDBDatabase>;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private lastFailure: DraftAutosaveFailure | null = null;
  private lastWrite: DraftRecord | null = null;

  constructor(options: DraftAutosaveControllerOptions = {}) {
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.openDb = options.openDb ?? openDraftDatabase;
  }

  /** Schedules a debounced write. Safe to call on every working-copy
   * change; only the write from the last call in a burst ever persists. */
  schedule(identity: DraftIdentity, baseline: SceneDocument | null, current: SceneDocument): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    const localSeq = ++this.seq;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.performWrite(localSeq, identity, baseline, current);
    }, this.debounceMs);
  }

  private async performWrite(
    localSeq: number,
    identity: DraftIdentity,
    baseline: SceneDocument | null,
    current: SceneDocument,
  ): Promise<void> {
    if (localSeq !== this.seq) return; // superseded before this write's DB open even began
    try {
      const db = await this.getDb();
      if (localSeq !== this.seq) return; // superseded while awaiting the DB handle
      const record: DraftRecord = {
        ...identity,
        sceneJson: current,
        savedAt: new Date().toISOString(),
        changeSummary: summarizeSceneChange(baseline, current),
        writeSeq: localSeq,
      };
      await putDraftRecord(db, record);
      if (localSeq !== this.seq) return; // a newer write already won; don't report this as the latest
      this.lastFailure = null;
      this.lastWrite = record;
    } catch (err) {
      this.lastFailure = classifyFailure(err);
    }
  }

  /** Cancels any pending debounced write without touching persisted data.
   * Used when the identity a write would be scoped to (project, tab) is
   * about to change, so a stale in-flight write can never land under the
   * wrong project. */
  cancelPending(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.seq += 1;
  }

  async clearDraft(projectId: string): Promise<void> {
    this.cancelPending();
    try {
      const db = await this.getDb();
      await deleteDraftRecord(db, projectId);
      if (this.lastWrite?.projectId === projectId) this.lastWrite = null;
    } catch (err) {
      this.lastFailure = classifyFailure(err);
    }
  }

  async readDraft(projectId: string): Promise<DraftRecord | null> {
    try {
      const db = await this.getDb();
      return await getDraftRecord(db, projectId);
    } catch (err) {
      this.lastFailure = classifyFailure(err);
      return null;
    }
  }

  getLastFailure(): DraftAutosaveFailure | null {
    return this.lastFailure;
  }

  /** Test/inspection hook: the most recent record this controller actually
   * persisted (not merely scheduled). */
  getLastWrite(): DraftRecord | null {
    return this.lastWrite;
  }

  private getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = this.openDb().catch((err) => {
        // Don't cache a rejected promise — a later call (e.g. after a
        // transient failure) should retry opening rather than fail forever.
        this.dbPromise = null;
        throw err;
      });
    }
    return this.dbPromise;
  }
}
