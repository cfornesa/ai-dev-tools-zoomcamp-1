/**
 * Issue #796: the structured-3D editor's link to its A-Frame stage. The stage runs in a sandboxed,
 * opaque-origin iframe (nothing here changes that), so the parent cannot read its camera or pointer. This
 * editor-only script (appended to the sandbox document, never to public, immersive, or exported markup)
 * reports two things over the existing versioned `postMessage` bridge:
 *
 * - `scene3d-camera`: the active camera's world matrix, field of view, and canvas size, whenever they change,
 *   so the parent can project scene objects onto the stage exactly as the Three.js stage does;
 * - `scene3d-click`: a click (not a drag) as a fraction of the stage, so the parent can pick a drawing plane.
 */
import * as THREE from 'three';

export const AFRAME_EDITOR_BRIDGE_SCRIPT = `<script>
(function () {
  function post(message) {
    message.source = 'art-piece-sandbox';
    window.parent.postMessage(message, '*');
  }
  function start(sceneEl) {
    var last = '';
    function report() {
      var cam = sceneEl.camera;
      var canvas = sceneEl.canvas;
      if (!cam || !canvas) return;
      cam.updateMatrixWorld(true);
      var e = cam.matrixWorld.elements;
      var key = e.join(',') + '|' + cam.fov + '|' + canvas.clientWidth + 'x' + canvas.clientHeight;
      if (key === last) return;
      last = key;
      post({ status: 'scene3d-camera', matrix: Array.prototype.slice.call(e), fov: cam.fov, width: canvas.clientWidth, height: canvas.clientHeight });
    }
    setInterval(report, 80);
    var down = null;
    document.addEventListener('pointerdown', function (event) { down = { x: event.clientX, y: event.clientY }; }, true);
    document.addEventListener('pointerup', function (event) {
      var start0 = down;
      down = null;
      if (!start0 || Math.hypot(event.clientX - start0.x, event.clientY - start0.y) > 5) return;
      post({ status: 'scene3d-click', x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight });
    }, true);
  }
  function whenReady() {
    var sceneEl = document.querySelector('a-scene');
    if (!sceneEl) return;
    if (sceneEl.hasLoaded) start(sceneEl);
    else sceneEl.addEventListener('loaded', function () { start(sceneEl); });
  }
  if (document.readyState === 'complete') whenReady();
  else window.addEventListener('load', whenReady);
}());
</script>`;

export type ReportedCamera = { matrix: number[]; fov: number; width: number; height: number };

export function parseReportedCamera(data: unknown): ReportedCamera | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.status !== 'scene3d-camera') return null;
  if (!Array.isArray(d.matrix) || d.matrix.length !== 16) return null;
  const matrix = d.matrix.map(Number);
  const fov = Number(d.fov);
  const width = Number(d.width);
  const height = Number(d.height);
  if (![...matrix, fov, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }
  return { matrix, fov, width, height };
}

/** A Three.js camera matching the pose the A-Frame stage reported. */
export function cameraFromReport(report: ReportedCamera): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(report.fov, report.width / report.height, 0.1, 1000);
  new THREE.Matrix4()
    .fromArray(report.matrix)
    .decompose(camera.position, camera.quaternion, camera.scale);
  camera.updateMatrixWorld(true);
  return camera;
}
