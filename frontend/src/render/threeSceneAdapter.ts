import * as THREE from 'three';

import {
  buildThreeSceneGraph,
  disposeThreeSceneGraph,
  updateThreeCameraAspect,
} from './threeSceneBuilder';
import type { ScenePreview } from './scenePreview';
import type { Scene3DDocument } from '../pages/scene3dTypes';

/** Minimal editor adapter for the shared preview contract. The dedicated
 * Scene3DPreview owns richer camera/audio/editor controls; this adapter keeps
 * the unified manual editor's preview path renderer-correct without turning
 * that 2D contract into a second 3D workspace. */
export function createThreeScenePreview(container: HTMLElement): ScenePreview {
  const canvas = document.createElement('canvas');
  canvas.dataset.testid = 'three-scene-preview-canvas';
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  let graph: ReturnType<typeof buildThreeSceneGraph> | null = null;
  let destroyed = false;

  function resize() {
    if (destroyed) return;
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setSize(width, height, false);
    if (graph) updateThreeCameraAspect(graph.camera, width, height);
  }
  resize();
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  observer?.observe(container);

  return {
    render(scene) {
      if (destroyed) return;
      const scene3d = scene as unknown as Scene3DDocument;
      if (graph) disposeThreeSceneGraph(graph.scene);
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      graph = buildThreeSceneGraph(scene3d, width / height);
      renderer.render(graph.scene, graph.camera);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      if (graph) disposeThreeSceneGraph(graph.scene);
      renderer.dispose();
      canvas.remove();
    },
    getCanvasElement() {
      return canvas;
    },
  };
}
