import {
  Fragment,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import type { SceneDocument } from '../api/projects';
import { getCanvasBackgroundColor, getCanvasOpacity } from './canvasSettingsFields';
import {
  moveItemToGroup as moveItemToGroupOp,
  moveItemToLayer as moveItemToLayerOp,
  type OutlineRow,
} from './sceneOutline';
import type { SceneEditor } from './useSceneEditor';

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
 *
 * ## Touch drag support (Task 129, issue #161)
 *
 * Native HTML5 Drag-and-Drop (above) has no touch-input support at all in
 * iOS Safari or Android Chrome — a `draggable` element there never fires
 * `dragstart` from a touch gesture. Rather than replace the mouse path (which
 * works fine and is well-tested), each row's drag-handle span
 * (`.editor-outline-drag-handle`) additionally listens for Pointer Events
 * (`onPointerDown`/`onPointerMove`/`onPointerUp`/`onPointerCancel`), which
 * *do* fire for touch. `onHandlePointerDown` ignores `pointerType === 'mouse'`
 * so the two mechanisms never compete for the same input. Move/up delivery
 * during a touch drag uses `setPointerCapture` (so events keep reaching the
 * handle even once the finger has moved off it) plus
 * `document.elementFromPoint` (to find whichever row is currently under the
 * finger) — the touch equivalent of what `dragover`/`drop` give the native
 * path for free. Everything downstream of "which row, which zone" is the
 * exact same pure `planDrop`/`isPlanValid`/`applyPlan` the native path calls,
 * and the two paths share the same `dragId`/`hover` state, so there is
 * exactly one drag/hover/drop-indicator implementation, not two parallel
 * ones. `touch-action: none` on the handle (see the stylesheet) stops the
 * browser from also interpreting the gesture as a page scroll.
 */

type LayerNameFieldProps = {
  layerId: string;
  name: string;
  onRename: (layerId: string, name: string) => void;
  // Issue #167 (task 135): lets the layer row apply a width-constraining
  // class so the name field no longer dominates the row's horizontal
  // space at its default browser input width — see
  // `.editor-outline-layer-name` in index.css.
  className?: string;
};

/** An uncontrolled text field that commits a rename on blur/Enter — one
 * commit per rename action, not per keystroke (Task 24 acceptance
 * criterion: exactly one undo step per action). Keying on the *committed*
 * name (not the in-progress draft) means the field re-syncs to the
 * canonical name after an undo/redo without ever interrupting an
 * in-progress edit. */
function LayerNameField({ layerId, name, onRename, className }: LayerNameFieldProps) {
  return (
    <input
      key={name}
      type="text"
      className={className}
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

export function ShapeNameField({
  shapeId,
  name,
  onRename,
  className = 'editor-outline-shape-name',
}: {
  shapeId: string;
  name: string;
  onRename: (shapeId: string, name: string) => void;
  className?: string;
}) {
  return (
    <input
      key={name}
      type="text"
      className={className}
      defaultValue={name}
      aria-label={`Shape name for ${name}`}
      onBlur={(event) => {
        const value = event.target.value.trim();
        if (value && value !== name) onRename(shapeId, value);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.currentTarget.value = name;
          event.currentTarget.blur();
        } else if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function GroupNameField({
  groupId,
  name,
  onRename,
  className = 'editor-outline-group-name',
}: {
  groupId: string;
  name: string;
  onRename: (groupId: string, name: string) => void;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="editor-outline-name-field">
      <input
        key={name}
        type="text"
        className={className}
        defaultValue={name}
        aria-label={`Group name for ${name}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${groupId}-name-error` : undefined}
        onChange={() => setError(null)}
        onBlur={(event) => {
          const trimmed = event.target.value.trim();
          if (!trimmed) {
            setError('A group name cannot be empty.');
          } else if (trimmed.length > 200) {
            setError('A group name cannot be longer than 200 characters.');
          } else if (trimmed !== name) {
            setError(null);
            onRename(groupId, trimmed);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.currentTarget.value = name;
            setError(null);
            event.currentTarget.blur();
          } else if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      {error && (
        <span id={`${groupId}-name-error`} role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

export type MoveControlsProps = {
  itemId: string;
  itemLabel: string;
  itemLayerId: string;
  currentGroupId: string | null;
  sceneEditor: SceneEditor;
};

/** Task 76: keyboard-operable ("select a destination, then press a button"
 * — the same pattern `GraphListView.tsx` uses for its reconnect controls)
 * reparenting controls for a group/shape: move the item to a different
 * layer's top level, or into a different group on the same layer (or back
 * out to that layer's top level via the "Top level" option). Both native
 * `<select>`+`<button>` pairs are fully reachable by Tab/arrow keys/Enter,
 * so no separate drag-based interaction is needed to satisfy the "pointer
 * and keyboard" acceptance criterion — the same controls serve both a
 * mouse click and an all-keyboard sequence. Issue #127: unchanged by the
 * addition of pointer drag-and-drop above; this remains the keyboard-only
 * path to every reparent a drag can reach.
 *
 * Issue #164 (task 132): exported (was module-private) so `SelectionHud.tsx`
 * can render this exact component for a selected shape/group's Move-to-
 * layer/Move-to-group controls — this task's chosen "explicit, documented
 * home" for the reparenting controls that used to live in every row's own
 * `RowMoreDisclosure` (removed from the row below; see that removal's own
 * comment for the full rationale). Reused verbatim rather than
 * reimplemented so the group-options filtering / layer-options list stay
 * defined in exactly one place. */
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
  const layerIsCurrentNoOp = layerTarget === itemLayerId && currentGroupId === null;
  const groupIsCurrentNoOp = (groupTarget || null) === currentGroupId;

  return (
    <fieldset className="editor-outline-move-controls">
      <legend>Organization</legend>
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
        disabled={layerIsCurrentNoOp}
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
        disabled={groupIsCurrentNoOp}
        onClick={() => sceneEditor.moveItemToGroup(itemId, groupTarget || null)}
      >
        Move to group
      </button>
    </fieldset>
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

// Issue #164 (task 132): `ShapeColorSwatch` (the inline per-row fill-color
// editor issue #131 added) was removed here — its always-visible row
// affordance is exactly what this task compacts away. Fill-color editing
// for the active selection now lives in `SelectionHud.tsx`, which calls
// the identical `sceneEditor.updateSelectedShapeColorField('fill', ...)`
// mutation this component used to.

// ---------------------------------------------------------------------------
// Drag-and-drop planning (pure — no React, no scene mutation; see the
// module doc comment's "Drag-and-drop mechanics" section)
// ---------------------------------------------------------------------------

export { MoveControls };

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
  // Task 129 (issue #161): the touch-compatible counterpart to the native
  // HTML5 DnD handlers above — see the module doc comment's "Touch drag
  // support" section. Attached to each row's drag-handle span, not the row
  // itself, so touch scrolling elsewhere in the row/list is unaffected.
  onHandlePointerDown: (event: ReactPointerEvent<HTMLSpanElement>, row: OutlineRow) => void;
  onHandlePointerMove: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  onHandlePointerUp: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  onHandlePointerCancel: (event: ReactPointerEvent<HTMLSpanElement>) => void;
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

/** The drag-handle span's own pointer-event props (Task 129/#161's touch
 * path) — separate from `dragAttributesFor` above since these attach to the
 * handle span, not the row `<li>`. */
function handlePointerPropsFor(row: OutlineRow, drag: DragController) {
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLSpanElement>) =>
      drag.onHandlePointerDown(event, row),
    onPointerMove: drag.onHandlePointerMove,
    onPointerUp: drag.onHandlePointerUp,
    onPointerCancel: drag.onHandlePointerCancel,
  };
}

function OutlineRowItem({
  row,
  sceneEditor,
  drag,
  onRowSelect,
}: {
  row: OutlineRow;
  sceneEditor: SceneEditor;
  drag: DragController;
  // Issue #171 (task 139): called (in addition to `sceneEditor.selectShape`)
  // only when a group/shape row's own select button is clicked — never for
  // a canvas-driven selection. `EditorWorkspace.tsx` uses this to scroll
  // the Preview/canvas section into view when it isn't already visible; see
  // that file's `handleLayerRowSelect` doc comment for the full rationale.
  // Deliberately kept out of this file's own auto-scroll call surface: a
  // regression test (`LayersPanel.autoScroll.test.ts`) asserts this source
  // file itself makes no such call anywhere, per issue #166.
  onRowSelect?: () => void;
}) {
  const indent = { paddingLeft: `${row.depth * 1.25}rem` };
  const dragAttrs = dragAttributesFor(row, drag);
  const handleProps = handlePointerPropsFor(row, drag);

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
        data-selected={row.id === sceneEditor.selectedLayerId ? 'true' : undefined}
        tabIndex={0}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('input,button,select,summary')) return;
          sceneEditor.selectLayer(row.id);
        }}
        onKeyDown={(event) => {
          if (
            (event.key === 'Enter' || event.key === ' ') &&
            event.target === event.currentTarget
          ) {
            event.preventDefault();
            sceneEditor.selectLayer(row.id);
          }
        }}
      >
        <span className="editor-outline-drag-handle" aria-hidden="true" {...handleProps}>
          ⠿
        </span>
        <span className="editor-outline-kind-icon" aria-hidden="true">
          ▥
        </span>
        {/* Issue #167 (task 135): the standalone "Layer:" text label was
            dropped to reclaim horizontal width — the left accent border,
            bold weight, and kind icon (all pre-existing, task 80/#110)
            already distinguish a layer row at a glance, and the name
            field's own `aria-label` ("Layer name for X") still says
            "Layer" explicitly for a screen reader, so removing the
            redundant visible text loses no information. */}
        <LayerNameField
          layerId={row.id}
          name={row.name}
          onRename={sceneEditor.renameLayer}
          className="editor-outline-layer-name"
        />
        {/* Issue #168 (task 136): Visible/Locked converted from full-size
            toggle buttons to compact checkboxes at reduced text size, per
            live user feedback that checkboxes would "accommodate a
            horizontally longer layer space." Wired to the exact same
            `toggleLayerVisible`/`toggleLayerLocked` mutations the old
            buttons called. Delete layer and the "More" disclosure below
            are unchanged — out of scope per #168. Same `<label>`-wraps-
            `<input>`-plus-visible-text pattern the group/shape rows'
            "Select for grouping" checkbox already uses (below), so this
            introduces no new accessibility pattern to this file. */}
        <label className="editor-outline-layer-toggle">
          <input
            type="checkbox"
            checked={row.visible}
            onChange={() => sceneEditor.toggleLayerVisible(row.id)}
            aria-label={`Layer ${row.name} visible`}
          />
          Visible
        </label>
        <label className="editor-outline-layer-toggle">
          <input
            type="checkbox"
            checked={row.locked}
            onChange={() => sceneEditor.toggleLayerLocked(row.id)}
            aria-label={`Layer ${row.name} locked`}
          />
          Locked
        </label>
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
    // Issue #164 (task 132): the group row's Visible/Locked toggle buttons,
    // Delete button, Move up/down, and MoveControls reparent pair — plus
    // the inherited-hidden/locked annotation text that used to sit next to
    // them — are all removed from this always-visible row. Every one of
    // them still exists, just relocated:
    //  - Visible/Locked/Delete: `SelectionHud.tsx`, shown while this row's
    //    group is the active selection — the exact same
    //    `toggleGroupVisible`/`toggleGroupLocked`/`deleteGroupSelected`
    //    calls this row used to make.
    //  - Move up/down, MoveControls (Move to layer/Move to group):
    //    `SelectionHud.tsx` too — this task's grooming chose "extend the
    //    HUD" over a second, row-local collapsed disclosure, since the HUD
    //    already only renders while this exact row is selected, so it's no
    //    more (and no less) reachable than a per-row disclosure would be,
    //    without a second parallel implementation of "is this the active
    //    selection."
    // The inherited-state annotation (whether a *cascaded* ancestor's
    // hidden/locked state applies) has no HUD equivalent — it was a purely
    // informational annotation, not a control, and dropping it from the
    // always-visible row matches this task's own "too cluttered... should
    // only be necessary to show if the layer is active" framing. See this
    // task's `_docs/tasks.md` resolution notes for the full writeup.
    return (
      <li
        style={indent}
        data-outline-kind="group"
        data-outline-id={row.id}
        data-selected={row.id === sceneEditor.selectedShapeId ? 'true' : undefined}
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
        <span className="editor-outline-drag-handle" aria-hidden="true" {...handleProps}>
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
        <GroupNameField groupId={row.id} name={row.name} onRename={sceneEditor.renameGroup} />
        <button
          type="button"
          aria-pressed={row.id === sceneEditor.selectedShapeId}
          onClick={() => {
            sceneEditor.selectShape(row.id);
            onRowSelect?.();
          }}
        >
          {label}
        </button>
      </li>
    );
  }

  // Task 80 (issue #110): `row.label` is the friendly, stable label
  // (`sceneShapes.ts`'s `shapeLabel`, e.g. "Circle 2") — no more truncated
  // UUID in the outline row, its move-button `aria-label`s, or the "Select
  // for grouping" checkbox's label.
  const label = row.label;

  // Issue #164 (task 132): same relocation as the group row above — the
  // shape row's Visible/Locked toggle buttons, `ShapeColorSwatch`, Delete
  // button, Move up/down, MoveControls, and the inherited-hidden/locked
  // annotation are all removed from this always-visible row. Visible/
  // Locked/fill color/opacity/Delete now live in `SelectionHud.tsx` while
  // this row's shape is selected (the exact same
  // `toggleShapeVisible`/`toggleShapeLocked`/`updateSelectedShapeColorField`/
  // the `opacity` `ShapeStyleField` mutation/`deleteSelected` calls this row
  // used to make); Move up/down and MoveControls are there too, per the
  // same "extend the HUD" choice the group row's comment explains. See this
  // task's `_docs/tasks.md` resolution notes for the full writeup.
  return (
    <li
      style={indent}
      data-outline-kind="shape"
      data-outline-id={row.id}
      data-selected={row.id === sceneEditor.selectedShapeId ? 'true' : undefined}
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
      <span className="editor-outline-drag-handle" aria-hidden="true" {...handleProps}>
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
      <ShapeNameField shapeId={row.id} name={label} onRename={sceneEditor.renameShape} />
      <button
        type="button"
        aria-pressed={row.id === sceneEditor.selectedShapeId}
        onClick={() => {
          sceneEditor.selectShape(row.id);
          onRowSelect?.();
        }}
      >
        {label}
      </button>
    </li>
  );
}

/**
 * Task 138 (issue #170): a persistent, always-visible row for the scene's
 * own canvas/background settings — `backgroundColor` (existing schema
 * field, previously reachable only via the Code tab's raw JSON) and the
 * new `opacity` field.
 *
 * ## Placement (documented decision)
 *
 * The issue's grooming left two candidate homes: a row in this panel's
 * outline, or the Preview toolbar. This panel was chosen because it
 * already is the single place every other layer-like scene-composition
 * control lives (layer/group/shape rows, `SelectionHud.tsx` for the
 * active selection) — putting canvas settings anywhere else would split
 * "things that affect how the scene composites" across two panels for no
 * reason. Within this panel, the row renders at the *bottom* of the
 * outline (after the `<ul>`), not the top: this panel's own draw-order
 * convention (see the "Top of the list = drawn last = on top of
 * everything below it" hint above) already reads top-to-bottom as
 * front-to-back, and the canvas/background is the one thing every scene
 * draws *first*, beneath every layer — so the bottom of the list is where
 * a reader's existing mental model already expects it, without this
 * needing to be an actual outline row (it isn't draggable, reorderable,
 * or nestable, and deliberately doesn't participate in the drag-and-drop
 * machinery above).
 *
 * No visibility toggle is rendered here (issue #170 explicitly excludes
 * one — the canvas can't be meaningfully hidden), and no lock control
 * either (the canvas has no lock concept; nothing here can be blocked by
 * a locked layer/group the way shape edits can).
 */
function CanvasSettingsRow({ sceneEditor }: { sceneEditor: SceneEditor }) {
  const scene = sceneEditor.workingCopy;
  const [colorError, setColorError] = useState<string | null>(null);
  const [opacityError, setOpacityError] = useState<string | null>(null);

  if (!scene) return null;

  const backgroundColor = getCanvasBackgroundColor(scene);
  const opacity = getCanvasOpacity(scene);

  return (
    <div
      role="group"
      aria-label="Canvas settings"
      className="editor-outline-row editor-outline-row-canvas"
    >
      <span className="editor-outline-kind-icon" aria-hidden="true">
        ▦
      </span>
      <span>Canvas</span>

      <label>
        Background color
        <input
          type="color"
          aria-label="Canvas background color"
          value={/^#([0-9a-fA-F]{6})$/.test(backgroundColor) ? backgroundColor : '#ffffff'}
          onChange={(event) => {
            const outcome = sceneEditor.updateCanvasBackgroundColor(event.target.value);
            setColorError(outcome.ok ? null : outcome.error);
          }}
        />
      </label>
      {colorError && (
        <p role="alert" aria-live="assertive">
          {colorError}
        </p>
      )}

      <label>
        Canvas opacity
        <input
          type="number"
          min={0}
          max={1}
          step={0.01}
          aria-label="Canvas opacity"
          defaultValue={opacity}
          key={opacity}
          onBlur={(event) => {
            const outcome = sceneEditor.updateCanvasOpacity(event.target.value);
            setOpacityError(outcome.ok ? null : outcome.error);
          }}
        />
      </label>
      {opacityError && (
        <p role="alert" aria-live="assertive">
          {opacityError}
        </p>
      )}
    </div>
  );
}

function CameraOverlayRow({
  sceneEditor,
  layerOrder,
  onLayerOrderChange,
}: {
  sceneEditor: SceneEditor;
  layerOrder: number;
  onLayerOrderChange: (order: number) => void;
}) {
  const layers = sceneEditor.workingCopy
    ? (Array.isArray(sceneEditor.workingCopy.layers) ? sceneEditor.workingCopy.layers : [])
        .map((layer) => layer as { order?: unknown })
        .filter((layer): layer is { order: number } => typeof layer.order === 'number')
        .sort((a, b) => a.order - b.order)
    : [];
  const below = layers.filter((layer) => layer.order < layerOrder).at(-1);
  const above = layers.find((layer) => layer.order > layerOrder);
  return (
    <li
      data-testid="camera-overlay-layer"
      data-outline-kind="camera-overlay"
      className="editor-outline-row editor-outline-row-camera"
      tabIndex={0}
      aria-label="Camera overlay layer"
    >
      <span className="editor-outline-kind-icon" aria-hidden="true">
        ◉
      </span>
      <span>Camera overlay</span>
      <span className="editor-outline-camera-order" aria-live="polite">
        Z-order {layerOrder}
      </span>
      <button
        type="button"
        aria-label="Move camera overlay up"
        disabled={!below}
        onClick={() => below && onLayerOrderChange((below.order + layerOrder) / 2)}
      >
        Move up
      </button>
      <button
        type="button"
        aria-label="Move camera overlay down"
        disabled={!above}
        onClick={() => above && onLayerOrderChange((above.order + layerOrder) / 2)}
      >
        Move down
      </button>
      <span className="sr-only">
        Camera overlay position and stacking follow the canvas and artwork layer order.
      </span>
    </li>
  );
}

function rowOrder(row: OutlineRow, sceneEditor: SceneEditor): number {
  if (row.kind !== 'layer') return Number.NEGATIVE_INFINITY;
  const layers = sceneEditor.workingCopy?.layers;
  const layer = Array.isArray(layers)
    ? layers.find((candidate) => (candidate as { id?: unknown }).id === row.id)
    : undefined;
  const order = (layer as { order?: unknown } | undefined)?.order;
  return typeof order === 'number' ? order : Number.NEGATIVE_INFINITY;
}

function LayersPanel({
  sceneEditor,
  onRowSelect,
  cameraOverlayActive = false,
  cameraLayerOrder,
  onCameraLayerOrderChange,
}: {
  sceneEditor: SceneEditor;
  // Issue #171 (task 139): see `OutlineRowItem`'s identically-named prop
  // doc comment for the full rationale — threaded straight through to
  // every row unchanged.
  onRowSelect?: () => void;
  cameraOverlayActive?: boolean;
  cameraLayerOrder?: number;
  onCameraLayerOrderChange?: (order: number) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  // Task 129 (issue #161): which pointer (if any) is mid touch-drag — a ref,
  // not state, since it's read-and-cleared synchronously inside the same
  // move/up handlers that also drive `dragId`/`hover` and doesn't itself
  // need to trigger a render.
  const pointerDragIdRef = useRef<number | null>(null);

  // Task 129 (issue #161): finds whichever outline row is currently under a
  // touch point — the touch-drag equivalent of what `dragover`/`drop`
  // targets give the native HTML5 path for free via their own event target.
  const resolveRowFromPoint = (
    clientX: number,
    clientY: number,
  ): { row: OutlineRow; rect: DOMRect } | null => {
    const el = document.elementFromPoint(clientX, clientY);
    const li = el?.closest('li[data-outline-id]') ?? null;
    if (!li) return null;
    const id = li.getAttribute('data-outline-id');
    const row = sceneEditor.outline.find((r) => r.id === id) ?? null;
    if (!row) return null;
    return { row, rect: li.getBoundingClientRect() };
  };

  // Issue #153 introduced a selection-driven auto-scroll effect (jumping
  // the panel to whichever row was selected); issue #165 (task 133)
  // narrowed it to only fire when the newly-selected row was actually out
  // of view. Issue #166 (task 134): live user feedback
  // after #165 shipped reported the "only scroll when out of view" heuristic
  // *still* reads as the same jarring jump when the panel is off-screen, so
  // this panel now performs NO automatic page/panel scrolling on selection
  // at all — `SelectionHud.tsx` (#163) and each row's own
  // `[data-selected='true']` highlight (#164) are relied on entirely to
  // surface what's selected. Selecting a row directly by clicking it in
  // this panel is unaffected (that's a user-initiated scroll into their own
  // view, not this removed behavior). See `_docs/tasks.md` task 134's
  // resolution notes for the full writeup.
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
    // Task 129 (issue #161): the touch-compatible counterpart — see the
    // module doc comment's "Touch drag support" section. Ignores
    // `pointerType === 'mouse'` so mouse users keep using the native HTML5
    // DnD path above unchanged.
    onHandlePointerDown: (event, row) => {
      if (event.pointerType === 'mouse' || isRowLocked(row)) return;
      event.preventDefault();
      // jsdom (unit tests) has no `setPointerCapture` implementation at
      // all, hence the optional-call guard.
      event.currentTarget.setPointerCapture?.(event.pointerId);
      pointerDragIdRef.current = event.pointerId;
      setDragId(row.id);
      setHover(null);
    },
    onHandlePointerMove: (event) => {
      if (pointerDragIdRef.current !== event.pointerId) return;
      if (!dragId || !sceneEditor.workingCopy) return;
      const hit = resolveRowFromPoint(event.clientX, event.clientY);
      if (!hit) {
        setHover(null);
        return;
      }
      const zone = zoneForRow(hit.row, hit.rect, event.clientY);
      const plan = planDrop(sceneEditor.outline, dragId, hit.row.id, zone);
      const valid = plan !== null && isPlanValid(sceneEditor.workingCopy, plan);
      setHover({ id: hit.row.id, zone, valid });
    },
    onHandlePointerUp: (event) => {
      if (pointerDragIdRef.current !== event.pointerId) return;
      pointerDragIdRef.current = null;
      const currentDragId = dragId;
      setDragId(null);
      setHover(null);
      if (!currentDragId || !sceneEditor.workingCopy) return;
      const hit = resolveRowFromPoint(event.clientX, event.clientY);
      if (!hit) return;
      const zone = zoneForRow(hit.row, hit.rect, event.clientY);
      const plan = planDrop(sceneEditor.outline, currentDragId, hit.row.id, zone);
      if (!plan || !isPlanValid(sceneEditor.workingCopy, plan)) return; // rejected: a no-op release
      applyPlan(sceneEditor, plan);
    },
    onHandlePointerCancel: (event) => {
      if (pointerDragIdRef.current !== event.pointerId) return;
      pointerDragIdRef.current = null;
      setDragId(null);
      setHover(null);
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

      {/* Issue #182: layer/group mutations live in the always-visible editor
          toolbar. The outline keeps only its selection-specific action. */}
      <div role="group" aria-label="Outline actions" className="editor-tool-group">
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
          {(() => {
            let cameraInserted = false;
            return sceneEditor.outline.map((row) => {
              const cameraBeforeLayer =
                cameraOverlayActive &&
                row.kind === 'layer' &&
                cameraLayerOrder !== undefined &&
                !cameraInserted &&
                rowOrder(row, sceneEditor) >= cameraLayerOrder;
              if (cameraBeforeLayer) cameraInserted = true;
              return (
                <Fragment key={row.id}>
                  {cameraBeforeLayer && onCameraLayerOrderChange && (
                    <CameraOverlayRow
                      sceneEditor={sceneEditor}
                      layerOrder={cameraLayerOrder!}
                      onLayerOrderChange={onCameraLayerOrderChange}
                    />
                  )}
                  <OutlineRowItem
                    row={row}
                    sceneEditor={sceneEditor}
                    drag={drag}
                    onRowSelect={onRowSelect}
                  />
                </Fragment>
              );
            });
          })()}
          {cameraOverlayActive &&
            cameraLayerOrder !== undefined &&
            onCameraLayerOrderChange &&
            !sceneEditor.outline.some(
              (row) => row.kind === 'layer' && rowOrder(row, sceneEditor) >= cameraLayerOrder,
            ) && (
              <CameraOverlayRow
                sceneEditor={sceneEditor}
                layerOrder={cameraLayerOrder}
                onLayerOrderChange={onCameraLayerOrderChange}
              />
            )}
        </ul>
      )}

      {/* Task 138 (issue #170): the canvas/background settings row —
          intentionally rendered outside (below) the outline `<ul>` above,
          not as one of its `<li>` rows — see `CanvasSettingsRow`'s own
          doc comment for the full placement rationale. */}
      <CanvasSettingsRow sceneEditor={sceneEditor} />
    </div>
  );
}

export default LayersPanel;
