import { useEffect, useState, type MouseEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
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

type LocalEditorState = 'loading' | 'ready' | 'missing' | 'error';

function LocalEditorWorkspace() {
  const { id } = useParams<{ id: string }>();
  const auth = useAuth();
  const [state, setState] = useState<LocalEditorState>('loading');
  const [project, setProject] = useState<LocalProjectRecord | null>(null);
  const [scenes, setScenes] = useState<LocalSceneRecord[]>([]);
  const [assets, setAssets] = useState<LocalMediaAssetRecord[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [sceneName, setSceneName] = useState('');
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
        const [loadedScenes, loadedAssets] = await Promise.all([
          listScenesForProject(db, id),
          listMediaAssetsForProject(db, id),
        ]);
        db.close();
        const firstScene = loadedScenes[0] ?? null;
        setProject(loadedProject);
        setScenes(loadedScenes);
        setAssets(loadedAssets);
        setSelectedSceneId(firstScene?.id ?? null);
        setSceneName(firstScene?.name ?? '');
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, id]);

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

  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) ?? null;

  async function saveScene() {
    if (!selectedScene || !id) return;
    try {
      const db = await openLocalProjectDatabase();
      const updated = await updateScene(db, selectedScene.id, {
        name: sceneName.trim() || selectedScene.name,
      });
      db.close();
      setScenes((current) => current.map((scene) => (scene.id === updated.id ? updated : scene)));
      setSceneName(updated.name);
      setDirty(false);
      setMessage('Saved local scene changes to this browser.');
    } catch {
      setMessage('Could not save local scene changes. Your draft remains on screen.');
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
