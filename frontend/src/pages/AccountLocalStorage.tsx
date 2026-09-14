import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { exportDatabaseArchive, restoreDatabaseArchive } from '../storage/localDatabaseArchive';
import {
  deleteProject,
  getProjectUsage,
  listProjectsForOwner,
  listScenesForProject,
  openLocalProjectDatabase,
  requestPersistentStorage,
  type LocalProjectRecord,
} from '../storage/localProjectRepository';
import {
  getLocalStorageDashboardSnapshot,
  isNearQuota,
  type DatabaseSummary,
  type LocalStorageDashboardSnapshot,
} from '../storage/localStorageDashboard';

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function kindLabel(kind: DatabaseSummary['kind']): string {
  if (kind === 'active') return 'Active';
  if (kind === 'legacy_recovery') return 'Legacy / recovery';
  return 'Archived';
}

function DatabaseRow({ database }: { database: DatabaseSummary }) {
  return (
    <li className="local-storage-database-row" aria-label={database.label}>
      <h4>{database.label}</h4>
      <p>
        Status: {kindLabel(database.kind)}
        {database.opened === false && (
          <span role="alert"> &mdash; unavailable ({database.errorKind ?? 'unknown reason'})</span>
        )}
      </p>
      {database.opened && (
        <dl>
          <dt>Version</dt>
          <dd>{database.actualVersion}</dd>
          <dt>Projects</dt>
          <dd>{database.projectCount ?? 0}</dd>
          <dt>Scenes</dt>
          <dd>{database.sceneCount ?? 0}</dd>
          <dt>Media files</dt>
          <dd>{database.mediaFileCount ?? 0}</dd>
          <dt>Storage used</dt>
          <dd>{formatBytes(database.byteTotal)}</dd>
          <dt>Last activity</dt>
          <dd>
            {database.lastActivity ? new Date(database.lastActivity).toLocaleString() : 'Never'}
          </dd>
        </dl>
      )}
    </li>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Issue #526: per-project export/delete plus whole-database export and
 * restore-from-file, for the local project database only -- the drafts
 * database has no comparable per-project archive concept. */
type LocalProjectDetails = { sceneCount: number; mediaFileCount: number; byteTotal: number };

function LocalProjectsManager({ ownerId }: { ownerId: string }) {
  const [projects, setProjects] = useState<LocalProjectRecord[] | null>(null);
  const [details, setDetails] = useState<Record<string, LocalProjectDetails>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    openLocalProjectDatabase()
      .then(async (db) => {
        const list = await listProjectsForOwner(db, ownerId);
        // Issue #527: "names the exact scope ... shows current
        // project/file/byte counts" for the delete confirmation below --
        // fetched once per load rather than only when Delete is clicked,
        // so the confirmation can show real numbers immediately.
        const detailEntries = await Promise.all(
          list.map(async (project) => {
            const [scenes, usage] = await Promise.all([
              listScenesForProject(db, project.id),
              getProjectUsage(db, project.id),
            ]);
            return [
              project.id,
              {
                sceneCount: scenes.length,
                mediaFileCount: usage.fileCount,
                byteTotal: usage.bytesUsed,
              },
            ] as const;
          }),
        );
        db.close();
        if (!cancelled) {
          setProjects(list);
          setDetails(Object.fromEntries(detailEntries));
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not read local projects.');
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId, refreshKey]);

  async function exportProject(project: LocalProjectRecord) {
    setBusyId(project.id);
    setMessage(null);
    try {
      const db = await openLocalProjectDatabase();
      const result = await exportDatabaseArchive(db, ownerId, { projectIds: [project.id] });
      db.close();
      downloadBlob(result.blob, `${project.title.replace(/[^\w.-]+/g, '_') || 'project'}.zip`);
      setMessage(`Exported "${project.title}".`);
    } catch {
      setMessage(`Could not export "${project.title}". Local data was not changed.`);
    } finally {
      setBusyId(null);
    }
  }

  async function exportWholeDatabase() {
    setBusyId('__database__');
    setMessage(null);
    try {
      const db = await openLocalProjectDatabase();
      const result = await exportDatabaseArchive(db, ownerId);
      db.close();
      downloadBlob(result.blob, 'local-projects-archive.zip');
      setMessage(
        `Exported ${result.projectCount} project(s), ${result.sceneCount} scene(s), ${result.mediaFileCount} media file(s). This file is your own responsibility to keep safe -- it is not uploaded anywhere.`,
      );
    } catch {
      setMessage('Could not export the database. Local data was not changed.');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteProjectConfirmed(project: LocalProjectRecord) {
    setBusyId(project.id);
    setConfirmingDeleteId(null);
    setMessage(null);
    try {
      const db = await openLocalProjectDatabase();
      await deleteProject(db, ownerId, project.id);
      db.close();
      setMessage(`Deleted "${project.title}".`);
      setRefreshKey((k) => k + 1);
    } catch {
      setMessage(`Could not delete "${project.title}".`);
    } finally {
      setBusyId(null);
    }
  }

  async function restoreFromFile(file: File) {
    setBusyId('__restore__');
    setMessage(null);
    try {
      const zipBytes = new Uint8Array(await file.arrayBuffer());
      const db = await openLocalProjectDatabase();
      const result = await restoreDatabaseArchive(db, ownerId, zipBytes);
      db.close();
      setMessage(
        `Restored ${result.projectCount} project(s), ${result.sceneCount} scene(s), ${result.mediaFileCount} media file(s) as new project(s).`,
      );
      setRefreshKey((k) => k + 1);
    } catch {
      setMessage(
        'Could not restore that archive. It may be corrupted or in an unrecognized format. No local data was changed.',
      );
    } finally {
      setBusyId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <section aria-label="Manage local projects: export, restore, and delete">
      <h3>Manage local projects</h3>
      {loadError && (
        <p role="alert" aria-live="assertive">
          {loadError}
        </p>
      )}
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
      <div className="local-storage-actions">
        <button
          type="button"
          onClick={() => void exportWholeDatabase()}
          disabled={busyId !== null || !projects || projects.length === 0}
        >
          {busyId === '__database__' ? 'Exporting…' : 'Export entire database'}
        </button>
        <label htmlFor="restore-archive-input">Restore from a ZIP archive</label>
        <input
          ref={fileInputRef}
          id="restore-archive-input"
          type="file"
          accept=".zip,application/zip"
          disabled={busyId !== null}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void restoreFromFile(file);
          }}
        />
      </div>
      <p className="intro">
        An exported ZIP is your responsibility to keep safe -- it is never uploaded anywhere by this
        app. Restoring an archive always creates brand-new project(s); it never overwrites an
        existing one.
      </p>
      {projects && projects.length === 0 && <p>No local projects yet.</p>}
      {projects && projects.length > 0 && (
        <ul className="local-storage-project-list">
          {projects.map((project) => (
            <li key={project.id} aria-label={project.title}>
              <span>{project.title}</span>
              <div className="local-storage-actions">
                <button
                  type="button"
                  onClick={() => void exportProject(project)}
                  disabled={busyId !== null}
                >
                  {busyId === project.id && confirmingDeleteId !== project.id
                    ? 'Exporting…'
                    : 'Export'}
                </button>
                {confirmingDeleteId === project.id ? (
                  <>
                    <span role="alert">
                      Delete "{project.title}" permanently? This removes{' '}
                      {details[project.id]?.sceneCount ?? 0} scene(s) and{' '}
                      {details[project.id]?.mediaFileCount ?? 0} media file(s) (
                      {formatBytes(details[project.id]?.byteTotal)}) from this browser. This project
                      is not synced to the cloud -- it only exists here; export it first if you want
                      a copy.
                    </span>
                    <button
                      type="button"
                      onClick={() => void deleteProjectConfirmed(project)}
                      disabled={busyId !== null}
                    >
                      {busyId === project.id ? 'Deleting…' : 'Confirm delete'}
                    </button>
                    <button type="button" onClick={() => setConfirmingDeleteId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(project.id)}
                    disabled={busyId !== null}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AccountLocalStorage() {
  const auth = useAuth();
  const [snapshot, setSnapshot] = useState<LocalStorageDashboardSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [persistBusy, setPersistBusy] = useState(false);
  const [persistMessage, setPersistMessage] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    let cancelled = false;
    setLoadError(null);
    getLocalStorageDashboardSnapshot(auth.user.username)
      .then((next) => {
        if (!cancelled) setSnapshot(next);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not read local storage information.');
      });
    return () => {
      cancelled = true;
    };
  }, [auth, refreshKey]);

  if (auth.status === 'loading') return null;
  if (auth.status !== 'signed-in') return <Navigate to="/" replace />;

  const nearQuota = snapshot ? isNearQuota(snapshot.estimate) : false;

  async function requestPersistence() {
    setPersistBusy(true);
    setPersistMessage(null);
    try {
      const result = await requestPersistentStorage();
      if (!result.supported) {
        setPersistMessage("This browser doesn't support requesting persistent storage.");
      } else if (result.persisted) {
        setPersistMessage('Persistent storage granted.');
      } else {
        setPersistMessage(
          'The browser declined persistent storage for now. It may grant it automatically as you use this app more (e.g. bookmarking or installing it can help).',
        );
      }
      setRefreshKey((k) => k + 1);
    } catch {
      setPersistMessage('Could not request persistent storage.');
    } finally {
      setPersistBusy(false);
    }
  }

  return (
    <section className="content-panel account-local-storage">
      <h2>Local storage</h2>
      <p>
        This reports only what this browser can tell us about this app's own storage on this origin.
        It never sees other sites' storage, and it can't guarantee more space is available.
      </p>
      <p>
        Clearing your browser's history or site data outside this app can delete this data too --
        that happens entirely outside this page, and no website can reliably detect or prevent it.
        Export what you want to keep, and check "Last activity" above for a rough sense of what's
        been backed up.
      </p>
      {loadError && (
        <p role="alert" aria-live="assertive">
          {loadError}
        </p>
      )}
      {!snapshot && !loadError && <p role="status">Loading local storage information…</p>}
      {snapshot && (
        <>
          {!snapshot.indexedDbSupported && (
            <p role="alert">
              This browser does not support local storage for this app. Projects created here cannot
              be saved locally.
            </p>
          )}
          <section aria-label="Overall browser storage">
            <h3>Overall browser storage</h3>
            {snapshot.estimate.supported ? (
              <p>
                Using {formatBytes(snapshot.estimate.usage)} of{' '}
                {formatBytes(snapshot.estimate.quota)} available to this origin.
              </p>
            ) : (
              <p>This browser does not report a storage estimate.</p>
            )}
            <p>
              Persistent storage:{' '}
              {snapshot.persistentStorage.supported
                ? snapshot.persistentStorage.persisted
                  ? 'granted'
                  : 'not granted'
                : 'not supported by this browser'}
              {snapshot.persistentStorage.supported && !snapshot.persistentStorage.persisted && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => void requestPersistence()}
                    disabled={persistBusy}
                  >
                    {persistBusy ? 'Requesting…' : 'Request persistent storage'}
                  </button>
                </>
              )}
            </p>
            {persistMessage && (
              <p role="status" aria-live="polite">
                {persistMessage}
              </p>
            )}
            <p>
              {snapshot.browserReportedDatabases === null
                ? "This browser doesn't report a list of its own databases."
                : `This browser reports ${snapshot.browserReportedDatabases.length} database(s) on this origin.`}
            </p>
          </section>

          {nearQuota && (
            <section aria-label="Storage running low" role="alert">
              <h3>Storage running low</h3>
              <p>
                This origin is close to its browser storage limit. Consider exporting an inactive
                project, or deleting one only after confirming you no longer need it.
              </p>
              <div className="local-storage-actions">
                <button type="button" onClick={() => setRefreshKey((k) => k + 1)}>
                  Retry
                </button>
                <a href="/account/settings/export">Export your data</a>
                <a href="mailto:support@augmentrart.example">Contact support</a>
              </div>
            </section>
          )}

          <section aria-label="App-owned databases">
            <h3>App-owned databases</h3>
            <ul className="local-storage-database-list">
              {snapshot.databases.map((database) => (
                <DatabaseRow key={database.name} database={database} />
              ))}
            </ul>
          </section>

          <LocalProjectsManager ownerId={auth.user.username} />
        </>
      )}
    </section>
  );
}

export default AccountLocalStorage;
