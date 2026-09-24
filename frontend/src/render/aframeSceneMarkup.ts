/**
 * Issue #772: renders a validated `scene3d` document through A-Frame.
 *
 * The structured 3D editor previously had exactly one builder (`threeSceneBuilder.ts`). The owner
 * requires A-Frame to be a real second rendering library for structured pieces, selected per scene
 * with the optional `renderer.preferred` (#770). This module is the A-Frame counterpart: a pure,
 * deterministic function from a scene3d document to declarative A-Frame markup.
 *
 * Why markup and not an npm dependency or executable code: the markup is generated only from
 * validated, closed-vocabulary fields (finite numbers, hex colours, schema-checked ids), never from
 * user-written script, and it renders inside the same opaque-origin `sandbox="allow-scripts"` iframe
 * generated A-Frame pieces already use (`generative/artPieceSandbox.ts`, pinned A-Frame CDN). No
 * dependency is added and nothing executes in the parent (memory
 * 3d-rendering-npm-dependency-vs-cdn-sandbox). Every dynamic value is escaped defensively anyway.
 *
 * Fidelity with `threeSceneBuilder.ts` (the reference for what a scene3d means):
 * - Euler rotations are XYZ-ordered degrees in scene3d and Three.js; A-Frame applies YXZ, so each
 *   rotation is converted through a rotation matrix rather than copied component-wise.
 * - The camera's look-at target becomes yaw/pitch on a camera rig.
 * - A directional light's schema `direction` becomes a position opposite that direction, aimed at
 *   the origin, exactly as the Three.js builder does.
 * - A zero-content scene uses the same neutral grey background, and planes are double-sided.
 */
import { rasterizeDrawing } from './drawingRaster';
import type {
  Camera3D,
  DrawingDocument,
  Group3D,
  Light3D,
  Object3D as SceneObject3D,
  Scene3DDocument,
} from '../pages/scene3dTypes';

const ZERO_CONTENT_BACKGROUND_COLOR = '#808080';

/**
 * #783: the A-Frame counterpart of `objectAnimation.ts`. A first-party component (a static string, never
 * built from scene data) that applies the same four motion formulas each frame from the object's authored
 * base transform, so both engines move identically. It pauses under prefers-reduced-motion and when the
 * parent posts a `scene3d-frozen` message (draw mode). Rotation is applied in XYZ order like scene3d.
 */
export const AFRAME_ANIMATION_COMPONENT_SCRIPT = `<script>
(function () {
  if (typeof AFRAME === 'undefined' || AFRAME.components['scene3d-animate']) return;
  var DEG = Math.PI / 180;
  var frozen = false;
  window.addEventListener('message', function (event) {
    var data = event && event.data;
    if (data && data.source === 'art-piece-parent' && data.type === 'scene3d-frozen') frozen = !!data.frozen;
  });
  function reduced() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function rotateAbout(p, axis, deg) {
    var c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
    if (axis === 'x') return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
    if (axis === 'y') return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
  }
  AFRAME.registerComponent('scene3d-animate', {
    schema: {
      kind: { type: 'string' }, axis: { type: 'string', default: 'y' }, speed: { type: 'number' },
      amplitude: { type: 'number', default: -1 }, center: { type: 'vec3' },
      basePosition: { type: 'vec3' }, baseRotation: { type: 'vec3' }, baseScale: { type: 'vec3', default: { x: 1, y: 1, z: 1 } }
    },
    init: function () { this.seconds = 0; },
    tick: function (time, deltaMs) {
      var d = this.data;
      var o = this.el.object3D;
      if (!reduced() && !frozen) this.seconds += Math.min(deltaMs, 100) / 1000;
      var t = this.seconds, axis = d.axis, speed = d.speed;
      var pos = { x: d.basePosition.x, y: d.basePosition.y, z: d.basePosition.z };
      var rot = { x: d.baseRotation.x, y: d.baseRotation.y, z: d.baseRotation.z };
      var scl = { x: d.baseScale.x, y: d.baseScale.y, z: d.baseScale.z };
      if (d.kind === 'rotate') { rot[axis] += speed * t; }
      else if (d.kind === 'orbit') {
        var off = { x: pos.x - d.center.x, y: pos.y - d.center.y, z: pos.z - d.center.z };
        var turned = rotateAbout(off, axis, speed * t);
        pos = { x: d.center.x + turned.x, y: d.center.y + turned.y, z: d.center.z + turned.z };
        rot[axis] += speed * t;
      } else if (d.kind === 'oscillate') {
        pos[axis] += (d.amplitude < 0 ? 1 : d.amplitude) * Math.sin(2 * Math.PI * speed * t);
      } else if (d.kind === 'pulse') {
        var f = 1 + (d.amplitude < 0 ? 0.1 : d.amplitude) * Math.sin(2 * Math.PI * speed * t);
        scl = { x: scl.x * f, y: scl.y * f, z: scl.z * f };
      }
      o.position.set(pos.x, pos.y, pos.z);
      o.rotation.order = 'XYZ';
      o.rotation.set(rot.x * DEG, rot.y * DEG, rot.z * DEG);
      o.scale.set(scl.x, scl.y, scl.z);
    }
  });
}());
</script>`;

type Vec3 = { x: number; y: number; z: number };

const DEG = Math.PI / 180;

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function num(value: number): string {
  // Fixed precision keeps output deterministic and free of exponent notation.
  return String(Math.round(value * 1e6) / 1e6);
}

function vec(value: Vec3): string {
  return `${num(value.x)} ${num(value.y)} ${num(value.z)}`;
}

function sanitizeColor(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback;
}

/**
 * XYZ-ordered Euler degrees (Three.js / scene3d) to YXZ-ordered Euler degrees (A-Frame).
 * Builds R = Rx * Ry * Rz, then extracts the YXZ decomposition with the same formulas as
 * `THREE.Euler.setFromRotationMatrix(m, 'YXZ')`.
 */
export function eulerXYZToAFrameDegrees(rotation: Vec3): Vec3 {
  const cx = Math.cos(rotation.x * DEG);
  const sx = Math.sin(rotation.x * DEG);
  const cy = Math.cos(rotation.y * DEG);
  const sy = Math.sin(rotation.y * DEG);
  const cz = Math.cos(rotation.z * DEG);
  const sz = Math.sin(rotation.z * DEG);
  // R = Rx * Ry * Rz (row-major).
  const m11 = cy * cz;
  const m13 = sy;
  const m21 = cx * sz + sx * sy * cz;
  const m22 = cx * cz - sx * sy * sz;
  const m23 = -sx * cy;
  const m31 = sx * sz - cx * sy * cz;
  const m33 = cx * cy;
  const clamp = (v: number) => Math.min(1, Math.max(-1, v));
  const x = Math.asin(-clamp(m23));
  let y: number;
  let z: number;
  if (Math.abs(m23) < 0.9999999) {
    y = Math.atan2(m13, m33);
    z = Math.atan2(m21, m22);
  } else {
    y = Math.atan2(-m31, m11);
    z = 0;
  }
  const out = { x: x / DEG, y: y / DEG, z: z / DEG };
  // Snap tiny float noise so identity rotations print as 0.
  return {
    x: Math.abs(out.x) < 1e-9 ? 0 : out.x,
    y: Math.abs(out.y) < 1e-9 ? 0 : out.y,
    z: Math.abs(out.z) < 1e-9 ? 0 : out.z,
  };
}

function transformAttrs(transform: { position: Vec3; rotation: Vec3; scale: Vec3 }): string {
  return `position="${vec(transform.position)}" rotation="${vec(eulerXYZToAFrameDegrees(transform.rotation))}" scale="${vec(transform.scale)}"`;
}

function materialAttr(object: SceneObject3D, textureId?: string): string {
  const opacity = object.material.opacity ?? 1;
  if (textureId) {
    // #780: a drawing plane shows its rasterised vector drawing as a transparent texture; white keeps
    // the drawing's own colours unmodified.
    return `material="${escapeAttr(
      `src: #${textureId}; color: #ffffff; opacity: ${num(opacity)}; transparent: true; alphaTest: 0.01; side: ${object.doubleSided === false ? 'front' : 'double'}`,
    )}"`;
  }
  const parts = [
    `color: ${sanitizeColor(object.material.color, '#ffffff')}`,
    `opacity: ${num(opacity)}`,
    `transparent: ${opacity < 1 ? 'true' : 'false'}`,
  ];
  if (object.material.emissive) {
    parts.push(`emissive: ${sanitizeColor(object.material.emissive, '#000000')}`);
    parts.push('emissiveIntensity: 1');
  }
  if (object.type === 'plane' || object.type === 'drawingPlane') parts.push('side: double');
  return `material="${escapeAttr(parts.join('; '))}"`;
}

function animationAttr(object: SceneObject3D): string {
  const animation = object.animation;
  if (!animation) return '';
  const axis = animation.axis === 'x' || animation.axis === 'z' ? animation.axis : 'y';
  const kind = ['rotate', 'orbit', 'oscillate', 'pulse'].includes(animation.kind)
    ? animation.kind
    : null;
  if (!kind) return '';
  const center = animation.center ?? { x: 0, y: 0, z: 0 };
  const parts = [
    `kind: ${kind}`,
    `axis: ${axis}`,
    `speed: ${num(animation.speed)}`,
    `amplitude: ${animation.amplitude === undefined ? -1 : num(animation.amplitude)}`,
    `center: ${vec(center)}`,
    `basePosition: ${vec(object.transform.position)}`,
    `baseRotation: ${vec(object.transform.rotation)}`,
    `baseScale: ${vec(object.transform.scale)}`,
  ];
  return ` scene3d-animate="${escapeAttr(parts.join('; '))}"`;
}

function objectMarkup(object: SceneObject3D, textureId?: string): string {
  const base = `id="${escapeAttr(object.id)}" ${materialAttr(object, textureId)} ${transformAttrs(object.transform)} visible="${object.visible ? 'true' : 'false'}"${animationAttr(object)}`;
  switch (object.type) {
    case 'box':
      return `<a-box ${base} width="${num(object.width ?? 1)}" height="${num(object.height ?? 1)}" depth="${num(object.depth ?? 1)}"></a-box>`;
    case 'sphere':
      return `<a-sphere ${base} radius="${num(object.radius ?? 1)}" segments-width="24" segments-height="16"></a-sphere>`;
    case 'cylinder': {
      const top = object.radiusTop ?? 1;
      const bottom = object.radiusBottom ?? 1;
      const height = object.height ?? 1;
      // A-Frame's cylinder has one radius; differing top/bottom radii use the cone primitive so
      // the schema's frustum shape is preserved.
      const geometry =
        top === bottom
          ? `primitive: cylinder; radius: ${num(bottom)}; height: ${num(height)}; segmentsRadial: 16`
          : `primitive: cone; radiusTop: ${num(top)}; radiusBottom: ${num(bottom)}; height: ${num(height)}; segmentsRadial: 16`;
      return `<a-entity ${base} geometry="${geometry}"></a-entity>`;
    }
    case 'plane':
    case 'drawingPlane':
      return `<a-plane ${base} width="${num(object.width ?? 1)}" height="${num(object.height ?? 1)}"></a-plane>`;
  }
}

function lightMarkup(light: Light3D): string {
  const color = sanitizeColor(light.color, '#ffffff');
  const id = `id="${escapeAttr(light.id)}"`;
  switch (light.type) {
    case 'ambient':
      return `<a-entity ${id} light="type: ambient; color: ${color}; intensity: ${num(light.intensity)}"></a-entity>`;
    case 'directional': {
      const direction = light.direction ?? { x: 0, y: -1, z: 0 };
      const position = { x: -direction.x, y: -direction.y, z: -direction.z };
      return `<a-entity ${id} light="type: directional; color: ${color}; intensity: ${num(light.intensity)}" position="${vec(position)}"></a-entity>`;
    }
    case 'point': {
      const position = light.position ?? { x: 0, y: 0, z: 0 };
      return `<a-entity ${id} light="type: point; color: ${color}; intensity: ${num(light.intensity)}" position="${vec(position)}"></a-entity>`;
    }
  }
}

/** Camera rig: position plus the yaw/pitch that aims -Z at the look-at target. */
function cameraMarkup(camera: Camera3D): string {
  const dx = camera.target.x - camera.position.x;
  const dy = camera.target.y - camera.position.y;
  const dz = camera.target.z - camera.position.z;
  const yaw = Math.atan2(-dx, -dz) / DEG;
  const pitch = Math.atan2(dy, Math.hypot(dx, dz)) / DEG;
  const rotation = `${num(pitch)} ${num(yaw)} 0`;
  return `<a-entity id="scene3d-camera-rig" position="${vec(camera.position)}" rotation="${rotation}"><a-camera user-height="0" position="0 0 0" fov="${num(camera.fov)}" near="${num(camera.near)}" far="${num(camera.far)}" wasd-controls-enabled="false"></a-camera></a-entity>`;
}

function groupMarkup(group: Group3D, children: string): string {
  return `<a-entity id="${escapeAttr(group.id)}" ${transformAttrs(group.transform)} visible="${group.visible ? 'true' : 'false'}">${children}</a-entity>`;
}

/** The declarative A-Frame markup (`<a-scene>...</a-scene>`) for a validated scene3d document. */
export type AFrameMarkupOptions = {
  /** Rasterises a drawing plane's drawing to a PNG data URL; defaults to the shared canvas painter. */
  rasterize?: (drawing: DrawingDocument) => string | null;
};

function defaultRasterize(drawing: DrawingDocument): string | null {
  const canvas = rasterizeDrawing(drawing);
  if (!canvas) return null;
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export function buildAFrameSceneMarkup(
  scene3d: Scene3DDocument,
  options: AFrameMarkupOptions = {},
): string {
  const rasterize = options.rasterize ?? defaultRasterize;
  const zeroContent =
    scene3d.objects.length === 0 && scene3d.lights.length === 0 && scene3d.groups.length === 0;
  const background = sanitizeColor(
    zeroContent ? ZERO_CONTENT_BACKGROUND_COLOR : scene3d.scene.backgroundColor,
    '#000000',
  );
  const byGroup = new Map<string, string[]>();
  const topLevel: string[] = [];
  const assets: string[] = [];
  for (const [index, object] of scene3d.objects.entries()) {
    let textureId: string | undefined;
    if (object.type === 'drawingPlane' && object.drawing) {
      const dataUrl = rasterize(object.drawing);
      if (dataUrl && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
        textureId = `drawing-texture-${index}`;
        assets.push(`<img id="${textureId}" src="${dataUrl}" alt="">`);
      }
    }
    const markup = objectMarkup(object, textureId);
    if (object.groupId !== null && scene3d.groups.some((group) => group.id === object.groupId)) {
      const bucket = byGroup.get(object.groupId) ?? [];
      bucket.push(markup);
      byGroup.set(object.groupId, bucket);
    } else {
      topLevel.push(markup);
    }
  }
  const groups = scene3d.groups.map((group) =>
    groupMarkup(group, (byGroup.get(group.id) ?? []).join('')),
  );
  return [
    `<a-scene embedded vr-mode-ui="enabled: false" background="color: ${background}" renderer="antialias: true">`,
    assets.length > 0 ? `<a-assets timeout="10000">${assets.join('')}</a-assets>` : '',
    ...scene3d.lights.map(lightMarkup),
    ...groups,
    ...topLevel,
    cameraMarkup(scene3d.camera),
    '</a-scene>',
    scene3d.objects.some((object) => object.animation) ? AFRAME_ANIMATION_COMPONENT_SCRIPT : '',
  ].join('');
}
