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
import type {
  Camera3D,
  Group3D,
  Light3D,
  Object3D as SceneObject3D,
  Scene3DDocument,
} from '../pages/scene3dTypes';

const ZERO_CONTENT_BACKGROUND_COLOR = '#808080';

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

function materialAttr(object: SceneObject3D): string {
  const opacity = object.material.opacity ?? 1;
  const parts = [
    `color: ${sanitizeColor(object.material.color, '#ffffff')}`,
    `opacity: ${num(opacity)}`,
    `transparent: ${opacity < 1 ? 'true' : 'false'}`,
  ];
  if (object.material.emissive) {
    parts.push(`emissive: ${sanitizeColor(object.material.emissive, '#000000')}`);
    parts.push('emissiveIntensity: 1');
  }
  if (object.type === 'plane') parts.push('side: double');
  return `material="${escapeAttr(parts.join('; '))}"`;
}

function objectMarkup(object: SceneObject3D): string {
  const base = `id="${escapeAttr(object.id)}" ${materialAttr(object)} ${transformAttrs(object.transform)} visible="${object.visible ? 'true' : 'false'}"`;
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
export function buildAFrameSceneMarkup(scene3d: Scene3DDocument): string {
  const zeroContent =
    scene3d.objects.length === 0 && scene3d.lights.length === 0 && scene3d.groups.length === 0;
  const background = sanitizeColor(
    zeroContent ? ZERO_CONTENT_BACKGROUND_COLOR : scene3d.scene.backgroundColor,
    '#000000',
  );
  const byGroup = new Map<string, string[]>();
  const topLevel: string[] = [];
  for (const object of scene3d.objects) {
    const markup = objectMarkup(object);
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
    ...scene3d.lights.map(lightMarkup),
    ...groups,
    ...topLevel,
    cameraMarkup(scene3d.camera),
    '</a-scene>',
  ].join('');
}
