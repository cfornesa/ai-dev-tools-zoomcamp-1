import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { requestPersistentStorage } from '../storage/localProjectRepository';
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
        </>
      )}
    </section>
  );
}

export default AccountLocalStorage;
