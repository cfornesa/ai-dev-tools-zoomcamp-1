/**
 * Task 60 (issue #58): pure field metadata/validation/apply helpers for the
 * Inspector panel's shape-styling section — position X/Y, scale X/Y,
 * rotation, opacity, fill, stroke, and stroke width for the single actively
 * selected shape (`sceneEditor.selectedShape`).
 *
 * Kept separate from `ShapeInspectorPanel.tsx` (presentation) the same way
 * `behaviorCards.ts`/`graphEditing.ts`/`sceneOutline.ts` separate pure
 * data/validation logic from their panel components — every function here
 * is a plain, side-effect-free transform over a `Shape`, easy to unit test
 * without rendering anything.
 *
 * ## Out-of-range policy (documented once, here, for this whole feature)
 *
 * Numeric fields **clamp** a valid finite number into range rather than
 * rejecting it — the same policy `sceneShapes.ts`'s pointer transform
 * handles (Task 26, `clamp`/`POSITION_LIMIT`/`ROTATION_LIMIT`) and
 * `behaviorRuntime.ts`'s `clampToTargetRange` (Task 35/37,
 * `NUMERIC_TARGET_RANGES`) already use for these exact properties
 * (position/scale/rotation/opacity). Reusing the same limits and the same
 * policy here keeps typing "9999" into Position X behave identically to
 * dragging the move handle past the canvas edge: the value settles at the
 * boundary instead of the whole edit being thrown away.
 *
 * Invalid text (anything that doesn't parse as a number, e.g. "abc", a
 * bare "-", or an empty field) and non-finite values (`NaN`, `Infinity`,
 * `-Infinity`) are **rejected** outright: `parseNumericFieldEdit` returns
 * `{ ok: false }` for these and the caller must not write anything to
 * scene state. This is the one asymmetry in the policy — "in range or
 * clampable" always succeeds, "not a real number at all" never does.
 *
 * Color fields (fill/stroke) have no numeric range; a value is accepted
 * only if it is empty (meaning "none" — the schema allows `null` for both)
 * or matches the canonical `#rgb`/`#rrggbb`/`#rrggbbaa` hex pattern
 * (`schema/scene.schema.json`'s `$defs.color`, duplicated here as a plain
 * regex per this task's constraint not to modify the schema itself — same
 * approach `sceneShapes.ts`'s `POSITION_LIMIT`/etc. and
 * `behaviorRuntime.ts`'s `COLOR_PATTERN` already take). Anything else is
 * rejected with a specific error message.
 */

import { clamp, POSITION_LIMIT, ROTATION_LIMIT, type Shape } from './sceneShapes';

export const SCALE_LIMIT = { min: 0, max: 100 };
export const OPACITY_LIMIT = { min: 0, max: 1 };
export const STROKE_WIDTH_LIMIT = { min: 0, max: 64 };

const COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export type NumericShapeField =
  'positionX' | 'positionY' | 'scaleX' | 'scaleY' | 'rotation' | 'opacity' | 'strokeWidth';

export type ColorShapeField = 'fill' | 'stroke';

export type ShapeStyleField = NumericShapeField | ColorShapeField;

export type NumericFieldSpec = {
  field: NumericShapeField;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Visible, accessible unit/range text rendered next to the field's
   * label — not a tooltip (see this file's module doc comment / issue
   * #58's acceptance criteria). */
  rangeText: string;
};

export const NUMERIC_FIELD_SPECS: NumericFieldSpec[] = [
  {
    field: 'positionX',
    label: 'Position X',
    min: POSITION_LIMIT.min,
    max: POSITION_LIMIT.max,
    step: 1,
    rangeText: `${POSITION_LIMIT.min} to ${POSITION_LIMIT.max} px`,
  },
  {
    field: 'positionY',
    label: 'Position Y',
    min: POSITION_LIMIT.min,
    max: POSITION_LIMIT.max,
    step: 1,
    rangeText: `${POSITION_LIMIT.min} to ${POSITION_LIMIT.max} px`,
  },
  {
    field: 'scaleX',
    label: 'Scale X',
    min: SCALE_LIMIT.min,
    max: SCALE_LIMIT.max,
    step: 0.1,
    rangeText: `${SCALE_LIMIT.min} to ${SCALE_LIMIT.max} (1 = original size)`,
  },
  {
    field: 'scaleY',
    label: 'Scale Y',
    min: SCALE_LIMIT.min,
    max: SCALE_LIMIT.max,
    step: 0.1,
    rangeText: `${SCALE_LIMIT.min} to ${SCALE_LIMIT.max} (1 = original size)`,
  },
  {
    field: 'rotation',
    label: 'Rotation',
    min: ROTATION_LIMIT.min,
    max: ROTATION_LIMIT.max,
    step: 1,
    rangeText: `${ROTATION_LIMIT.min} to ${ROTATION_LIMIT.max} degrees`,
  },
  {
    field: 'opacity',
    label: 'Opacity',
    min: OPACITY_LIMIT.min,
    max: OPACITY_LIMIT.max,
    step: 0.01,
    rangeText: `${OPACITY_LIMIT.min} to ${OPACITY_LIMIT.max} (0 = transparent, 1 = opaque)`,
  },
  {
    field: 'strokeWidth',
    label: 'Stroke width',
    min: STROKE_WIDTH_LIMIT.min,
    max: STROKE_WIDTH_LIMIT.max,
    step: 1,
    rangeText: `${STROKE_WIDTH_LIMIT.min} to ${STROKE_WIDTH_LIMIT.max} px`,
  },
];

export const COLOR_FIELD_LABELS: Record<ColorShapeField, string> = {
  fill: 'Fill',
  stroke: 'Stroke',
};

export function getNumericFieldValue(shape: Shape, field: NumericShapeField): number {
  switch (field) {
    case 'positionX':
      return shape.transform.x;
    case 'positionY':
      return shape.transform.y;
    case 'scaleX':
      return shape.transform.scaleX;
    case 'scaleY':
      return shape.transform.scaleY;
    case 'rotation':
      return shape.transform.rotation;
    case 'opacity':
      return shape.transform.opacity;
    case 'strokeWidth':
      return shape.style.strokeWidth;
  }
}

export function getColorFieldValue(shape: Shape, field: ColorShapeField): string | null {
  return field === 'fill' ? shape.style.fill : shape.style.stroke;
}

/** Validates and clamps raw text typed (or keyboard-incremented) into a
 * numeric field. Never returns a non-finite value — invalid/non-finite
 * input is rejected via `ok: false` with a specific, field-named error
 * message instead. */
export function parseNumericFieldEdit(
  spec: NumericFieldSpec,
  raw: string,
): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { ok: false, error: `${spec.label} must be a number (${spec.rangeText}).` };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: `${spec.label} must be a finite number (${spec.rangeText}).` };
  }
  return { ok: true, value: clamp(parsed, spec.min, spec.max) };
}

/** Validates raw text typed into a color field. An empty value is valid
 * and means "none" (the schema allows `null` for both `fill` and
 * `stroke`); anything else must be a well-formed `#rgb`/`#rrggbb`/
 * `#rrggbbaa` hex color. */
export function parseColorFieldEdit(
  field: ColorShapeField,
  raw: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: null };
  if (COLOR_PATTERN.test(trimmed)) return { ok: true, value: trimmed };
  return {
    ok: false,
    error: `${COLOR_FIELD_LABELS[field]} must be a hex color like #4f46e5 (3, 6, or 8 hex digits after #), or empty for none.`,
  };
}

export function applyNumericFieldToShape(
  shape: Shape,
  field: NumericShapeField,
  value: number,
): Shape {
  switch (field) {
    case 'positionX':
      return { ...shape, transform: { ...shape.transform, x: value } };
    case 'positionY':
      return { ...shape, transform: { ...shape.transform, y: value } };
    case 'scaleX':
      return { ...shape, transform: { ...shape.transform, scaleX: value } };
    case 'scaleY':
      return { ...shape, transform: { ...shape.transform, scaleY: value } };
    case 'rotation':
      return { ...shape, transform: { ...shape.transform, rotation: value } };
    case 'opacity':
      return { ...shape, transform: { ...shape.transform, opacity: value } };
    case 'strokeWidth':
      return { ...shape, style: { ...shape.style, strokeWidth: value } };
  }
}

export function applyColorFieldToShape(
  shape: Shape,
  field: ColorShapeField,
  value: string | null,
): Shape {
  return field === 'fill'
    ? { ...shape, style: { ...shape.style, fill: value } }
    : { ...shape, style: { ...shape.style, stroke: value } };
}
