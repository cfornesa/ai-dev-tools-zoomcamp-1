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

type DrawioLayer = { id: string; locked: boolean; visible: boolean };
type DrawioDocument = { layers: DrawioLayer[]; objects: DrawioObject[]; formatVersion: 1 };
export type DrawioMutation =
  { ok: true; scene: SceneDocument; selectedId?: string } | { ok: false; error: string };

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
