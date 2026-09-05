/** Pure object-level mutations for the supported draw.io document subset.
 * The editor can compose these with its existing commit/undo machinery while
 * retaining stable IDs and layer-level lock semantics. */
import type { SceneDocument } from '../api/projects';
import { validateScene } from '../validation/scene';

export type DrawioObject = {
  id: string;
  type: 'rect' | 'ellipse' | 'line' | 'text';
  layerId: string;
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fill?: string | null;
  stroke?: string | null;
};

export type DrawioLayer = {
  id: string;
  name: string;
  order: number;
  locked: boolean;
  visible: boolean;
};
type DrawioDocument = { layers: DrawioLayer[]; objects: DrawioObject[]; formatVersion: 1 };
export type DrawioMutation =
  { ok: true; scene: SceneDocument; selectedId?: string } | { ok: false; error: string };

export function getDrawioLayers(scene: SceneDocument): DrawioLayer[] {
  return read(scene)?.layers ?? [];
}

export function renameDrawioLayer(scene: SceneDocument, id: string, name: string): DrawioMutation {
  return edit(scene, (document) => {
    const layer = document.layers.find((candidate) => candidate.id === id);
    if (!layer) return 'The selected draw.io layer no longer exists.';
    if (layer.locked) return 'The selected draw.io layer is locked.';
    const trimmed = name.trim();
    if (!trimmed) return 'Layer names cannot be blank.';
    layer.name = trimmed;
    return null;
  });
}

export function toggleDrawioLayerFlag(
  scene: SceneDocument,
  id: string,
  flag: 'visible' | 'locked',
): DrawioMutation {
  return edit(scene, (document) => {
    const layer = document.layers.find((candidate) => candidate.id === id);
    if (!layer) return 'The selected draw.io layer no longer exists.';
    layer[flag] = !layer[flag];
    return null;
  });
}

export function deleteDrawioLayer(scene: SceneDocument, id: string): DrawioMutation {
  return edit(scene, (document) => {
    const index = document.layers.findIndex((layer) => layer.id === id);
    if (index < 0) return 'The selected draw.io layer no longer exists.';
    if (document.layers.length === 1) return 'A draw.io document must keep at least one layer.';
    if (document.layers[index].locked) return 'The selected draw.io layer is locked.';
    document.layers.splice(index, 1);
    document.objects = document.objects.filter((object) => object.layerId !== id);
    return null;
  });
}

export function moveDrawioLayer(
  scene: SceneDocument,
  id: string,
  direction: 'up' | 'down',
): DrawioMutation {
  return edit(scene, (document) => {
    const index = document.layers.findIndex((layer) => layer.id === id);
    if (index < 0) return 'The selected draw.io layer no longer exists.';
    const otherIndex = direction === 'up' ? index - 1 : index + 1;
    if (otherIndex < 0 || otherIndex >= document.layers.length) return null;
    [document.layers[index].order, document.layers[otherIndex].order] = [
      document.layers[otherIndex].order,
      document.layers[index].order,
    ];
    return null;
  });
}

function read(scene: SceneDocument): DrawioDocument | null {
  if (scene.documentType !== 'drawio' || !scene.drawio || typeof scene.drawio !== 'object')
    return null;
  const document = scene.drawio as Partial<DrawioDocument>;
  return Array.isArray(document.layers) && Array.isArray(document.objects)
    ? (document as DrawioDocument)
    : null;
}

function edit(
  scene: SceneDocument,
  mutate: (document: DrawioDocument) => string | null,
): DrawioMutation {
  const document = read(scene);
  if (!document) return { ok: false, error: 'This is not a supported draw.io document.' };
  const next = structuredClone(document);
  const error = mutate(next);
  if (error) return { ok: false, error };
  const candidate = { ...scene, drawio: next };
  const validation = validateScene(candidate);
  return validation.valid
    ? { ok: true, scene: candidate }
    : { ok: false, error: validation.errors[0]?.message ?? 'Invalid draw.io edit.' };
}

function unlocked(document: DrawioDocument, object: DrawioObject): boolean {
  return document.layers.some(
    (layer) => layer.id === object.layerId && layer.visible && !layer.locked,
  );
}

function objectIndex(document: DrawioDocument, id: string): number {
  return document.objects.findIndex((object) => object.id === id);
}

export function moveDrawioObject(
  scene: SceneDocument,
  id: string,
  dx: number,
  dy: number,
): DrawioMutation {
  return edit(scene, (document) => {
    const index = objectIndex(document, id);
    const object = document.objects[index];
    if (!object) return 'The selected draw.io object no longer exists.';
    if (!unlocked(document, object)) return 'The selected object is hidden or locked.';
    object.x += dx;
    object.y += dy;
    return null;
  });
}

export function resizeDrawioObject(
  scene: SceneDocument,
  id: string,
  width: number,
  height: number,
): DrawioMutation {
  return edit(scene, (document) => {
    const object = document.objects[objectIndex(document, id)];
    if (!object) return 'The selected draw.io object no longer exists.';
    if (!unlocked(document, object)) return 'The selected object is hidden or locked.';
    if (width <= 0 || height <= 0) return 'Draw.io object dimensions must be positive.';
    object.width = width;
    object.height = height;
    return null;
  });
}

export function duplicateDrawioObject(scene: SceneDocument, id: string): DrawioMutation {
  return edit(scene, (document) => {
    const object = document.objects[objectIndex(document, id)];
    if (!object) return 'The selected draw.io object no longer exists.';
    if (!unlocked(document, object)) return 'The selected object is hidden or locked.';
    const copy = { ...object, id: `${object.id}-copy`, x: object.x + 10, y: object.y + 10 };
    while (document.objects.some((candidate) => candidate.id === copy.id))
      copy.id = `${copy.id}-copy`;
    document.objects.push(copy);
    return null;
  });
}

export function deleteDrawioObject(scene: SceneDocument, id: string): DrawioMutation {
  return edit(scene, (document) => {
    const index = objectIndex(document, id);
    const object = document.objects[index];
    if (!object) return 'The selected draw.io object no longer exists.';
    if (!unlocked(document, object)) return 'The selected object is hidden or locked.';
    document.objects.splice(index, 1);
    return null;
  });
}
