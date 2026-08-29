import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import {
  getProject,
  getSceneVersion,
  updateProjectMetadata,
  type Project,
  type SceneDocument,
  type SceneVersion,
} from '../api/projects';
import { createScenePreview, resolveSceneRendererId } from '../render/createScenePreview';
import type { ScenePreview } from '../render/scenePreview';
import AIProposalPanel from './AIProposalPanel';
import { SceneCodeEditor, useJsonCodeSync } from './jsonCodeSync';

type LoadState = 'loading' | 'ready' | 'access-denied' | 'no-scene' | 'error';
type PreviewView = 'visual' | 'code';

/**
 * Issue #223: the smallest possible slice that makes the 2D AI-assisted
 * editor exist as a real, navigable, distinct route -- shell + preview +
 * title editing only. No layers panel, no shape-by-shape manual editing
 * (that's EditorWorkspace.tsx's concept, not this one's), no AI prompt
 * panel yet (#224, now delivered). Reuses the same
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
  const [previewView, setPreviewView] = useState<PreviewView>('visual');
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<ScenePreview | null>(null);
  // Issue #225: the same JSON Code tab the manual editor has, going
  // through the same client-side validateScene mirror of
  // scenes.validation.validate_scene as every other write (see
  // jsonCodeSync.tsx). Called unconditionally, before the loading/error
  // early returns below, so its state survives them the same way it
  // survives Visual<->Code toggling in EditorWorkspace.tsx.
  const jsonCodeSync = useJsonCodeSync(scene, setScene);

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

  // Issue #224: applies an accepted AI proposal exactly like
  // EditorWorkspace.tsx's `handleAIProposalAccepted` -- the server has
  // already persisted `version` as the project's new current version, so
  // this just syncs local state from it (no separate save step). The
  // scene this leaves in `scene` is what the *next* prompt (in "Edit"
  // mode) is generated against, and #222's name-based resolution lets
  // that next prompt reference anything just created by name -- this is
  // the continuous-session behavior the issue asks for.
  function handleAccepted(version: SceneVersion) {
    setScene(version.scene_json);
    setProject((current) => (current ? { ...current, current_version: version.id } : current));
  }

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
      <div role="radiogroup" aria-label="Preview view" className="editor-tool-group">
        <button
          type="button"
          role="radio"
          aria-checked={previewView === 'visual'}
          onClick={() => setPreviewView('visual')}
        >
          Visual
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={previewView === 'code'}
          onClick={() => setPreviewView('code')}
        >
          Code
        </button>
      </div>
      <section
        aria-label="Preview"
        role="region"
        data-panel="preview"
        hidden={previewView !== 'visual'}
      >
        <div ref={previewContainerRef} className="ai-editor-preview" />
      </section>
      {previewView === 'code' && (
        <section aria-label="Code" role="region" data-panel="code">
          <SceneCodeEditor sync={jsonCodeSync} />
        </section>
      )}
      {/* Issue #224: the prompt panel is this editor's primary, default
          interaction surface -- not tucked into a collapsible section
          like the manual editor's AI proposals panel (#221's decision
          keeps that one as a supplementary feature; this editor's whole
          purpose is prompt-first authoring). */}
      <section aria-label="AI assistant" role="region" data-panel="ai-assistant">
        {id && (
          <AIProposalPanel
            projectId={id}
            workingCopy={scene}
            currentVersionId={project?.current_version ?? null}
            onAccepted={handleAccepted}
          />
        )}
      </section>
    </div>
  );
}

export default AiEditorWorkspace;
