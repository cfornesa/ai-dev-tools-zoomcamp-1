import { useEffect, useState } from 'react';

import { POSITION_LIMIT } from './sceneShapes';
import {
  COLOR_FIELD_LABELS,
  getColorFieldValue,
  getNumericFieldValue,
  NUMERIC_FIELD_SPECS,
  type ColorShapeField,
  type NumericFieldSpec,
} from './shapeStyleFields';
import type { SceneEditor } from './useSceneEditor';

type FieldOutcome = { ok: true } | { ok: false; error: string };

// Issue #79: the keyboard point-coordinate list's X/Y fields reuse
// `NumericStyleField` below exactly (same component, same input/keyboard
// behavior Task 60 established) rather than inventing a second field
// component. `NumericFieldSpec.field` is typed as `NumericShapeField` (the
// whole-shape position/scale/rotation/style fields `shapeStyleFields.ts`
// already knows about) since that's the only field this spec's shape is
// ever read from `NUMERIC_FIELD_SPECS`; the value is never actually read
// back off a point spec (see `NumericStyleField`'s body — it only reads
// `spec.label`/`spec.step`/`spec.rangeText`), so reusing `'positionX'`/
// `'positionY'` here purely for structural typing is safe.
const POINT_FIELD_RANGE_TEXT = `${POSITION_LIMIT.min} to ${POSITION_LIMIT.max}`;
function pointAxisSpec(axis: 'x' | 'y'): NumericFieldSpec {
  return {
    field: axis === 'x' ? 'positionX' : 'positionY',
    label: axis === 'x' ? 'X' : 'Y',
    min: POSITION_LIMIT.min,
    max: POSITION_LIMIT.max,
    step: 1,
    rangeText: POINT_FIELD_RANGE_TEXT,
  };
}

/**
 * Task 60 (issue #58): one keyboard-operable numeric field — position X/Y,
 * scale X/Y, rotation, opacity, or stroke width — for the shape-styling
 * section of the Inspector panel.
 *
 * Follows the same controlled-local-draft pattern `NodeParamFields.tsx`'s
 * `NumberField` established for Task 36/37: the input always echoes
 * exactly what the user typed (so a rejected intermediate keystroke, e.g.
 * a bare "-" mid-negative-number, never gets fought or snapped back), and
 * only a value that parses (`shapeStyleFields.ts`'s `parseNumericFieldEdit`)
 * is ever sent to `onCommit`. `key={fieldId + shape id}` on the caller's
 * side (see `ShapeInspectorPanel` below) remounts this component with a
 * fresh draft whenever the selected shape changes, so switching shapes (or
 * a deletion clearing the selection) can never leave a stale value
 * on-screen; the effect below additionally resyncs the draft whenever the
 * canonical `value` changes for some other reason while this shape stays
 * selected (undo/redo, or another commit landing between renders).
 *
 * Renders as `<input type="text" inputMode="decimal">` rather than
 * `type="number"`: a native number input silently discards (blanks out)
 * any text its own browser-level parser rejects — including a deliberately
 * invalid value like "abc" or a syntactically-valid-but-overflowing
 * "1e400" in some environments — before this component's own onChange
 * ever sees it, which would make this file's own textual validation
 * (and its specific error messages) unreachable for exactly the inputs
 * issue #58 requires it to catch. `inputMode="decimal"` still requests a
 * numeric-friendly keyboard on mobile. Keyboard increment/decrement is
 * implemented explicitly on ArrowUp/ArrowDown (rather than relying on a
 * native number input's spinner, which is pointer-only in some browsers
 * and not reliably keyboard-triggered in every environment), so it works
 * the same way regardless of input type.
 */
function NumericStyleField({
  spec,
  fieldId,
  value,
  onCommit,
}: {
  spec: NumericFieldSpec;
  fieldId: string;
  value: number;
  onCommit: (raw: string) => FieldOutcome;
}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const errorId = `${fieldId}-error`;
  const rangeId = `${fieldId}-range`;

  useEffect(() => {
    setDraft(String(value));
    setError(null);
  }, [value]);

  function commit(raw: string) {
    const outcome = onCommit(raw);
    setError(outcome.ok ? null : outcome.error);
  }

  return (
    <div className="shape-style-field">
      <label htmlFor={fieldId}>{spec.label}</label>
      <span id={rangeId} className="shape-style-field-range">
        {spec.rangeText}
      </span>
      <input
        id={fieldId}
        type="text"
        inputMode="decimal"
        value={draft}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${rangeId} ${errorId}` : rangeId}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          commit(next);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          const parsedDraft = Number(draft);
          const base = Number.isFinite(parsedDraft) ? parsedDraft : value;
          const delta = event.key === 'ArrowUp' ? spec.step : -spec.step;
          const next = String(base + delta);
          setDraft(next);
          commit(next);
        }}
      />
      {error && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** The color-field counterpart to `NumericStyleField` above, for fill and
 * stroke. Free-text rather than `<input type="color">` since the schema
 * (and this field) allows an empty value to mean "none" — a native color
 * picker cannot represent that. */
function ColorStyleField({
  field,
  fieldId,
  value,
  onCommit,
}: {
  field: ColorShapeField;
  fieldId: string;
  value: string | null;
  onCommit: (raw: string) => FieldOutcome;
}) {
  const [draft, setDraft] = useState(value ?? '');
  const [error, setError] = useState<string | null>(null);
  const errorId = `${fieldId}-error`;
  const rangeId = `${fieldId}-range`;

  useEffect(() => {
    setDraft(value ?? '');
    setError(null);
  }, [value]);

  return (
    <div className="shape-style-field">
      <label htmlFor={fieldId}>{COLOR_FIELD_LABELS[field]}</label>
      <span id={rangeId} className="shape-style-field-range">
        Hex color, e.g. #4f46e5 (3, 6, or 8 hex digits after #), or empty for none
      </span>
      <input
        id={fieldId}
        type="text"
        value={draft}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${rangeId} ${errorId}` : rangeId}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          const outcome = onCommit(next);
          setError(outcome.ok ? null : outcome.error);
        }}
      />
      {error && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Task 60 (issue #58): the Inspector panel's shape-styling section —
 * position X/Y, scale X/Y, rotation, opacity, fill, stroke, and stroke
 * width for the single actively selected shape (`sceneEditor.selectedShape`
 * — see `useSceneEditor.ts`'s Task 24 comment on why selection is a single
 * id shared between shapes and groups, and `sceneOutline.ts`'s
 * `multiSelectedIds`, which is a *separate* additive outline-only pick
 * used only to gather items to group, never a general multi-shape edit
 * target).
 *
 * Rendered in `EditorWorkspace.tsx`'s Inspector panel, in the exact slot
 * the Task 23 doc comment reserved for it ("Property editing is added in
 * a later task").
 *
 * ## Selection-state handling (issue #58's four required cases)
 *
 * - **No selection**: neither a shape nor a group nor any outline
 *   multi-pick is active — a plain empty-state message, no fields
 *   rendered at all (so nothing stale can linger).
 * - **Multi-selection**: `sceneEditor.multiSelectedIds` (the outline's
 *   additive grouping pick) has 2+ entries. The current app has no
 *   concept of editing several shapes' style at once — only a single
 *   active `selectedShapeId` — so per issue #58's own guidance ("if only
 *   single-selection exists today... clearly document that multi-selection
 *   editing is deferred"), this shows an explanatory message instead of
 *   fields for whichever shape happens to be the single active selection,
 *   which would misleadingly suggest editing applies to the whole pick.
 * - **A group selected** (not a multi-pick — the single active selection
 *   is a group id): style fields don't apply to a group as a unit today,
 *   so this shows a message pointing at the individual shapes inside it.
 * - **Hidden selection**: the selected shape's `outline` row reports
 *   `inheritedVisible: false` (its layer or an ancestor group has
 *   visibility off). Fields still render and remain editable — hiding a
 *   shape doesn't lock it — but a visible notice makes it clear *why* the
 *   canvas/preview isn't showing the shape being edited, so the values
 *   don't look mysteriously disconnected from what's on screen.
 * - **Selection deletion**: `sceneEditor.selectedShape` is recomputed
 *   fresh from `workingCopy`/`selectedShapeId` on every render (see
 *   `useSceneEditor.ts`), and every deletion path there clears
 *   `selectedShapeId` synchronously — so the very next render already
 *   shows the empty state, with no stale shape values ever painted.
 */
function ShapeInspectorPanel({ sceneEditor }: { sceneEditor: SceneEditor }) {
  const { selectedShape, selectedGroup, multiSelectedIds, outline } = sceneEditor;

  if (multiSelectedIds.length >= 2) {
    return (
      <div className="shape-inspector" role="group" aria-label="Shape style">
        <h4>Shape style</h4>
        <p role="status" aria-live="polite">
          {multiSelectedIds.length} shapes are selected in the outline for grouping. Style editing
          works on a single selected shape at a time — select just one shape to edit its position,
          scale, rotation, opacity, fill, stroke, and stroke width.
        </p>
      </div>
    );
  }

  if (selectedGroup) {
    return (
      <div className="shape-inspector" role="group" aria-label="Shape style">
        <h4>Shape style</h4>
        <p role="status" aria-live="polite">
          A group is selected. Select an individual shape inside it to edit its style.
        </p>
      </div>
    );
  }

  if (!selectedShape) {
    return (
      <div className="shape-inspector" role="group" aria-label="Shape style">
        <h4>Shape style</h4>
        <p role="status" aria-live="polite">
          No shape selected. Select a shape in the canvas or the outline to edit its position,
          scale, rotation, opacity, fill, stroke, and stroke width.
        </p>
      </div>
    );
  }

  const outlineRow = outline.find((row) => row.kind === 'shape' && row.id === selectedShape.id);
  const isHidden = outlineRow?.kind === 'shape' && !outlineRow.inheritedVisible;

  return (
    <div className="shape-inspector" role="group" aria-label="Shape style">
      <h4>Shape style</h4>
      {isHidden && (
        <p role="status" aria-live="polite">
          This shape is currently hidden (its layer or group visibility is off). Editing its style
          here still updates scene state, but it will not appear on the canvas or preview until it
          is made visible again.
        </p>
      )}
      {NUMERIC_FIELD_SPECS.map((spec) => (
        <NumericStyleField
          key={`${selectedShape.id}-${spec.field}`}
          spec={spec}
          fieldId={`shape-style-${spec.field}`}
          value={getNumericFieldValue(selectedShape, spec.field)}
          onCommit={(raw) => sceneEditor.updateSelectedShapeNumericField(spec.field, raw)}
        />
      ))}
      {(['fill', 'stroke'] as ColorShapeField[]).map((field) => (
        <ColorStyleField
          key={`${selectedShape.id}-${field}`}
          field={field}
          fieldId={`shape-style-${field}`}
          value={getColorFieldValue(selectedShape, field)}
          onCommit={(raw) => sceneEditor.updateSelectedShapeColorField(field, raw)}
        />
      ))}

      {/* Issue #79: per-vertex path editing — the "Edit points" toggle plus
          the keyboard-accessible point-coordinate list. Both are gated to
          `selectedShape.type === 'path'` only (never rendered for any
          other shape type, a group, or a multi-selection — both earlier
          returns above already rule out group/multi-selection, so this
          check alone is sufficient here). The toggle enters/exits canvas
          vertex edit mode (`EditorWorkspace.tsx`'s point handles); the
          point list itself doesn't require that mode to be active — it's
          the keyboard-only parity path issue #79 requires independent of
          the pointer gesture. */}
      {selectedShape.type === 'path' && (
        <PathPointsSection sceneEditor={sceneEditor} shape={selectedShape} />
      )}
    </div>
  );
}

/**
 * Issue #79: the "Edit points" toggle button and keyboard point-coordinate
 * list for a selected `path` shape — see `ShapeInspectorPanel`'s own render
 * call above for the gating rationale. Kept as its own component (rather
 * than inlined) purely for readability; it shares `sceneEditor`'s vertex
 * state/actions with `EditorWorkspace.tsx`'s canvas handles, so the two
 * stay perfectly in sync (e.g. clicking a canvas handle to select a vertex
 * is reflected here, and editing a point's X/Y here is reflected on the
 * canvas) with no separate state to keep in sync.
 */
function PathPointsSection({
  sceneEditor,
  shape,
}: {
  sceneEditor: SceneEditor;
  shape: { id: string; points: { x: number; y: number }[] };
}) {
  return (
    <div className="shape-vertex-editor">
      <button
        type="button"
        aria-pressed={sceneEditor.vertexEditActive}
        onClick={() => sceneEditor.toggleVertexEditMode()}
      >
        {sceneEditor.vertexEditActive ? 'Exit edit points' : 'Edit points'}
      </button>

      {sceneEditor.vertexError && (
        <p role="status" aria-live="polite">
          {sceneEditor.vertexError}
        </p>
      )}

      <div role="group" aria-label="Path points" className="shape-vertex-list">
        <h5>Points</h5>
        <ul>
          {shape.points.map((point, index) => (
            <li key={`${shape.id}-point-${index}`}>
              <span>Point {index + 1}</span>
              <NumericStyleField
                spec={pointAxisSpec('x')}
                fieldId={`shape-vertex-${shape.id}-${index}-x`}
                value={point.x}
                onCommit={(raw) => sceneEditor.updateVertexPointField(index, 'x', raw)}
              />
              <NumericStyleField
                spec={pointAxisSpec('y')}
                fieldId={`shape-vertex-${shape.id}-${index}-y`}
                value={point.y}
                onCommit={(raw) => sceneEditor.updateVertexPointField(index, 'y', raw)}
              />
              <button type="button" onClick={() => sceneEditor.deleteVertexAt(index)}>
                Delete point {index + 1}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => sceneEditor.addVertexNearLast()}>
          Add point
        </button>
      </div>
    </div>
  );
}

export default ShapeInspectorPanel;
