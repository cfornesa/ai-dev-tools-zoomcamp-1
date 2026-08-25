import { useEffect, useState } from 'react';

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
 * mutations `LayersPanel.tsx`'s `OutlineRowItem` already reads and calls —
 * `toggleShapeVisible`/`toggleShapeLocked`/`updateSelectedShapeColorField`/
 * the `opacity` `ShapeStyleField` mutation (`updateSelectedShapeNumericField`)
 * /`deleteSelected` for a shape, and `toggleGroupVisible`/
 * `toggleGroupLocked`/`deleteGroupSelected` for a group — never a new,
 * parallel mutation path. `LayersPanel.tsx` is left completely unchanged by
 * this task (additive only; see that file's own doc comment and issue #164,
 * which will remove the now-redundant inline controls once this HUD is the
 * documented replacement home for them).
 *
 * Renders nothing for: no selection, a layer row (layers are never
 * `selectedShapeId` — see `useSceneEditor.ts`'s `selectShape`), or an
 * outline multi-select pick with no single active shape/group (this HUD
 * only ever tracks the single `selectedShapeId`/`selectedGroup`, the same
 * "single active selection" concept `ShapeInspectorPanel.tsx` already
 * follows — multi-selection style editing is out of scope here exactly as
 * it is there).
 *
 * Dismiss behavior: this component just renders (or doesn't) from
 * `sceneEditor.selectedShape`/`selectedGroup` on every render, so clicking
 * empty canvas (`EditorWorkspace.tsx`'s `handleCanvasClick` already calls
 * `selectShape(null)` when nothing is hit) already hides it with no HUD-
 * specific code. Escape-to-deselect (the one behavior that didn't already
 * exist) is added as its own small `EditorWorkspace.tsx` keydown listener,
 * not here — this component has no window-level listeners of its own.
 */
function SelectionHud({ sceneEditor }: { sceneEditor: SceneEditor }) {
  const { selectedShape, selectedGroup, outline } = sceneEditor;

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

  if (selectedGroup) {
    const row = outline.find((r) => r.kind === 'group' && r.id === selectedGroup.id);
    const visible = row?.kind === 'group' ? row.visible : true;
    const locked = row?.kind === 'group' ? row.locked : false;
    return (
      <div
        className="editor-selection-hud"
        role="group"
        aria-label={`Selected: ${selectedGroup.name}`}
        data-testid="selection-hud"
      >
        <p className="editor-selection-hud-title">{selectedGroup.name}</p>
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
        </div>
      </div>
    );
  }

  if (!selectedShape) return null;

  const row = outline.find((r) => r.kind === 'shape' && r.id === selectedShape.id);
  const visible = row?.kind === 'shape' ? row.visible : true;
  const locked = row?.kind === 'shape' ? row.locked : false;
  const label = row?.kind === 'shape' ? row.label : selectedShape.id;

  return (
    <div
      className="editor-selection-hud"
      role="group"
      aria-label={`Selected: ${label}`}
      data-testid="selection-hud"
    >
      <p className="editor-selection-hud-title">{label}</p>
      <div className="editor-selection-hud-controls">
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
      </div>
    </div>
  );
}

export default SelectionHud;
