import { useEffect, useMemo, useRef, useState } from 'react';
import type * as THREE from 'three';

import PieceStageToolbar from '../components/PieceStageToolbar';
import { THREE_D_STAGE_CAPABILITIES } from '../components/pieceStageCapabilities';
import { downloadBlob } from '../export/downloadBlob';
import {
  ART_PIECE_BRIDGE_VERSION,
  ART_PIECE_IFRAME_ALLOW,
  ART_PIECE_IFRAME_SANDBOX,
  buildArtPieceSandboxDocument,
} from '../generative/artPieceSandbox';
import { buildAFrameSceneMarkup } from '../render/aframeSceneMarkup';
import {
  AFRAME_EDITOR_BRIDGE_SCRIPT,
  cameraFromReport,
  parseReportedCamera,
} from '../render/aframeEditorBridge';
import { pickDrawingPlane } from './planeTransform';
import type { Scene3DPreviewProps } from './Scene3DPreview';
import { useFullscreenToggle } from './useFullscreenToggle';

function screenshotName(base: string): string {
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'scene'}-${Date.now()}.png`;
}

/**
 * Issue #772: the A-Frame renderer for structured 3D scenes (`renderer.preferred: 'aframe'`, #770).
 *
 * The scene is converted to declarative A-Frame markup by `aframeSceneMarkup.ts` (validated fields
 * only) and shown in the same opaque-origin `sandbox="allow-scripts"` iframe that generated A-Frame
 * pieces use, so no new dependency is added and nothing executes in the parent page. Screenshot goes
 * through the sandbox's existing versioned postMessage bridge. Sound, hand steering, and camera
 * preview are Three.js-only features today, so they are simply not offered here (the stage never
 * shows a control that cannot work).
 */
export default function Scene3DAFramePreview({
  scene,
  showScreenshotButton = true,
  screenshotBaseName,
  onDownload,
  downloadFormat = 'zip',
  immersiveHref,
  toolbarMode = 'menu',
  editorControls,
  frozen = false,
  pauseAnimations = false,
  holdRender = false,
  onPickObject,
  renderOverlay,
}: Scene3DPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreenToggle(containerRef);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const baseName = screenshotBaseName ?? scene.id;

  // #796: while a handle drag is in flight the sandbox keeps showing the last committed scene (the parent's
  // overlay already shows the live outline); it reloads once, on release.
  const [renderedScene, setRenderedScene] = useState(scene);
  useEffect(() => {
    if (!holdRender) setRenderedScene(scene);
  }, [scene, holdRender]);

  const editing = Boolean(onPickObject || renderOverlay);
  const srcDoc = useMemo(
    () =>
      buildArtPieceSandboxDocument(
        // The camera/click bridge is editor-only: public, immersive, and exported markup never carry it.
        buildAFrameSceneMarkup(renderedScene) + (editing ? AFRAME_EDITOR_BRIDGE_SCRIPT : ''),
        'aframe',
        'regular',
      ),
    [renderedScene, editing],
  );

  // #796: the camera the sandbox reports, rebuilt as a Three.js camera for the parent-side overlay.
  const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  cameraRef.current = camera;
  const onPickRef = useRef(onPickObject);
  onPickRef.current = onPickObject;

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { source?: string; status?: string; data?: string } | null;
      if (data?.source !== 'art-piece-sandbox') return;
      const report = parseReportedCamera(event.data);
      if (report) {
        setCamera(cameraFromReport(report));
        return;
      }
      if (data.status === 'scene3d-click') {
        const click = event.data as { x?: number; y?: number };
        const frame = frameRef.current;
        const activeCamera = cameraRef.current;
        if (!frame || !activeCamera || !onPickRef.current) return;
        const stage = { width: frame.clientWidth, height: frame.clientHeight };
        const picked = pickDrawingPlane(
          sceneRef.current.objects,
          sceneRef.current.groups,
          activeCamera,
          stage,
          { x: Number(click.x) * stage.width, y: Number(click.y) * stage.height },
        );
        onPickRef.current(picked);
        return;
      }
      if (data.status === 'error') setScreenshotError('The A-Frame scene could not be captured.');
      if (data.status === 'screenshot' && data.data) {
        void fetch(data.data)
          .then((response) => response.blob())
          .then((blob) => downloadBlob(blob, screenshotName(baseName)))
          .catch(() => setScreenshotError('Screenshot failed.'));
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [baseName]);

  // #796: hold every animation at its authored pose while draw mode or a selection's handles need it.
  const holdAnimations = frozen || pauseAnimations;
  function sendFrozen() {
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: 'art-piece-parent',
        version: ART_PIECE_BRIDGE_VERSION,
        type: 'scene3d-frozen',
        frozen: holdAnimations,
      },
      '*',
    );
  }
  useEffect(sendFrozen, [holdAnimations]);

  function handleScreenshot() {
    setScreenshotError(null);
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: 'art-piece-parent',
        version: ART_PIECE_BRIDGE_VERSION,
        type: 'screenshot',
        filename: screenshotName(baseName),
      },
      '*',
    );
  }

  return (
    <div
      ref={containerRef}
      className="scene3d-preview"
      data-testid="scene3d-preview"
      data-renderer="aframe"
    >
      <div
        ref={frameRef}
        className="scene3d-preview-canvas-frame"
        data-testid="scene3d-preview-canvas-frame"
      >
        <iframe
          ref={iframeRef}
          title="A-Frame scene preview"
          data-testid="scene3d-aframe-frame"
          sandbox={ART_PIECE_IFRAME_SANDBOX}
          allow={ART_PIECE_IFRAME_ALLOW}
          srcDoc={srcDoc}
          onLoad={sendFrozen}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
        {renderOverlay?.({
          camera,
          width: frameRef.current?.clientWidth ?? 0,
          height: frameRef.current?.clientHeight ?? 0,
        })}
        <PieceStageToolbar
          ariaLabel="Preview actions"
          className="editor-tool-group scene3d-preview-actions"
          onScreenshot={showScreenshotButton ? handleScreenshot : undefined}
          onDownload={onDownload}
          downloadFormat={downloadFormat}
          capabilities={{
            ...THREE_D_STAGE_CAPABILITIES,
            sound: false,
            pieceControls: false,
            gesture: false,
            gestureGuide: false,
          }}
          immersiveHref={immersiveHref}
          toolbarMode={toolbarMode}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          editorControls={editorControls}
        />
      </div>
      {screenshotError && <p role="alert">{screenshotError}</p>}
    </div>
  );
}
