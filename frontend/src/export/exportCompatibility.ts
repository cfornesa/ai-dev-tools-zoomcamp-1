/**
 * Task 55: export-time renderer/interaction-mode compatibility rules.
 *
 * ## Why there's a real (if currently unreachable) renderer check
 *
 * `_docs/plan.md`'s "Renderer selection" section originally documented V1
 * as shipping exactly one renderer — p5.js — with the canonical scene
 * schema (`schema/scene.schema.json`'s `renderer.preferred`) encoding that
 * as a `const: "p5"`. Issue #206 widened that to an `enum` (`p5`,
 * `canvas2d`), adding a second renderer with an identical capability
 * set — see below. Every scene that ever reaches this dialog has already
 * been server-validated against a schema that only allows shape/node
 * types both renderers are built to render (see
 * `frontend/src/render/p5Adapter.ts`/`canvas2dAdapter.ts` and
 * `frontend/src/runtime/behaviorRuntime.ts`'s `ALLOWED_NODE_TYPES_BY_FAMILY`).
 * In practice, `checkRendererCompatibility` below still can never find a
 * real scene incompatible with either renderer today, for the same reason
 * it couldn't before #206: the 2D shape/node vocabulary is inherently
 * renderer-agnostic, so any renderer that implements the full vocabulary
 * (as both do) has full capability parity.
 *
 * It still exists, as a genuine data-driven check rather than a hardcoded
 * "always compatible" shortcut, because:
 *  - Issue #55's acceptance criteria require a real, testable blocking
 *    mechanism that "names each exact unsupported feature" — not a promise
 *    that one exists once more renderers ship.
 *  - `_docs/plan.md` explicitly plans SVG parity later ("SVG... export
 *    options appear only when the selected scene uses features supported
 *    by that renderer... Validate selected renderer compatibility before
 *    export"). Adding a new entry to `RENDERER_CAPABILITIES` is all a
 *    future task needs to do to make this check meaningful for a renderer
 *    that *doesn't* have full parity — no dialog/validation logic changes.
 *  - Tests exercise the blocking path directly against a scene shaped with
 *    a feature outside a renderer's declared capability set (see
 *    `exportCompatibility.test.ts`), proving the mechanism works now,
 *    even though no real V1 scene can currently trigger it.
 */

import type { SceneDocument } from '../api/projects';

export type RendererId = 'p5js' | 'canvas2d';

export const RENDERER_LABELS: Record<RendererId, string> = {
  p5js: 'p5.js',
  canvas2d: 'Canvas2D',
};

/** Every shape/node type the canonical schema (`schema/scene.schema.json`)
 * and runtime (`frontend/src/runtime/behaviorRuntime.ts`'s
 * `ALLOWED_NODE_TYPES_BY_FAMILY`) allow today. Both p5.js and Canvas2D
 * implement the full known 2D vocabulary (`frontend/src/render/p5Adapter.ts`/
 * `canvas2dAdapter.ts` both draw every shape type and are driven by the
 * same renderer-agnostic runtime for every node type), so their capability
 * sets are identical — see module doc comment above. */
const FULL_2D_CAPABILITIES = {
  shapeTypes: new Set(['circle', 'rect', 'line', 'path', 'particleEmitter']),
  nodeTypes: new Set([
    'handSignal',
    'gestureEvent',
    'timer',
    'oscillator',
    'randomRange',
    'randomChoice',
    'mapRange',
    'clamp',
    'smooth',
    'invert',
    'add',
    'multiply',
    'lerp',
    'noise',
    'ifElse',
    'shapeProperty',
    'groupProperty',
    'particleEmitter',
    'trigger',
    'delay',
    'cooldown',
    'randomEvent',
  ]),
};

const RENDERER_CAPABILITIES: Record<
  RendererId,
  { shapeTypes: Set<string>; nodeTypes: Set<string> }
> = {
  p5js: FULL_2D_CAPABILITIES,
  canvas2d: FULL_2D_CAPABILITIES,
};

type SceneShapeLike = { type?: unknown };
type SceneGraphNodeLike = { type?: unknown };

function sceneShapes(scene: SceneDocument): SceneShapeLike[] {
  const shapes = (scene as { shapes?: unknown }).shapes;
  return Array.isArray(shapes) ? (shapes as SceneShapeLike[]) : [];
}

function sceneGraphNodes(scene: SceneDocument): SceneGraphNodeLike[] {
  const graph = (scene as { graph?: { nodes?: unknown } }).graph;
  const nodes = graph?.nodes;
  return Array.isArray(nodes) ? (nodes as SceneGraphNodeLike[]) : [];
}

/** Camera-driven input node types — the only nodes that read live (or
 * demo-simulated) hand-tracking data, per `behaviorCards.ts`'s
 * `graphFragmentForCard` (every `followHand`/`reactToPinch`/`pulse`/
 * `emitParticles` card's input node is `handSignal` or `gestureEvent`). */
const CAMERA_INPUT_NODE_TYPES = new Set(['handSignal', 'gestureEvent']);

/** Whether `scene` has at least one binding driven by hand-tracking input
 * (live camera or demo-simulated — both feed the same
 * `TrackingProvider`-shaped signal, see `frontend/src/tracking/demoController.ts`).
 * Used to gate whether offering camera-inclusive interaction modes is
 * meaningful for this scene (see `getAvailableInteractionModes` below). */
export function sceneUsesCameraInput(scene: SceneDocument): boolean {
  return sceneGraphNodes(scene).some(
    (node) => typeof node.type === 'string' && CAMERA_INPUT_NODE_TYPES.has(node.type),
  );
}

/** Returns the exact list of unsupported-feature messages for `scene`
 * against `renderer`'s declared capabilities — empty when fully
 * compatible. Each message names the exact offending type, per issue
 * #55's "names each exact unsupported feature" acceptance criterion,
 * rather than a generic "incompatible" message. */
export function checkRendererCompatibility(scene: SceneDocument, renderer: RendererId): string[] {
  const capabilities = RENDERER_CAPABILITIES[renderer];
  const label = RENDERER_LABELS[renderer];
  const messages: string[] = [];

  sceneShapes(scene).forEach((shape) => {
    if (typeof shape.type === 'string' && !capabilities.shapeTypes.has(shape.type)) {
      messages.push(`Shape type "${shape.type}" is not supported by the ${label} renderer.`);
    }
  });

  sceneGraphNodes(scene).forEach((node) => {
    if (typeof node.type === 'string' && !capabilities.nodeTypes.has(node.type)) {
      messages.push(`Behavior node type "${node.type}" is not supported by the ${label} renderer.`);
    }
  });

  return messages;
}

export type InteractionMode = 'demo' | 'camera' | 'demo-camera';

export const INTERACTION_MODE_LABELS: Record<InteractionMode, string> = {
  demo: 'Demo only',
  camera: 'Camera only',
  'demo-camera': 'Demo + camera',
};

/**
 * Task 55's documented interaction-mode gating rule (see
 * `_docs/plan.md`'s "Camera/device handling" and "Export dialog"
 * sections, and `frontend/src/tracking/demoController.ts`'s module doc
 * comment):
 *
 *  - `demo` is always available. Demo mode (manual sliders or scripted
 *    playback, see `DemoControlsPanel.tsx`) drives the exact same
 *    `TrackingProvider` contract live camera input does, so every scene —
 *    with or without camera-driven bindings — runs correctly in demo mode.
 *    This is not a "compatibility" gate at all, just always-on.
 *  - `camera` and `demo-camera` are offered only when the scene has at
 *    least one camera-driven binding (`sceneUsesCameraInput` above).
 *    Enabling the camera for a scene with zero `handSignal`/`gestureEvent`
 *    nodes would request a sensitive permission (see plan.md's "Never open
 *    the camera automatically... Provide explicit `Enable camera`
 *    control") for a mode that could not possibly affect anything the
 *    scene does — so it is deliberately not offered, not merely
 *    discouraged. This is a UX availability rule, not a hard
 *    incompatibility: no camera-driven bindings ever produce a *blocking*
 *    error, unlike a genuine renderer/feature mismatch.
 */
export function getAvailableInteractionModes(scene: SceneDocument): InteractionMode[] {
  return sceneUsesCameraInput(scene) ? ['demo', 'camera', 'demo-camera'] : ['demo'];
}
