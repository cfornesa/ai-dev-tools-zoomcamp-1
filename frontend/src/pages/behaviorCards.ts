/**
 * Task 34: behavior cards — "Follow hand," "React to pinch," "Pulse," and
 * "Emit particles" — as readable signal-to-target sentences that serialize
 * to the canonical scene's `bindings` array (`schema/scene.schema.json`'s
 * `$defs.binding`) plus an equivalent typed `graph` fragment
 * (`$defs.graphNode`/`$defs.graphConnection`) a future graph UI (Task 36)
 * will read. See `_docs/plan.md`'s "Gesture-to-visual binding system" and
 * "Node graph vocabulary" sections for the vocabulary this module draws
 * from — signal names, hand targets, target scopes/properties, and node
 * families/types all come from there and from the schema; nothing here
 * invents a new shape.
 *
 * ## One card, one binding
 *
 * Every card here produces exactly one `binding` (never a bundle of two),
 * so a card's identity *is* its binding's `id` — there is no separate
 * "card id" field to keep in sync, and no ad-hoc grouping metadata needs
 * to survive a save/reload round trip. `buildCardsFromScene` reconstructs
 * cards by pattern-matching each binding's (signal, targetScope,
 * targetProperty) shape back to exactly one of the four card types; a
 * binding that doesn't match any pattern (e.g. hand-authored or from a
 * future advanced-graph edit) is simply not shown as a card here — this
 * module never errors on it and never drops it from the scene.
 *
 * ## Equivalent graph representation
 *
 * Each card also writes a small subgraph tagged by the same id
 * (`input-<cardId>`, `action-<cardId>`, `conn-<cardId>`), added/removed
 * alongside its binding so the two stay in lockstep. This is data only —
 * no graph UI or runtime graph execution exists yet (Task 36 and Task 35
 * respectively); it exists so a scene saved from this UI already carries
 * the typed-node representation `Show logic` will later render.
 *
 * ## Continuous vs. event-triggered signals
 *
 * A signal name prefixed `event:` (schema `$defs.signal`) is one-shot —
 * pinch start, a gesture transition, a hand appearing — never a
 * continuously competing value. Every other signal (`indexTipX`,
 * `pinchStrength`, `gestureState:*`, `handDistance`, `handsClose`, ...) is
 * treated as continuous. Only continuous bindings collide over a target
 * channel (`_docs/plan.md`'s "Binding collision rule"); `findConflict`
 * only ever flags a continuous-vs-continuous collision, matching this
 * task's acceptance criterion ("a second continuous binding").
 */
import type { SceneDocument } from '../api/projects';
import { validateScene } from '../validation/scene';

export type HandTarget = 'primary' | 'left' | 'right' | 'either';

export const HAND_TARGET_OPTIONS: Array<{ value: HandTarget; label: string }> = [
  { value: 'primary', label: 'Primary hand' },
  { value: 'left', label: 'Left hand' },
  { value: 'right', label: 'Right hand' },
  { value: 'either', label: 'Either hand' },
];

/** A binding targets a two-hand-specific hand independently only when it
 * names `left` or `right` — `primary`/`either` work the same in one-hand
 * or two-hand mode (`_docs/plan.md`'s "Hand modes" section). */
export function isTwoHandTarget(handTarget: HandTarget): boolean {
  return handTarget === 'left' || handTarget === 'right';
}

export type FollowHandSource = 'indexTip' | 'palm';
export type Axis = 'x' | 'y';
export type PinchSource = 'pinchStrength' | 'pinchDistance';
export type PinchTargetProperty = 'opacity' | 'scaleX' | 'scaleY' | 'rotation';
export type EventTrigger =
  'pinchStart' | 'pinchEnd' | 'gestureEnter' | 'gestureExit' | 'handAppear' | 'handDisappear';
export type TargetScope = 'shape' | 'group';

export const FOLLOW_HAND_SOURCE_OPTIONS: Array<{ value: FollowHandSource; label: string }> = [
  { value: 'indexTip', label: 'Index finger tip' },
  { value: 'palm', label: 'Palm center' },
];

export const AXIS_OPTIONS: Array<{ value: Axis; label: string }> = [
  { value: 'x', label: 'Horizontal (X)' },
  { value: 'y', label: 'Vertical (Y)' },
];

export const PINCH_SOURCE_OPTIONS: Array<{ value: PinchSource; label: string }> = [
  { value: 'pinchStrength', label: 'Pinch strength' },
  { value: 'pinchDistance', label: 'Pinch distance' },
];

export const PINCH_TARGET_PROPERTY_OPTIONS: Array<{ value: PinchTargetProperty; label: string }> = [
  { value: 'opacity', label: 'Opacity' },
  { value: 'scaleX', label: 'Scale (horizontal)' },
  { value: 'scaleY', label: 'Scale (vertical)' },
  { value: 'rotation', label: 'Rotation' },
];

export const EVENT_TRIGGER_OPTIONS: Array<{ value: EventTrigger; label: string }> = [
  { value: 'pinchStart', label: 'Pinch starts' },
  { value: 'pinchEnd', label: 'Pinch ends' },
  { value: 'gestureEnter', label: 'Gesture recognized' },
  { value: 'gestureExit', label: 'Gesture released' },
  { value: 'handAppear', label: 'Hand appears' },
  { value: 'handDisappear', label: 'Hand disappears' },
];

export type FollowHandCard = {
  type: 'followHand';
  id: string;
  source: FollowHandSource;
  axis: Axis;
  handTarget: HandTarget;
  targetScope: TargetScope;
  targetId: string;
};

export type ReactToPinchCard = {
  type: 'reactToPinch';
  id: string;
  source: PinchSource;
  handTarget: HandTarget;
  targetScope: TargetScope;
  targetId: string;
  targetProperty: PinchTargetProperty;
};

export type PulseCard = {
  type: 'pulse';
  id: string;
  trigger: EventTrigger;
  handTarget: HandTarget;
};

export type EmitParticlesCard = {
  type: 'emitParticles';
  id: string;
  trigger: EventTrigger;
  handTarget: HandTarget;
};

export type BehaviorCard = FollowHandCard | ReactToPinchCard | PulseCard | EmitParticlesCard;

/** Same shape as its card, minus `id` — the id is assigned when the card
 * is actually added to a scene (`crypto.randomUUID()`, matching every
 * other scene-graph id in this codebase). */
export type BehaviorCardDraft =
  | Omit<FollowHandCard, 'id'>
  | Omit<ReactToPinchCard, 'id'>
  | Omit<PulseCard, 'id'>
  | Omit<EmitParticlesCard, 'id'>;

type Binding = Record<string, unknown>;
type GraphNode = Record<string, unknown>;
type GraphConnection = Record<string, unknown>;

function followHandSignal(source: FollowHandSource, axis: Axis): string {
  if (source === 'indexTip') return axis === 'x' ? 'indexTipX' : 'indexTipY';
  return axis === 'x' ? 'palmX' : 'palmY';
}

function followHandTargetProperty(axis: Axis): 'positionX' | 'positionY' {
  return axis === 'x' ? 'positionX' : 'positionY';
}

/** Inverse of `followHandSignal`/`followHandTargetProperty` — used by
 * `buildCardsFromScene` to recognize a "Follow hand" binding. Returns
 * `null` when `signal`/`targetProperty` don't form one of the four valid
 * (source, axis) combinations this card type ever produces. */
function parseFollowHandSignal(
  signal: string,
  targetProperty: string,
): { source: FollowHandSource; axis: Axis } | null {
  const table: Array<{
    signal: string;
    targetProperty: string;
    source: FollowHandSource;
    axis: Axis;
  }> = [
    { signal: 'indexTipX', targetProperty: 'positionX', source: 'indexTip', axis: 'x' },
    { signal: 'indexTipY', targetProperty: 'positionY', source: 'indexTip', axis: 'y' },
    { signal: 'palmX', targetProperty: 'positionX', source: 'palm', axis: 'x' },
    { signal: 'palmY', targetProperty: 'positionY', source: 'palm', axis: 'y' },
  ];
  const match = table.find((row) => row.signal === signal && row.targetProperty === targetProperty);
  return match ? { source: match.source, axis: match.axis } : null;
}

/** Channel key a binding occupies: scope + target + property. Two
 * bindings sharing a channel key are competing for the same visual
 * output (`_docs/plan.md`'s "Binding collision rule"). */
export function channelKey(binding: {
  targetScope: unknown;
  targetId: unknown;
  targetProperty: unknown;
}): string {
  return `${String(binding.targetScope)}:${String(binding.targetId ?? 'null')}:${String(binding.targetProperty)}`;
}

/** `event:`-prefixed signals are one-shot triggers; everything else is a
 * continuous value. */
export function isContinuousSignal(signal: string): boolean {
  return !signal.startsWith('event:');
}

function rawBindings(scene: SceneDocument): Binding[] {
  return Array.isArray(scene.bindings) ? (scene.bindings as Binding[]) : [];
}

function rawGraph(scene: SceneDocument): { nodes: GraphNode[]; connections: GraphConnection[] } {
  const graph = scene.graph as { nodes?: unknown; connections?: unknown } | undefined;
  return {
    nodes: Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : [],
    connections: Array.isArray(graph?.connections) ? (graph!.connections as GraphConnection[]) : [],
  };
}

function sceneCanvasSize(scene: SceneDocument): { width: number; height: number } {
  const canvas = scene.canvas as { width?: unknown; height?: unknown } | undefined;
  return {
    width: typeof canvas?.width === 'number' ? canvas.width : 800,
    height: typeof canvas?.height === 'number' ? canvas.height : 600,
  };
}

/** Builds the exact `binding` this card serializes to. Every field here
 * comes straight from `$defs.binding` in `schema/scene.schema.json` — no
 * extra fields, so `additionalProperties: false` always passes. */
export function bindingForCard(card: BehaviorCard, scene: SceneDocument): Binding {
  switch (card.type) {
    case 'followHand': {
      const { width, height } = sceneCanvasSize(scene);
      return {
        id: card.id,
        signal: followHandSignal(card.source, card.axis),
        handTarget: card.handTarget,
        targetScope: card.targetScope,
        targetId: card.targetId,
        targetProperty: followHandTargetProperty(card.axis),
        composition: 'replace',
        mapping: { inMin: 0, inMax: 1, outMin: 0, outMax: card.axis === 'x' ? width : height },
        smoothing: 0.3,
      };
    }
    case 'reactToPinch': {
      const outRangeByProperty: Record<PinchTargetProperty, [number, number]> = {
        opacity: [0, 1],
        scaleX: [0.2, 3],
        scaleY: [0.2, 3],
        rotation: [-180, 180],
      };
      const [outMin, outMax] = outRangeByProperty[card.targetProperty];
      return {
        id: card.id,
        signal: card.source,
        handTarget: card.handTarget,
        targetScope: card.targetScope,
        targetId: card.targetId,
        targetProperty: card.targetProperty,
        composition: 'replace',
        mapping: { inMin: 0, inMax: 1, outMin, outMax },
        smoothing: 0.2,
      };
    }
    case 'pulse':
      return {
        id: card.id,
        signal: `event:${card.trigger}`,
        handTarget: card.handTarget,
        targetScope: 'interaction',
        targetId: null,
        targetProperty: 'triggerPreset',
        composition: 'replace',
      };
    case 'emitParticles':
      return {
        id: card.id,
        signal: `event:${card.trigger}`,
        handTarget: card.handTarget,
        targetScope: 'interaction',
        targetId: null,
        targetProperty: 'emitParticles',
        composition: 'replace',
      };
  }
}

/** Builds the equivalent typed graph nodes/connection for this card,
 * tagged with ids derived from the card's own id so they can always be
 * found again (for removal/replacement) without any extra bookkeeping.
 * `nodeOffset` staggers new nodes' editor-only `position` so cards added
 * one after another don't all stack on top of each other. */
export function graphFragmentForCard(
  card: BehaviorCard,
  nodeOffset: number,
): { nodes: GraphNode[]; connections: GraphConnection[] } {
  const inputId = `input-${card.id}`;
  const actionId = `action-${card.id}`;
  const connectionId = `conn-${card.id}`;
  const inputPosition = { x: nodeOffset * 220, y: 0 };
  const actionPosition = { x: nodeOffset * 220 + 160, y: 0 };

  switch (card.type) {
    case 'followHand': {
      const signal = followHandSignal(card.source, card.axis);
      const property = followHandTargetProperty(card.axis);
      return {
        nodes: [
          {
            id: inputId,
            family: 'input',
            type: 'handSignal',
            params: { signal, handTarget: card.handTarget },
            position: inputPosition,
          },
          {
            id: actionId,
            family: 'visual',
            type: card.targetScope === 'group' ? 'groupProperty' : 'shapeProperty',
            params: { targetId: card.targetId, property },
            position: actionPosition,
          },
        ],
        connections: [
          {
            id: connectionId,
            fromNodeId: inputId,
            fromPort: 'value',
            toNodeId: actionId,
            toPort: 'in',
          },
        ],
      };
    }
    case 'reactToPinch': {
      return {
        nodes: [
          {
            id: inputId,
            family: 'input',
            type: 'handSignal',
            params: { signal: card.source, handTarget: card.handTarget },
            position: inputPosition,
          },
          {
            id: actionId,
            family: 'visual',
            type: card.targetScope === 'group' ? 'groupProperty' : 'shapeProperty',
            params: { targetId: card.targetId, property: card.targetProperty },
            position: actionPosition,
          },
        ],
        connections: [
          {
            id: connectionId,
            fromNodeId: inputId,
            fromPort: 'value',
            toNodeId: actionId,
            toPort: 'in',
          },
        ],
      };
    }
    case 'pulse': {
      return {
        nodes: [
          {
            id: inputId,
            family: 'input',
            type: 'gestureEvent',
            params: { signal: `event:${card.trigger}`, handTarget: card.handTarget },
            position: inputPosition,
          },
          {
            id: actionId,
            family: 'flow',
            type: 'trigger',
            params: { preset: 'pulse' },
            position: actionPosition,
          },
        ],
        connections: [
          {
            id: connectionId,
            fromNodeId: inputId,
            fromPort: 'event',
            toNodeId: actionId,
            toPort: 'trigger',
          },
        ],
      };
    }
    case 'emitParticles': {
      return {
        nodes: [
          {
            id: inputId,
            family: 'input',
            type: 'gestureEvent',
            params: { signal: `event:${card.trigger}`, handTarget: card.handTarget },
            position: inputPosition,
          },
          {
            id: actionId,
            family: 'visual',
            type: 'particleEmitter',
            params: {},
            position: actionPosition,
          },
        ],
        connections: [
          {
            id: connectionId,
            fromNodeId: inputId,
            fromPort: 'event',
            toNodeId: actionId,
            toPort: 'trigger',
          },
        ],
      };
    }
  }
}

/** Reconstructs the card, if any, that a single binding represents. A
 * binding this module didn't create (or a hand-authored/advanced-graph
 * edit that doesn't match one of the four patterns) yields `null` rather
 * than a guessed/partial card. */
function cardFromBinding(binding: Binding): BehaviorCard | null {
  const id = binding.id;
  const signal = binding.signal;
  const handTarget = binding.handTarget;
  const targetScope = binding.targetScope;
  const targetId = binding.targetId;
  const targetProperty = binding.targetProperty;
  if (typeof id !== 'string' || typeof signal !== 'string' || typeof handTarget !== 'string') {
    return null;
  }
  const hand = handTarget as HandTarget;

  if (
    (targetScope === 'shape' || targetScope === 'group') &&
    typeof targetId === 'string' &&
    typeof targetProperty === 'string'
  ) {
    const followMatch = parseFollowHandSignal(signal, targetProperty);
    if (followMatch) {
      return {
        type: 'followHand',
        id,
        source: followMatch.source,
        axis: followMatch.axis,
        handTarget: hand,
        targetScope,
        targetId,
      };
    }
    if (
      (signal === 'pinchStrength' || signal === 'pinchDistance') &&
      (targetProperty === 'opacity' ||
        targetProperty === 'scaleX' ||
        targetProperty === 'scaleY' ||
        targetProperty === 'rotation')
    ) {
      return {
        type: 'reactToPinch',
        id,
        source: signal,
        handTarget: hand,
        targetScope,
        targetId,
        targetProperty,
      };
    }
  }

  if (targetScope === 'interaction' && signal.startsWith('event:')) {
    const trigger = signal.slice('event:'.length) as EventTrigger;
    const isKnownTrigger = EVENT_TRIGGER_OPTIONS.some((option) => option.value === trigger);
    if (isKnownTrigger && targetProperty === 'triggerPreset') {
      return { type: 'pulse', id, trigger, handTarget: hand };
    }
    if (isKnownTrigger && targetProperty === 'emitParticles') {
      return { type: 'emitParticles', id, trigger, handTarget: hand };
    }
  }

  return null;
}

/** Reconstructs every recognizable behavior card from a scene document's
 * `bindings`, in binding order. Round trip: for any scene assembled by
 * `addCardToScene`/`replaceCardInScene`, this returns the same cards back
 * (see `behaviorCards.test.ts`). */
export function buildCardsFromScene(scene: SceneDocument): BehaviorCard[] {
  return rawBindings(scene)
    .map(cardFromBinding)
    .filter((card): card is BehaviorCard => card !== null);
}

/** True once the scene contains any binding whose hand target requires
 * independent left/right tracking — the automatic trigger for Two-hand
 * mode (`_docs/plan.md`: "Two-hand mode activates automatically when
 * users add a two-hand binding."). */
export function sceneHasTwoHandBinding(scene: SceneDocument): boolean {
  return rawBindings(scene).some((binding) => {
    const handTarget = binding.handTarget;
    return typeof handTarget === 'string' && isTwoHandTarget(handTarget as HandTarget);
  });
}

/** Finds the existing continuous binding, if any, that a candidate
 * binding would collide with (same channel, both continuous signals).
 * Event-triggered bindings (Pulse, Emit particles) never collide — only
 * a second *continuous* binding does (this task's acceptance criterion). */
export function findConflict(scene: SceneDocument, candidate: Binding): Binding | null {
  const candidateSignal = candidate.signal;
  if (typeof candidateSignal !== 'string' || !isContinuousSignal(candidateSignal)) return null;
  const key = channelKey(
    candidate as { targetScope: unknown; targetId: unknown; targetProperty: unknown },
  );
  return (
    rawBindings(scene).find((existing) => {
      if (existing.id === candidate.id) return false;
      const existingSignal = existing.signal;
      if (typeof existingSignal !== 'string' || !isContinuousSignal(existingSignal)) return false;
      return (
        channelKey(
          existing as { targetScope: unknown; targetId: unknown; targetProperty: unknown },
        ) === key
      );
    }) ?? null
  );
}

export type Outcome = { ok: true; scene: SceneDocument } | { ok: false; error: string };

export type AddOutcome =
  | { status: 'added'; scene: SceneDocument; card: BehaviorCard }
  | { status: 'conflict'; existingCard: BehaviorCard }
  | { status: 'error'; error: string };

function checkCandidate(scene: SceneDocument): string | null {
  const result = validateScene(scene);
  if (result.valid) return null;
  const limitError = result.errors.find((e) => e.rule === 'limitExceeded');
  return (limitError ?? result.errors[0])?.message ?? 'This change would make the scene invalid.';
}

function withCardAdded(scene: SceneDocument, card: BehaviorCard): SceneDocument {
  const binding = bindingForCard(card, scene);
  const { nodes, connections } = rawGraph(scene);
  const fragment = graphFragmentForCard(card, nodes.length);
  return {
    ...scene,
    bindings: [...rawBindings(scene), binding],
    graph: {
      nodes: [...nodes, ...fragment.nodes],
      connections: [...connections, ...fragment.connections],
    },
  };
}

function withCardRemoved(scene: SceneDocument, cardId: string): SceneDocument {
  const { nodes, connections } = rawGraph(scene);
  const removedNodeIds = new Set([`input-${cardId}`, `action-${cardId}`]);
  const nextNodes = nodes.filter((node) => !removedNodeIds.has(String(node.id)));
  const nextConnections = connections.filter(
    (connection) =>
      !removedNodeIds.has(String(connection.fromNodeId)) &&
      !removedNodeIds.has(String(connection.toNodeId)),
  );
  return {
    ...scene,
    bindings: rawBindings(scene).filter((binding) => binding.id !== cardId),
    graph: { nodes: nextNodes, connections: nextConnections },
  };
}

/** Adds a new card (freshly assigned id) to the scene. Returns a
 * `conflict` outcome — never a silent overwrite — when the card's
 * binding would occupy a target channel an existing *continuous* binding
 * already holds (this task's acceptance criterion); the caller must call
 * `replaceCardInScene` with the same draft to proceed. */
export function addCardToScene(scene: SceneDocument, draft: BehaviorCardDraft): AddOutcome {
  const id = crypto.randomUUID();
  const card = { ...draft, id } as BehaviorCard;
  const binding = bindingForCard(card, scene);
  const conflict = findConflict(scene, binding);
  if (conflict) {
    const existingCard = cardFromBinding(conflict);
    if (existingCard) return { status: 'conflict', existingCard };
    // A colliding binding that isn't itself a recognizable card (e.g.
    // hand-authored) still must not be silently overwritten — but there's
    // no card-shaped explanation to hand back, so this is treated as a
    // hard error the caller surfaces as-is rather than a resolvable
    // conflict.
    return { status: 'error', error: 'This target already has a conflicting binding.' };
  }
  const nextScene = withCardAdded(scene, card);
  const error = checkCandidate(nextScene);
  if (error) return { status: 'error', error };
  return { status: 'added', scene: nextScene, card };
}

/** Removes `oldCardId`'s binding/graph fragment and adds `draft` as a new
 * card in one step — the explicit "replace" the conflict prompt performs
 * once the user confirms (never automatic). */
export function replaceCardInScene(
  scene: SceneDocument,
  oldCardId: string,
  draft: BehaviorCardDraft,
): Outcome {
  const withoutOld = withCardRemoved(scene, oldCardId);
  const id = crypto.randomUUID();
  const card = { ...draft, id } as BehaviorCard;
  const nextScene = withCardAdded(withoutOld, card);
  const error = checkCandidate(nextScene);
  if (error) return { ok: false, error };
  return { ok: true, scene: nextScene };
}

export function removeCardFromScene(scene: SceneDocument, cardId: string): Outcome {
  const nextScene = withCardRemoved(scene, cardId);
  const error = checkCandidate(nextScene);
  if (error) return { ok: false, error };
  return { ok: true, scene: nextScene };
}

/** Plain-language "signal → target" sentence for a card, as required by
 * this task's acceptance criteria. `targetName` is resolved by the
 * caller (a shape/group's display name), since this module doesn't have
 * access to the scene's shape/group list. */
export function describeCard(card: BehaviorCard, targetName?: string): string {
  const handLabel =
    HAND_TARGET_OPTIONS.find((o) => o.value === card.handTarget)?.label ?? card.handTarget;
  switch (card.type) {
    case 'followHand': {
      const sourceLabel =
        FOLLOW_HAND_SOURCE_OPTIONS.find((o) => o.value === card.source)?.label ?? card.source;
      const axisLabel = card.axis === 'x' ? 'horizontal' : 'vertical';
      return `When the ${handLabel.toLowerCase()}'s ${sourceLabel.toLowerCase()} moves, ${targetName ?? 'the target'} follows on the ${axisLabel} axis.`;
    }
    case 'reactToPinch': {
      const sourceLabel =
        PINCH_SOURCE_OPTIONS.find((o) => o.value === card.source)?.label ?? card.source;
      const propertyLabel =
        PINCH_TARGET_PROPERTY_OPTIONS.find((o) => o.value === card.targetProperty)?.label ??
        card.targetProperty;
      return `When the ${handLabel.toLowerCase()}'s ${sourceLabel.toLowerCase()} changes, set ${targetName ?? 'the target'}'s ${propertyLabel.toLowerCase()}.`;
    }
    case 'pulse': {
      const triggerLabel =
        EVENT_TRIGGER_OPTIONS.find((o) => o.value === card.trigger)?.label ?? card.trigger;
      return `When the ${handLabel.toLowerCase()}'s ${triggerLabel.toLowerCase()}, pulse the scene.`;
    }
    case 'emitParticles': {
      const triggerLabel =
        EVENT_TRIGGER_OPTIONS.find((o) => o.value === card.trigger)?.label ?? card.trigger;
      return `When the ${handLabel.toLowerCase()}'s ${triggerLabel.toLowerCase()}, emit particles.`;
    }
  }
}

export const CARD_TYPE_LABELS: Record<BehaviorCard['type'], string> = {
  followHand: 'Follow hand',
  reactToPinch: 'React to pinch',
  pulse: 'Pulse',
  emitParticles: 'Emit particles',
};
