import { useState } from 'react';

import type { OutlineRow } from './sceneOutline';
import type { SceneEditor } from './useSceneEditor';

/**
 * Task 24: the Tools panel's scene outline — a keyboard-operable,
 * accessible list view (see `_docs/plan.md`'s "Accessibility and
 * alternate controls" → "Keyboard access": "Provide an accessible
 * scene-outline/list view that can fully substitute for canvas
 * drag-and-drop") of every layer, group, and shape in deterministic
 * draw order (see `sceneOutline.ts`'s draw-order rule).
 *
 * All state and mutation live in `useSceneEditor` (Task 23's hook,
 * extended by this task); this component is presentation only, so every
 * row's controls call straight through to that hook.
 */

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

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
 * controls serve both a mouse click and an all-keyboard sequence. */
function MoveControls({
  itemId,
  itemLabel,
  itemLayerId,
  currentGroupId,
  sceneEditor,
}: MoveControlsProps) {
  const [layerTarget, setLayerTarget] = useState(itemLayerId);
  const [groupTarget, setGroupTarget] = useState(currentGroupId ?? '');

  const groupOptions = sceneEditor.groups.filter(
    (g) => g.layerId === itemLayerId && g.id !== itemId,
  );

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

function OutlineRowItem({ row, sceneEditor }: { row: OutlineRow; sceneEditor: SceneEditor }) {
  const indent = { paddingLeft: `${row.depth * 1.25}rem` };
  const moveUp = () => sceneEditor.moveItem(row.id, 'up');
  const moveDown = () => sceneEditor.moveItem(row.id, 'down');

  if (row.kind === 'layer') {
    return (
      <li style={indent} data-outline-kind="layer" data-outline-id={row.id}>
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
        <button
          type="button"
          aria-label={`Delete layer ${row.name}`}
          onClick={() => sceneEditor.deleteLayer(row.id)}
        >
          Delete layer
        </button>
      </li>
    );
  }

  if (row.kind === 'group') {
    const label = `Group: ${row.name} (${row.childCount} item(s))`;
    return (
      <li style={indent} data-outline-kind="group" data-outline-id={row.id}>
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
      </li>
    );
  }

  const label = `${capitalize(row.typeLabel)} shape`;
  const moveLabel = `${label} (${row.id.slice(0, 8)})`;
  const inherited = [
    row.inheritedVisible ? null : 'hidden',
    row.inheritedLocked ? 'locked' : null,
  ].filter(Boolean);

  return (
    <li style={indent} data-outline-kind="shape" data-outline-id={row.id}>
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
      {inherited.length > 0 ? <span> ({inherited.join(', ')})</span> : null}
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
    </li>
  );
}

function SceneOutlinePanel({ sceneEditor }: { sceneEditor: SceneEditor }) {
  const canGroup = sceneEditor.multiSelectedIds.length >= 2;
  const hasGroupSelected = sceneEditor.selectedGroup !== null;

  return (
    <div>
      <h4>Scene outline</h4>

      {sceneEditor.outlineError && (
        <p role="alert" aria-live="assertive">
          {sceneEditor.outlineError}
        </p>
      )}

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
            <OutlineRowItem key={row.id} row={row} sceneEditor={sceneEditor} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default SceneOutlinePanel;
