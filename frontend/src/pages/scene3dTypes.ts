/** Document-shape types for `schema/scene3d.schema.json`, mirroring
 * `sceneShapes.ts`'s convention for the 2D schema -- used by
 * `Outline3DInspector.tsx` (issue #227) to read/edit a `scene3d` document
 * in memory. Not a validator (see `frontend/src/validation/scene3d.ts`
 * for that); these types only describe the shape well enough for a
 * property inspector to read and produce a new document from. */

export type Vec3 = { x: number; y: number; z: number };

export type Transform3D = {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  opacity: number;
};

export type Material3D = {
  color: string;
  opacity?: number;
  emissive?: string;
};

export type Object3DType = 'box' | 'sphere' | 'cylinder' | 'plane';

export type Object3D = {
  id: string;
  name?: string;
  type: Object3DType;
  groupId: string | null;
  transform: Transform3D;
  material: Material3D;
  visible: boolean;
  // Type-specific dimension fields -- only the ones matching `type` are
  // meaningful, mirroring the schema's per-type allOf branches.
  width?: number;
  height?: number;
  depth?: number;
  radius?: number;
  radiusTop?: number;
  radiusBottom?: number;
};

export type Group3D = {
  id: string;
  name: string;
  transform: Transform3D;
  visible: boolean;
  locked: boolean;
};

export type LightType = 'directional' | 'point' | 'ambient';

export type Light3D = {
  id: string;
  name?: string;
  type: LightType;
  color: string;
  intensity: number;
  position?: Vec3;
  direction?: Vec3;
};

export type Camera3D = {
  position: Vec3;
  target: Vec3;
  fov: number;
  near: number;
  far: number;
};

export type Scene3DDocument = {
  schemaVersion: 1;
  documentType: 'scene3d';
  id: string;
  scene: { backgroundColor: string };
  camera: Camera3D;
  lights: Light3D[];
  groups: Group3D[];
  objects: Object3D[];
  randomness: { seed: number; enabled: boolean };
};

export const OBJECT_TYPE_DISPLAY_NAMES: Record<Object3DType, string> = {
  box: 'Box',
  sphere: 'Sphere',
  cylinder: 'Cylinder',
  plane: 'Plane',
};

/** Mirrors `sceneShapes.ts`'s `shapeLabel` convention: `<type display
 * name> <1-based ordinal among same-type objects>`, falling back to the
 * object's own `name` when set. */
export function object3DLabel(object: Object3D, allObjects: Object3D[]): string {
  if (object.name) return object.name;
  const sameType = allObjects.filter((o) => o.type === object.type);
  const ordinal = sameType.findIndex((o) => o.id === object.id) + 1;
  return `${OBJECT_TYPE_DISPLAY_NAMES[object.type]} ${ordinal || sameType.length + 1}`;
}

export function light3DLabel(light: Light3D, allLights: Light3D[]): string {
  if (light.name) return light.name;
  const sameType = allLights.filter((l) => l.type === light.type);
  const ordinal = sameType.findIndex((l) => l.id === light.id) + 1;
  const display = light.type.charAt(0).toUpperCase() + light.type.slice(1);
  return `${display} light ${ordinal || sameType.length + 1}`;
}
