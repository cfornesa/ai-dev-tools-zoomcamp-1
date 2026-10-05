import { useEffect, useMemo, useState } from 'react';

import { fetchCloudSyncPreference } from '../api/cloudSyncPreference';
import { intakePiecePackage } from '../api/pieceIntake';
import { fetchStorageEstimate } from '../api/storageUsage';
import { useAuth } from '../auth/useAuth';
import { buildLocalPiecePackage, measureLocalPiecePackage } from '../storage/localPiecePackage';
import {
  listProjectsForOwner,
  openLocalProjectDatabase,
  updateProject,
  type LocalProjectRecord,
} from '../storage/localProjectRepository';

type PieceRow = {
  project: LocalProjectRecord;
  pieceBytes: number;
  mediaBytes: number;
  mediaFiles: number;
};
type Result = { state: 'uploaded' | 'failed' | 'over-quota'; detail: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function LocalPieceSyncOffer() {
  const auth = useAuth();
  const [eligible, setEligible] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [rows, setRows] = useState<PieceRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null);
  const ownerId = auth.status === 'signed-in' ? auth.user.username : null;

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    void Promise.all([fetchCloudSyncPreference(), openLocalProjectDatabase()])
      .then(async ([preference, db]) => {
        try {
          const projects = await listProjectsForOwner(db, ownerId);
          const next = await Promise.all(
            projects.map(async (project) => {
              const measurement = await measureLocalPiecePackage(db, ownerId, project.id);
              return {
                project,
                pieceBytes: measurement.pieceBytes,
                mediaBytes: measurement.mediaBytes,
                mediaFiles: measurement.mediaFiles,
              };
            }),
          );
          if (!cancelled) {
            setEligible(preference.eligible);
            setEnabled(preference.enabled);
            setRows(next);
          }
        } finally {
          db.close();
        }
      })
      .catch(() => {
        if (!cancelled)
          setMessage('Could not read the local sync offer. Your local pieces are unchanged.');
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selected.includes(row.project.id)),
    [rows, selected],
  );
  useEffect(() => {
    let cancelled = false;
    if (selectedRows.length === 0) {
      setQuotaMessage(null);
      return () => {
        cancelled = true;
      };
    }
    void fetchStorageEstimate({
      pieceBytes: selectedRows.reduce((sum, row) => sum + row.pieceBytes, 0),
      mediaBytes: selectedRows.reduce((sum, row) => sum + row.mediaBytes, 0),
      pieceFiles: selectedRows.length,
      mediaFiles: selectedRows.reduce((sum, row) => sum + row.mediaFiles, 0),
    })
      .then((estimate) => {
        if (!cancelled) {
          setQuotaMessage(
            `Selected total: ${formatBytes(selectedRows.reduce((sum, row) => sum + row.pieceBytes + row.mediaBytes, 0))}; ${formatBytes(Math.max(estimate.remaining_after.private.bytes, 0))} remains of the private sync quota.`,
          );
        }
      })
      .catch(() => {
        if (!cancelled)
          setQuotaMessage(
            'Quota estimate unavailable; upload will still be checked before it starts.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRows]);

  if (auth.status !== 'signed-in' || !eligible) return null;

  async function uploadOne(db: IDBDatabase, row: PieceRow) {
    try {
      const built = await buildLocalPiecePackage(db, ownerId!, row.project.id);
      if (built.missingAssets.length > 0)
        throw new Error('Missing local media; export or repair it before uploading.');
      const estimate = await fetchStorageEstimate({
        pieceBytes: built.pieceBytes,
        mediaBytes: built.mediaBytes,
        pieceFiles: 1,
        mediaFiles: built.mediaFiles,
      });
      if (!estimate.fits.private) {
        setResults((current) => ({
          ...current,
          [row.project.id]: {
            state: 'over-quota',
            detail: `Over quota; ${formatBytes(Math.max(estimate.remaining_after.private.bytes, 0))} remains.`,
          },
        }));
        return;
      }
      const intake = await intakePiecePackage(
        built.bytes,
        `local-sync-${row.project.id}-${row.project.updatedAt}`,
      );
      const syncedProject = await updateProject(db, ownerId!, row.project.id, {
        cloudSyncState: 'synced',
        remotePublicId: intake.public_id,
        remoteVersion: intake.version,
      });
      setRows((current) =>
        current.map((item) =>
          item.project.id === row.project.id ? { ...item, project: syncedProject } : item,
        ),
      );
      setResults((current) => ({
        ...current,
        [row.project.id]: {
          state: 'uploaded',
          detail: `Uploaded and verified (version ${intake.version}).`,
        },
      }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [row.project.id]: {
          state: 'failed',
          detail: error instanceof Error ? error.message : 'Upload failed.',
        },
      }));
    }
  }

  async function uploadSelected() {
    if (!enabled || selectedRows.length === 0) return;
    setBusy(true);
    setMessage(null);
    const db = await openLocalProjectDatabase();
    try {
      for (const row of selectedRows) await uploadOne(db, row);
    } finally {
      db.close();
      setBusy(false);
    }
  }

  async function retryOne(row: PieceRow) {
    if (!enabled) return;
    setBusy(true);
    const db = await openLocalProjectDatabase();
    try {
      await uploadOne(db, row);
    } finally {
      db.close();
      setBusy(false);
    }
  }

  return (
    <section aria-label="Offer local pieces for cloud sync">
      <h3>Sync selected local pieces</h3>
      <p>
        Account sync is enabled. Nothing uploads automatically; choose pieces below and confirm the
        upload.
      </p>
      {rows.length === 0 ? (
        <p>No local pieces are available to offer.</p>
      ) : (
        <>
          <label>
            <input
              type="checkbox"
              checked={selected.length === rows.length}
              onChange={(event) =>
                setSelected(event.target.checked ? rows.map((row) => row.project.id) : [])
              }
            />{' '}
            Select all ({rows.length})
          </label>
          {quotaMessage && <p role="status">{quotaMessage}</p>}
          <ul>
            {rows.map((row) => (
              <li key={row.project.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(row.project.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, row.project.id]
                          : current.filter((id) => id !== row.project.id),
                      )
                    }
                  />{' '}
                  {row.project.title} ({row.project.kind ?? '2d'}) —{' '}
                  {formatBytes(row.pieceBytes + row.mediaBytes)}, edited{' '}
                  {new Date(row.project.updatedAt).toLocaleString()}
                </label>
                {results[row.project.id] && (
                  <span role="status"> — {results[row.project.id].detail}</span>
                )}
                {(results[row.project.id]?.state === 'failed' ||
                  results[row.project.id]?.state === 'over-quota') && (
                  <button type="button" onClick={() => void retryOne(row)} disabled={busy}>
                    Retry
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void uploadSelected()}
            disabled={busy || selectedRows.length === 0}
          >
            {busy ? 'Uploading selected pieces…' : 'Upload selected pieces'}
          </button>
        </>
      )}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
