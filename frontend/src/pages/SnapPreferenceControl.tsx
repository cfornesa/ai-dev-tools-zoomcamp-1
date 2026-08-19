import { useRovingRadioGroup } from '../a11y/useRovingRadioGroup';
import { useSnapSettings } from '../editor/snapSettings';

/**
 * Issue #78: the editor-scoped snap-to-grid / alignment-guide toggle.
 *
 * Two independent on/off radio groups (not a single combined toggle, per
 * the acceptance criteria's "a pair of toggles, one for grid and one for
 * guides") — grid snapping and alignment-guide snapping are separately
 * useful (e.g. a user aligning shapes to each other but not to a fixed
 * grid), so they're independently controllable, following the exact
 * accessible pattern `ReducedMotionControl.tsx` (Task 29) already
 * established: `role="radiogroup"`/`role="radio"` + `aria-checked` for
 * each toggle, reusing `.demo-radio-option`'s pill styling, plus a
 * `role="status"` live line surfacing the *effective* combined state at
 * all times — not just inferable from which radio is checked (acceptance
 * criterion).
 *
 * Rendered in `EditorWorkspace.tsx`'s Tools panel (editor-specific, unlike
 * the global header Reduce motion control) — see that file's own render
 * for placement.
 */
function SnapToggle({
  label,
  enabled,
  onChange,
}: {
  label: string;
  enabled: boolean;
  onChange: (next: boolean) => void;
}) {
  const roving = useRovingRadioGroup([{ value: true }, { value: false }], enabled, onChange);

  return (
    <div role="radiogroup" aria-label={label} className="editor-tool-group">
      <span className="snap-toggle-label">{label}</span>
      <button
        type="button"
        role="radio"
        className="demo-radio-option"
        aria-checked={enabled}
        onClick={() => onChange(true)}
        {...roving.getRadioProps(true)}
      >
        On
      </button>
      <button
        type="button"
        role="radio"
        className="demo-radio-option"
        aria-checked={!enabled}
        onClick={() => onChange(false)}
        {...roving.getRadioProps(false)}
      >
        Off
      </button>
    </div>
  );
}

function SnapPreferenceControl() {
  const { gridEnabled, guidesEnabled, setGridEnabled, setGuidesEnabled } = useSnapSettings();

  const statusText =
    gridEnabled && guidesEnabled
      ? 'Snapping is on: grid and alignment guides.'
      : gridEnabled
        ? 'Snapping is on: grid only.'
        : guidesEnabled
          ? 'Snapping is on: alignment guides only.'
          : 'Snapping is off.';

  return (
    <div className="snap-preference-control">
      <h4>Snapping</h4>
      <SnapToggle label="Snap to grid" enabled={gridEnabled} onChange={setGridEnabled} />
      <SnapToggle label="Align to shapes" enabled={guidesEnabled} onChange={setGuidesEnabled} />
      <p role="status" aria-live="polite" className="snap-preference-status">
        {statusText}
      </p>
    </div>
  );
}

export default SnapPreferenceControl;
