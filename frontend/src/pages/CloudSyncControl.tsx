import { useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import { fetchCloudBackup, setCloudBackupAction, type CloudBackupStatus } from '../api/cloudBackup';

export default function CloudSyncControl({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<CloudBackupStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCloudBackup(projectId)
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) {
          setStatus({ enabled: false, paused: false, read_only: false, revision: 0 });
          return;
        }
        setMessage('Cloud sync status is unavailable. Local editing and export are unaffected.');
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function change(action: 'enable' | 'pause') {
    setBusy(true);
    setMessage(null);
    try {
      setStatus(await setCloudBackupAction(projectId, action));
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 409) {
        setMessage(
          'Cloud sync is not available for this account or is currently paused. Your local project remains available; export it from Account settings.',
        );
      } else {
        setMessage('Cloud sync could not be changed. Local editing and export are unaffected.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!status && !message) return null;

  return (
    <section aria-label="Project cloud sync" className="cloud-sync-control">
      <h3>Cloud sync</h3>
      {status?.read_only ? (
        <p role="status">
          Your retained cloud copy is read-only. Local editing and export remain available.
        </p>
      ) : status?.paused ? (
        <p role="status">
          Cloud sync is paused. Your local project remains available and the remote copy is
          retained.
        </p>
      ) : status?.enabled ? (
        <>
          <p role="status">Cloud sync is enabled for this project.</p>
          <button type="button" onClick={() => void change('pause')} disabled={busy}>
            {busy ? 'Pausing…' : 'Pause cloud sync'}
          </button>
        </>
      ) : (
        <>
          <p>
            Cloud sync is optional and requires an eligible plan. Your local project is never
            restricted.
          </p>
          <button type="button" onClick={() => void change('enable')} disabled={busy}>
            {busy ? 'Enabling…' : 'Enable cloud sync'}
          </button>
        </>
      )}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
