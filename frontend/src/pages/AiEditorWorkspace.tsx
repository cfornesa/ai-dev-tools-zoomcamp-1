import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import {
  getProject,
  getSceneVersion,
  updateProjectMetadata,
  type Project,
  type SceneDocument,
} from '../api/projects';
import { createScenePreview, resolveSceneRendererId } from '../render/createScenePreview';
import type { ScenePreview } from '../render/scenePreview';

type LoadState = 'loading' | 'ready' | 'access-denied' | 'no-scene' | 'error';

/**
 * Issue #223: the smallest possible slice that makes the 2D AI-assisted
 * editor exist as a real, navigable, distinct route -- shell + preview +
 * title editing only. No layers panel, no shape-by-shape manual editing
 * (that's EditorWorkspace.tsx's concept, not this one's), no AI prompt
 * panel yet (#224), no embedded code editor yet (#225). Reuses the same
 * 2D Project/SceneVersion document family and creation endpoint as the
 * manual editor -- this is a different editor UI over the same data, not
 * a separate document family (contrast with the 3D document family,
 * which genuinely is separate per #208's decision).
 */
function AiEditorWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [project, setProject] = useState<Project | null>(null);
  const [scene, setScene] = useState<SceneDocument | null>(null);
  const [title, setTitle] = useState('');
  const [titleSaving, setTitleSaving] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<ScenePreview | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadState('loading');

    getProject(id)
      .then((loadedProject) => {
        if (cancelled) return;
        setProject(loadedProject);
        setTitle(loadedProject.title);
        if (!loadedProject.current_version) {
          setLoadState('no-scene');
          return;
        }
        return getSceneVersion(id, loadedProject.current_version).then((version) => {
          if (cancelled) return;
          setScene(version.scene_json);
          setLoadState('ready');
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setLoadState('access-denied');
          return;
        }
        setLoadState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const node = previewContainerRef.current;
    if (!node || loadState !== 'ready' || !scene) return;
    previewRef.current = createScenePreview(node, resolveSceneRendererId(scene));
    previewRef.current.render(scene);
    return () => {
      previewRef.current?.destroy();
      previewRef.current = null;
    };
  }, [loadState, scene]);

  async function handleTitleBlur() {
    if (!id || !project || title === project.title) return;
    setTitleSaving(true);
    try {
      const updated = await updateProjectMetadata(id, { title });
      setProject(updated);
    } catch {
      setTitle(project.title); // revert on failure
    } finally {
      setTitleSaving(false);
    }
  }

  if (loadState === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading AI-assisted editor…
      </p>
    );
  }

  if (loadState === 'access-denied') {
    return (
      <p role="alert" aria-live="assertive">
        This project doesn't exist, or you don't have access to it.
      </p>
    );
  }

  if (loadState === 'no-scene') {
    return (
      <p role="alert" aria-live="assertive">
        This project has no saved scene yet.
      </p>
    );
  }

  if (loadState === 'error') {
    return (
      <p role="alert" aria-live="assertive">
        Something went wrong loading this project. Please try again.
      </p>
    );
  }

  return (
    <div>
      <header className="editor-workspace-header">
        <input
          className="ai-editor-title-input"
          aria-label="Project title"
          value={title}
          disabled={titleSaving}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={handleTitleBlur}
        />
      </header>
      <section aria-label="Preview" role="region" data-panel="preview">
        <div ref={previewContainerRef} className="ai-editor-preview" />
      </section>
    </div>
  );
}

export default AiEditorWorkspace;
