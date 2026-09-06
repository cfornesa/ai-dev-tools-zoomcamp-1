import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import {
  type AccountSession,
  fetchAccountSessions,
  revokeAccountSession,
} from '../api/accountSessions';
import { useAuth } from '../auth/useAuth';

function AccountSessions() {
  const auth = useAuth();
  const [sessions, setSessions] = useState<AccountSession[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    fetchAccountSessions()
      .then(setSessions)
      .catch(() => setLoadError('Could not load your sessions.'));
  }, [auth]);

  if (auth.status === 'loading') return null;
  if (auth.status !== 'signed-in') return <Navigate to="/" replace />;

  if (signedOut) {
    return <Navigate to="/" replace />;
  }

  async function confirmRevoke(publicId: string) {
    setBusyId(publicId);
    setActionError(null);
    try {
      const result = await revokeAccountSession(publicId);
      if (result.was_current) {
        // The server session is already gone -- sync the shared auth
        // context directly rather than round-tripping through the
        // separate logout endpoint a second time.
        auth.signOutLocally?.();
        setSignedOut(true);
        return;
      }
      setSessions((current) => (current ?? []).filter((s) => s.public_id !== publicId));
    } catch {
      setActionError('Could not revoke this session. Please try again.');
    } finally {
      setBusyId(null);
      setConfirmingId(null);
    }
  }

  return (
    <section className="content-panel account-sessions">
      <h2>Active sessions</h2>
      {loadError && (
        <p role="alert" aria-live="assertive">
          {loadError}
        </p>
      )}
      {sessions ? (
        <ul aria-label="Active sessions">
          {sessions.map((session) => (
            <li key={session.public_id}>
              <span>{session.user_agent || 'Unknown device'}</span>
              {session.is_current && <span> (this device)</span>}
              {confirmingId === session.public_id ? (
                <span>
                  <span>Revoke this session?</span>
                  <button
                    type="button"
                    onClick={() => void confirmRevoke(session.public_id)}
                    disabled={busyId === session.public_id}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    disabled={busyId === session.public_id}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmingId(session.public_id)}>
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !loadError && <p role="status">Loading your sessions…</p>
      )}
      {actionError && (
        <p role="alert" aria-live="assertive">
          {actionError}
        </p>
      )}
    </section>
  );
}

export default AccountSessions;
