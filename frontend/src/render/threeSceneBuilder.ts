/**
 * Issue #244: builds a real Three.js scene graph from a validated
 * `scene3d` document (`../pages/scene3dTypes.ts`, mirroring
 * `../../../schema/scene3d.schema.json`). Mirrors `p5Adapter.ts`'s split
 * between "how to draw a scene" and "how to mount/animate a canvas" —
 * this module only ever constructs `THREE.Object3D` instances from plain
 * data, never touches a `<canvas>`, a renderer, or an animation loop
 * (that's `../pages/Scene3DPreview.tsx`). Kept deliberately separate so
 * the scene-graph construction is testable without a WebGL context,
 * which jsdom (this project's test environment) does not provide.
 *
 * ## Primitive mapping (schema type -> Three.js geometry)
 *
 * - `box` -> `BoxGeometry(width, height, depth)`
 * - `sphere` -> `SphereGeometry(radius, ...)`
 * - `cylinder` -> `CylinderGeometry(radiusTop, radiusBottom, height, ...)`
 * - `plane` -> `PlaneGeometry(width, height)`, both sides rendered
 *   (`THREE.DoubleSide`) since a plane object has no schema-defined
 *   "front" — matches `scenes/thumbnails3d.py`'s choice not to
 *   backface-cull planes.
 *
 * ## Transform composition
 *
 * An object's `THREE.Mesh` is added as a child of a `THREE.Group`
 * representing its containing `scene3d` group (or directly to the scene
 * root when `groupId` is `null`), and each level's own
 * position/rotation/scale/opacity is set on that level's `Object3D` —
 * i.e. Three.js's own scene-graph parenting does the transform
 * composition, rather than this module pre-multiplying matrices by hand
 * (unlike `scenes/thumbnails3d.py`, which has no scene-graph API
 * available in Pillow and must compose transforms manually). Euler
 * rotation order is fixed to `"XYZ"` (`THREE.Euler`'s default), matching
 * the schema's documented "applied in a fixed X-then-Y-then-Z order"
 * rule.
 *
 * ## Materials and lighting
 *
 * Uses `MeshStandardMaterial` (not `MeshBasicMaterial`) specifically so
 * the schema's `lights` array (directional/point/ambient) has something
 * to actually illuminate -- the 2D-family thumbnail rasterizer
 * (`scenes/thumbnails3d.py`) deliberately ignores lighting entirely
 * ("artwork only" for a static card image); the *editor's own* live
 * preview is a different surface with a different goal (issue #244's
 * acceptance criteria: "camera, lighting, and object/group placement
 * should reflect the schema's fields"), so lighting is real here.
 */
import * as THREE from 'three';

import type {
  Camera3D,
  Group3D,
  Light3D,
  Object3D as SceneObject3D,
  Scene3DDocument,
} from '../pages/scene3dTypes';

export type ThreeSceneGraph = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
};

/** Issue #254: a zero-content scene (no objects, lights, or groups) reads as
 * "loaded, empty" rather than "broken" regardless of its persisted
 * `backgroundColor` -- matches `scenes/thumbnails3d.py`'s
 * `_ZERO_CONTENT_BACKGROUND_COLOR` so the live preview and the gallery
 * thumbnail agree. This is a render-time override, not a data migration: it
 * never touches the stored document, so it applies uniformly to scenes
 * created before and after #253's creation-time default changed. */
const ZERO_CONTENT_BACKGROUND_COLOR = '#808080';

function isZeroContentScene(scene3d: Scene3DDocument): boolean {
  return scene3d.objects.length === 0 && scene3d.lights.length === 0 && scene3d.groups.length === 0;
}

function applyTransform(
  target: THREE.Object3D,
  transform: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
    opacity: number;
  },
): void {
  target.position.set(transform.position.x, transform.position.y, transform.position.z);
  target.rotation.set(
    THREE.MathUtils.degToRad(transform.rotation.x),
    THREE.MathUtils.degToRad(transform.rotation.y),
    THREE.MathUtils.degToRad(transform.rotation.z),
    'XYZ',
  );
  target.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
}

function buildGeometry(object: SceneObject3D): THREE.BufferGeometry {
  switch (object.type) {
    case 'box':
      return new THREE.BoxGeometry(object.width ?? 1, object.height ?? 1, object.depth ?? 1);
    case 'sphere':
      return new THREE.SphereGeometry(object.radius ?? 1, 24, 16);
    case 'cylinder':
      return new THREE.CylinderGeometry(
        object.radiusTop ?? 1,
        object.radiusBottom ?? 1,
        object.height ?? 1,
        16,
      );
    case 'plane':
      return new THREE.PlaneGeometry(object.width ?? 1, object.height ?? 1);
  }
}

function buildMaterial(object: SceneObject3D): THREE.MeshStandardMaterial {
  const opacity = object.material.opacity ?? 1;
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(object.material.color),
    emissive: object.material.emissive ? new THREE.Color(object.material.emissive) : undefined,
    opacity,
    transparent: opacity < 1,
    side: object.type === 'plane' ? THREE.DoubleSide : THREE.FrontSide,
  });
}

function buildObjectMesh(object: SceneObject3D): THREE.Mesh {
  const mesh = new THREE.Mesh(buildGeometry(object), buildMaterial(object));
  applyTransform(mesh, object.transform);
  mesh.visible = object.visible;
  mesh.name = object.id;
  return mesh;
}

function buildGroupNode(group: Group3D): THREE.Group {
  const node = new THREE.Group();
  applyTransform(node, group.transform);
  node.visible = group.visible;
  node.name = group.id;
  return node;
}

function buildLight(light: Light3D): THREE.Light {
  const color = new THREE.Color(light.color);
  switch (light.type) {
    case 'ambient':
      return new THREE.AmbientLight(color, light.intensity);
    case 'directional': {
      const directional = new THREE.DirectionalLight(color, light.intensity);
      const direction = light.direction ?? { x: 0, y: -1, z: 0 };
      // A DirectionalLight in Three.js shines from its `position` toward
      // its `target` -- the schema instead gives a direction vector, so
      // place the light opposite that direction and aim the (default)
      // target back at the origin.
      directional.position.set(-direction.x, -direction.y, -direction.z);
      directional.target.position.set(0, 0, 0);
      return directional;
    }
    case 'point': {
      const point = new THREE.PointLight(color, light.intensity);
      const position = light.position ?? { x: 0, y: 0, z: 0 };
      point.position.set(position.x, position.y, position.z);
      return point;
    }
  }
}

function buildCamera(camera: Camera3D, aspect: number): THREE.PerspectiveCamera {
  const result = new THREE.PerspectiveCamera(camera.fov, aspect, camera.near, camera.far);
  result.position.set(camera.position.x, camera.position.y, camera.position.z);
  result.lookAt(camera.target.x, camera.target.y, camera.target.z);
  return result;
}

/** Builds a fresh `THREE.Scene`/`THREE.PerspectiveCamera` pair from a
 * validated `scene3d` document. Always rebuilds from scratch (no partial
 * diffing) -- simple, deterministic, and cheap enough for an editor
 * preview's scene sizes (the same complexity limits `schema/limits3d.json`
 * already caps saving/AI-generation at). `aspect` is the caller's
 * canvas's current width/height ratio (kept out of the document itself,
 * matching how `scenes/thumbnails3d.py` derives its own projection
 * aspect from the fixed card size rather than the document). */
export function buildThreeSceneGraph(scene3d: Scene3DDocument, aspect: number): ThreeSceneGraph {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(
    isZeroContentScene(scene3d) ? ZERO_CONTENT_BACKGROUND_COLOR : scene3d.scene.backgroundColor,
  );

  for (const light of scene3d.lights) {
    const built = buildLight(light);
    scene.add(built);
    if (built instanceof THREE.DirectionalLight) {
      scene.add(built.target);
    }
  }

  const groupNodes = new Map<string, THREE.Group>();
  for (const group of scene3d.groups) {
    const node = buildGroupNode(group);
    groupNodes.set(group.id, node);
    scene.add(node);
  }

  for (const object of scene3d.objects) {
    const mesh = buildObjectMesh(object);
    const parent = object.groupId !== null ? groupNodes.get(object.groupId) : undefined;
    (parent ?? scene).add(mesh);
  }

  const camera = buildCamera(scene3d.camera, aspect);

  return { scene, camera };
}

/** Recursively disposes every geometry/material this module allocated
 * (`buildThreeSceneGraph`'s output), so rebuilding the scene on every
 * prop change (`Scene3DPreview.tsx`) doesn't leak GPU buffers -- Three.js
 * never does this automatically when objects are simply dereferenced. */
export function disposeThreeSceneGraph(scene: THREE.Scene): void {
  scene.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) material.dispose();
    }
  });
}
