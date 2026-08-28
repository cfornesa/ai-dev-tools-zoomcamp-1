/**
 * Task 66 (issue #66): direct IndexedDB seeding/reading for the recovery-
 * prompt end-to-end scenarios (`aiAndRecovery.spec.ts`). The app's own
 * local-draft store (`frontend/src/storage/draftAutosave.ts`) is
 * deliberately framework-free and keyed only by `projectId` (database
 * `motion-editor-draft-autosave`, object store `drafts`, keyPath
 * `projectId`) -- these constants are duplicated here rather than
 * imported so this file has zero dependency on the app's own source tree
 * (Playwright's `page.evaluate` callbacks run inside the browser, with no
 * access to this repo's TypeScript modules; only plain, self-contained
 * JS reaches the page).
 *
 * Used to set up states the app's own UI cannot produce on demand:
 * an expired draft (backdating `savedAt` past `LOCAL_DRAFT_MAX_AGE_MS`,
 * 24h -- `useDraftRecovery.ts`), and a corrupt draft (a record missing
 * required fields, which `isWellFormedRecord` in `draftAutosave.ts` is
 * specifically written to detect and delete rather than crash on).
 */
import type { Page } from '@playwright/test';

const DB_NAME = 'motion-editor-draft-autosave';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

export type SeedableDraftRecord = {
  projectId: string;
  userKey: string;
  sessionId: string;
  sceneJson: unknown;
  savedAt: string;
  changeSummary: string;
  writeSeq: number;
};

/** Writes a well-formed local draft record directly into IndexedDB, from
 * the page's own origin -- `page` must already have navigated to the app
 * (any same-origin URL) before this is called. */
export async function seedLocalDraft(page: Page, record: SeedableDraftRecord): Promise<void> {
  await page.evaluate(
    ({ dbName, dbVersion, storeName, record: rec }) => {
      return new Promise<void>((resolve, reject) => {
        const openReq = indexedDB.open(dbName, dbVersion);
        openReq.onupgradeneeded = () => {
          const db = openReq.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'projectId' });
          }
        };
        openReq.onsuccess = () => {
          const db = openReq.result;
          const tx = db.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).put(rec);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        openReq.onerror = () => reject(openReq.error);
      });
    },
    { dbName: DB_NAME, dbVersion: DB_VERSION, storeName: STORE_NAME, record },
  );
}

/** Writes a deliberately malformed record (missing every required field
 * except `projectId`) under the given project id -- exercises
 * `draftAutosave.ts`'s `isWellFormedRecord` corrupt-data path. */
export async function seedCorruptLocalDraft(page: Page, projectId: string): Promise<void> {
  await page.evaluate(
    ({ dbName, dbVersion, storeName, projectId: pid }) => {
      return new Promise<void>((resolve, reject) => {
        const openReq = indexedDB.open(dbName, dbVersion);
        openReq.onupgradeneeded = () => {
          const db = openReq.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'projectId' });
          }
        };
        openReq.onsuccess = () => {
          const db = openReq.result;
          const tx = db.transaction(storeName, 'readwrite');
          // Deliberately missing sceneJson/savedAt/changeSummary/writeSeq/
          // userKey/sessionId -- a hand-edited or partially-written record.
          tx.objectStore(storeName).put({ projectId: pid, garbage: true });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        openReq.onerror = () => reject(openReq.error);
      });
    },
    { dbName: DB_NAME, dbVersion: DB_VERSION, storeName: STORE_NAME, projectId },
  );
}

/** Reads the raw record (or `null`) for one project -- used to assert a
 * draft was actually cleared (explicit Save, confirmed Exit-without-save,
 * Discard) or actually persisted (debounced autosave). */
export async function readLocalDraft(page: Page, projectId: string): Promise<unknown> {
  return page.evaluate(
    ({ dbName, dbVersion, storeName, projectId: pid }) => {
      return new Promise<unknown>((resolve, reject) => {
        const openReq = indexedDB.open(dbName, dbVersion);
        openReq.onupgradeneeded = () => {
          const db = openReq.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'projectId' });
          }
        };
        openReq.onsuccess = () => {
          const db = openReq.result;
          const tx = db.transaction(storeName, 'readonly');
          const req = tx.objectStore(storeName).get(pid);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => reject(req.error);
        };
        openReq.onerror = () => reject(openReq.error);
      });
    },
    { dbName: DB_NAME, dbVersion: DB_VERSION, storeName: STORE_NAME, projectId },
  );
}

/** Reads the per-tab session id `useDraftAutosave.ts`'s `sessionIdFor`
 * assigns a project -- needed to PUT a server-side draft
 * (`DraftDetailView`) under the exact session id the running page will
 * itself look up when `useDraftRecovery`'s server-candidate check runs. */
export async function readSessionId(page: Page, projectId: string): Promise<string | null> {
  await page.waitForFunction(
    (pid) => Boolean(window.sessionStorage.getItem(`motion-editor-draft-session:${pid}`)),
    projectId,
  );
  return page.evaluate(
    (pid) => window.sessionStorage.getItem(`motion-editor-draft-session:${pid}`),
    projectId,
  );
}
