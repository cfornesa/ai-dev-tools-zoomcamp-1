import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import {
  exportDatabaseArchive,
  inspectDatabaseArchive,
  restoreDatabaseArchive,
  type ArchiveInspection,
} from '../storage/localDatabaseArchive';
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

type LocalWorkspace = { name: string; projectIds: string[] };
const workspaceStorageKey = (ownerId: string) => `creatrart:local-workspaces:${ownerId}`;
const selectedWorkspaceStorageKey = (ownerId: string) =>
  `creatrart:selected-local-workspace:${ownerId}`;
type OffloadedProject = {
  projectId: string;
  title: string;
  archiveFilename: string;
  exportedAt: string;
  sceneCount: number;
  mediaFileCount: number;
  byteTotal: number;
};
const offloadedProjectsStorageKey = (ownerId: string) => `creatrart:offloaded-projects:${ownerId}`;

function readWorkspaces(ownerId: string): Record<string, LocalWorkspace> {
  try {
    const raw = window.localStorage.getItem(workspaceStorageKey(ownerId));
    if (raw) return JSON.parse(raw) as Record<string, LocalWorkspace>;
  } catch {
    // A blocked/full localStorage must not make the IndexedDB workspace unusable.
  }
  return { active: { name: 'Active workspace', projectIds: [] } };
}

function writeWorkspaces(ownerId: string, workspaces: Record<string, LocalWorkspace>) {
  try {
    window.localStorage.setItem(workspaceStorageKey(ownerId), JSON.stringify(workspaces));
  } catch {
    // Workspace labels are convenience metadata; project data remains in IndexedDB.
  }
}

function readOffloadedProjects(ownerId: string): OffloadedProject[] {
  try {
    const raw = window.localStorage.getItem(offloadedProjectsStorageKey(ownerId));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as OffloadedProject[];
    }
  } catch {
    // Recovery metadata is best effort; active IndexedDB data remains authoritative.
  }
  return [];
}

function writeOffloadedProjects(ownerId: string, projects: OffloadedProject[]) {
  try {
    window.localStorage.setItem(offloadedProjectsStorageKey(ownerId), JSON.stringify(projects));
  } catch {
    // A full/blocked localStorage must not make the active repository unusable.
  }
}

/** Issue #526: per-project export/delete plus whole-database export and
 * restore-from-file, for the local project database only -- the drafts
 * database has no comparable per-project archive concept. */
type LocalProjectDetails = { sceneCount: number; mediaFileCount: number; byteTotal: number };
type PendingOffload = {
  project: LocalProjectRecord;
  result: { sceneCount: number; mediaFileCount: number; byteTotal: number };
};

function LocalProjectsManager({ ownerId }: { ownerId: string }) {
  const [projects, setProjects] = useState<LocalProjectRecord[] | null>(null);
  const [details, setDetails] = useState<Record<string, LocalProjectDetails>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Record<string, LocalWorkspace>>(() =>
    readWorkspaces(ownerId),
  );
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(() => {
    try {
      return window.localStorage.getItem(selectedWorkspaceStorageKey(ownerId)) ?? 'active';
    } catch {
      return 'active';
    }
  });
  const [archivePreview, setArchivePreview] = useState<ArchiveInspection | null>(null);
  const [archiveBytes, setArchiveBytes] = useState<Uint8Array | null>(null);
  const [selectedArchiveIndices, setSelectedArchiveIndices] = useState<number[]>([]);
  const [workspaceName, setWorkspaceName] = useState('');
  const [offloadedProjects, setOffloadedProjects] = useState<OffloadedProject[]>(() =>
    readOffloadedProjects(ownerId),
  );
  const [pendingOffload, setPendingOffload] = useState<PendingOffload | null>(null);
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

  useEffect(() => {
    const next = readWorkspaces(ownerId);
    setWorkspaces(next);
    try {
      const saved = window.localStorage.getItem(selectedWorkspaceStorageKey(ownerId));
      setSelectedWorkspaceId(saved && next[saved] ? saved : 'active');
    } catch {
      setSelectedWorkspaceId('active');
    }
  }, [ownerId]);

  function selectWorkspace(workspaceId: string) {
    setSelectedWorkspaceId(workspaceId);
    try {
      window.localStorage.setItem(selectedWorkspaceStorageKey(ownerId), workspaceId);
    } catch {
      // Selection persistence is best effort; project data remains in IndexedDB.
    }
  }

  useEffect(() => {
    setOffloadedProjects(readOffloadedProjects(ownerId));
    setPendingOffload(null);
  }, [ownerId]);

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

  async function prepareOffload(project: LocalProjectRecord) {
    setBusyId(`offload:${project.id}`);
    setMessage(null);
    try {
      const db = await openLocalProjectDatabase();
      const result = await exportDatabaseArchive(db, ownerId, { projectIds: [project.id] });
      const bytes = new Uint8Array(await result.blob.arrayBuffer());
      const inspection = await inspectDatabaseArchive(bytes, ownerId);
      db.close();
      downloadBlob(result.blob, `${project.title.replace(/[^\w.-]+/g, '_') || 'project'}.zip`);
      setPendingOffload({
        project,
        result: {
          sceneCount: inspection.sceneCount,
          mediaFileCount: inspection.mediaFileCount,
          byteTotal: inspection.byteTotal,
        },
      });
      setMessage(
        `Archive verified for "${project.title}". Confirm offload only after keeping the downloaded archive safe.`,
      );
    } catch {
      setMessage(`Could not verify an archive for "${project.title}". Local data was not changed.`);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmOffload() {
    if (!pendingOffload) return;
    const { project, result } = pendingOffload;
    setBusyId(`offload:${project.id}`);
    setMessage(null);
    try {
      const db = await openLocalProjectDatabase();
      await deleteProject(db, ownerId, project.id);
      db.close();
      const record: OffloadedProject = {
        projectId: project.id,
        title: project.title,
        archiveFilename: `${project.title.replace(/[^\w.-]+/g, '_') || 'project'}.zip`,
        exportedAt: new Date().toISOString(),
        ...result,
      };
      const next = [...offloadedProjects.filter((item) => item.projectId !== project.id), record];
      writeOffloadedProjects(ownerId, next);
      setOffloadedProjects(next);
      setPendingOffload(null);
      setMessage(
        `Offloaded "${project.title}" after verified export. Keep ${record.archiveFilename} to rehydrate it later.`,
      );
      setRefreshKey((k) => k + 1);
    } catch {
      setMessage(`Could not offload "${project.title}". The active project was preserved.`);
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

  async function inspectArchive(file: File) {
    setMessage(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const inspection = await inspectDatabaseArchive(bytes, ownerId);
      setArchiveBytes(bytes);
      setArchivePreview(inspection);
      setSelectedArchiveIndices(inspection.projects.map((project) => project.index));
      setWorkspaceName('');
      setMessage('Archive verified. Choose projects and a workspace name before restoring.');
    } catch {
      setMessage(
        'Could not inspect that archive. It may be corrupted or in an unrecognized format. No local data was changed.',
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function restoreSelectedArchive() {
    if (
      !archiveBytes ||
      !archivePreview ||
      !workspaceName.trim() ||
      selectedArchiveIndices.length === 0
    )
      return;
    setBusyId('__restore__');
    setMessage(null);
    try {
      const db = await openLocalProjectDatabase();
      const result = await restoreDatabaseArchive(db, ownerId, archiveBytes, {
        projectIndices: selectedArchiveIndices,
      });
      db.close();
      const id = crypto.randomUUID();
      const next = {
        ...workspaces,
        [id]: {
          name: workspaceName.trim(),
          projectIds: result.projects.map((project) => project.id),
        },
      };
      writeWorkspaces(ownerId, next);
      setWorkspaces(next);
      setSelectedWorkspaceId(id);
      setArchivePreview(null);
      setArchiveBytes(null);
      setMessage(
        `Restored ${result.projectCount} project(s), ${result.sceneCount} scene(s), ${result.mediaFileCount} media file(s) into "${workspaceName.trim()}".`,
      );
      setRefreshKey((k) => k + 1);
    } catch {
      setMessage(
        'Could not restore that archive. No active or existing workspace data was changed.',
      );
    } finally {
      setBusyId(null);
    }
  }

  const selectedProjectIds = new Set(workspaces[selectedWorkspaceId]?.projectIds ?? []);
  const visibleProjects = projects?.filter(
    (project) => selectedWorkspaceId === 'active' || selectedProjectIds.has(project.id),
  );

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
            if (file) void inspectArchive(file);
          }}
        />
      </div>
      <label htmlFor="local-workspace-select">Workspace</label>
      <select
        id="local-workspace-select"
        value={selectedWorkspaceId}
        onChange={(event) => selectWorkspace(event.target.value)}
      >
        {Object.entries(workspaces).map(([id, workspace]) => (
          <option key={id} value={id}>
            {workspace.name}
          </option>
        ))}
      </select>
      {archivePreview && (
        <section aria-label="Inspect archive before restore">
          <h4>Archive preview</h4>
          <p>
            {archivePreview.projectCount} project(s), {archivePreview.sceneCount} scene(s),{' '}
            {archivePreview.mediaFileCount} media file(s), {formatBytes(archivePreview.byteTotal)}.
          </p>
          <label htmlFor="workspace-name">New workspace name</label>
          <input
            id="workspace-name"
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
          />
          <ul>
            {archivePreview.projects.map((project) => (
              <li key={project.index}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedArchiveIndices.includes(project.index)}
                    onChange={(event) =>
                      setSelectedArchiveIndices((current) =>
                        event.target.checked
                          ? [...current, project.index]
                          : current.filter((index) => index !== project.index),
                      )
                    }
                  />{' '}
                  {project.title} — {project.sceneCount} scene(s), {project.mediaFileCount} media
                  file(s), {formatBytes(project.byteTotal)}
                  {project.checksums.length > 0 && (
                    <span className="local-storage-checksums">
                      {' '}
                      Verified SHA-256:{' '}
                      {project.checksums.map((checksum) => (
                        <code key={checksum}>{checksum}</code>
                      ))}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void restoreSelectedArchive()}
            disabled={
              busyId !== null || !workspaceName.trim() || selectedArchiveIndices.length === 0
            }
          >
            {busyId === '__restore__' ? 'Restoring…' : 'Restore selected projects'}
          </button>
          <button
            type="button"
            onClick={() => {
              setArchivePreview(null);
              setArchiveBytes(null);
            }}
          >
            Cancel
          </button>
        </section>
      )}
      <p className="intro">
        An exported ZIP is your responsibility to keep safe -- it is never uploaded anywhere by this
        app. Restoring an archive always creates brand-new project(s); it never overwrites an
        existing one.
      </p>
      {visibleProjects && visibleProjects.length === 0 && (
        <p>
          {selectedWorkspaceId === 'active'
            ? 'No local projects yet.'
            : 'No projects in this workspace yet.'}
        </p>
      )}
      {visibleProjects && visibleProjects.length > 0 && (
        <ul className="local-storage-project-list">
          {visibleProjects.map((project) => (
            <li key={project.id} aria-label={project.title}>
              <Link to={`/local-projects/${project.id}?workspace=${selectedWorkspaceId}`}>
                {project.title}
              </Link>
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
                <button
                  type="button"
                  onClick={() => void prepareOffload(project)}
                  disabled={busyId !== null}
                >
                  {busyId === `offload:${project.id}` ? 'Preparing…' : 'Archive & offload'}
                </button>
                {pendingOffload?.project.id === project.id && (
                  <>
                    <span role="alert">
                      Archive verified: {pendingOffload.result.sceneCount} scene(s),{' '}
                      {pendingOffload.result.mediaFileCount} media file(s),{' '}
                      {formatBytes(pendingOffload.result.byteTotal)}. Confirming removes the active
                      browser copy; the downloaded archive remains your recovery copy.
                    </span>
                    <button
                      type="button"
                      onClick={() => void confirmOffload()}
                      disabled={busyId !== null}
                    >
                      {busyId === `offload:${project.id}` ? 'Offloading…' : 'Confirm offload'}
                    </button>
                    <button type="button" onClick={() => setPendingOffload(null)}>
                      Cancel
                    </button>
                  </>
                )}
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
      {offloadedProjects.length > 0 && (
        <section aria-label="Offloaded local projects">
          <h4>Offloaded local projects</h4>
          <p>
            These projects are no longer in active IndexedDB storage. Keep their verified ZIP
            archives to rehydrate them later; another archive or database does not create extra
            browser quota.
          </p>
          <ul>
            {offloadedProjects.map((project) => (
              <li key={project.projectId}>
                <strong>{project.title}</strong> — {project.sceneCount} scene(s),{' '}
                {project.mediaFileCount} media file(s), {formatBytes(project.byteTotal)}; archive{' '}
                <code>{project.archiveFilename}</code>
              </li>
            ))}
          </ul>
        </section>
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
              <>
                <p>
                  Using {formatBytes(snapshot.estimate.usage)} of{' '}
                  {formatBytes(snapshot.estimate.quota)} available to this origin.
                </p>
                {snapshot.estimate.usage !== undefined && snapshot.estimate.quota !== undefined && (
                  <p>
                    Estimated remaining origin capacity:{' '}
                    {formatBytes(Math.max(snapshot.estimate.quota - snapshot.estimate.usage, 0))}.
                    This is an origin quota estimate, not free space on the device, and it may
                    change.
                  </p>
                )}
              </>
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
