import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { buildThreeSceneGraph, disposeThreeSceneGraph } from '../render/threeSceneBuilder';
import type { Scene3DDocument } from './scene3dTypes';

/**
 * Issue #244: replaces `project3d-preview-placeholder` with a real,
 * live-updating Three.js render of the current `scene3d` document.
 * Mounted by both `Project3DWorkspace.tsx` (manual editor) and
 * `AiProject3DWorkspace.tsx` (AI-assisted editor) -- neither owns
 * anything about *how* the scene is drawn; this component and
 * `../render/threeSceneBuilder.ts` are the single implementation both
 * share, exactly like `p5Adapter.ts` is the single 2D renderer both 2D
 * editors go through.
 *
 * ## Rebuild-on-change, not incremental diffing
 *
 * Every time `scene` changes (by reference -- both workspaces already
 * replace `workingScene`/`scene` wholesale on every edit, matching this
 * codebase's existing dirty-check convention), the entire Three.js scene
 * graph is torn down and rebuilt from scratch via
 * `buildThreeSceneGraph`/`disposeThreeSceneGraph`. No incremental
 * diffing -- simple, deterministic, and cheap enough at this app's scene
 * complexity limits (`schema/limits3d.json`). The `WebGLRenderer`/canvas
 * itself is *not* rebuilt on scene changes, only on mount/unmount, so
 * there's no visible flash-of-blank-canvas on every keystroke.
 *
 * ## Graceful degradation when WebGL is unavailable
 *
 * `THREE.WebGLRenderer`'s constructor throws when the canvas can't
 * produce a WebGL context (no GPU/driver support, a locked-down browser,
 * or -- relevant for this repo's own test suite -- jsdom, which never
 * implements WebGL at all). Rather than crashing the whole editor, that
 * failure is caught and this component renders a friendly fallback
 * message instead, mirroring this app's existing "friendly states for
 * denial/missing hardware/unsupported browser" convention from Task 31's
 * camera permission UX -- a 3D preview that can't render is exactly that
 * kind of environment limitation, not a bug to surface as a crash.
 */
function Scene3DPreview({ scene }: { scene: Scene3DDocument }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [renderError, setRenderError] = useState(false);

  // Mount/unmount only: create the renderer once, tied to this
  // component's lifetime, and resize it to the container.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch {
      setRenderError(true);
      return;
    }
    rendererRef.current = renderer;

    function resize() {
      if (!container) return;
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      renderer.setSize(width, height, false);
    }
    resize();

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    }

    return () => {
      resizeObserver?.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Rebuild the scene graph and (re)start the render loop whenever
  // `scene` changes -- the renderer/canvas above is untouched.
  useEffect(() => {
    const container = containerRef.current;
    if (!rendererRef.current || !container || renderError) return;
    const activeRenderer: THREE.WebGLRenderer = rendererRef.current;

    const size = activeRenderer.getSize(new THREE.Vector2());
    const aspect = (size.x || 1) / (size.y || 1);
    const { scene: threeScene, camera } = buildThreeSceneGraph(scene, aspect);

    // Issue #271: mouse-drag/touch-drag orbit, scroll/pinch zoom, and
    // (via listenToKeyEvents) arrow-key pan, all out of the box.
    // Rebuilt alongside the scene graph each time `scene` changes (rather
    // than kept alive across rebuilds) since the camera itself is a new
    // object every time -- purely a transient viewport interaction, never
    // persisted back into the scene document; see the issue's own scope
    // note for why that's the simpler default given this component's
    // existing whole-graph-rebuild-on-change architecture.
    const controls = new OrbitControls(camera, activeRenderer.domElement);
    controls.target.set(scene.camera.target.x, scene.camera.target.y, scene.camera.target.z);
    controls.enableDamping = true;
    controls.listenToKeyEvents(window);
    controls.update();

    let frameId: number;
    function tick() {
      controls.update();
      activeRenderer.render(threeScene, camera);
      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      controls.dispose();
      disposeThreeSceneGraph(threeScene);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rendererRef/renderError are refs/state read once per effect run, not reactive inputs the loop needs to resubscribe to independently of `scene`.
  }, [scene, renderError]);

  if (renderError) {
    return (
      <div
        className="scene3d-preview-unavailable"
        role="status"
        aria-live="polite"
        data-testid="scene3d-preview-unavailable"
      >
        <p>3D preview isn't available in this browser.</p>
        <p>
          {scene.objects.length} object(s), {scene.lights.length} light(s), {scene.groups.length}{' '}
          group(s) in this scene.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="scene3d-preview" data-testid="scene3d-preview">
      <canvas ref={canvasRef} data-testid="scene3d-preview-canvas" />
    </div>
  );
}

export default Scene3DPreview;
