import { useEffect, useState } from 'react';

import { useAlertDialogFocus } from '../a11y/useAlertDialogFocus';
import { useRovingRadioGroup } from '../a11y/useRovingRadioGroup';
import {
  AXIS_OPTIONS,
  CARD_TYPE_LABELS,
  EVENT_TRIGGER_OPTIONS,
  FOLLOW_HAND_SOURCE_OPTIONS,
  HAND_TARGET_OPTIONS,
  PINCH_SOURCE_OPTIONS,
  PINCH_TARGET_PROPERTY_OPTIONS,
  describeCard,
  isTwoHandTarget,
  type Axis,
  type BehaviorCard,
  type BehaviorCardDraft,
  type EventTrigger,
  type FollowHandSource,
  type HandTarget,
  type PinchSource,
  type PinchTargetProperty,
  type TargetScope,
} from './behaviorCards';
import { shapeLabel } from './sceneShapes';
import type { SceneEditor } from './useSceneEditor';

type CardTypeName = BehaviorCard['type'];

const CARD_TYPE_OPTIONS: CardTypeName[] = ['followHand', 'reactToPinch', 'pulse', 'emitParticles'];

type TargetOption = { id: string; scope: TargetScope; label: string };

/**
 * Task 64 (issue #64): the "target already has a binding" conflict prompt,
 * as its own component so `useAlertDialogFocus` (focus-into-dialog on
 * open, Escape cancels rather than confirming the replacement, focus
 * returns to the trigger on close) runs for exactly this dialog's own
 * mount/unmount lifecycle — see that hook's doc comment.
 */
function CardConflictDialog({
  description,
  onReplace,
  onCancel,
}: {
  description: string;
  onReplace: () => void;
  onCancel: () => void;
}) {
  const { dialogRef, onKeyDown } = useAlertDialogFocus<HTMLDivElement>(onCancel);
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      role="alertdialog"
      aria-labelledby="behavior-card-conflict-title"
      className="behavior-card-conflict"
    >
      <h5 id="behavior-card-conflict-title">Target already has a binding</h5>
      <p>{description} already controls this channel. Adding this card will replace it.</p>
      <button type="button" onClick={onReplace}>
        Replace existing binding
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function targetOptionsFor(sceneEditor: SceneEditor): TargetOption[] {
  return [
    ...sceneEditor.shapes.map((shape) => ({
      id: shape.id,
      scope: 'shape' as const,
      label: shapeLabel(shape, sceneEditor.shapes),
    })),
    ...sceneEditor.groups.map((group) => ({
      id: group.id,
      scope: 'group' as const,
      label: `group: ${group.name}`,
    })),
  ];
}

/**
 * Task 34: the behavior-card editing panel. Cards ("Follow hand," "React
 * to pinch," "Pulse," "Emit particles" — `_docs/plan.md`'s "Progressive
 * disclosure" section) are the readable, sentence-shaped alternative to
 * editing bindings/graph nodes directly; all card logic (serialization,
 * round trip, conflict detection) lives in `behaviorCards.ts` and
 * `useSceneEditor.ts` — this component is presentation plus the small
 * amount of local draft-form state needed before a card is actually
 * added.
 *
 * Rendered in the editor's Inspector panel alongside per-shape properties
 * (a later task); it only needs `sceneEditor`, so it doesn't care which
 * panel it's mounted in.
 */
function BehaviorCardsPanel({ sceneEditor }: { sceneEditor: SceneEditor }) {
  const targetOptions = targetOptionsFor(sceneEditor);
  const [cardType, setCardType] = useState<CardTypeName>('followHand');
  const [handTarget, setHandTarget] = useState<HandTarget>('primary');
  const [followSource, setFollowSource] = useState<FollowHandSource>('indexTip');
  const [followAxis, setFollowAxis] = useState<Axis>('x');
  const [pinchSource, setPinchSource] = useState<PinchSource>('pinchStrength');
  const [pinchProperty, setPinchProperty] = useState<PinchTargetProperty>('opacity');
  const [eventTrigger, setEventTrigger] = useState<EventTrigger>('pinchStart');
  const [targetKey, setTargetKey] = useState<string>(targetOptions[0]?.id ?? '');
  // Task 34: default is One-hand (Primary) mode; a two-hand binding
  // (handTarget left/right) flips this to Two-hand automatically and it
  // stays there even if that binding is later removed, without touching
  // any existing Primary-hand binding — switching modes never mutates
  // `bindings` itself, this is purely which options/explanation the panel
  // shows. A manual switch (segmented control below) can also opt in
  // early, before any two-hand binding exists.
  const [manualTwoHand, setManualTwoHand] = useState(false);

  const handMode: 'primary' | 'two' =
    manualTwoHand || sceneEditor.hasTwoHandBinding ? 'two' : 'primary';

  const handModeRoving = useRovingRadioGroup(
    [{ value: 'primary' as const }, { value: 'two' as const }],
    handMode,
    (value) => setManualTwoHand(value === 'two'),
  );
  const cardTypeRoving = useRovingRadioGroup(
    CARD_TYPE_OPTIONS.map((type) => ({ value: type })),
    cardType,
    setCardType,
  );

  // Issue #116: `targetKey`'s useState initializer only ever runs once, at
  // mount. If this panel first mounts before any shape/group exists (its
  // "Behaviors" CollapsibleSection can be opened at any time, independent
  // of when shapes are added), `targetOptions` is empty then, and
  // `targetKey` is stuck at `''` forever -- `selectedTarget` never
  // resolves even after a shape is added, permanently disabling "Add
  // card" for `followHand`/`reactToPinch` with no visible explanation.
  // Re-sync whenever the currently selected id stops being a valid option
  // (empty because nothing existed yet, or the previously-selected
  // shape/group was since deleted) but options are available again.
  const targetOptionIds = targetOptions.map((option) => option.id).join(',');
  useEffect(() => {
    if (targetOptions.length === 0) return;
    if (targetOptions.some((option) => option.id === targetKey)) return;
    setTargetKey(targetOptions[0].id);
    // Keyed on the stable id-list string, not `targetOptions` itself (a
    // fresh array every render) or `targetKey` (would fight this effect's
    // own update) -- see the comment above for what this corrects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetOptionIds]);

  const selectedTarget = targetOptions.find((option) => option.id === targetKey) ?? null;
  const needsTarget = cardType === 'followHand' || cardType === 'reactToPinch';

  function buildDraft(): BehaviorCardDraft | null {
    switch (cardType) {
      case 'followHand': {
        if (!selectedTarget) return null;
        return {
          type: 'followHand',
          source: followSource,
          axis: followAxis,
          handTarget,
          targetScope: selectedTarget.scope,
          targetId: selectedTarget.id,
        };
      }
      case 'reactToPinch': {
        if (!selectedTarget) return null;
        return {
          type: 'reactToPinch',
          source: pinchSource,
          handTarget,
          targetScope: selectedTarget.scope,
          targetId: selectedTarget.id,
          targetProperty: pinchProperty,
        };
      }
      case 'pulse':
        return { type: 'pulse', trigger: eventTrigger, handTarget };
      case 'emitParticles':
        return { type: 'emitParticles', trigger: eventTrigger, handTarget };
    }
  }

  function handleAdd() {
    const draft = buildDraft();
    if (!draft) return;
    if (isTwoHandTarget(draft.handTarget)) setManualTwoHand(true);
    sceneEditor.addBehaviorCard(draft);
  }

  const draftPreview = buildDraft();
  const canAdd = draftPreview !== null;

  return (
    <div className="behavior-cards-panel">
      <h4>Behavior cards</h4>
      <p>
        Compose gesture behaviors as plain-language cards. Each card reads as a sentence and
        serializes to the scene's bindings and graph data.
      </p>

      <div role="radiogroup" aria-label="Hand mode" className="editor-tool-group">
        <button
          type="button"
          role="radio"
          aria-checked={handMode === 'primary'}
          onClick={() => setManualTwoHand(false)}
          {...handModeRoving.getRadioProps('primary')}
        >
          Hands: One
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={handMode === 'two'}
          onClick={() => setManualTwoHand(true)}
          {...handModeRoving.getRadioProps('two')}
        >
          Hands: Two
        </button>
      </div>
      {handMode === 'two' && (
        <p role="status" className="hand-mode-explanation">
          Use left and right hand signals independently. Existing Primary-hand cards keep working
          unchanged.
        </p>
      )}

      <form
        aria-label="Add a behavior card"
        onSubmit={(event) => {
          event.preventDefault();
          handleAdd();
        }}
      >
        <div role="radiogroup" aria-label="Card type" className="editor-tool-group">
          {CARD_TYPE_OPTIONS.map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={cardType === type}
              onClick={() => setCardType(type)}
              {...cardTypeRoving.getRadioProps(type)}
            >
              {CARD_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {(cardType === 'followHand' || cardType === 'reactToPinch') && (
          <div className="behavior-card-field">
            <label htmlFor="behavior-card-target">Target</label>
            <select
              id="behavior-card-target"
              value={targetKey}
              onChange={(event) => setTargetKey(event.target.value)}
            >
              {targetOptions.length === 0 && <option value="">No shapes or groups yet</option>}
              {targetOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {cardType === 'followHand' && (
          <>
            <div className="behavior-card-field">
              <label htmlFor="behavior-card-follow-source">Hand signal</label>
              <select
                id="behavior-card-follow-source"
                value={followSource}
                onChange={(event) => setFollowSource(event.target.value as FollowHandSource)}
              >
                {FOLLOW_HAND_SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="behavior-card-field">
              <label htmlFor="behavior-card-follow-axis">Axis</label>
              <select
                id="behavior-card-follow-axis"
                value={followAxis}
                onChange={(event) => setFollowAxis(event.target.value as Axis)}
              >
                {AXIS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {cardType === 'reactToPinch' && (
          <>
            <div className="behavior-card-field">
              <label htmlFor="behavior-card-pinch-source">Pinch signal</label>
              <select
                id="behavior-card-pinch-source"
                value={pinchSource}
                onChange={(event) => setPinchSource(event.target.value as PinchSource)}
              >
                {PINCH_SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="behavior-card-field">
              <label htmlFor="behavior-card-pinch-property">Visual channel</label>
              <select
                id="behavior-card-pinch-property"
                value={pinchProperty}
                onChange={(event) => setPinchProperty(event.target.value as PinchTargetProperty)}
              >
                {PINCH_TARGET_PROPERTY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {(cardType === 'pulse' || cardType === 'emitParticles') && (
          <div className="behavior-card-field">
            <label htmlFor="behavior-card-event">Gesture event</label>
            <select
              id="behavior-card-event"
              value={eventTrigger}
              onChange={(event) => setEventTrigger(event.target.value as EventTrigger)}
            >
              {EVENT_TRIGGER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="behavior-card-field">
          <label htmlFor="behavior-card-hand-target">Hand target</label>
          <select
            id="behavior-card-hand-target"
            value={handTarget}
            onChange={(event) => setHandTarget(event.target.value as HandTarget)}
          >
            {HAND_TARGET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {draftPreview && (
          <p className="behavior-card-preview">
            Preview:{' '}
            {describeCard(
              { ...draftPreview, id: 'preview' } as BehaviorCard,
              selectedTarget?.label,
            )}
          </p>
        )}

        <button type="submit" disabled={!canAdd || (needsTarget && targetOptions.length === 0)}>
          Add card
        </button>
      </form>

      {sceneEditor.cardConflict && (
        <CardConflictDialog
          description={describeCard(sceneEditor.cardConflict.existingCard)}
          onReplace={() => sceneEditor.confirmReplaceCard()}
          onCancel={() => sceneEditor.cancelCardConflict()}
        />
      )}

      {sceneEditor.cardError && (
        <p role="alert" aria-live="assertive">
          {sceneEditor.cardError}
        </p>
      )}

      <h5>Cards in this scene</h5>
      {sceneEditor.behaviorCards.length === 0 ? (
        <p>No behavior cards yet.</p>
      ) : (
        <ul aria-label="Behavior card list" className="behavior-card-list">
          {sceneEditor.behaviorCards.map((card) => {
            const targetName =
              card.type === 'followHand' || card.type === 'reactToPinch'
                ? (targetOptions.find((option) => option.id === card.targetId)?.label ??
                  card.targetId)
                : undefined;
            return (
              <li key={card.id}>
                <span className="behavior-card-type">{CARD_TYPE_LABELS[card.type]}</span>
                <p>{describeCard(card, targetName)}</p>
                <button type="button" onClick={() => sceneEditor.removeBehaviorCard(card.id)}>
                  Remove card
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default BehaviorCardsPanel;
