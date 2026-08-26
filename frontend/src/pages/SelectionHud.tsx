import { useEffect, useState } from 'react';

import { MoveControls, ShapeNameField } from './LayersPanel';
import { getColorFieldValue, getNumericFieldValue } from './shapeStyleFields';
import type { SceneEditor } from './useSceneEditor';

/**
 * Issue #163 (task 131): a small floating HUD overlaid on the Preview
 * canvas (`EditorWorkspace.tsx`'s `data-panel="preview"` section, which
 * this is rendered into with `position: relative` so this HUD's own
 * `position: absolute` — see `index.css`'s `.editor-selection-hud` — anchors
 * to a fixed corner of that panel rather than the whole page) whenever a
 * shape or group is the active selection.
 *
 * This is deliberately a *second* surface over the exact same state/
 * mutations `LayersPanel.tsx`'s `OutlineRowItem` used to read and call
 * inline — `toggleShapeVisible`/`toggleShapeLocked`/
 * `updateSelectedShapeColorField`/the `opacity` `ShapeStyleField` mutation
 * (`updateSelectedShapeNumericField`)/`deleteSelected` for a shape, and
 * `toggleGroupVisible`/`toggleGroupLocked`/`deleteGroupSelected` for a
 * group — never a new, parallel mutation path.
 *
 * Issue #164 (task 132): now that `LayersPanel.tsx`'s rows are compacted
 * to drag handle/kind icon/checkbox/name, this is also the documented
 * replacement home for a selected shape/group's Move up/down and
 * `MoveControls` (Move to layer/Move to group) reparent pair — imported
 * from `LayersPanel.tsx` (now exported) rather than reimplemented, so the
 * group-options filtering / layer-options list logic stays defined in
 * exactly one place. "Combine into group" already had its own home before
 * either task: the always-visible toolbar button above the outline list
 * (`LayersPanel.tsx`'s "Outline actions" group), never a per-row control,
 * so it needs no relocation here.
 *
 * Renders nothing for: no selection, a layer row (layers are never
 * `selectedShapeId` — see `useSceneEditor.ts`'s `selectShape`, and per
 * issue #163's own acceptance criteria a layer row keeps its existing
 * inline Visible/Locked/Delete/Move-up-down buttons unchanged rather than
 * getting a HUD — `LayersPanel.tsx`'s layer row is therefore also left
 * uncompacted by issue #164, since compacting it with no HUD replacement
 * would be exactly the "net loss of reachable functionality" both tasks'
 * acceptance criteria forbid), or an outline multi-select pick with no
 * single active shape/group (this HUD only ever tracks the single
 * `selectedShapeId`/`selectedGroup`, the same "single active selection"
 * concept `ShapeInspectorPanel.tsx` already follows — multi-selection
 * style editing is out of scope here exactly as it is there).
 *
 * Dismiss behavior: this component just renders (or doesn't) from
 * `sceneEditor.selectedShape`/`selectedGroup` on every render, so clicking
 * empty canvas (`EditorWorkspace.tsx`'s `handleCanvasClick` already calls
 * `selectShape(null)` when nothing is hit) already hides it with no HUD-
 * specific code. Escape-to-deselect (the one behavior that didn't already
 * exist) is added as its own small `EditorWorkspace.tsx` keydown listener,
 * not here — this component has no window-level listeners of its own.
 */
/**
 * Issue #173 (task 141): the collapse/expand affordance itself — a small
 * header button shared by both the group and shape render branches below,
 * so there is exactly one implementation of the toggle's accessible-name/
 * `aria-expanded` pairing rather than two copies drifting apart. Always
 * rendered (this is the "persistent pill" a collapsed HUD keeps, per this
 * issue's own acceptance criteria) — only the body next to it is ever
 * conditionally omitted.
 */
function HudCollapseToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="editor-selection-hud-collapse-toggle"
      aria-expanded={!collapsed}
      aria-label={collapsed ? 'Expand selection panel' : 'Collapse selection panel'}
      onClick={onToggle}
    >
      <span aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
    </button>
  );
}

function SelectionHud({ sceneEditor }: { sceneEditor: SceneEditor }) {
  const { selectedShape, selectedGroup, selectedLayerId, layers, outline } = sceneEditor;

  // Issue #173 (task 141): a collapse/expand toggle for this HUD's body,
  // independent of the underlying selection — collapsing must never touch
  // `selectedShapeId`/`multiSelectedIds`, the canvas handles, or the
  // Layers-panel row highlight (`[data-selected='true']`), all of which
  // are driven entirely by `sceneEditor` state this component doesn't
  // own or mutate here. Per this issue's own groomed decision, a fresh
  // selection always resets to expanded regardless of the previous
  // shape/group's collapsed state — tracked below by re-running the effect
  // whenever the active selection's id changes. Deselecting still
  // dismisses the whole HUD via the early `return null`s below (unaffected
  // by this state, since those returns happen before this local state is
  // ever read for rendering).
  const activeSelectionId = selectedGroup?.id ?? selectedShape?.id ?? null;
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(false);
  }, [activeSelectionId]);

  // Local drafts for the two free-text fields (fill color, opacity),
  // re-synced whenever the selected shape or its canonical value changes —
  // the same re-sync `ShapeColorSwatch`/`NumericStyleField`/`ColorStyleField`
  // already perform for their own identical fields, so an undo/redo or a
  // fresh selection never leaves a stale draft on screen. Declared
  // unconditionally (before the early return below) since React hooks must
  // run in the same order on every render regardless of which selection
  // kind (shape/group/none) is active this time.
  const fillValue = selectedShape ? getColorFieldValue(selectedShape, 'fill') : null;
  const opacityValue = selectedShape ? getNumericFieldValue(selectedShape, 'opacity') : null;

  const [fillDraft, setFillDraft] = useState(fillValue ?? '');
  const [fillError, setFillError] = useState<string | null>(null);
  const [opacityDraft, setOpacityDraft] = useState(
    opacityValue !== null ? String(opacityValue) : '',
  );
  const [opacityError, setOpacityError] = useState<string | null>(null);

  useEffect(() => {
    setFillDraft(fillValue ?? '');
    setFillError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShape?.id, fillValue]);

  useEffect(() => {
    setOpacityDraft(opacityValue !== null ? String(opacityValue) : '');
    setOpacityError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShape?.id, opacityValue]);

  if (selectedLayerId) {
    const layer = layers.find((candidate) => candidate.id === selectedLayerId);
    if (layer) {
      const count = outline.filter(
        (row) => row.kind === 'shape' && row.layerId === layer.id && row.inheritedVisible,
      ).length;
      return (
        <div
          className="editor-selection-hud"
          role="group"
          aria-label={`Selected: ${layer.name}`}
          data-testid="selection-hud"
        >
          <div className="editor-selection-hud-header">
            <p className="editor-selection-hud-title">{layer.name}</p>
            <HudCollapseToggle collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
          </div>
          {!collapsed && (
            <p role="status">
              Layer selected · {count} visible shape{count === 1 ? '' : 's'}
            </p>
          )}
        </div>
      );
    }
  }

  if (selectedGroup) {
    const row = outline.find((r) => r.kind === 'group' && r.id === selectedGroup.id);
    const visible = row?.kind === 'group' ? row.visible : true;
    const locked = row?.kind === 'group' ? row.locked : false;
    const isFirst = row?.kind === 'group' ? row.isFirst : true;
    const isLast = row?.kind === 'group' ? row.isLast : true;
    const layerId = row?.kind === 'group' ? row.layerId : null;
    const currentGroupId =
      sceneEditor.groups.find((g) => g.childIds.includes(selectedGroup.id))?.id ?? null;
    return (
      <div
        className="editor-selection-hud"
        role="group"
        aria-label={`Selected: ${selectedGroup.name}`}
        data-testid="selection-hud"
      >
        <div className="editor-selection-hud-header">
          <p className="editor-selection-hud-title">{selectedGroup.name}</p>
          <HudCollapseToggle collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        </div>
        {!collapsed && (
          <div className="editor-selection-hud-controls">
            <button
              type="button"
              aria-pressed={visible}
              onClick={() => sceneEditor.toggleGroupVisible(selectedGroup.id)}
            >
              {visible ? 'Visible' : 'Hidden'}
            </button>
            <button
              type="button"
              aria-pressed={locked}
              onClick={() => sceneEditor.toggleGroupLocked(selectedGroup.id)}
            >
              {locked ? 'Locked' : 'Unlocked'}
            </button>
            <button
              type="button"
              aria-label={`Delete group ${selectedGroup.name}`}
              onClick={() => sceneEditor.deleteGroupSelected(selectedGroup.id)}
            >
              Delete group
            </button>
            <button
              type="button"
              aria-label={`Move ${selectedGroup.name} up`}
              disabled={isFirst}
              onClick={() => sceneEditor.moveItem(selectedGroup.id, 'up')}
            >
              Move up
            </button>
            <button
              type="button"
              aria-label={`Move ${selectedGroup.name} down`}
              disabled={isLast}
              onClick={() => sceneEditor.moveItem(selectedGroup.id, 'down')}
            >
              Move down
            </button>
            {layerId !== null && (
              <MoveControls
                itemId={selectedGroup.id}
                itemLabel={selectedGroup.name}
                itemLayerId={layerId}
                currentGroupId={currentGroupId}
                sceneEditor={sceneEditor}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  if (!selectedShape) return null;

  const row = outline.find((r) => r.kind === 'shape' && r.id === selectedShape.id);
  const visible = row?.kind === 'shape' ? row.visible : true;
  const locked = row?.kind === 'shape' ? row.locked : false;
  const label = row?.kind === 'shape' ? row.label : selectedShape.id;
  const isFirst = row?.kind === 'shape' ? row.isFirst : true;
  const isLast = row?.kind === 'shape' ? row.isLast : true;
  const layerId = row?.kind === 'shape' ? row.layerId : null;
  const currentGroupId =
    sceneEditor.groups.find((g) => g.childIds.includes(selectedShape.id))?.id ?? null;

  return (
    <div
      className="editor-selection-hud"
      role="group"
      aria-label={`Selected: ${label}`}
      data-testid="selection-hud"
    >
      <div className="editor-selection-hud-header">
        <p className="editor-selection-hud-title">{label}</p>
        <HudCollapseToggle collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>
      {!collapsed && (
        <div className="editor-selection-hud-controls">
          <ShapeNameField
            shapeId={selectedShape.id}
            name={label}
            onRename={sceneEditor.renameShape}
            className="editor-selection-hud-shape-name"
          />
          <button
            type="button"
            aria-pressed={visible}
            onClick={() => sceneEditor.toggleShapeVisible(selectedShape.id)}
          >
            {visible ? 'Visible' : 'Hidden'}
          </button>
          <button
            type="button"
            aria-pressed={locked}
            onClick={() => sceneEditor.toggleShapeLocked(selectedShape.id)}
          >
            {locked ? 'Locked' : 'Unlocked'}
          </button>
          <div className="editor-selection-hud-field">
            {/* Issue #163: labeled "Selection fill" rather than plain "Fill"
                — `ShapeInspectorPanel.tsx`'s own `ColorStyleField` already
                uses the exact accessible name "Fill" for its identical
                field, and both can be mounted simultaneously (this HUD and
                the Inspector panel both read/write the same selected
                shape's fill), so a shared name would make `getByLabelText`
                ambiguous for any test/assistive-tech query not already
                scoped to one container or the other. */}
            <label htmlFor="selection-hud-fill">Selection fill</label>
            <input
              id="selection-hud-fill"
              type="text"
              value={fillDraft}
              aria-invalid={fillError ? true : undefined}
              aria-describedby={fillError ? 'selection-hud-fill-error' : undefined}
              onChange={(event) => {
                const next = event.target.value;
                setFillDraft(next);
                const outcome = sceneEditor.updateSelectedShapeColorField('fill', next);
                setFillError(outcome.ok ? null : outcome.error);
              }}
            />
            {fillError && (
              <p id="selection-hud-fill-error" role="alert">
                {fillError}
              </p>
            )}
          </div>
          <div className="editor-selection-hud-field">
            {/* Issue #163: "Selection opacity", not `OPACITY_SPEC.label`
                ("Opacity") verbatim — same ambiguity rationale as "Selection
                fill" above, against `ShapeInspectorPanel.tsx`'s own
                `NumericStyleField` for the identical `opacity` field. */}
            <label htmlFor="selection-hud-opacity">Selection opacity</label>
            <input
              id="selection-hud-opacity"
              type="text"
              inputMode="decimal"
              value={opacityDraft}
              aria-invalid={opacityError ? true : undefined}
              aria-describedby={opacityError ? 'selection-hud-opacity-error' : undefined}
              onChange={(event) => {
                const next = event.target.value;
                setOpacityDraft(next);
                const outcome = sceneEditor.updateSelectedShapeNumericField('opacity', next);
                setOpacityError(outcome.ok ? null : outcome.error);
              }}
            />
            {opacityError && (
              <p id="selection-hud-opacity-error" role="alert">
                {opacityError}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label={`Delete shape ${label}`}
            onClick={() => sceneEditor.deleteSelected(selectedShape.id)}
          >
            Delete shape
          </button>
          <button
            type="button"
            aria-label={`Move ${label} up`}
            disabled={isFirst}
            onClick={() => sceneEditor.moveItem(selectedShape.id, 'up')}
          >
            Move up
          </button>
          <button
            type="button"
            aria-label={`Move ${label} down`}
            disabled={isLast}
            onClick={() => sceneEditor.moveItem(selectedShape.id, 'down')}
          >
            Move down
          </button>
          {layerId !== null && (
            <MoveControls
              itemId={selectedShape.id}
              itemLabel={label}
              itemLayerId={layerId}
              currentGroupId={currentGroupId}
              sceneEditor={sceneEditor}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default SelectionHud;
