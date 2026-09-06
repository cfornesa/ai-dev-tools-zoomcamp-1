import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { deleteAccount, type AccountDeletionErrorBody } from '../api/accountDeletion';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';

const REQUIRED_CONFIRMATION_TEXT = 'DELETE';

/**
 * Issue #443: the confirmation UI for `POST /api/account/delete/`.
 * Deliberately no `onAccepted`-style "act immediately" affordance --
 * every field starts empty, the submit button stays disabled until the
 * exact confirmation text is typed, and Cancel (navigating away) never
 * calls the server at all, matching the issue's own "cancel is
 * non-mutating" criterion.
 */
function AccountDeletion() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.status === 'loading') return null;
  if (auth.status !== 'signed-in') return <Navigate to="/" replace />;

  const canSubmit = confirmation.trim().toUpperCase() === REQUIRED_CONFIRMATION_TEXT && !busy;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(confirmation, password || undefined);
      // The server has already logged this session out server-side --
      // sync the shared client-side auth context directly (mirroring
      // AccountSessions.tsx's identical self-revocation handling) rather
      // than relying on a route change alone, which never itself
      // refetches the separately-cached signed-in state.
      auth.signOutLocally?.();
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as Partial<AccountDeletionErrorBody> | null;
        if (body?.error === 'reauthentication_required') {
          setError('Your current password is required to delete your account.');
        } else if (body?.error === 'confirmation_mismatch') {
          setError(`Type "${REQUIRED_CONFIRMATION_TEXT}" exactly to confirm.`);
        } else if (body?.error === 'already_deleted') {
          setError('This account has already been deleted.');
        } else {
          setError('Something went wrong deleting your account. Please try again.');
        }
      } else {
        setError('Something went wrong deleting your account. Please try again.');
      }
      setBusy(false);
    }
  }

  return (
    <section className="content-panel account-deletion">
      <h2>Delete your account</h2>
      <p>
        This permanently deactivates your account. All of your projects, 3D scenes, and art pieces
        are unpublished and scheduled for permanent removal after a 30-day grace period. Your linked
        sign-in methods and saved AI provider keys are removed immediately. An active subscription
        is cancelled, but you keep paid access through the end of the current billing period. This
        cannot be undone once submitted.
      </p>
      <form onSubmit={(event) => void handleSubmit(event)} className="account-settings-form">
        <label htmlFor="account-deletion-password">
          Current password (leave blank if you only sign in with Google, GitHub, or LinkedIn)
        </label>
        <input
          id="account-deletion-password"
          className="account-settings-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
        />
        <label htmlFor="account-deletion-confirmation">
          Type "{REQUIRED_CONFIRMATION_TEXT}" to confirm
        </label>
        <input
          id="account-deletion-confirmation"
          className="account-settings-input"
          type="text"
          autoComplete="off"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          disabled={busy}
        />
        <div className="editor-tool-group">
          <button
            type="submit"
            className="shell-action"
            disabled={!canSubmit}
            data-testid="account-deletion-submit"
          >
            {busy ? 'Deleting…' : 'Permanently delete my account'}
          </button>
          <button
            type="button"
            className="shell-action"
            onClick={() => navigate('/account/settings')}
            disabled={busy}
            data-testid="account-deletion-cancel"
          >
            Cancel
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" aria-live="assertive" data-testid="account-deletion-error">
          {error}
        </p>
      )}
    </section>
  );
}

export default AccountDeletion;
