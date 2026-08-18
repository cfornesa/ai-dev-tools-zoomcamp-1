import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import type { BehaviorCard, BehaviorCardDraft, FollowHandCard } from './behaviorCards';
import { useSceneEditor } from './useSceneEditor';

function asFollowHand(card: BehaviorCard): FollowHandCard {
  if (card.type !== 'followHand') throw new Error(`expected a followHand card, got ${card.type}`);
  return card;
}

/**
 * Task 34: hook-level tests for `useSceneEditor`'s behavior-card wiring —
 * add/replace/remove going through the same commit()/undo/redo history as
 * every other scene mutation, and the conflict flow never silently
 * overwriting. See `behaviorCards.test.ts` for the underlying pure-logic
 * tests and `EditorWorkspace.behaviorCards.test.tsx` for the rendered UI.
 */

const SCENE_WITH_SHAPE: SceneDocument = {
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
};

const followHandDraft: BehaviorCardDraft = {
  type: 'followHand',
  source: 'indexTip',
  axis: 'x',
  handTarget: 'primary',
  targetScope: 'shape',
  targetId: 'shape-1',
};

function renderSceneEditor(initial: SceneDocument = structuredClone(SCENE_WITH_SHAPE)) {
  return renderHook(() => {
    const [workingCopy, setWorkingCopy] = useState<SceneDocument | null>(initial);
    const editor = useSceneEditor(workingCopy, setWorkingCopy);
    return { workingCopy, ...editor };
  });
}

describe('useSceneEditor behavior cards', () => {
  it('starts with no cards and Primary-hand mode', () => {
    const { result } = renderSceneEditor();
    expect(result.current.behaviorCards).toEqual([]);
    expect(result.current.hasTwoHandBinding).toBe(false);
  });

  it('adds a card as a single undoable step', () => {
    const { result } = renderSceneEditor();
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.addBehaviorCard(followHandDraft));
    expect(result.current.behaviorCards).toHaveLength(1);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.behaviorCards).toHaveLength(0);

    act(() => result.current.redo());
    expect(result.current.behaviorCards).toHaveLength(1);
  });

  it('a colliding continuous binding sets cardConflict instead of committing', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addBehaviorCard(followHandDraft));
    expect(result.current.behaviorCards).toHaveLength(1);

    act(() => result.current.addBehaviorCard({ ...followHandDraft, source: 'palm' }));
    expect(result.current.cardConflict).not.toBeNull();
    // No silent overwrite: still exactly the original card.
    expect(result.current.behaviorCards).toHaveLength(1);
    expect(asFollowHand(result.current.behaviorCards[0]).source).toBe('indexTip');
  });

  it('confirmReplaceCard performs the replace and clears the conflict', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addBehaviorCard(followHandDraft));
    act(() => result.current.addBehaviorCard({ ...followHandDraft, source: 'palm' }));
    expect(result.current.cardConflict).not.toBeNull();

    act(() => result.current.confirmReplaceCard());
    expect(result.current.cardConflict).toBeNull();
    expect(result.current.behaviorCards).toHaveLength(1);
    expect(asFollowHand(result.current.behaviorCards[0]).source).toBe('palm');
  });

  it('cancelCardConflict discards the pending draft without touching the scene', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addBehaviorCard(followHandDraft));
    act(() => result.current.addBehaviorCard({ ...followHandDraft, source: 'palm' }));
    expect(result.current.cardConflict).not.toBeNull();

    act(() => result.current.cancelCardConflict());
    expect(result.current.cardConflict).toBeNull();
    expect(result.current.behaviorCards).toHaveLength(1);
    expect(asFollowHand(result.current.behaviorCards[0]).source).toBe('indexTip');
  });

  it('removeBehaviorCard removes the card as a single undoable step', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addBehaviorCard(followHandDraft));
    const cardId = result.current.behaviorCards[0].id;

    act(() => result.current.removeBehaviorCard(cardId));
    expect(result.current.behaviorCards).toEqual([]);

    act(() => result.current.undo());
    expect(result.current.behaviorCards).toHaveLength(1);
  });

  it('adding a left/right-hand card flips hasTwoHandBinding without touching existing Primary-hand cards', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addBehaviorCard(followHandDraft));
    const primaryCardBefore = result.current.behaviorCards[0];
    expect(result.current.hasTwoHandBinding).toBe(false);

    act(() =>
      result.current.addBehaviorCard({
        type: 'reactToPinch',
        source: 'pinchStrength',
        handTarget: 'right',
        targetScope: 'shape',
        targetId: 'shape-1',
        targetProperty: 'scaleX',
      }),
    );

    expect(result.current.hasTwoHandBinding).toBe(true);
    const primaryCardAfter = result.current.behaviorCards.find(
      (c) => c.id === primaryCardBefore.id,
    );
    expect(primaryCardAfter).toEqual(primaryCardBefore);
  });
});
