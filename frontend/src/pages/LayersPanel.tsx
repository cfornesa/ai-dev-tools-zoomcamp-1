import { useEffect, useState, type DragEvent as ReactDragEvent, type ReactNode } from 'react';

import type { SceneDocument } from '../api/projects';
import {
  moveItemToGroup as moveItemToGroupOp,
  moveItemToLayer as moveItemToLayerOp,
  type OutlineRow,
} from './sceneOutline';
import type { ShapeType } from './sceneShapes';
import { getColorFieldValue } from './shapeStyleFields';
import type { SceneEditor } from './useSceneEditor';

/** Issue #131: moved here verbatim from `EditorWorkspace.tsx`'s Tools
 * panel, which used to render these four buttons above a `CollapsibleSection
 * heading="Add & edit shapes"` that also duplicated this panel's own shape
 * listing. Creation now lives alongside the listing it populates — see this
 * file's own doc comment above and issue #131 for the full rationale. */
const SHAPE_TYPES: Array<{ type: ShapeType; label: string }> = [
  { type: 'circle', label: 'Add circle' },
  { type: 'rect', label: 'Add rectangle' },
  { type: 'line', label: 'Add line' },
  { type: 'path', label: 'Add polygon' },
];

/**
 * Issue #127: `SceneOutlinePanel.tsx` (Task 24, extended by Tasks 76/80)
 * renamed to `LayersPanel.tsx` and promoted from a `CollapsibleSection`
 * buried inside the Tools panel to its own dedicated, always-reachable
 * landmark panel (`role="region" aria-label="Layers"`, rendered by
 * `EditorWorkspace.tsx` alongside Details/Tools/Preview/Inspector — see
 * that file's `editor-panel[data-panel='layers']` section and
 * `EditorPanelSwitcher.tsx`'s `'layers'` tab for narrow viewports).
 *
 * All state and mutation still live in `useSceneEditor` — this component
 * remains presentation-only, reusing the exact same `buildOutline`-derived
 * `sceneEditor.outline` rows and the exact same `moveItem`/`moveLayer`/
 * `moveItemToLayer`/`moveItemToGroup`/toggle/rename/group mutations
 * `SceneOutlinePanel.tsx` already called. The only net-new capability here
 * is pointer drag-and-drop reordering/reparenting, built entirely on top
 * of those existing mutations (see "Drag-and-drop mechanics" below) rather
 * than a second, parallel scene-mutation implementation. Every keyboard
 * control this file already had (Move up/down, the target-select "Move to
 * layer"/"Move to group" pair) is unchanged and carries over verbatim —
 * dragging is additive, not a replacement, and reaches no position those
 * controls couldn't already reach.
 *
 * ## Drag-and-drop mechanics
 *
 * No new dependency is used (per `AGENTS.md`'s "no new dependency without
 * asking" rule) — this is native HTML5 drag-and-drop
 * (`draggable`/`onDragStart`/`onDragOver`/`onDrop`), the same class of
 * "native DOM events, no library" approach this codebase already uses for
 * pointer-driven transforms in `EditorWorkspace.tsx`. A drag never carries
 * cross-window payload data; the only state that matters is this
 * component's own `dragId`, so `dataTransfer` is touched defensively (it
 * can be undefined in non-browser test environments) purely for the
 * native drag cursor/`effectAllowed` affordance, never as the source of
 * truth for what's being dragged.
 *
 * Every drag is resolved into a `DragPlan` by `planDrop` below, which
 * reads only `sceneEditor.outline` (the same flat, depth-annotated row
 * list every other part of this panel already renders from) to work out:
 * (a) which existing mutation the drop maps to, and (b) — for a same-
 * container reorder to an arbitrary position — how many single-step
 * `moveItem`/`moveLayer` swaps get there. `useSceneEditor.ts`'s
 * `moveItemBySteps`/`moveLayerBySteps` then apply that many *existing*
 * pure swap calls against one local candidate scene and commit exactly
 * once, so a drag to any position — not just an adjacent swap — still
 * lands as the same single undo step every other outline mutation here
 * produces. A reparent drop (onto a different group or a different
 * layer's row) instead calls the existing `moveItemToGroup`/
 * `moveItemToLayer` hook methods directly (already exactly one commit,
 * already lock-guarded).
 *
 * Validity (both the live "can I drop here" affordance while dragging and
 * the actual commit-time check) is never re-derived here: a same-
 * container reorder can't fail (the sibling list itself is where the
 * insertion index came from), and a reparent's validity is checked by
 * literally invoking `moveItemToGroup`/`moveItemToLayer` from
 * `sceneOutline.ts` as a *pure, non-committing* dry run (`isPlanValid`) —
 * the exact same `checkCandidate`/`validateScene`-backed gate the actual
 * drop later commits through, not a second copy of its cycle/limit rules.
 * A locked row (`row.locked`/`row.inheritedLocked` — already computed by
 * `buildOutline`, see that module's Task 80 doc comment) is refused as
 * *either* a drag source (not `draggable`) or a drop target (`planDrop`
 * returns `null`) before any of that even runs — this only gates the new
 * drag UI itself; it doesn't add lock enforcement to the underlying
 * mutations (issue #80's separately tracked scope, per this task's own
 * "Out of scope").
 */

type LayerNameFieldProps = {
  layerId: string;
  name: string;
  onRename: (layerId: string, name: string) => void;
};

/** An uncontrolled text field that commits a rename on blur/Enter — one
 * commit per rename action, not per keystroke (Task 24 acceptance
 * criterion: exactly one undo step per action). Keying on the *committed*
 * name (not the in-progress draft) means the field re-syncs to the
 * canonical name after an undo/redo without ever interrupting an
 * in-progress edit. */
function LayerNameField({ layerId, name, onRename }: LayerNameFieldProps) {
  return (
    <input
      key={name}
      type="text"
      defaultValue={name}
      aria-label={`Layer name for ${name}`}
      onBlur={(event) => {
        const trimmed = event.target.value.trim();
        if (trimmed.length > 0 && trimmed !== name) onRename(layerId, trimmed);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}

type MoveControlsProps = {
  itemId: string;
  itemLabel: string;
  itemLayerId: string;
  currentGroupId: string | null;
  sceneEditor: SceneEditor;
};

/** Task 76: keyboard-operable ("select a destination, then press a button"
 * — the same pattern `GraphListView.tsx` uses for its reconnect controls)
 * reparenting controls attached to every group/shape outline row: move the
 * item to a different layer's top level, or into a different group on the
 * same layer (or back out to that layer's top level via the "Top level"
 * option). Both native `<select>`+`<button>` pairs are fully reachable by
 * Tab/arrow keys/Enter, so no separate drag-based interaction is needed to
 * satisfy the "pointer and keyboard" acceptance criterion — the same
 * controls serve both a mouse click and an all-keyboard sequence. Issue
 * #127: unchanged by the addition of pointer drag-and-drop above; this
 * remains the keyboard-only path to every reparent a drag can reach. */
function MoveControls({
  itemId,
  itemLabel,
  itemLayerId,
  currentGroupId,
  sceneEditor,
}: MoveControlsProps) {
  const [layerTarget, setLayerTarget] = useState(itemLayerId);
  const [groupTarget, setGroupTarget] = useState(currentGroupId ?? '');

  // Task 111 (issue #142): `moveItemToGroup` no longer requires the moved
  // item and target group to share a layerId (every shape is its own
  // independent layer now, so that precondition would reject nearly every
  // move) -- this option list must offer every group, not just ones on
  // `itemLayerId`, to stay in sync with what the underlying mutation
  // actually allows.
  const groupOptions = sceneEditor.groups.filter((g) => g.id !== itemId);

  return (
    <span className="editor-outline-move-controls">
      <select
        aria-label={`Target layer for ${itemLabel}`}
        value={layerTarget}
        onChange={(event) => setLayerTarget(event.target.value)}
      >
        {sceneEditor.layers.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label={`Move ${itemLabel} to layer`}
        onClick={() => sceneEditor.moveItemToLayer(itemId, layerTarget)}
      >
        Move to layer
      </button>

      <select
        aria-label={`Target group for ${itemLabel}`}
        value={groupTarget}
        onChange={(event) => setGroupTarget(event.target.value)}
      >
        <option value="">Top level</option>
        {groupOptions.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label={`Move ${itemLabel} to group`}
        onClick={() => sceneEditor.moveItemToGroup(itemId, groupTarget || null)}
      >
        Move to group
      </button>
    </span>
  );
}

/** Issue #131: every row's *secondary* controls (move up/down, the
 * `MoveControls` reparent select+button pair) live behind this one
 * `<details>`/`<summary>` disclosure, so a row's always-visible primary view
 * stays to name/visibility/lock/color/delete — the small, frequently-used
 * set — while the keyboard-reachable reparenting/reordering controls
 * `MoveControls`' own doc comment describes are still fully present, just
 * one extra `<summary>` activation away. `<summary>` itself is a real,
 * natively focusable/keyboard-operable disclosure widget (Enter/Space
 * toggles it), so nothing here is any less keyboard-operable than before —
 * it's simply not *always* in the tab order. */
function RowMoreDisclosure({ children }: { children: ReactNode }) {
  return (
    <details className="editor-outline-row-more">
      <summary>More</summary>
      {children}
    </details>
  );
}

/** Issue #131: the inline fill-color editor attached to every shape row's
 * primary view. Reuses the exact mutation path `ShapeInspectorPanel.tsx`'s
 * `ColorStyleField` already exercises (`updateSelectedShapeColorField`), but
 * cannot reuse that component verbatim — that one always edits *the* active
 * selection, while this one is one of potentially many rows, each needing
 * to edit *its own* shape without disturbing what's currently selected
 * elsewhere.
 *
 * Hazard this works around (see this task's own write-up and
 * `useSceneEditor.ts`'s `selectShape`/`updateSelectedShapeColorField`):
 * `updateSelectedShapeColorField` always acts on the hook's *current-render*
 * `selectedShape`, and a `selectShape(id)` call doesn't update that state
 * synchronously within the same handler. Calling both in one click handler
 * would silently edit whatever shape *was* selected before this click, not
 * `row.id`. So the editor's editable field is gated on
 * `sceneEditor.selectedShapeId === row.id` — it only ever renders (and only
 * ever calls `updateSelectedShapeColorField`) once a render has confirmed
 * selection actually landed on this row's shape. Opening the editor is a
 * separate two-step affair: click the swatch, which both requests selection
 * and requests the editor open; the *open* local flag is inert until that
 * render-confirmed condition is also true. */
function ShapeColorSwatch({
  row,
  sceneEditor,
}: {
  row: Extract<OutlineRow, { kind: 'shape' }>;
  sceneEditor: SceneEditor;
}) {
  const [wantsOpen, setWantsOpen] = useState(false);
  const isSelected = sceneEditor.selectedShapeId === row.id;
  const isOpen = wantsOpen && isSelected;
  const shape = sceneEditor.shapes.find((s) => s.id === row.id) ?? null;
  const value = shape ? getColorFieldValue(shape, 'fill') : null;

  const [draft, setDraft] = useState(value ?? '');
  const [error, setError] = useState<string | null>(null);

  // Re-sync the draft to the canonical value whenever the editor (re)opens
  // on this row, or the underlying value changes out from under it (e.g.
  // an undo) while it's open — the same re-sync `ColorStyleField` performs
  // on `value` changes.
  useEffect(() => {
    if (isOpen) {
      setDraft(value ?? '');
      setError(null);
    }
  }, [isOpen, value]);

  const fieldId = `layer-row-fill-${row.id}`;
  const errorId = `${fieldId}-error`;

  return (
    <span className="editor-outline-color-swatch">
      <button
        type="button"
        className="editor-outline-color-swatch-toggle"
        style={{ backgroundColor: value ?? 'transparent' }}
        aria-label={`Edit fill color for ${row.label}`}
        aria-expanded={isOpen}
        onClick={() => {
          sceneEditor.selectShape(row.id);
          setWantsOpen(true);
        }}
      >
        {value ? '' : '∅'}
      </button>
      {isOpen && (
        <span className="editor-outline-color-swatch-editor">
          <input
            id={fieldId}
            type="text"
            value={draft}
            aria-label={`Fill color hex for ${row.label}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              const next = event.target.value;
              setDraft(next);
              const outcome = sceneEditor.updateSelectedShapeColorField('fill', next);
              setError(outcome.ok ? null : outcome.error);
            }}
          />
          <button type="button" onClick={() => setWantsOpen(false)}>
            Close
          </button>
          {error && (
            <span id={errorId} role="alert">
              {error}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Drag-and-drop planning (pure — no React, no scene mutation; see the
// module doc comment's "Drag-and-drop mechanics" section)
// ---------------------------------------------------------------------------

export type DropZone = 'before' | 'after' | 'into';

export type DragPlan =
  | { kind: 'reorderItem'; itemId: string; direction: 'up' | 'down'; steps: number }
  | { kind: 'reorderLayer'; layerId: string; direction: 'up' | 'down'; steps: number }
  | { kind: 'reparentToGroup'; itemId: string; targetGroupId: string }
  | { kind: 'reparentToLayer'; itemId: string; targetLayerId: string };

/** A row's *effective* lock state, folding in the same own+inherited
 * cascade `buildOutline` already computes: for a layer, its own `locked`
 * flag (a layer has no ancestor); for a group/shape, `inheritedLocked`
 * already folds in the row's own flag (for a group) plus every ancestor
 * group and the layer (see `sceneOutline.ts`'s `isEffectivelyLocked` doc
 * comment) — so this needs no second lookup into the scene document. */
export function isRowLocked(row: OutlineRow): boolean {
  return row.kind === 'layer' ? row.locked : row.inheritedLocked;
}

/** Identifies row `index`'s immediate container as `'root'` (a layer row
 * itself has no container in this sense), `'layer:<id>'` (top-level of
 * that layer), or `'group:<id>'` (a child of that group) — derived purely
 * from the flat outline's `depth` values, by walking backward for the
 * nearest preceding row exactly one depth shallower (its parent, per
 * `buildOutline`'s own emission order: a row's parent always immediately
 * precedes its first child's subtree in the flat list). */
function parentKeyAt(outline: OutlineRow[], index: number): string {
  const row = outline[index];
  if (row.depth === 0) return 'root';
  for (let i = index - 1; i >= 0; i -= 1) {
    if (outline[i].depth === row.depth - 1) {
      const ancestor = outline[i];
      return ancestor.kind === 'group' ? `group:${ancestor.id}` : `layer:${ancestor.id}`;
    }
  }
  return 'root';
}

/** Every id of `kind` sharing `containerKey`, in outline (draw) order —
 * i.e. the exact sibling list `moveItem`/`moveLayer` swap adjacent entries
 * within (see `sceneOutline.ts`'s draw-order rule: groups and shapes are
 * never interleaved as siblings, so restricting to one `kind` here matches
 * what those functions actually reorder). */
function siblingIdsInContainer(
  outline: OutlineRow[],
  containerKey: string,
  kind: OutlineRow['kind'],
): string[] {
  const ids: string[] = [];
  outline.forEach((row, i) => {
    if (row.kind === kind && parentKeyAt(outline, i) === containerKey) ids.push(row.id);
  });
  return ids;
}

/** Diffs `draggedId`'s current position in `list` against where it should
 * land (immediately before/after `targetId`), the same way any "reorder
 * a list by dragging" implementation would with `Array.prototype.splice`
 * — then converts that index delta into "how many single-step
 * up/down swaps" so the caller can drive the existing adjacent-swap
 * mutation (`moveItemBySteps`/`moveLayerBySteps` in `useSceneEditor.ts`)
 * exactly that many times. Returns `null` if `targetId` isn't present (a
 * stale row), or `{ steps: 0 }` for a legitimate no-op (dropped right back
 * where it already was). */
function computeSteps(
  list: string[],
  draggedId: string,
  targetId: string,
  zone: Exclude<DropZone, 'into'>,
): { direction: 'up' | 'down'; steps: number } | null {
  const without = list.filter((id) => id !== draggedId);
  let insertAt = without.indexOf(targetId);
  if (insertAt < 0) return null;
  if (zone === 'after') insertAt += 1;
  const reordered = [...without.slice(0, insertAt), draggedId, ...without.slice(insertAt)];
  const oldIndex = list.indexOf(draggedId);
  const newIndex = reordered.indexOf(draggedId);
  const steps = newIndex - oldIndex;
  if (steps === 0) return { direction: 'down', steps: 0 };
  return { direction: steps > 0 ? 'down' : 'up', steps: Math.abs(steps) };
}

/** Resolves a drag of `dragId` released over `targetId` (in `zone`
 * relative to that target row) into a `DragPlan`, or `null` for a drop
 * this panel doesn't support / must reject — see each acceptance
 * criterion this maps to:
 *  - same id, or either row locked: always rejected.
 *  - dragging a layer: only valid onto another layer row, before/after
 *    (layers never nest, so `'into'` is never valid for a layer source or
 *    target).
 *  - dragging a shape/group onto a layer row: always a reparent-to-that-
 *    layer's-top-level, regardless of `zone` (a layer row has no "siblings
 *    of shapes/groups" to reorder against).
 *  - dragging a shape/group onto a same-kind row (shape onto shape, group
 *    onto group) that shares its exact immediate container, in the
 *    `'before'`/`'after'` zone: a same-container reorder.
 *  - dragging a shape/group onto a group row otherwise (a different
 *    container, or the `'into'` zone): a reparent into that group.
 *  - dragging a shape/group onto a shape row in a different container, or
 *    into a shape's `'into'` zone (shapes accept no children): rejected —
 *    not one of this task's listed valid drop targets. */
export function planDrop(
  outline: OutlineRow[],
  dragId: string,
  targetId: string,
  zone: DropZone,
): DragPlan | null {
  if (dragId === targetId) return null;
  const dragIdx = outline.findIndex((r) => r.id === dragId);
  const targetIdx = outline.findIndex((r) => r.id === targetId);
  if (dragIdx < 0 || targetIdx < 0) return null;
  const dragRow = outline[dragIdx];
  const targetRow = outline[targetIdx];
  if (isRowLocked(dragRow) || isRowLocked(targetRow)) return null;

  if (dragRow.kind === 'layer') {
    if (targetRow.kind !== 'layer' || zone === 'into') return null;
    const list = outline.filter((r) => r.kind === 'layer').map((r) => r.id);
    const result = computeSteps(list, dragId, targetId, zone);
    if (!result || result.steps === 0) return null;
    return {
      kind: 'reorderLayer',
      layerId: dragId,
      direction: result.direction,
      steps: result.steps,
    };
  }

  if (targetRow.kind === 'layer') {
    return { kind: 'reparentToLayer', itemId: dragId, targetLayerId: targetId };
  }

  const dragContainer = parentKeyAt(outline, dragIdx);
  const targetContainer = parentKeyAt(outline, targetIdx);

  if (targetRow.kind === dragRow.kind && dragContainer === targetContainer && zone !== 'into') {
    const list = siblingIdsInContainer(outline, dragContainer, dragRow.kind);
    const result = computeSteps(list, dragId, targetId, zone);
    if (!result || result.steps === 0) return null;
    return {
      kind: 'reorderItem',
      itemId: dragId,
      direction: result.direction,
      steps: result.steps,
    };
  }

  // Task 111 (issue #142): two top-level shapes now almost always sit on
  // two DIFFERENT layers (every shape is its own independent layer), so
  // the `dragContainer === targetContainer` branch above -- which used to
  // catch "reorder two shapes on the same layer" -- can no longer match
  // for shapes the way it still does for groups (which may still share a
  // layerId). Dragging one top-level shape onto another now reorders
  // their two layers instead, mirroring `moveItem`'s identical shift (see
  // that function's doc comment in sceneOutline.ts).
  if (
    dragRow.kind === 'shape' &&
    targetRow.kind === 'shape' &&
    dragContainer.startsWith('layer:') &&
    targetContainer.startsWith('layer:') &&
    zone !== 'into'
  ) {
    const list = outline.filter((r) => r.kind === 'layer').map((r) => r.id);
    const result = computeSteps(list, dragRow.layerId, targetRow.layerId, zone);
    if (!result || result.steps === 0) return null;
    return {
      kind: 'reorderLayer',
      layerId: dragRow.layerId,
      direction: result.direction,
      steps: result.steps,
    };
  }

  if (targetRow.kind === 'group') {
    return { kind: 'reparentToGroup', itemId: dragId, targetGroupId: targetId };
  }

  return null;
}

/** A same-container reorder can never fail (the insertion index came from
 * the real sibling list), so this only needs to dry-run a reparent — by
 * literally calling the existing pure `moveItemToGroup`/`moveItemToLayer`
 * from `sceneOutline.ts` and checking `.ok`, discarding the returned scene
 * without committing it. This is the exact same `checkCandidate`/
 * `validateScene` gate the real drop commits through afterward — not a
 * second, UI-layer copy of the cycle/limit rules. */
export function isPlanValid(scene: SceneDocument, plan: DragPlan): boolean {
  switch (plan.kind) {
    case 'reorderItem':
    case 'reorderLayer':
      return true;
    case 'reparentToGroup':
      return moveItemToGroupOp(scene, plan.itemId, plan.targetGroupId).ok;
    case 'reparentToLayer':
      return moveItemToLayerOp(scene, plan.itemId, plan.targetLayerId).ok;
  }
}

/** Maps a pointer's Y position within a hovered row's own bounding box to
 * an insertion zone: a shape row (which never accepts children) only ever
 * offers `'before'`/`'after'`, split at its vertical midpoint; a
 * layer/group row (either can be a reparent target) additionally offers
 * `'into'` in its middle third, matching the "clear insertion indicator...
 * before/after two rows, or 'into' a group/layer" acceptance criterion. */
function zoneForRow(
  row: OutlineRow,
  rect: { top: number; height: number },
  clientY: number,
): DropZone {
  const relativeY = clientY - rect.top;
  const height = rect.height || 1;
  if (row.kind === 'shape') {
    return relativeY < height / 2 ? 'before' : 'after';
  }
  if (relativeY < height / 3) return 'before';
  if (relativeY > (height * 2) / 3) return 'after';
  return 'into';
}

function applyPlan(sceneEditor: SceneEditor, plan: DragPlan): void {
  switch (plan.kind) {
    case 'reorderItem':
      sceneEditor.moveItemBySteps(plan.itemId, plan.direction, plan.steps);
      break;
    case 'reorderLayer':
      sceneEditor.moveLayerBySteps(plan.layerId, plan.direction, plan.steps);
      break;
    case 'reparentToGroup':
      sceneEditor.moveItemToGroup(plan.itemId, plan.targetGroupId);
      break;
    case 'reparentToLayer':
      sceneEditor.moveItemToLayer(plan.itemId, plan.targetLayerId);
      break;
  }
}

// ---------------------------------------------------------------------------
// Row rendering
// ---------------------------------------------------------------------------

type HoverState = { id: string; zone: DropZone; valid: boolean };

type DragController = {
  dragId: string | null;
  hover: HoverState | null;
  isRowDraggable: (row: OutlineRow) => boolean;
  onRowDragStart: (event: ReactDragEvent<HTMLLIElement>, row: OutlineRow) => void;
  onRowDragEnd: () => void;
  onRowDragOver: (event: ReactDragEvent<HTMLLIElement>, row: OutlineRow) => void;
  onRowDragLeave: (row: OutlineRow) => void;
  onRowDrop: (event: ReactDragEvent<HTMLLIElement>, row: OutlineRow) => void;
};

/** Every drag-related prop a row needs, computed once per row from the
 * shared `DragController` — kept as one small object so the three row
 * variants below (layer/group/shape) apply an identical, easy-to-audit
 * set of DOM attributes rather than each re-deriving them. */
function dragAttributesFor(row: OutlineRow, drag: DragController) {
  const isDragging = drag.dragId === row.id;
  const isHoverTarget = drag.hover?.id === row.id;
  const indicatorClass = isHoverTarget
    ? drag.hover!.valid
      ? `editor-outline-row-drop-${drag.hover!.zone}`
      : 'editor-outline-row-drop-rejected'
    : '';
  return {
    draggable: drag.isRowDraggable(row),
    onDragStart: (event: ReactDragEvent<HTMLLIElement>) => drag.onRowDragStart(event, row),
    onDragEnd: () => drag.onRowDragEnd(),
    onDragOver: (event: ReactDragEvent<HTMLLIElement>) => drag.onRowDragOver(event, row),
    onDragLeave: () => drag.onRowDragLeave(row),
    onDrop: (event: ReactDragEvent<HTMLLIElement>) => drag.onRowDrop(event, row),
    'data-dragging': isDragging ? 'true' : undefined,
    'data-drop-zone': isHoverTarget ? drag.hover!.zone : undefined,
    'data-drop-valid': isHoverTarget ? String(drag.hover!.valid) : undefined,
    extraClassName: [isDragging ? 'editor-outline-row-dragging' : '', indicatorClass]
      .filter(Boolean)
      .join(' '),
  };
}

function OutlineRowItem({
  row,
  sceneEditor,
  drag,
}: {
  row: OutlineRow;
  sceneEditor: SceneEditor;
  drag: DragController;
}) {
  const indent = { paddingLeft: `${row.depth * 1.25}rem` };
  const moveUp = () => sceneEditor.moveItem(row.id, 'up');
  const moveDown = () => sceneEditor.moveItem(row.id, 'down');
  const dragAttrs = dragAttributesFor(row, drag);

  if (row.kind === 'layer') {
    return (
      <li
        style={indent}
        data-outline-kind="layer"
        data-outline-id={row.id}
        className={`editor-outline-row editor-outline-row-layer ${dragAttrs.extraClassName}`.trim()}
        draggable={dragAttrs.draggable}
        onDragStart={dragAttrs.onDragStart}
        onDragEnd={dragAttrs.onDragEnd}
        onDragOver={dragAttrs.onDragOver}
        onDragLeave={dragAttrs.onDragLeave}
        onDrop={dragAttrs.onDrop}
        data-dragging={dragAttrs['data-dragging']}
        data-drop-zone={dragAttrs['data-drop-zone']}
        data-drop-valid={dragAttrs['data-drop-valid']}
      >
        <span className="editor-outline-drag-handle" aria-hidden="true">
          ⠿
        </span>
        <span className="editor-outline-kind-icon" aria-hidden="true">
          ▥
        </span>
        <span>Layer:</span>{' '}
        <LayerNameField layerId={row.id} name={row.name} onRename={sceneEditor.renameLayer} />
        <button
          type="button"
          aria-pressed={row.visible}
          onClick={() => sceneEditor.toggleLayerVisible(row.id)}
        >
          {row.visible ? 'Visible' : 'Hidden'}
        </button>
        <button
          type="button"
          aria-pressed={row.locked}
          onClick={() => sceneEditor.toggleLayerLocked(row.id)}
        >
          {row.locked ? 'Locked' : 'Unlocked'}
        </button>
        <button
          type="button"
          aria-label={`Delete layer ${row.name}`}
          onClick={() => sceneEditor.deleteLayer(row.id)}
        >
          Delete layer
        </button>
        <RowMoreDisclosure>
          <button
            type="button"
            aria-label={`Move layer ${row.name} up`}
            disabled={row.isFirst}
            onClick={() => sceneEditor.moveLayer(row.id, 'up')}
          >
            Move up
          </button>
          <button
            type="button"
            aria-label={`Move layer ${row.name} down`}
            disabled={row.isLast}
            onClick={() => sceneEditor.moveLayer(row.id, 'down')}
          >
            Move down
          </button>
        </RowMoreDisclosure>
      </li>
    );
  }

  if (row.kind === 'group') {
    const label = `Group: ${row.name} (${row.childCount} item(s))`;
    // Task 80 (issue #110): make an ancestor's hidden/locked state visibly
    // apparent on this group too, not just on the shapes underneath it —
    // `inheritedVisible`/`inheritedLocked` fold in every ancestor group and
    // the layer, the same OR-cascade `isEffectivelyLocked` already applies.
    // This is purely a display annotation alongside the group's own
    // Visible/Locked toggle buttons, which still show (and mutate) its own
    // flag — an ancestor's state can't be changed from a descendant's row.
    const inherited = [
      row.inheritedVisible ? null : 'hidden (from an ancestor)',
      !row.locked && row.inheritedLocked ? 'locked (from an ancestor)' : null,
    ].filter(Boolean);
    return (
      <li
        style={indent}
        data-outline-kind="group"
        data-outline-id={row.id}
        className={`editor-outline-row editor-outline-row-group ${dragAttrs.extraClassName}`.trim()}
        draggable={dragAttrs.draggable}
        onDragStart={dragAttrs.onDragStart}
        onDragEnd={dragAttrs.onDragEnd}
        onDragOver={dragAttrs.onDragOver}
        onDragLeave={dragAttrs.onDragLeave}
        onDrop={dragAttrs.onDrop}
        data-dragging={dragAttrs['data-dragging']}
        data-drop-zone={dragAttrs['data-drop-zone']}
        data-drop-valid={dragAttrs['data-drop-valid']}
      >
        <span className="editor-outline-drag-handle" aria-hidden="true">
          ⠿
        </span>
        <span className="editor-outline-kind-icon" aria-hidden="true">
          ▤
        </span>
        <label>
          <input
            type="checkbox"
            checked={sceneEditor.multiSelectedIds.includes(row.id)}
            onChange={() => sceneEditor.toggleMultiSelect(row.id)}
            aria-label={`Add ${row.name} to group selection`}
          />
          Select for grouping
        </label>
        <button
          type="button"
          aria-pressed={row.id === sceneEditor.selectedShapeId}
          onClick={() => sceneEditor.selectShape(row.id)}
        >
          {label}
        </button>
        {inherited.length > 0 && (
          <span className="editor-outline-inherited-state"> ({inherited.join(', ')})</span>
        )}
        <button
          type="button"
          aria-pressed={row.visible}
          onClick={() => sceneEditor.toggleGroupVisible(row.id)}
        >
          {row.visible ? 'Visible' : 'Hidden'}
        </button>
        <button
          type="button"
          aria-pressed={row.locked}
          onClick={() => sceneEditor.toggleGroupLocked(row.id)}
        >
          {row.locked ? 'Locked' : 'Unlocked'}
        </button>
        <button
          type="button"
          aria-label={`Delete group ${row.name}`}
          onClick={() => sceneEditor.deleteGroupSelected(row.id)}
        >
          Delete group
        </button>
        <RowMoreDisclosure>
          <button
            type="button"
            aria-label={`Move ${row.name} up`}
            disabled={row.isFirst}
            onClick={moveUp}
          >
            Move up
          </button>
          <button
            type="button"
            aria-label={`Move ${row.name} down`}
            disabled={row.isLast}
            onClick={moveDown}
          >
            Move down
          </button>
          <MoveControls
            itemId={row.id}
            itemLabel={row.name}
            itemLayerId={row.layerId}
            currentGroupId={sceneEditor.groups.find((g) => g.childIds.includes(row.id))?.id ?? null}
            sceneEditor={sceneEditor}
          />
        </RowMoreDisclosure>
      </li>
    );
  }

  // Task 80 (issue #110): `row.label` is the friendly, stable label
  // (`sceneShapes.ts`'s `shapeLabel`, e.g. "Circle 2") — no more truncated
  // UUID in the outline row, its move-button `aria-label`s, or the "Select
  // for grouping" checkbox's label.
  const label = row.label;
  const moveLabel = label;
  const inherited = [
    row.inheritedVisible ? null : 'hidden',
    row.inheritedLocked ? 'locked' : null,
  ].filter(Boolean);

  return (
    <li
      style={indent}
      data-outline-kind="shape"
      data-outline-id={row.id}
      className={`editor-outline-row editor-outline-row-shape ${dragAttrs.extraClassName}`.trim()}
      draggable={dragAttrs.draggable}
      onDragStart={dragAttrs.onDragStart}
      onDragEnd={dragAttrs.onDragEnd}
      onDragOver={dragAttrs.onDragOver}
      onDragLeave={dragAttrs.onDragLeave}
      onDrop={dragAttrs.onDrop}
      data-dragging={dragAttrs['data-dragging']}
      data-drop-zone={dragAttrs['data-drop-zone']}
      data-drop-valid={dragAttrs['data-drop-valid']}
    >
      <span className="editor-outline-drag-handle" aria-hidden="true">
        ⠿
      </span>
      <span className="editor-outline-kind-icon" aria-hidden="true">
        ◆
      </span>
      <label>
        <input
          type="checkbox"
          checked={sceneEditor.multiSelectedIds.includes(row.id)}
          onChange={() => sceneEditor.toggleMultiSelect(row.id)}
          aria-label={`Add ${label} to group selection`}
        />
        Select for grouping
      </label>
      <button
        type="button"
        aria-pressed={row.id === sceneEditor.selectedShapeId}
        onClick={() => sceneEditor.selectShape(row.id)}
      >
        {label}
      </button>
      {inherited.length > 0 ? (
        <span className="editor-outline-inherited-state"> ({inherited.join(', ')})</span>
      ) : null}
      {/* Task 111 (issue #142): a shape's own visibility/lock toggle,
          mirroring the layer/group rows' existing pattern — this reflects
          and mutates the shape's OWN flag (`row.visible`/`row.locked`),
          not the cascaded `inherited` state shown just above. */}
      <button
        type="button"
        aria-pressed={row.visible}
        onClick={() => sceneEditor.toggleShapeVisible(row.id)}
      >
        {row.visible ? 'Visible' : 'Hidden'}
      </button>
      <button
        type="button"
        aria-pressed={row.locked}
        onClick={() => sceneEditor.toggleShapeLocked(row.id)}
      >
        {row.locked ? 'Locked' : 'Unlocked'}
      </button>
      <ShapeColorSwatch row={row} sceneEditor={sceneEditor} />
      <button
        type="button"
        aria-label={`Delete shape ${label}`}
        onClick={() => sceneEditor.deleteSelected(row.id)}
      >
        Delete shape
      </button>
      <RowMoreDisclosure>
        <button
          type="button"
          aria-label={`Move ${moveLabel} up`}
          disabled={row.isFirst}
          onClick={moveUp}
        >
          Move up
        </button>
        <button
          type="button"
          aria-label={`Move ${moveLabel} down`}
          disabled={row.isLast}
          onClick={moveDown}
        >
          Move down
        </button>
        <MoveControls
          itemId={row.id}
          itemLabel={moveLabel}
          itemLayerId={row.layerId}
          currentGroupId={sceneEditor.groups.find((g) => g.childIds.includes(row.id))?.id ?? null}
          sceneEditor={sceneEditor}
        />
      </RowMoreDisclosure>
    </li>
  );
}

function LayersPanel({ sceneEditor }: { sceneEditor: SceneEditor }) {
  const canGroup = sceneEditor.multiSelectedIds.length >= 2;
  const hasGroupSelected = sceneEditor.selectedGroup !== null;

  const [dragId, setDragId] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  const drag: DragController = {
    dragId,
    hover,
    isRowDraggable: (row) => !isRowLocked(row),
    onRowDragStart: (event, row) => {
      if (isRowLocked(row)) {
        event.preventDefault();
        return;
      }
      setDragId(row.id);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', row.id);
      }
    },
    onRowDragEnd: () => {
      setDragId(null);
      setHover(null);
    },
    onRowDragOver: (event, row) => {
      if (!dragId || !sceneEditor.workingCopy) return;
      // Always prevent the default here so `onDrop` can fire below — an
      // invalid target still needs to *reach* the drop handler so it can
      // surface a rejected affordance and cleanly no-op, rather than the
      // browser silently swallowing the drop before this component ever
      // sees it.
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const zone = zoneForRow(row, rect, event.clientY);
      const plan = planDrop(sceneEditor.outline, dragId, row.id, zone);
      const valid = plan !== null && isPlanValid(sceneEditor.workingCopy, plan);
      if (event.dataTransfer) event.dataTransfer.dropEffect = valid ? 'move' : 'none';
      setHover({ id: row.id, zone, valid });
    },
    onRowDragLeave: (row) => {
      setHover((current) => (current?.id === row.id ? null : current));
    },
    onRowDrop: (event, row) => {
      event.preventDefault();
      const currentDragId = dragId;
      setDragId(null);
      setHover(null);
      if (!currentDragId || !sceneEditor.workingCopy) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const zone = zoneForRow(row, rect, event.clientY);
      const plan = planDrop(sceneEditor.outline, currentDragId, row.id, zone);
      if (!plan || !isPlanValid(sceneEditor.workingCopy, plan)) return; // rejected: a no-op release
      applyPlan(sceneEditor, plan);
    },
  };

  return (
    <div>
      {/* Issue #127: draw-order convention, stated explicitly per this
          task's acceptance criterion — the top of this list is the item
          drawn *last*, i.e. visually frontmost/on top, matching
          `sceneOutline.ts`'s existing draw-order rule (ascending layer
          `order`, then top-level groups before top-level shapes within a
          layer, then a group's own `childIds` order) and the canvas's own
          z-order (later in `sceneEditor.shapes` paints on top). */}
      <p className="editor-outline-order-hint">
        Top of the list = drawn last = on top of everything below it.
      </p>

      {sceneEditor.outlineError && (
        <p role="alert" aria-live="assertive">
          {sceneEditor.outlineError}
        </p>
      )}

      {/* Issue #131: shape creation, formerly a separate toolbar in
          EditorWorkspace.tsx's Tools panel, now lives directly above the
          listing it populates — see this file's module doc comment. */}
      <div role="group" aria-label="Add shape" className="editor-tool-group">
        {SHAPE_TYPES.map(({ type, label }) => (
          <button key={type} type="button" onClick={() => sceneEditor.addShape(type)}>
            {label}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Outline actions" className="editor-tool-group">
        <button type="button" onClick={() => sceneEditor.addLayer()}>
          Add layer
        </button>
        <button type="button" disabled={!canGroup} onClick={() => sceneEditor.groupSelected()}>
          Combine into group
        </button>
        <button
          type="button"
          disabled={!hasGroupSelected}
          onClick={() => sceneEditor.ungroupSelected()}
        >
          Ungroup selected
        </button>
        <button
          type="button"
          disabled={!hasGroupSelected}
          onClick={() => sceneEditor.deleteGroupSelected()}
        >
          Delete selected group
        </button>
        {sceneEditor.multiSelectedIds.length > 0 && (
          <button type="button" onClick={() => sceneEditor.clearMultiSelect()}>
            Clear group selection
          </button>
        )}
      </div>

      {sceneEditor.outline.length === 0 ? (
        <p>No layers yet.</p>
      ) : (
        <ul aria-label="Scene outline" className="editor-outline-list">
          {sceneEditor.outline.map((row) => (
            <OutlineRowItem key={row.id} row={row} sceneEditor={sceneEditor} drag={drag} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default LayersPanel;
