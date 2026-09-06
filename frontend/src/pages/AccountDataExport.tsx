import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { fetchAccountExport } from '../api/accountExport';
import { useAuth } from '../auth/useAuth';

function AccountDataExport() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  if (auth.status === 'loading') return null;
  if (auth.status !== 'signed-in') return <Navigate to="/" replace />;

  async function download() {
    setBusy(true);
    setError(null);
    setDownloaded(false);
    try {
      const data = await fetchAccountExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'account-export.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch {
      setError('Could not generate your data export. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-panel account-data-export">
      <h2>Export your data</h2>
      <p>
        Download a portable archive of your profile, linked sign-in methods, plan and billing
        status, and every project, 3D scene, and art piece you own, including their full version
        history. Your saved AI provider keys are never included — only whether one is configured.
      </p>
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        data-testid="account-export-download"
      >
        {busy ? 'Preparing your export…' : 'Download my data'}
      </button>
      {downloaded && !error && (
        <p role="status" aria-live="polite">
          Your export has downloaded.
        </p>
      )}
      {error && (
        <p role="alert" aria-live="assertive">
          {error}
        </p>
      )}
    </section>
  );
}

export default AccountDataExport;
