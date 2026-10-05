import { useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import {
  type ConnectedMcpApp,
  fetchConnectedMcpApps,
  revokeConnectedMcpApp,
} from '../api/connectedMcpApps';

export default function ConnectedMcpAppsSettings() {
  const [apps, setApps] = useState<ConnectedMcpApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchConnectedMcpApps()
      .then((result) => {
        if (active) setApps(result);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof ApiError && cause.status === 401
            ? 'Sign in to view connected MCP apps.'
            : 'Could not load connected MCP apps. Please try again.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function revoke(applicationId: number) {
    setBusyId(applicationId);
    setError('');
    try {
      await revokeConnectedMcpApp(applicationId);
      setApps((current) => current.filter((app) => app.id !== applicationId));
    } catch {
      setError('Could not revoke this app. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p role="status">Loading connected MCP apps…</p>;
  return (
    <div>
      <p>These apps can access your account using the scopes you approved.</p>
      {error && <p role="alert">{error}</p>}
      {apps.length === 0 ? (
        <p>No connected MCP apps.</p>
      ) : (
        <ul aria-label="Connected MCP apps">
          {apps.map((app) => (
            <li key={app.id}>
              <strong>{app.name}</strong>
              <p>Approved access: {app.scopes.join(', ') || 'none'}</p>
              <p>Last authorized: {new Date(app.last_authorized).toLocaleString()}</p>
              <button
                type="button"
                disabled={busyId === app.id}
                onClick={() => void revoke(app.id)}
              >
                {busyId === app.id ? 'Revoking…' : `Revoke ${app.name}`}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
