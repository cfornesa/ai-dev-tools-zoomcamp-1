import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { validateScene } from '../validation/scene';
import {
  addCardToScene,
  bindingForCard,
  buildCardsFromScene,
  channelKey,
  findConflict,
  graphFragmentForCard,
  isContinuousSignal,
  removeCardFromScene,
  replaceCardInScene,
  sceneHasTwoHandBinding,
  type BehaviorCard,
  type BehaviorCardDraft,
} from './behaviorCards';

/**
 * Task 34: pure-logic tests for behavior-card serialization, round trip,
 * and conflict detection. `useSceneEditor.behaviorCards.test.ts` covers
 * the hook wiring (undo/redo, conflict state) and
 * `EditorWorkspace.behaviorCards.test.tsx` covers the rendered,
 * keyboard-operable UI.
 */

function baseScene(overrides: Partial<SceneDocument> = {}): SceneDocument {
  return {
    schemaVersion: 1,
    id: 'scene-1',
    canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
    renderer: { preferred: 'p5' },
    layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
    shapes: [
      {
        id: 'shape-1',
        type: 'circle',
        layerId: 'layer-1',
        groupId: null,
        transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        style: { fill: '#4f46e5', stroke: null, strokeWidth: 0 },
        radius: 50,
      },
    ],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
    ...overrides,
  };
}

const followHandDraft: BehaviorCardDraft = {
  type: 'followHand',
  source: 'indexTip',
  axis: 'x',
  handTarget: 'primary',
  targetScope: 'shape',
  targetId: 'shape-1',
};

const reactToPinchDraft: BehaviorCardDraft = {
  type: 'reactToPinch',
  source: 'pinchStrength',
  handTarget: 'primary',
  targetScope: 'shape',
  targetId: 'shape-1',
  targetProperty: 'opacity',
};

const pulseDraft: BehaviorCardDraft = {
  type: 'pulse',
  trigger: 'pinchStart',
  handTarget: 'primary',
};

const emitParticlesDraft: BehaviorCardDraft = {
  type: 'emitParticles',
  trigger: 'gestureEnter',
  handTarget: 'primary',
};

describe('isContinuousSignal', () => {
  it('treats event:-prefixed signals as one-shot, everything else as continuous', () => {
    expect(isContinuousSignal('indexTipX')).toBe(true);
    expect(isContinuousSignal('pinchStrength')).toBe(true);
    expect(isContinuousSignal('gestureState:openPalm')).toBe(true);
    expect(isContinuousSignal('handDistance')).toBe(true);
    expect(isContinuousSignal('event:pinchStart')).toBe(false);
    expect(isContinuousSignal('event:handsBecameClose')).toBe(false);
  });
});

describe('channelKey', () => {
  it('combines scope, target, and property', () => {
    expect(channelKey({ targetScope: 'shape', targetId: 's1', targetProperty: 'opacity' })).toBe(
      'shape:s1:opacity',
    );
    expect(
      channelKey({ targetScope: 'interaction', targetId: null, targetProperty: 'emitParticles' }),
    ).toBe('interaction:null:emitParticles');
  });
});

describe('bindingForCard / graphFragmentForCard', () => {
  it('serializes a Follow hand card to a schema-shaped continuous binding', () => {
    const scene = baseScene();
    const card: BehaviorCard = { ...followHandDraft, id: 'card-1' };
    const binding = bindingForCard(card, scene);
    expect(binding).toMatchObject({
      id: 'card-1',
      signal: 'indexTipX',
      handTarget: 'primary',
      targetScope: 'shape',
      targetId: 'shape-1',
      targetProperty: 'positionX',
      composition: 'replace',
    });
  });

  it('serializes React to pinch, Pulse, and Emit particles to their documented signal/target shapes', () => {
    const scene = baseScene();
    expect(bindingForCard({ ...reactToPinchDraft, id: 'c2' }, scene)).toMatchObject({
      signal: 'pinchStrength',
      targetProperty: 'opacity',
      targetScope: 'shape',
    });
    expect(bindingForCard({ ...pulseDraft, id: 'c3' }, scene)).toMatchObject({
      signal: 'event:pinchStart',
      targetScope: 'interaction',
      targetId: null,
      targetProperty: 'triggerPreset',
    });
    expect(bindingForCard({ ...emitParticlesDraft, id: 'c4' }, scene)).toMatchObject({
      signal: 'event:gestureEnter',
      targetScope: 'interaction',
      targetId: null,
      targetProperty: 'emitParticles',
    });
  });

  it('produces referentially-consistent graph node ids/connections for a card', () => {
    const card: BehaviorCard = { ...followHandDraft, id: 'card-1' };
    const { nodes, connections } = graphFragmentForCard(card, 0);
    expect(nodes.map((n) => n.id)).toEqual(['input-card-1', 'action-card-1']);
    expect(connections).toHaveLength(1);
    expect(connections[0]).toMatchObject({
      fromNodeId: 'input-card-1',
      toNodeId: 'action-card-1',
    });
  });
});

describe('addCardToScene / buildCardsFromScene round trip', () => {
  it.each([
    ['followHand', followHandDraft],
    ['reactToPinch', reactToPinchDraft],
    ['pulse', pulseDraft],
    ['emitParticles', emitParticlesDraft],
  ] as const)(
    'adds a %s card that reconstructs identically after a save/reload cycle',
    (_, draft) => {
      const scene = baseScene();
      const outcome = addCardToScene(scene, draft);
      expect(outcome.status).toBe('added');
      if (outcome.status !== 'added') return;

      // "Save/reload": serialize to JSON and back, exactly what persisting
      // and refetching a scene version does.
      const reloaded = JSON.parse(JSON.stringify(outcome.scene)) as SceneDocument;
      expect(validateScene(reloaded).valid).toBe(true);

      const cards = buildCardsFromScene(reloaded);
      expect(cards).toHaveLength(1);
      expect(cards[0]).toEqual(outcome.card);
    },
  );

  it('adding a card also writes its equivalent graph nodes/connections, preserved across reload', () => {
    const scene = baseScene();
    const outcome = addCardToScene(scene, followHandDraft);
    expect(outcome.status).toBe('added');
    if (outcome.status !== 'added') return;
    const reloaded = JSON.parse(JSON.stringify(outcome.scene)) as SceneDocument;
    const graph = reloaded.graph as { nodes: unknown[]; connections: unknown[] };
    expect(graph.nodes).toHaveLength(2);
    expect(graph.connections).toHaveLength(1);
  });

  it('several cards of different types all round trip together', () => {
    let scene = baseScene();
    for (const draft of [followHandDraft, reactToPinchDraft, pulseDraft, emitParticlesDraft]) {
      const outcome = addCardToScene(scene, draft);
      expect(outcome.status).toBe('added');
      if (outcome.status === 'added') scene = outcome.scene;
    }
    expect(validateScene(scene).valid).toBe(true);
    const reloaded = JSON.parse(JSON.stringify(scene)) as SceneDocument;
    const cards = buildCardsFromScene(reloaded);
    expect(cards.map((c) => c.type).sort()).toEqual(
      ['emitParticles', 'followHand', 'pulse', 'reactToPinch'].sort(),
    );
  });

  it('ignores a binding that does not match any known card pattern', () => {
    const scene = baseScene({
      bindings: [
        {
          id: 'hand-authored',
          signal: 'handDepth',
          handTarget: 'primary',
          targetScope: 'scene',
          targetId: null,
          targetProperty: 'backgroundColor',
          composition: 'replace',
        },
      ],
    });
    expect(buildCardsFromScene(scene)).toEqual([]);
  });
});

describe('conflict detection', () => {
  it('flags a second continuous binding on the same target channel and requires explicit replacement', () => {
    const scene = baseScene();
    const first = addCardToScene(scene, followHandDraft);
    expect(first.status).toBe('added');
    if (first.status !== 'added') return;

    // Same signal family/axis -> same channel (shape-1's positionX).
    const second = addCardToScene(first.scene, {
      ...followHandDraft,
      source: 'palm', // different source, same axis -> same targetProperty (positionX)
    });
    expect(second.status).toBe('conflict');
    if (second.status !== 'conflict') return;
    expect(second.existingCard.id).toBe(first.card.id);

    // The scene must be untouched — no silent overwrite.
    expect(buildCardsFromScene(first.scene)).toHaveLength(1);
  });

  it('replaceCardInScene performs the explicit replace once confirmed', () => {
    const scene = baseScene();
    const first = addCardToScene(scene, followHandDraft);
    if (first.status !== 'added') throw new Error('expected added');

    const replaced = replaceCardInScene(first.scene, first.card.id, {
      ...followHandDraft,
      source: 'palm',
    });
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) return;
    const cards = buildCardsFromScene(replaced.scene);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ type: 'followHand', source: 'palm' });
    // The old binding's graph fragment is gone, not left dangling.
    const graph = replaced.scene.graph as { nodes: unknown[] };
    expect(graph.nodes).toHaveLength(2);
  });

  it('does not conflict when target channels differ', () => {
    const scene = baseScene();
    const first = addCardToScene(scene, followHandDraft); // positionX
    if (first.status !== 'added') throw new Error('expected added');
    const second = addCardToScene(first.scene, { ...followHandDraft, axis: 'y' }); // positionY
    expect(second.status).toBe('added');
  });

  it('never flags a conflict for event-triggered cards (Pulse, Emit particles)', () => {
    const scene = baseScene();
    const first = addCardToScene(scene, pulseDraft);
    if (first.status !== 'added') throw new Error('expected added');
    const second = addCardToScene(first.scene, pulseDraft);
    // Two Pulse cards on the same trigger both target interaction/triggerPreset,
    // but the trigger signal is event-prefixed (one-shot), so this must not
    // be treated as a competing continuous binding.
    expect(second.status).toBe('added');
  });

  it('findConflict returns null for two event bindings on the same channel', () => {
    const scene = baseScene();
    const first = addCardToScene(scene, emitParticlesDraft);
    if (first.status !== 'added') throw new Error('expected added');
    const candidateBinding = bindingForCard({ ...emitParticlesDraft, id: 'other' }, first.scene);
    expect(findConflict(first.scene, candidateBinding)).toBeNull();
  });
});

describe('removeCardFromScene', () => {
  it('removes a card and its graph fragment, leaving the scene valid', () => {
    const scene = baseScene();
    const added = addCardToScene(scene, followHandDraft);
    if (added.status !== 'added') throw new Error('expected added');
    const removed = removeCardFromScene(added.scene, added.card.id);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(buildCardsFromScene(removed.scene)).toEqual([]);
    const graph = removed.scene.graph as { nodes: unknown[]; connections: unknown[] };
    expect(graph.nodes).toEqual([]);
    expect(graph.connections).toEqual([]);
    expect(validateScene(removed.scene).valid).toBe(true);
  });
});

describe('sceneHasTwoHandBinding', () => {
  it('is false for a scene with only primary/either bindings', () => {
    const scene = baseScene();
    const withPrimary = addCardToScene(scene, followHandDraft);
    if (withPrimary.status !== 'added') throw new Error('expected added');
    const withEither = addCardToScene(withPrimary.scene, {
      ...reactToPinchDraft,
      handTarget: 'either',
    });
    if (withEither.status !== 'added') throw new Error('expected added');
    expect(sceneHasTwoHandBinding(withEither.scene)).toBe(false);
  });

  it('is true once a binding targets left or right hand independently', () => {
    const scene = baseScene();
    const added = addCardToScene(scene, { ...reactToPinchDraft, handTarget: 'left' });
    if (added.status !== 'added') throw new Error('expected added');
    expect(sceneHasTwoHandBinding(added.scene)).toBe(true);
  });

  it('activating two-hand mode never alters an existing Primary-hand binding', () => {
    const scene = baseScene();
    const primaryCard = addCardToScene(scene, followHandDraft);
    if (primaryCard.status !== 'added') throw new Error('expected added');
    const before = buildCardsFromScene(primaryCard.scene)[0];

    const twoHandCard = addCardToScene(primaryCard.scene, {
      ...reactToPinchDraft,
      handTarget: 'right',
    });
    if (twoHandCard.status !== 'added') throw new Error('expected added');

    expect(sceneHasTwoHandBinding(twoHandCard.scene)).toBe(true);
    const after = buildCardsFromScene(twoHandCard.scene).find((c) => c.id === before.id);
    expect(after).toEqual(before);
  });
});
