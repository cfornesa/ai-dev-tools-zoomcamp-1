import { useCallback, useEffect, useRef, useState } from 'react';
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
import PieceStageToolbar from '../components/PieceStageToolbar';
import CameraControl, { type CameraStatus } from '../components/CameraControl';
import StageControlsPopover from '../components/StageControlsPopover';
import { TWO_D_STAGE_CAPABILITIES } from '../components/pieceStageCapabilities';
import { captureLiveScreenshot, screenshotFilename } from '../export/captureLiveScreenshot';
import { downloadBlob } from '../export/downloadBlob';
import { generateHtmlExport, triggerHtmlDownload } from '../export/generateHtmlExport';
import { getAvailableInteractionModes } from '../export/exportCompatibility';
import { createScenePreview, resolveSceneRendererId } from '../render/createScenePreview';
import type { RenderableCameraOverlay, ScenePreview } from '../render/scenePreview';
import { useCameraOverlaySettings } from '../editor/cameraOverlaySettings';
import {
  clampCameraOverlayGeometry,
  useCameraOverlayGeometry,
} from '../editor/cameraOverlayGeometry';
import DemoControlsPanel from './DemoControlsPanel';
import AIProposalPanel from './AIProposalPanel';
import PublishControl from './PublishControl';
import { useFullscreenToggle } from './useFullscreenToggle';
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
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const { opacity: cameraOverlayOpacity, mirrored: cameraOverlayMirrored } =
    useCameraOverlaySettings();
  const { setGeometry: _setCameraGeometry, ...cameraGeometry } = useCameraOverlayGeometry();
  // Issue #287: the preview container itself goes fullscreen.
  const { isFullscreen, toggleFullscreen } = useFullscreenToggle(previewContainerRef);

  useEffect(() => {
    const video = cameraVideoRef.current;
    if (!video) return;
    video.srcObject = cameraStream;
    if (cameraStream) void Promise.resolve(video.play()).catch(() => undefined);
  }, [cameraStream, cameraStatus]);

  const getCameraOverlay = useCallback((): RenderableCameraOverlay | undefined => {
    if (cameraStatus !== 'active' || !cameraStream || !cameraVideoRef.current) return undefined;
    return {
      source: cameraVideoRef.current,
      geometry: clampCameraOverlayGeometry(cameraGeometry, 800, 600),
      opacity: cameraOverlayOpacity,
      mirrored: cameraOverlayMirrored,
      layerOrder: Number.MAX_SAFE_INTEGER,
    };
  }, [cameraGeometry, cameraOverlayMirrored, cameraOverlayOpacity, cameraStatus, cameraStream]);
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
    const cameraOverlay = getCameraOverlay();
    previewRef.current.render(scene, [], [], Boolean(cameraOverlay), cameraOverlay);
    return () => {
      previewRef.current?.destroy();
      previewRef.current = null;
    };
  }, [cameraStatus, getCameraOverlay, loadState, scene]);

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

  // Issue #285: "Take screenshot" — captures whatever the live preview
  // canvas currently shows and downloads it as a PNG.
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  async function handleTakeScreenshot() {
    setScreenshotError(null);
    try {
      const canvas = previewRef.current?.getCanvasElement() ?? null;
      const blob = await captureLiveScreenshot(canvas);
      downloadBlob(blob, screenshotFilename(project?.title ?? id ?? 'scene'));
    } catch (error) {
      setScreenshotError(
        error instanceof Error ? error.message : 'Something went wrong taking the screenshot.',
      );
    }
  }

  function handleDownload(variant: 'full' | 'non-camera' = 'full') {
    if (!scene) return;
    const availableModes = getAvailableInteractionModes(scene);
    const interactionMode =
      variant === 'non-camera'
        ? 'demo'
        : availableModes.includes('demo-camera')
          ? 'demo-camera'
          : 'demo';
    const result = generateHtmlExport({
      scene,
      title,
      description: project?.description ?? '',
      interactionMode,
      includeAttribution: false,
    });
    if (!result.ok) {
      setScreenshotError(result.reasons.join(' '));
      return;
    }
    setScreenshotError(null);
    triggerHtmlDownload(result.html, result.filename);
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
        {id && (
          <PublishControl
            id={id}
            project={project}
            setProject={setProject}
            persistPendingDetails={async () => ({ status: 'skipped' })}
          />
        )}
      </header>
      <div className="ai-editor-workspace editor-workspace">
        {/* Task 245 (issue #303): a real `.editor-panel` region, matching
            `EditorWorkspace.tsx`'s convention, wrapped in a scoped
            `.ai-editor-workspace` class so its 2-panel grid (Preview +
            AI assistant only, unlike the manual editor's 5-panel sidebar)
            doesn't inherit that other page's unscoped
            `.editor-panel[data-panel='preview']` grid-row/span rule. */}
        <section aria-label="Preview" role="region" data-panel="preview" className="editor-panel">
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
          {/* Issue #159 (matching EditorWorkspace.tsx's own documented
              convention): Visual/Code is a sub-toggle inside the Preview
              panel, not a separate top-level panel -- Preview itself is
              never hidden, so a Code view of the same scene document
              belongs alongside it. */}
          {previewView === 'code' && (
            <section aria-label="Code" role="region" data-panel="code">
              <SceneCodeEditor sync={jsonCodeSync} />
            </section>
          )}
          <div>
            <div ref={previewContainerRef} className="ai-editor-preview piece-stage-shell">
              {cameraStatus === 'active' && cameraStream && (
                <video
                  ref={cameraVideoRef}
                  aria-hidden="true"
                  muted
                  playsInline
                  autoPlay
                  className="ai-editor-camera-source"
                />
              )}
              <PieceStageToolbar
                onScreenshot={() => void handleTakeScreenshot()}
                onDownload={(variant) => handleDownload(variant)}
                capabilities={TWO_D_STAGE_CAPABILITIES}
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => void toggleFullscreen()}
                controlsControl={
                  <StageControlsPopover>
                    <CameraControl
                      onStatusChange={setCameraStatus}
                      onStreamChange={setCameraStream}
                    />
                    <DemoControlsPanel />
                  </StageControlsPopover>
                }
              />
            </div>
            {/* Issue #285: read-only capture of whatever the live preview
                canvas currently shows -- never mutates render state. */}
            {screenshotError && (
              <p role="alert" aria-live="assertive" data-testid="screenshot-error">
                {screenshotError}
              </p>
            )}
          </div>
        </section>
        {/* Issue #224: the prompt panel is this editor's primary, default
            interaction surface -- not tucked into a collapsible section
            like the manual editor's AI proposals panel (#221's decision
            keeps that one as a supplementary feature; this editor's whole
            purpose is prompt-first authoring). Task 245 (issue #303): this
            is the only sidebar panel this editor has (no Layers/Tools/
            Details/Inspector -- see this file's own top-of-file doc
            comment), so it's never hidden and no `EditorPanelSwitcher` is
            rendered -- there is nothing for a narrow-viewport switcher to
            switch *between*. `.editor-workspace`'s existing responsive CSS
            (stacking below 1024px) still applies unconditionally, giving
            this 2-panel layout the same narrow-viewport behavior as the
            reference editor without a switcher that would have exactly
            one, permanently-selected tab. */}
        <section
          aria-label="AI assistant"
          role="region"
          data-panel="ai-assistant"
          className="editor-panel"
        >
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
    </div>
  );
}

export default AiEditorWorkspace;
