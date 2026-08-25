/**
 * Task 138 (issue #170): pure field metadata/validation helpers for the
 * canvas-level settings row `LayersPanel.tsx` renders — the scene's own
 * `canvas.backgroundColor` and `canvas.opacity` (Task 138's new field).
 * Mirrors `shapeStyleFields.ts`'s split of pure validation/apply logic
 * from presentation for the exact same reason: easy to unit test without
 * rendering anything, and a single place each rule lives rather than
 * duplicated inline in the panel component.
 *
 * ## Why a separate module from `shapeStyleFields.ts`
 *
 * These two canvas fields aren't shape fields — there's no `Shape` to
 * apply them to, and `canvas.backgroundColor` has a different validity
 * rule than a shape's `fill`/`stroke`: the schema requires
 * `canvas.backgroundColor` to be a non-null color string (`canvas`'s
 * `required` list), whereas a shape's `fill`/`stroke` may be `null`
 * ("none"). Reusing `parseColorFieldEdit` here would silently accept an
 * empty value as "clear the background," which the schema would then
 * reject at save time with a confusing "missingRequired" error instead of
 * a clear, immediate one. `parseNumericFieldEdit`'s generic
 * `{label,min,max,step,rangeText}` spec shape *is* reused as-is for
 * opacity (via `CANVAS_OPACITY_FIELD_SPEC`), since 0–1 clamp-not-reject
 * numeric behavior is identical to a shape's own opacity field.
 */
import { parseNumericFieldEdit, type NumericFieldSpec } from './shapeStyleFields';

const COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export const CANVAS_OPACITY_LIMIT = { min: 0, max: 1 };

export const CANVAS_OPACITY_FIELD_SPEC: NumericFieldSpec = {
  field: 'opacity',
  label: 'Canvas opacity',
  min: CANVAS_OPACITY_LIMIT.min,
  max: CANVAS_OPACITY_LIMIT.max,
  step: 0.01,
  rangeText: `${CANVAS_OPACITY_LIMIT.min} to ${CANVAS_OPACITY_LIMIT.max} (0 = fully transparent composite, 1 = fully opaque)`,
};

/** Reads the scene's current `canvas.opacity`, defaulting to 1 (fully
 * opaque) when the field is absent — matches every renderer's own default
 * for a scene document written before Task 138 added this field (see
 * `schema/scene.schema.json`'s `canvas.opacity` description). */
export function getCanvasOpacity(scene: Record<string, unknown>): number {
  const canvas = scene.canvas as { opacity?: unknown } | undefined;
  return typeof canvas?.opacity === 'number' ? canvas.opacity : 1;
}

/** Reads the scene's current `canvas.backgroundColor`. Falls back to
 * `#ffffff` only for a malformed/missing value (the schema requires this
 * field, so a well-formed scene always has one) — never surfaced as a
 * validation error here, since this getter is display-only. */
export function getCanvasBackgroundColor(scene: Record<string, unknown>): string {
  const canvas = scene.canvas as { backgroundColor?: unknown } | undefined;
  return typeof canvas?.backgroundColor === 'string' ? canvas.backgroundColor : '#ffffff';
}

/** Validates raw text typed into the canvas background-color field.
 * Unlike a shape's `fill`/`stroke` (`parseColorFieldEdit`), an empty
 * value is rejected, not treated as "none" — `canvas.backgroundColor` is
 * required and non-nullable in the schema (there is deliberately no
 * canvas visibility/"none" concept; see issue #170's exclusion of a
 * canvas visibility toggle). */
export function parseCanvasBackgroundColorEdit(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (COLOR_PATTERN.test(trimmed)) return { ok: true, value: trimmed };
  return {
    ok: false,
    error: 'Background color must be a hex color like #4f46e5 (3, 6, or 8 hex digits after #).',
  };
}

/** Validates and clamps raw text typed into the canvas opacity field —
 * identical clamp-in-range/reject-non-finite policy to
 * `parseNumericFieldEdit` (see that function's doc comment). */
export function parseCanvasOpacityEdit(
  raw: string,
): { ok: true; value: number } | { ok: false; error: string } {
  return parseNumericFieldEdit(CANVAS_OPACITY_FIELD_SPEC, raw);
}
