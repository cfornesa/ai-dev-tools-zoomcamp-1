/**
 * Task 25: turns a canonical scene document into an ordered, typed "draw
 * plan" the p5.js adapter (`p5Adapter.ts`) walks to issue draw calls.
 *
 * This module is renderer-neutral on purpose: it never touches p5, the
 * DOM, or `<canvas>`. It only reads scene JSON fields (see
 * `../../../schema/scene.schema.json`) as inert data — numbers, strings,
 * booleans, and the fixed `shape.type` enum — and turns them into a plain
 * object tree. No scene field is ever passed to `eval`, `new Function`, or
 * template interpolation that could execute it as code (acceptance
 * criterion 12); every field access below is a hardcoded property name
 * chosen by a `switch` on the shape's *validated* `type`, never a
 * data-driven property lookup.
 *
 * ## Two-layer validation (acceptance criteria 10 and 11)
 *
 * `buildScenePlan` runs two checks, in this order, before it will return a
 * plan (and therefore before the adapter can issue a single p5 draw call):
 *
 * 1. A strict structural/referential pre-pass (`readCanvas`, `readLayer`,
 *    `readGroup`, `readShape`, and the dangling-reference checks in
 *    `buildScenePlan` itself) that throws a `SceneRenderError` naming the
 *    offending object's `id` and field the moment it finds a problem —
 *    e.g. a shape `type` outside the schema's five values, or a
 *    `groupId`/`layerId` that doesn't resolve. This is defense in depth:
 *    `validateScene` (schema structure) already rejects most of these,
 *    but this pre-pass gives a message that names the specific object,
 *    which a generic schema error path doesn't always do.
 * 2. A full `validateScene` gate (referential integrity, cycles,
 *    duplicate ids, `schema/limits.json` complexity/payload limits,
 *    schema version) as a backstop — a scene that passes step 1's lighter
 *    checks but was never actually validated (or fails on something step
 *    1 doesn't check, like a group cycle or an over-limit shape count)
 *    still throws before any draw call.
 *
 * ## Draw order (acceptance criterion 5)
 *
 * Follows the exact rule documented in `../pages/sceneOutline.ts`'s
 * `buildOutline()`: layers in ascending `order`; within a layer,
 * top-level `groups` in array order, then top-level shapes
 * (`groupId === null`) in `shapes` array order; a grouped shape/group
 * draws at its position in the parent's `childIds`. This module
 * reimplements that rule rather than calling `buildOutline` directly
 * because `buildOutline` (via `getEditableShapes`) deliberately excludes
 * `particleEmitter` shapes (out of scope for Task 24) — this renderer
 * must draw all five shape types (acceptance criterion 2).
 */
import { validateScene } from '../validation/scene';

export class SceneRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SceneRenderError';
  }
}

export type Transform2D = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
};

export type Style = {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
};

type BaseFields = {
  id: string;
  layerId: string;
  groupId: string | null;
  transform: Transform2D;
  style: Style;
};

export type CircleShape = BaseFields & { type: 'circle'; radius: number };
export type RectShape = BaseFields & {
  type: 'rect';
  width: number;
  height: number;
  cornerRadius: number;
};
export type LineShape = BaseFields & { type: 'line'; x2: number; y2: number };
export type PathShape = BaseFields & {
  type: 'path';
  points: Array<{ x: number; y: number }>;
  closed: boolean;
};
export type ParticleEmitterShape = BaseFields & {
  type: 'particleEmitter';
  rate: number;
  size: number;
  lifespan: number;
  speed: number;
  palette: string[];
};

export type AnyShape = CircleShape | RectShape | LineShape | PathShape | ParticleEmitterShape;

export type GroupNode = {
  id: string;
  name: string;
  layerId: string;
  childIds: string[];
  transform: Transform2D;
  visible: boolean;
  locked: boolean;
};

export type LayerInfo = {
  id: string;
  name: string;
  order: number;
  visible: boolean;
  locked: boolean;
};

export type DrawShapeNode = { kind: 'shape'; shape: AnyShape };
export type DrawGroupNode = { kind: 'group'; group: GroupNode; children: DrawNode[] };
export type DrawNode = DrawShapeNode | DrawGroupNode;

export type ScenePlan = {
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
    /** Task 138 (issue #170): opacity of the overall rendered composite
     * (background + every shape, as one flattened layer) -- distinct from
     * each shape's own `transform.opacity`. Optional in the scene document
     * itself (`schema/scene.schema.json`'s `canvas.opacity`); defaults to
     * 1 (fully opaque) here so every scene predating this field renders
     * exactly as before. */
    opacity: number;
  };
  randomness: { seed: number; enabled: boolean };
  layers: LayerInfo[];
  nodes: DrawNode[];
};

const SHAPE_TYPES = new Set(['circle', 'rect', 'line', 'path', 'particleEmitter']);

function asRecord(value: unknown): Record<string, unknown> {
  return (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
}

function idOf(raw: Record<string, unknown>, index: number): string {
  return typeof raw.id === 'string' ? raw.id : `#${index}`;
}

function readTransform(raw: unknown, where: string): Transform2D {
  const t = asRecord(raw);
  const fields = ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity'] as const;
  for (const field of fields) {
    if (typeof t[field] !== 'number') {
      throw new SceneRenderError(`${where}.transform.${field} must be a number.`);
    }
  }
  return {
    x: t.x as number,
    y: t.y as number,
    scaleX: t.scaleX as number,
    scaleY: t.scaleY as number,
    rotation: t.rotation as number,
    opacity: t.opacity as number,
  };
}

function readStyle(raw: unknown, where: string): Style {
  const s = asRecord(raw);
  const fill = s.fill;
  const stroke = s.stroke;
  const strokeWidth = s.strokeWidth;
  if (fill !== null && typeof fill !== 'string') {
    throw new SceneRenderError(`${where}.style.fill must be a color string or null.`);
  }
  if (stroke !== null && typeof stroke !== 'string') {
    throw new SceneRenderError(`${where}.style.stroke must be a color string or null.`);
  }
  if (typeof strokeWidth !== 'number') {
    throw new SceneRenderError(`${where}.style.strokeWidth must be a number.`);
  }
  return {
    fill: (fill as string | null) ?? null,
    stroke: (stroke as string | null) ?? null,
    strokeWidth,
  };
}

function readLayer(raw: unknown, index: number): LayerInfo {
  const l = asRecord(raw);
  const where = `layers[${index}] (id "${idOf(l, index)}")`;
  if (typeof l.id !== 'string') throw new SceneRenderError(`${where}.id must be a string.`);
  if (typeof l.name !== 'string') throw new SceneRenderError(`${where}.name must be a string.`);
  if (typeof l.order !== 'number') throw new SceneRenderError(`${where}.order must be a number.`);
  if (typeof l.visible !== 'boolean')
    throw new SceneRenderError(`${where}.visible must be a boolean.`);
  if (typeof l.locked !== 'boolean')
    throw new SceneRenderError(`${where}.locked must be a boolean.`);
  return { id: l.id, name: l.name, order: l.order, visible: l.visible, locked: l.locked };
}

function readGroup(raw: unknown, index: number): GroupNode {
  const g = asRecord(raw);
  const where = `groups[${index}] (id "${idOf(g, index)}")`;
  if (typeof g.id !== 'string') throw new SceneRenderError(`${where}.id must be a string.`);
  if (typeof g.name !== 'string') throw new SceneRenderError(`${where}.name must be a string.`);
  if (typeof g.layerId !== 'string')
    throw new SceneRenderError(`${where}.layerId must be a string.`);
  if (!Array.isArray(g.childIds) || g.childIds.some((c) => typeof c !== 'string')) {
    throw new SceneRenderError(`${where}.childIds must be an array of strings.`);
  }
  if (typeof g.visible !== 'boolean')
    throw new SceneRenderError(`${where}.visible must be a boolean.`);
  if (typeof g.locked !== 'boolean')
    throw new SceneRenderError(`${where}.locked must be a boolean.`);
  const transform = readTransform(g.transform, where);
  return {
    id: g.id,
    name: g.name,
    layerId: g.layerId,
    childIds: g.childIds as string[],
    transform,
    visible: g.visible,
    locked: g.locked,
  };
}

function readShape(raw: unknown, index: number): AnyShape {
  const s = asRecord(raw);
  const where = `shapes[${index}] (id "${idOf(s, index)}")`;
  const type = s.type;
  if (typeof type !== 'string' || !SHAPE_TYPES.has(type)) {
    throw new SceneRenderError(`${where}.type: unknown shape type ${JSON.stringify(type)}.`);
  }
  if (typeof s.id !== 'string') throw new SceneRenderError(`${where}.id must be a string.`);
  if (typeof s.layerId !== 'string')
    throw new SceneRenderError(`${where}.layerId must be a string.`);
  if (s.groupId !== null && typeof s.groupId !== 'string') {
    throw new SceneRenderError(`${where}.groupId must be a string or null.`);
  }
  const transform = readTransform(s.transform, where);
  const style = readStyle(s.style, where);
  const base: BaseFields = {
    id: s.id,
    layerId: s.layerId,
    groupId: (s.groupId as string | null) ?? null,
    transform,
    style,
  };

  switch (type) {
    case 'circle': {
      if (typeof s.radius !== 'number')
        throw new SceneRenderError(`${where}.radius must be a number.`);
      return { ...base, type, radius: s.radius };
    }
    case 'rect': {
      if (typeof s.width !== 'number')
        throw new SceneRenderError(`${where}.width must be a number.`);
      if (typeof s.height !== 'number')
        throw new SceneRenderError(`${where}.height must be a number.`);
      if (typeof s.cornerRadius !== 'number') {
        throw new SceneRenderError(`${where}.cornerRadius must be a number.`);
      }
      return { ...base, type, width: s.width, height: s.height, cornerRadius: s.cornerRadius };
    }
    case 'line': {
      if (typeof s.x2 !== 'number') throw new SceneRenderError(`${where}.x2 must be a number.`);
      if (typeof s.y2 !== 'number') throw new SceneRenderError(`${where}.y2 must be a number.`);
      return { ...base, type, x2: s.x2, y2: s.y2 };
    }
    case 'path': {
      if (!Array.isArray(s.points)) throw new SceneRenderError(`${where}.points must be an array.`);
      const points = s.points.map((p, i) => {
        const pr = asRecord(p);
        if (typeof pr.x !== 'number' || typeof pr.y !== 'number') {
          throw new SceneRenderError(`${where}.points[${i}] must have numeric x and y.`);
        }
        return { x: pr.x, y: pr.y };
      });
      if (typeof s.closed !== 'boolean')
        throw new SceneRenderError(`${where}.closed must be a boolean.`);
      return { ...base, type, points, closed: s.closed };
    }
    case 'particleEmitter': {
      if (typeof s.rate !== 'number') throw new SceneRenderError(`${where}.rate must be a number.`);
      if (typeof s.size !== 'number') throw new SceneRenderError(`${where}.size must be a number.`);
      if (typeof s.lifespan !== 'number')
        throw new SceneRenderError(`${where}.lifespan must be a number.`);
      if (typeof s.speed !== 'number')
        throw new SceneRenderError(`${where}.speed must be a number.`);
      if (!Array.isArray(s.palette) || s.palette.some((c) => typeof c !== 'string')) {
        throw new SceneRenderError(`${where}.palette must be an array of color strings.`);
      }
      return {
        ...base,
        type,
        rate: s.rate,
        size: s.size,
        lifespan: s.lifespan,
        speed: s.speed,
        palette: s.palette as string[],
      };
    }
    default:
      // Unreachable: `type` was already checked against SHAPE_TYPES above.
      throw new SceneRenderError(`${where}.type: unknown shape type ${JSON.stringify(type)}.`);
  }
}

function readCanvas(scene: Record<string, unknown>): ScenePlan['canvas'] {
  const c = asRecord(scene.canvas);
  if (typeof c.width !== 'number') throw new SceneRenderError('canvas.width must be a number.');
  if (typeof c.height !== 'number') throw new SceneRenderError('canvas.height must be a number.');
  if (typeof c.backgroundColor !== 'string') {
    throw new SceneRenderError('canvas.backgroundColor must be a color string.');
  }
  // Task 138 (issue #170): optional, defaults to 1 (fully opaque) -- see
  // this field's schema description for why this is additive rather than
  // a schemaVersion bump. Reject an explicit-but-wrong-typed value the
  // same way every other field here does; only `undefined` gets the
  // default.
  if (c.opacity !== undefined && typeof c.opacity !== 'number') {
    throw new SceneRenderError('canvas.opacity must be a number.');
  }
  const opacity = typeof c.opacity === 'number' ? c.opacity : 1;
  return { width: c.width, height: c.height, backgroundColor: c.backgroundColor, opacity };
}

function readRandomness(scene: Record<string, unknown>): ScenePlan['randomness'] {
  const r = asRecord(scene.randomness);
  if (typeof r.seed !== 'number') throw new SceneRenderError('randomness.seed must be a number.');
  if (typeof r.enabled !== 'boolean')
    throw new SceneRenderError('randomness.enabled must be a boolean.');
  return { seed: r.seed, enabled: r.enabled };
}

/**
 * Validates a scene document (structurally and referentially) and builds
 * an ordered draw plan from it. Throws `SceneRenderError` — before
 * building any node, let alone issuing a p5 draw call — the moment it
 * finds a problem. See the module docstring for the two-layer validation
 * strategy and the draw-order rule.
 */
export function buildScenePlan(scene: unknown): ScenePlan {
  const sceneRecord = asRecord(scene);

  const canvas = readCanvas(sceneRecord);
  const randomness = readRandomness(sceneRecord);

  const rawLayers = Array.isArray(sceneRecord.layers) ? sceneRecord.layers : [];
  const rawGroups = Array.isArray(sceneRecord.groups) ? sceneRecord.groups : [];
  const rawShapes = Array.isArray(sceneRecord.shapes) ? sceneRecord.shapes : [];

  const layers = rawLayers.map((raw, i) => readLayer(raw, i));
  const groups = rawGroups.map((raw, i) => readGroup(raw, i));
  const shapes = rawShapes.map((raw, i) => readShape(raw, i));

  const layerIds = new Set(layers.map((l) => l.id));
  const groupIds = new Set(groups.map((g) => g.id));
  const shapeIds = new Set(shapes.map((s) => s.id));

  shapes.forEach((shape, i) => {
    if (!layerIds.has(shape.layerId)) {
      throw new SceneRenderError(
        `shapes[${i}] (id "${shape.id}").layerId: "${shape.layerId}" does not match any layer.`,
      );
    }
    if (shape.groupId !== null && !groupIds.has(shape.groupId)) {
      throw new SceneRenderError(
        `shapes[${i}] (id "${shape.id}").groupId: "${shape.groupId}" does not match any group.`,
      );
    }
  });

  groups.forEach((group, i) => {
    if (!layerIds.has(group.layerId)) {
      throw new SceneRenderError(
        `groups[${i}] (id "${group.id}").layerId: "${group.layerId}" does not match any layer.`,
      );
    }
    group.childIds.forEach((cid, ci) => {
      if (cid === group.id) {
        throw new SceneRenderError(
          `groups[${i}] (id "${group.id}").childIds[${ci}]: a group cannot list itself as a child.`,
        );
      }
      if (!shapeIds.has(cid) && !groupIds.has(cid)) {
        throw new SceneRenderError(
          `groups[${i}] (id "${group.id}").childIds[${ci}]: "${cid}" does not match any shape or group.`,
        );
      }
    });
  });

  // Backstop: full validateScene (referential integrity, cycles,
  // duplicate ids, schema/limits.json limits, schema version). See the
  // module docstring for why this runs after, not instead of, the pre-pass
  // above.
  const validation = validateScene(scene);
  if (!validation.valid) {
    const first = validation.errors[0];
    throw new SceneRenderError(
      `Cannot render an invalid scene: ${first ? `${first.path} — ${first.message}` : 'validateScene reported errors.'}`,
    );
  }

  const shapesById = new Map(shapes.map((s) => [s.id, s]));
  const groupsById = new Map(groups.map((g) => [g.id, g]));

  function isGroupTopLevel(groupId: string): boolean {
    return !groups.some((g) => g.childIds.includes(groupId));
  }

  function buildGroupNode(group: GroupNode): DrawGroupNode {
    const children: DrawNode[] = [];
    for (const cid of group.childIds) {
      const childShape = shapesById.get(cid);
      if (childShape) {
        children.push({ kind: 'shape', shape: childShape });
        continue;
      }
      const childGroup = groupsById.get(cid);
      if (childGroup) {
        children.push(buildGroupNode(childGroup));
      }
      // A childId matching neither would already have thrown above.
    }
    return { kind: 'group', group, children };
  }

  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);
  const nodes: DrawNode[] = [];
  for (const layer of sortedLayers) {
    // Acceptance criterion 6: an invisible layer renders none of its
    // shapes/groups. `locked` never affects rendering — it's read above
    // (readLayer requires it to exist) but intentionally never consulted
    // here.
    if (!layer.visible) continue;

    const topGroups = groups.filter((g) => g.layerId === layer.id && isGroupTopLevel(g.id));
    const topShapes = shapes.filter((s) => s.layerId === layer.id && s.groupId === null);

    for (const group of topGroups) nodes.push(buildGroupNode(group));
    for (const shape of topShapes) nodes.push({ kind: 'shape', shape });
  }

  return { canvas, randomness, layers, nodes };
}
