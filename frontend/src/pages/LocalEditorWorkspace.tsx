import { useEffect, useState, type MouseEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { useAlertDialogFocus } from '../a11y/useAlertDialogFocus';
import { ApiError } from '../api/client';
import { intakePiecePackage } from '../api/pieceIntake';
import {
  getProject as getRemoteProject,
  getSceneVersion,
  publishProject,
  type PublishValidationErrorBody,
  type Project,
} from '../api/projects';
import { fetchStorageEstimate } from '../api/storageUsage';
import { validateProjectMetadataForPublish, type FieldErrors } from '../validation/projectMetadata';
import { ConflictResolutionPanel } from '../components/ConflictResolutionPanel';
import { MutationRecoveryPanel } from '../components/MutationRecoveryPanel';
import { MediaTransferRecoveryPanel } from '../components/MediaTransferRecoveryPanel';
import { exportDatabaseArchive } from '../storage/localDatabaseArchive';
import {
  buildLocal2dPiecePackage,
  type LocalPiecePackageResult,
} from '../storage/localPiecePackage';
import { getFolderBridgeStatus, writeArchiveFile } from '../storage/folderArchiveBridge';
import { ensureLocalThumbnail } from '../storage/localThumbnail';
import { appendRecoveryDraft, getLatestRecoveryDraft } from '../storage/localRecovery';
import {
  getProject,
  getProjectStorageUsage,
  listMediaAssetsForProject,
  listScenesForProject,
  openLocalProjectDatabase,
  updateProject,
  updateScene,
  type LocalMediaAssetRecord,
  type LocalProjectRecord,
  type LocalSceneRecord,
} from '../storage/localProjectRepository';
import {
  discardMutation,
  enqueueMutation,
  listMutationOutbox,
  resumeMutation,
} from '../storage/mutationOutbox';
import {
  createConflictResolutionOperation,
  type ConflictResolutionChoice,
} from '../storage/conflictMerge';
import type { StoredSyncConflict, MutationOutboxRecord } from '../storage/mutationOutbox';
import { pauseMutation } from '../storage/mutationOutbox';
import { getMutationSessionGeneration } from '../storage/mutationSession';
import { replaySyncMutations } from '../storage/syncMutationReplay';
import {
  deleteMediaTransfer,
  listMediaTransfersForProject,
  saveMediaTransfer,
} from '../storage/mediaTransferRepository';
import { resumeMediaTransfer, type MediaTransferRecord } from '../storage/mediaTransfer';
import {
  collectMediaAssetIds,
  summarizeLocalPublicUpdate,
  type LocalPublicUpdateDiff,
} from '../storage/localPublicUpdate';
import LocalProject3DWorkspace from './LocalProject3DWorkspace';
import LocalCloudSyncControl from './LocalCloudSyncControl';

type LocalEditorState = 'loading' | 'ready' | 'missing' | 'error';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Issue #942: the "make this local-only piece public" transfer. Unlike
 * `PublishControl.tsx`'s `PublishConfirmDialog` (which publishes an
 * already-server-backed project with a title/description assumed valid),
 * a local-only piece may have no description at all yet, so this dialog
 * collects and validates title/description inline rather than requiring a
 * separate local details-editing feature first.
 */
function MakePublicDialog({
  initialTitle,
  initialDescription,
  busy,
  onConfirm,
  onCancel,
  actionLabel = 'Publish',
  headingLabel = 'Make',
  changeSummary,
}: {
  initialTitle: string;
  initialDescription: string;
  busy: boolean;
  onConfirm: (title: string, description: string) => void;
  onCancel: () => void;
  actionLabel?: string;
  headingLabel?: string;
  changeSummary?: string;
}) {
  const { dialogRef, onKeyDown } = useAlertDialogFocus<HTMLDivElement>(onCancel);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const errors: FieldErrors = validateProjectMetadataForPublish({ title, description });
  const canConfirm = Object.keys(errors).length === 0;
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      role="alertdialog"
      aria-labelledby="make-public-title"
      aria-describedby="make-public-description"
      className="publish-confirm-dialog"
    >
      <h4 id="make-public-title">
        {headingLabel} &quot;{title || 'this piece'}&quot; public?
      </h4>
      <p id="make-public-description">
        This piece and its media currently exist only in this browser. Publishing uploads them to
        the server and makes them visible to anyone with the link or in the public gallery. Copies,
        embeds, and caches of a published piece can&apos;t be recalled once shared. Uploads use TLS
        in transit but are not end-to-end encrypted — the server can read the content. Image
        location metadata is removed before upload.
      </p>
      {changeSummary && (
        <p aria-label="Changes since last public copy">
          Changes since last public copy: {changeSummary}
        </p>
      )}
      <label htmlFor="make-public-title-input">Title</label>
      <input
        id="make-public-title-input"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={busy}
      />
      {errors.title && (
        <p role="alert" className="field-error">
          {errors.title.join(' ')}
        </p>
      )}
      <label htmlFor="make-public-description-input">Description</label>
      <textarea
        id="make-public-description-input"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        disabled={busy}
      />
      {errors.description && (
        <p role="alert" className="field-error">
          {errors.description.join(' ')}
        </p>
      )}
      <button
        type="button"
        onClick={() => onConfirm(title, description)}
        disabled={!canConfirm || busy}
      >
        {busy ? 'Publishing…' : actionLabel}
      </button>
      <button type="button" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
    </div>
  );
}

function LocalEditorWorkspace() {
  const { id } = useParams<{ id: string }>();
  const auth = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<LocalEditorState>('loading');
  const [project, setProject] = useState<LocalProjectRecord | null>(null);
  const [scenes, setScenes] = useState<LocalSceneRecord[]>([]);
  const [assets, setAssets] = useState<LocalMediaAssetRecord[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [sceneName, setSceneName] = useState('');
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [checkpointBusy, setCheckpointBusy] = useState(false);
  const [packageBusy, setPackageBusy] = useState(false);
  const [preparedPackage, setPreparedPackage] = useState<LocalPiecePackageResult | null>(null);
  const [recoveryDraftId, setRecoveryDraftId] = useState<string | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [syncConflict, setSyncConflict] = useState<{
    operation: MutationOutboxRecord;
    conflict: StoredSyncConflict;
  } | null>(null);
  const [syncRecovery, setSyncRecovery] = useState<MutationOutboxRecord | null>(null);
  const [pausedMediaTransfers, setPausedMediaTransfers] = useState<MediaTransferRecord[]>([]);
  const [showMakePublic, setShowMakePublic] = useState(false);
  const [makePublicBusy, setMakePublicBusy] = useState(false);
  const [makePublicResult, setMakePublicResult] = useState<{
    state: 'over-quota' | 'error';
    detail: string;
  } | null>(null);
  const [publicUpdate, setPublicUpdate] = useState<{
    remoteProject: Project;
    diff: LocalPublicUpdateDiff;
  } | null>(null);
  const [publicUpdateBusy, setPublicUpdateBusy] = useState(false);
  const sessionGeneration =
    auth.status === 'signed-in' ? getMutationSessionGeneration(auth.user.username) : undefined;
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) ?? null;

  useEffect(() => {
    if (auth.status !== 'signed-in' || !id) return;
    let cancelled = false;
    setState('loading');
    void (async () => {
      try {
        const db = await openLocalProjectDatabase();
        const loadedProject = await getProject(db, auth.user.username, id);
        if (cancelled) return;
        if (!loadedProject) {
          db.close();
          setState('missing');
          return;
        }
        const [loadedScenes, loadedAssets, latestRecovery, mediaTransfers] = await Promise.all([
          listScenesForProject(db, id),
          listMediaAssetsForProject(db, id),
          getLatestRecoveryDraft(db, auth.user.username, id).catch(() => null),
          listMediaTransfersForProject(db, auth.user.username, id),
        ]);
        const pausedMutation = (await listMutationOutbox(db, auth.user.username, id)).find(
          (operation) =>
            operation.state === 'paused' &&
            operation.lastErrorCode !== 'conflict' &&
            operation.lastErrorCode !== null,
        );
        db.close();
        const firstScene = loadedScenes[0] ?? null;
        setProject(loadedProject);
        setScenes(loadedScenes);
        setAssets(loadedAssets);
        setSelectedSceneId(firstScene?.id ?? null);
        setSceneName(firstScene?.name ?? '');
        setRecoveryDraftId(latestRecovery?.id ?? null);
        setSyncRecovery(pausedMutation ?? null);
        setPausedMediaTransfers(mediaTransfers.filter((transfer) => transfer.state === 'paused'));
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, id]);

  useEffect(() => {
    const ownerId = auth.user?.username;
    if (auth.status !== 'signed-in' || !ownerId || !id) return;
    const replay = () => {
      void replaySyncMutations(ownerId, id, sessionGeneration)
        .then((completed) => {
          const conflicted = completed.find((operation) => operation.conflict);
          if (conflicted?.conflict) {
            setSyncConflict({ operation: conflicted, conflict: conflicted.conflict });
          } else {
            const paused = completed.find(
              (operation) => operation.state === 'paused' && operation.lastErrorCode !== 'conflict',
            );
            if (paused) setSyncRecovery(paused);
          }
        })
        .catch(() => {
          // The outbox remains durable; a later online event retries it.
        });
    };
    replay();
    window.addEventListener('online', replay);
    return () => window.removeEventListener('online', replay);
  }, [auth.status, auth.user?.username, id, sessionGeneration]);

  async function resumeSyncRecovery() {
    if (!syncRecovery || auth.status !== 'signed-in') return;
    const db = await openLocalProjectDatabase();
    try {
      await resumeMutation(db, auth.user.username, syncRecovery.operationId);
      setSyncRecovery(null);
      setMessage('Queued mutation resumed for authenticated replay.');
      await replaySyncMutations(auth.user.username, id!, sessionGeneration);
    } catch {
      setMessage('Could not resume the queued mutation; your local workspace remains unchanged.');
    } finally {
      db.close();
    }
  }

  async function discardSyncRecovery() {
    if (!syncRecovery || auth.status !== 'signed-in') return;
    const db = await openLocalProjectDatabase();
    try {
      const removed = await discardMutation(db, auth.user.username, syncRecovery.operationId);
      if (removed) {
        setSyncRecovery(null);
        setMessage('Queued private mutation discarded; local artwork was preserved.');
      }
    } catch {
      setMessage('Could not discard the queued mutation.');
    } finally {
      db.close();
    }
  }

  async function resumeMediaRecovery(transferId: string) {
    if (auth.status !== 'signed-in') return;
    const db = await openLocalProjectDatabase();
    try {
      const transfer = pausedMediaTransfers.find((item) => item.transferId === transferId);
      if (!transfer) return;
      await saveMediaTransfer(db, resumeMediaTransfer(transfer));
      setPausedMediaTransfers((current) =>
        current.filter((item) => item.transferId !== transferId),
      );
      setMessage('Media transfer queued to retry from its acknowledged ranges.');
    } finally {
      db.close();
    }
  }

  async function discardMediaRecovery(transferId: string) {
    if (auth.status !== 'signed-in') return;
    const db = await openLocalProjectDatabase();
    try {
      const removed = await deleteMediaTransfer(db, auth.user.username, transferId);
      if (removed) {
        setPausedMediaTransfers((current) =>
          current.filter((item) => item.transferId !== transferId),
        );
        setMessage('Paused media transfer discarded; local artwork was preserved.');
      }
    } finally {
      db.close();
    }
  }

  async function preparePublicUpdate() {
    if (auth.status !== 'signed-in' || !id || !project?.remotePublicId) return;
    setMakePublicResult(null);
    let db: IDBDatabase | undefined;
    try {
      db = await openLocalProjectDatabase();
      const remoteProject = await getRemoteProject(project.remotePublicId);
      const remoteVersion = project.remoteVersion ?? remoteProject.current_version;
      if (remoteVersion === null) throw new Error('The published piece has no saved version.');
      const [remoteScene, localScenes] = await Promise.all([
        getSceneVersion(project.remotePublicId, remoteVersion),
        listScenesForProject(db, id),
      ]);
      const localScene =
        localScenes.find((scene) => scene.id === project.activeSceneId) ??
        localScenes.at(-1) ??
        null;
      if (!localScene) throw new Error('The local piece has no scene to publish.');
      const localMediaIds = new Set<string>();
      for (const scene of localScenes) collectMediaAssetIds(scene.sceneJson, localMediaIds);
      const diff = summarizeLocalPublicUpdate(
        remoteScene.scene_json,
        localScene.sceneJson,
        collectMediaAssetIds(remoteScene.scene_json),
        localMediaIds,
      );
      setPublicUpdate({
        remoteProject,
        diff,
      });
    } catch (error) {
      setMakePublicResult({
        state: 'error',
        detail: error instanceof Error ? error.message : 'Could not compare the public copy.',
      });
    } finally {
      db?.close();
    }
  }

  async function handlePublicUpdateConfirm(titleValue: string, descriptionValue: string) {
    if (
      auth.status !== 'signed-in' ||
      !id ||
      !project?.remotePublicId ||
      project.remoteVersion === null ||
      project.remoteVersion === undefined
    ) {
      return;
    }
    setPublicUpdateBusy(true);
    setMakePublicResult(null);
    let db: IDBDatabase | undefined;
    try {
      db = await openLocalProjectDatabase();
      const built = await buildLocal2dPiecePackage(
        db,
        auth.user.username,
        id,
        undefined,
        descriptionValue,
        titleValue,
      );
      if (built.missingAssets.length > 0) {
        setMakePublicResult({
          state: 'error',
          detail: 'Missing local media; export or repair it before publishing.',
        });
        return;
      }
      const usage = await getProjectStorageUsage(db, id);
      const estimate = await fetchStorageEstimate({
        pieceBytes: built.bytes.byteLength,
        mediaBytes: usage.bytesUsed,
        pieceFiles: 1,
        mediaFiles: usage.fileCount,
      });
      if (!estimate.fits.public) {
        setMakePublicResult({
          state: 'over-quota',
          detail: `Over quota; ${formatBytes(Math.max(estimate.remaining_after.public.bytes, 0))} remains. The public copy was not changed.`,
        });
        return;
      }
      const intake = await intakePiecePackage(
        built.bytes,
        `local-republish-${id}-${project.remoteVersion}-${project.updatedAt}`,
        { pieceId: project.remotePublicId, expectedRevision: project.remoteVersion },
      );
      const updated = await updateProject(db, auth.user.username, id, {
        title: titleValue,
        cloudSyncState: 'synced',
        remoteVersion: intake.version,
      });
      setProject(updated);
      setPublicUpdate(null);
      setMessage(`Updated the public copy to version ${intake.version}.`);
    } catch (error) {
      setMakePublicResult({
        state: 'error',
        detail: error instanceof Error ? error.message : 'Could not update the public copy.',
      });
    } finally {
      db?.close();
      setPublicUpdateBusy(false);
    }
  }

  /**
   * Issue #942 (2D-only): warn → validate title/description → quota
   * preflight → upload (reusing #932's `intakePiecePackage`, same
   * idempotency-key convention as `LocalPieceSyncOffer.tsx`'s account-sync
   * upload) → publish. If intake succeeds but publish fails, the local
   * record is left `cloudSyncState: 'synced'` (a defined, non-public state
   * `LocalCloudSyncControl` already renders correctly) rather than any
   * ambiguous half-published state; the user can retry publishing from the
   * now-server-backed editor's existing `PublishControl.tsx`. Updating an
   * already-published copy is explicitly out of scope here — see the
   * linked follow-up issue.
   */
  async function handleMakePublicConfirm(titleValue: string, descriptionValue: string) {
    if (auth.status !== 'signed-in' || !id || !project) return;
    setMakePublicBusy(true);
    setMakePublicResult(null);
    let db: IDBDatabase | undefined;
    try {
      db = await openLocalProjectDatabase();
      const withTitle = await updateProject(db, auth.user.username, id, {
        title: titleValue,
      });
      setProject(withTitle);
      // `LocalProjectRecord` has no persisted description field (2D-only
      // scope; see the module doc on `buildLocal2dPiecePackage`) — the
      // typed description reaches the server only through the outgoing
      // package's metadata, not local storage.
      const built = await buildLocal2dPiecePackage(
        db,
        auth.user.username,
        id,
        undefined,
        descriptionValue,
      );
      if (built.missingAssets.length > 0) {
        setMakePublicResult({
          state: 'error',
          detail: 'Missing local media; export or repair it before publishing.',
        });
        return;
      }
      const usage = await getProjectStorageUsage(db, id);
      const estimate = await fetchStorageEstimate({
        pieceBytes: built.bytes.byteLength,
        mediaBytes: usage.bytesUsed,
        pieceFiles: 1,
        mediaFiles: usage.fileCount,
      });
      if (!estimate.fits.public) {
        setMakePublicResult({
          state: 'over-quota',
          detail: `Over quota; ${formatBytes(Math.max(estimate.remaining_after.public.bytes, 0))} remains. The local piece was not changed.`,
        });
        return;
      }
      const intake = await intakePiecePackage(
        built.bytes,
        `local-publish-${id}-${withTitle.updatedAt}`,
      );
      const synced = await updateProject(db, auth.user.username, id, {
        cloudSyncState: 'synced',
        remotePublicId: intake.public_id,
        remoteVersion: intake.version,
      });
      setProject(synced);
      const published = await publishProject(intake.public_id);
      setShowMakePublic(false);
      navigate(published.editor_url ?? `/local-projects/${id}`, { replace: true });
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 400 &&
        error.body &&
        typeof error.body === 'object'
      ) {
        const body = error.body as Partial<PublishValidationErrorBody>;
        if (body.errors && typeof body.errors === 'object') {
          setMakePublicResult({
            state: 'error',
            detail: Object.values(body.errors).flat().join(' '),
          });
          return;
        }
      }
      setMakePublicResult({
        state: 'error',
        detail: error instanceof Error ? error.message : 'Could not publish this piece.',
      });
    } finally {
      setMakePublicBusy(false);
      db?.close();
    }
  }

  async function resolveSyncConflict(choice: ConflictResolutionChoice, resolvedPayload: unknown) {
    if (!syncConflict || !id || auth.status !== 'signed-in') return;
    let db: IDBDatabase | undefined;
    try {
      db = await openLocalProjectDatabase();
      const resolution = createConflictResolutionOperation(
        {
          merged: syncConflict.conflict.mergedSnapshot,
          conflicts: syncConflict.conflict.conflicts,
        },
        choice,
        syncConflict.conflict.context,
        resolvedPayload,
      );
      await enqueueMutation(db, {
        ownerId: auth.user.username,
        sessionGeneration,
        projectId: id,
        sceneId: syncConflict.operation.sceneId,
        kind: syncConflict.operation.kind,
        payload: {
          type: 'conflict-resolution',
          base_version: resolution.baseVersion,
          choice: resolution.choice,
          resolved_payload: resolution.resolvedPayload,
          audit: resolution.audit,
        },
        // The original operation was rejected and is intentionally paused;
        // making the resolution depend on it would leave the resolution
        // permanently ineligible for replay. The audit payload retains the
        // original operation identity for deterministic provenance.
        dependencyOperationIds: [],
      });
      await pauseMutation(
        db,
        auth.user.username,
        syncConflict.operation.operationId,
        `conflict-resolved-${choice}`,
      );
      setSyncConflict(null);
      setMessage('Conflict resolution queued for deterministic replay.');
    } catch {
      setMessage('Could not queue that conflict resolution. The original conflict remains paused.');
    } finally {
      db?.close();
    }
  }

  useEffect(() => {
    if (!dirty || !selectedScene || !id || auth.status !== 'signed-in') return;
    const timer = window.setTimeout(() => {
      void (async () => {
        let db: IDBDatabase | undefined;
        try {
          db = await openLocalProjectDatabase();
          await updateScene(db, selectedScene.id, {
            name: sceneName.trim() || selectedScene.name,
          });
          const archive = await exportDatabaseArchive(db, auth.user.username, {
            projectIds: [id],
          });
          const recovery = await appendRecoveryDraft(db, {
            ownerId: auth.user.username,
            projectId: id,
            archive: archive.blob,
          });
          setRecoveryDraftId(recovery.id);
        } catch {
          // Recovery is best effort and must never interrupt the active edit.
        } finally {
          db?.close();
        }
      })();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [auth, dirty, id, sceneName, selectedScene]);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [dirty]);

  if (auth.status === 'loading') return null;
  if (auth.status !== 'signed-in') return <Navigate to="/" replace />;

  if (state === 'loading') return <p role="status">Loading local project…</p>;
  if (state === 'missing') {
    return (
      <section className="content-panel" aria-label="Local project unavailable">
        <h2>Local project unavailable</h2>
        <p>This project is missing from this browser or belongs to another local owner.</p>
        <Link to="/account/settings/storage">Return to local storage</Link>
      </section>
    );
  }
  if (state === 'error' || !project) {
    return (
      <section className="content-panel" aria-label="Local project error">
        <h2>Could not open local project</h2>
        <p>Local project data could not be read without changing it.</p>
        <Link to="/account/settings/storage">Return to local storage</Link>
      </section>
    );
  }

  if (project.kind === '3d') return <LocalProject3DWorkspace />;

  async function saveScene() {
    if (!selectedScene || !id) return;
    let db: IDBDatabase | undefined;
    try {
      db = await openLocalProjectDatabase();
      const updated = await updateScene(db, selectedScene.id, {
        name: sceneName.trim() || selectedScene.name,
      });
      try {
        await enqueueMutation(db, {
          ownerId: auth.user!.username,
          sessionGeneration,
          projectId: id,
          sceneId: updated.id,
          kind: 'scene',
          payload: { name: updated.name, scene_json: updated.sceneJson },
        });
      } catch {
        // Local IndexedDB remains authoritative when the optional sync queue
        // cannot accept this project or the browser is unavailable.
      }
      let recoveryId: string | null = null;
      try {
        const archive = await exportDatabaseArchive(db, auth.user!.username, {
          projectIds: [id],
        });
        const recovery = await appendRecoveryDraft(db, {
          ownerId: auth.user!.username,
          projectId: id,
          archive: archive.blob,
        });
        recoveryId = recovery.id;
      } catch {
        // A recovery snapshot is best effort; the active IndexedDB scene save
        // remains authoritative even when snapshot storage is unavailable.
      }
      setScenes((current) => current.map((scene) => (scene.id === updated.id ? updated : scene)));
      if (project) void ensureLocalThumbnail(project).catch(() => undefined);
      setSceneName(updated.name);
      setDirty(false);
      if (recoveryId) setRecoveryDraftId(recoveryId);
      setMessage(
        recoveryId
          ? 'Saved local scene changes to this browser.'
          : 'Saved local scene changes; a recovery snapshot was unavailable.',
      );
    } catch {
      setMessage('Could not save local scene changes. Your draft remains on screen.');
    } finally {
      db?.close();
    }
  }

  async function recoverLatestDraft() {
    if (!project || !id || !recoveryDraftId || recoveryBusy) return;
    setRecoveryBusy(true);
    setMessage(null);
    let db: IDBDatabase | undefined;
    try {
      db = await openLocalProjectDatabase();
      const latest = await getLatestRecoveryDraft(db, auth.user!.username, id);
      if (!latest) {
        setRecoveryDraftId(null);
        setMessage('The recovery draft is no longer available.');
        return;
      }
      const { restoreDatabaseArchive } = await import('../storage/localDatabaseArchive');
      const restored = await restoreDatabaseArchive(
        db,
        auth.user!.username,
        new Uint8Array(await latest.archive.arrayBuffer()),
      );
      const recovered = restored.projects[0];
      if (!recovered) throw new Error('Recovery archive did not contain a project.');
      setMessage('Recovered the latest browser-local draft in a fresh workspace.');
      navigate(`/local-projects/${recovered.id}?workspace=recovered`);
    } catch {
      setMessage('Could not recover the latest draft. The active workspace was preserved.');
    } finally {
      db?.close();
      setRecoveryBusy(false);
    }
  }

  async function saveDurableCheckpoint() {
    const ownerId = auth.user?.username;
    if (!project || !id || !ownerId || dirty) {
      setMessage(
        'Save or cancel the current local scene changes before writing a durable checkpoint.',
      );
      return;
    }
    setCheckpointBusy(true);
    setMessage(null);
    let db: IDBDatabase | undefined;
    try {
      db = await openLocalProjectDatabase();
      const result = await exportDatabaseArchive(db, ownerId, { projectIds: [id] });
      const bridge = await getFolderBridgeStatus(db);
      if (bridge.handle && bridge.status === 'granted') {
        await writeArchiveFile(
          bridge.handle,
          `${project.title.replace(/[^\w.-]+/g, '_') || 'project'}.zip`,
          result.blob,
        );
        setMessage('Durable checkpoint saved to the selected archive folder.');
      } else {
        downloadBlob(result.blob, `${project.title.replace(/[^\w.-]+/g, '_') || 'project'}.zip`);
        setMessage(
          'Durable checkpoint exported as a ZIP download. Direct folder writing is unavailable here.',
        );
      }
    } catch {
      setMessage(
        'Could not write the durable checkpoint. The active IndexedDB workspace was preserved.',
      );
    } finally {
      db?.close();
      setCheckpointBusy(false);
    }
  }

  async function preparePiecePackage() {
    const ownerId = auth.user?.username;
    if (!project || !id || !ownerId || dirty) {
      setMessage('Save or cancel the current local scene changes before preparing an export.');
      return;
    }
    setPackageBusy(true);
    setMessage(null);
    let db: IDBDatabase | undefined;
    try {
      db = await openLocalProjectDatabase();
      setPreparedPackage(await buildLocal2dPiecePackage(db, ownerId, id));
    } catch {
      setPreparedPackage(null);
      setMessage('Could not prepare the piece package. Local data was not changed.');
    } finally {
      db?.close();
      setPackageBusy(false);
    }
  }

  function downloadPreparedPackage() {
    if (!preparedPackage || !project) return;
    downloadBlob(
      new Blob([preparedPackage.bytes.slice().buffer as ArrayBuffer], { type: 'application/zip' }),
      `${project.title.replace(/[^\w.-]+/g, '_') || 'piece'}-package.zip`,
    );
    setMessage(`Piece package ready (${preparedPackage.bytes.byteLength} bytes).`);
    setPreparedPackage(null);
  }

  async function exportUnsavedChanges() {
    if (!selectedScene || !id || auth.status !== 'signed-in') return;
    let db: IDBDatabase | undefined;
    try {
      db = await openLocalProjectDatabase();
      await updateScene(db, selectedScene.id, {
        name: sceneName.trim() || selectedScene.name,
      });
      const archive = await exportDatabaseArchive(db, auth.user.username, { projectIds: [id] });
      downloadBlob(archive.blob, `${project?.title.replace(/[^\w.-]+/g, '_') || 'project'}.zip`);
      const exportedScene = { ...selectedScene, name: sceneName.trim() || selectedScene.name };
      setScenes((current) =>
        current.map((scene) => (scene.id === exportedScene.id ? exportedScene : scene)),
      );
      setSceneName(exportedScene.name);
      setDirty(false);
      setMessage('Unsaved local changes exported as a ZIP checkpoint.');
    } catch {
      setMessage('Could not export the unsaved changes. Your draft remains on screen.');
    } finally {
      db?.close();
    }
  }

  async function cancelUnsavedChanges() {
    if (!selectedScene) return;
    let db: IDBDatabase | undefined;
    try {
      db = await openLocalProjectDatabase();
      await updateScene(db, selectedScene.id, { name: selectedScene.name });
      setSceneName(selectedScene.name);
      setDirty(false);
      setMessage('Unsaved scene changes discarded; the recovery draft remains available.');
    } catch {
      setMessage('Could not discard the unsaved scene changes. Your draft remains on screen.');
    } finally {
      db?.close();
    }
  }

  function switchScene(nextId: string) {
    if (dirty) {
      setMessage('Save or cancel the current local scene changes before switching scenes.');
      return;
    }
    const next = scenes.find((scene) => scene.id === nextId);
    setSelectedSceneId(nextId);
    setSceneName(next?.name ?? '');
  }

  function handleBack(event: MouseEvent<HTMLAnchorElement>) {
    if (!dirty) return;
    event.preventDefault();
    setMessage('Save or cancel the current local scene changes before leaving this project.');
  }

  return (
    <section className="content-panel" aria-label="Local project editor">
      <LocalCloudSyncControl project={project} />
      <p>
        <Link to="/account/settings/storage" onClick={handleBack}>
          ← Local storage
        </Link>
      </p>
      <h2>{project.title}</h2>
      <p>Local editor — this project is loaded from this browser&apos;s IndexedDB.</p>
      {!project.remotePublicId && (
        <p>
          <button type="button" className="shell-action" onClick={() => setShowMakePublic(true)}>
            Make public
          </button>
        </p>
      )}
      {project.remotePublicId && (
        <p>
          <button
            type="button"
            className="shell-action"
            onClick={() => void preparePublicUpdate()}
            disabled={publicUpdateBusy}
          >
            {publicUpdateBusy ? 'Comparing…' : 'Update public copy'}
          </button>
        </p>
      )}
      {showMakePublic && (
        <MakePublicDialog
          initialTitle={project.title}
          initialDescription=""
          busy={makePublicBusy}
          onConfirm={(titleValue, descriptionValue) =>
            void handleMakePublicConfirm(titleValue, descriptionValue)
          }
          onCancel={() => {
            setShowMakePublic(false);
            setMakePublicResult(null);
          }}
        />
      )}
      {publicUpdate && (
        <MakePublicDialog
          initialTitle={project.title || publicUpdate.remoteProject.title}
          initialDescription={publicUpdate.remoteProject.description}
          busy={publicUpdateBusy}
          actionLabel="Update public copy"
          headingLabel="Update"
          changeSummary={publicUpdate.diff.summary}
          onConfirm={(titleValue, descriptionValue) =>
            void handlePublicUpdateConfirm(titleValue, descriptionValue)
          }
          onCancel={() => {
            setPublicUpdate(null);
            setMakePublicResult(null);
          }}
        />
      )}
      {makePublicResult && (
        <p role="alert">
          {makePublicResult.state === 'over-quota' ? 'Over quota: ' : 'Could not publish: '}
          {makePublicResult.detail}
        </p>
      )}
      {recoveryDraftId && (
        <p role="status">
          A browser-local recovery draft is available.
          <button type="button" onClick={() => void recoverLatestDraft()} disabled={recoveryBusy}>
            {recoveryBusy ? 'Recovering…' : 'Recover latest draft'}
          </button>
        </p>
      )}
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
      {dirty && (
        <section className="sync-recovery-panel" aria-label="Unsaved local changes">
          <h3>Unsaved local changes</h3>
          <p>
            Choose how to resolve this edit before leaving the project. The browser-local recovery
            draft remains available until you explicitly replace or discard it.
          </p>
          <div className="sync-conflict-actions">
            <button type="button" onClick={() => void saveScene()}>
              Save now
            </button>
            <button
              type="button"
              onClick={() => void recoverLatestDraft()}
              disabled={!recoveryDraftId}
            >
              Recover draft
            </button>
            <button type="button" onClick={() => void exportUnsavedChanges()}>
              Export ZIP
            </button>
            <button type="button" onClick={() => void cancelUnsavedChanges()}>
              Cancel edit
            </button>
          </div>
        </section>
      )}
      {syncConflict && (
        <ConflictResolutionPanel
          conflict={syncConflict.conflict}
          onResolve={(choice, payload) => void resolveSyncConflict(choice, payload)}
        />
      )}
      {syncRecovery && !syncConflict && (
        <MutationRecoveryPanel
          operation={syncRecovery}
          onResume={() => void resumeSyncRecovery()}
          onDiscard={() => void discardSyncRecovery()}
        />
      )}
      <MediaTransferRecoveryPanel
        transfers={pausedMediaTransfers}
        onResume={(transferId) => void resumeMediaRecovery(transferId)}
        onDiscard={(transferId) => void discardMediaRecovery(transferId)}
      />
      <label htmlFor="local-scene-select">Scene</label>
      <select
        id="local-scene-select"
        value={selectedSceneId ?? ''}
        onChange={(event) => switchScene(event.target.value)}
        disabled={scenes.length === 0}
      >
        {scenes.map((scene) => (
          <option key={scene.id} value={scene.id}>
            {scene.name}
          </option>
        ))}
      </select>
      {selectedScene ? (
        <>
          <label htmlFor="local-scene-name">Scene name</label>
          <input
            id="local-scene-name"
            value={sceneName}
            onChange={(event) => {
              setSceneName(event.target.value);
              setDirty(true);
            }}
          />
          <button type="button" onClick={() => void saveScene()} disabled={!dirty}>
            Save local changes
          </button>
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setSceneName(selectedScene.name);
                setDirty(false);
              }}
            >
              Cancel changes
            </button>
          )}
          <button
            type="button"
            onClick={() => void saveDurableCheckpoint()}
            disabled={dirty || checkpointBusy}
          >
            {checkpointBusy ? 'Writing checkpoint…' : 'Save durable checkpoint'}
          </button>
          <button
            type="button"
            onClick={() => void preparePiecePackage()}
            disabled={dirty || packageBusy}
          >
            {packageBusy ? 'Preparing piece package…' : 'Prepare piece package'}
          </button>
          {preparedPackage && (
            <section aria-label="Piece package export">
              <p>Package size: {preparedPackage.bytes.byteLength.toLocaleString()} bytes.</p>
              {preparedPackage.missingAssets.length > 0 && (
                <p role="alert">
                  Missing media:{' '}
                  {preparedPackage.missingAssets.map((asset) => asset.filename).join(', ')}. The
                  package will omit these files.
                </p>
              )}
              <button type="button" onClick={downloadPreparedPackage}>
                {preparedPackage.missingAssets.length > 0
                  ? 'Export without missing media'
                  : 'Download piece package'}
              </button>
              <button type="button" onClick={() => setPreparedPackage(null)}>
                Cancel export
              </button>
            </section>
          )}
          <p>Scene JSON is available locally and remains scoped to this project.</p>
        </>
      ) : (
        <p>No scenes are available in this local project.</p>
      )}
      <section aria-label="Local media references">
        <h3>Media references</h3>
        {assets.length === 0 ? (
          <p>No media files in this project.</p>
        ) : (
          <ul className="local-editor-media-list">
            {assets.map((asset) => (
              <li key={asset.id}>
                {asset.filename} — {asset.mimeType} —{' '}
                <code className="local-editor-media-checksum">{asset.checksum}</code>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

export default LocalEditorWorkspace;
