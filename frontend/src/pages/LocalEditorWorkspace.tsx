import { useEffect, useState, type MouseEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { exportDatabaseArchive } from '../storage/localDatabaseArchive';
import { getFolderBridgeStatus, writeArchiveFile } from '../storage/folderArchiveBridge';
import { appendRecoveryDraft, getLatestRecoveryDraft } from '../storage/localRecovery';
import {
  getProject,
  listMediaAssetsForProject,
  listScenesForProject,
  openLocalProjectDatabase,
  updateScene,
  type LocalMediaAssetRecord,
  type LocalProjectRecord,
  type LocalSceneRecord,
} from '../storage/localProjectRepository';
import { enqueueMutation } from '../storage/mutationOutbox';
import { replaySyncMutations } from '../storage/syncMutationReplay';

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
  const [recoveryDraftId, setRecoveryDraftId] = useState<string | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
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
        const [loadedScenes, loadedAssets, latestRecovery] = await Promise.all([
          listScenesForProject(db, id),
          listMediaAssetsForProject(db, id),
          getLatestRecoveryDraft(db, auth.user.username, id).catch(() => null),
        ]);
        db.close();
        const firstScene = loadedScenes[0] ?? null;
        setProject(loadedProject);
        setScenes(loadedScenes);
        setAssets(loadedAssets);
        setSelectedSceneId(firstScene?.id ?? null);
        setSceneName(firstScene?.name ?? '');
        setRecoveryDraftId(latestRecovery?.id ?? null);
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
      void replaySyncMutations(ownerId, id).catch(() => {
        // The outbox remains durable; a later online event retries it.
      });
    };
    replay();
    window.addEventListener('online', replay);
    return () => window.removeEventListener('online', replay);
  }, [auth.status, auth.user?.username, id]);

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
      <p>
        <Link to="/account/settings/storage" onClick={handleBack}>
          ← Local storage
        </Link>
      </p>
      <h2>{project.title}</h2>
      <p>Local editor — this project is loaded from this browser&apos;s IndexedDB.</p>
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
