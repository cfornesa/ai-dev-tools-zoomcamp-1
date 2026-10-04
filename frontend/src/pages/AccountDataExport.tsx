import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { fetchAccountExport } from '../api/accountExport';
import { useAuth } from '../auth/useAuth';
import {
  buildAccountExportArchive,
  type AccountExportArchiveResult,
  type AccountExportProgress,
} from '../storage/accountExportArchive';

function AccountDataExport() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipProgress, setZipProgress] = useState<AccountExportProgress | null>(null);
  const [zipResult, setZipResult] = useState<AccountExportArchiveResult | null>(null);

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

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function prepareZip() {
    if (!auth.user?.username) return;
    setZipBusy(true);
    setZipResult(null);
    setError(null);
    try {
      setZipResult(await buildAccountExportArchive(auth.user.username, setZipProgress));
    } catch {
      setError('Could not prepare your complete ZIP export. Please try again.');
    } finally {
      setZipBusy(false);
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
      <hr />
      <h3>Complete ZIP export</h3>
      <p>
        Includes the JSON export plus every server and browser-local piece package and its media. A
        partial ZIP records any individual package failures in its manifest.
      </p>
      <button type="button" onClick={() => void prepareZip()} disabled={zipBusy}>
        {zipBusy ? 'Preparing complete ZIP…' : 'Prepare complete ZIP'}
      </button>
      {zipProgress && zipBusy && (
        <p role="status" aria-live="polite">
          {zipProgress.label} ({zipProgress.completed}/{zipProgress.total})
        </p>
      )}
      {zipResult && (
        <section aria-label="Complete ZIP export ready">
          <p role="status">
            ZIP ready: {zipResult.byteSize.toLocaleString()} bytes, {zipResult.packageCount} piece
            packages.
            {zipResult.failures.length > 0 && ' This is a partial export.'}
          </p>
          <button
            type="button"
            onClick={() => downloadBlob(zipResult.blob, 'account-export-complete.zip')}
          >
            Download everything (ZIP)
          </button>
          {zipResult.failures.length > 0 && (
            <ul aria-label="ZIP package failures">
              {zipResult.failures.map((failure) => (
                <li key={failure.label}>
                  {failure.label}: {failure.reason}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </section>
  );
}

export default AccountDataExport;
