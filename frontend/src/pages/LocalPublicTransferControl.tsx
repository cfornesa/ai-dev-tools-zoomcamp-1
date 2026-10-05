import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ArtPiece } from '../api/artPieces';
import { useAuth } from '../auth/useAuth';
import type { Project3D } from '../api/projects3d';
import { LocalPublicTransferError, publishLocalPiece } from '../storage/localPublicTransfer';
import {
  getProject,
  openLocalProjectDatabase,
  type LocalProjectRecord,
} from '../storage/localProjectRepository';
import LocalMakePublicDialog from './LocalMakePublicDialog';

export default function LocalPublicTransferControl({
  project,
  onProjectUpdated,
  initialDescription = '',
}: {
  project: LocalProjectRecord;
  onProjectUpdated?: (project: LocalProjectRecord) => void;
  initialDescription?: string;
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (project.kind !== '3d' && project.kind !== 'generated') return null;
  if (project.remotePublicId) {
    return <p>This local piece is synced to a private server copy.</p>;
  }

  async function confirm(title: string, description: string) {
    if (auth.status !== 'signed-in') return;
    setBusy(true);
    setResult(null);
    let db: IDBDatabase | undefined;
    try {
      db = await openLocalProjectDatabase();
      const transfer = await publishLocalPiece(
        db,
        auth.user.username,
        project.id,
        title,
        description,
      );
      onProjectUpdated?.(transfer.project);
      setOpen(false);
      const destination =
        project.kind === '3d'
          ? ((transfer.published as Project3D).editor_url ??
            `/projects3d/${(transfer.published as Project3D).id}`)
          : `/art-pieces/${(transfer.published as ArtPiece).public_id}/edit`;
      navigate(destination, { replace: true });
    } catch (error) {
      // Refresh after intake even when publish failed: the helper has already
      // persisted cloudSyncState=synced and remotePublicId at that boundary.
      if (error instanceof LocalPublicTransferError || error instanceof Error) {
        const refreshed = await getProject(db!, auth.user.username, project.id).catch(() => null);
        if (refreshed) onProjectUpdated?.(refreshed);
      }
      setResult(error instanceof Error ? error.message : 'Could not publish this piece.');
    } finally {
      db?.close();
      setBusy(false);
    }
  }

  return (
    <section aria-label="Publish local piece" className="local-public-transfer">
      <button type="button" className="shell-action" onClick={() => setOpen(true)}>
        Make public
      </button>
      {open && (
        <LocalMakePublicDialog
          initialTitle={project.title}
          initialDescription={initialDescription}
          busy={busy}
          onConfirm={(title, description) => void confirm(title, description)}
          onCancel={() => {
            setOpen(false);
            setResult(null);
          }}
        />
      )}
      {result && <p role="alert">Could not publish: {result}</p>}
    </section>
  );
}
