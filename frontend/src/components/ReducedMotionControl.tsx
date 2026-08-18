import { useReducedMotion, type MotionOverride } from '../a11y/reducedMotion';

const OPTIONS: Array<{ value: MotionOverride; label: string }> = [
  { value: 'system', label: 'Match system' },
  { value: 'reduced', label: 'Reduced' },
  { value: 'full', label: 'Full' },
];

/**
 * Task 29 (issue #28): the global Reduce motion control (`_docs/plan.md`'s
 * "Reduced motion" section calls for exactly this — "Include a global
 * Reduce motion control with manual override"). Rendered once in
 * `Layout.tsx`'s header so it's available from every route, not just the
 * editor.
 *
 * A three-way radio group — Match system / Reduced / Full — rather than a
 * single checkbox, because the effective setting has three real states:
 * "no manual override, follow the OS" is meaningfully different from "the
 * user explicitly forced Full motion even though their OS prefers
 * reduced." `role="radiogroup"`/`role="radio"` + `aria-checked` follows
 * the same accessible pattern already used by `EditorPanelSwitcher` and
 * `DemoControlsPanel`'s mode/gesture radio groups (see `.demo-radio-option`
 * in `index.css`), so it's keyboard- and screen-reader-operable the same
 * way those are.
 *
 * The live effective state (which of the three is *actually* in force
 * right now, accounting for the system preference when the override is
 * 'system') is exposed via a visible, `aria-live` status line — not just
 * inferable from which radio is checked — so a screen reader user gets an
 * explicit, current answer to "is motion reduced right now?" without
 * having to cross-reference the system preference themselves.
 */
function ReducedMotionControl() {
  const { override, effective, setOverride } = useReducedMotion();

  return (
    <div className="reduced-motion-control">
      <div role="radiogroup" aria-label="Reduce motion" className="editor-tool-group">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            className="demo-radio-option"
            aria-checked={override === option.value}
            onClick={() => setOverride(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p role="status" aria-live="polite" className="reduced-motion-status">
        Motion is currently {effective ? 'reduced' : 'full'}.
      </p>
    </div>
  );
}

export default ReducedMotionControl;
