import { useReducedMotion } from '../a11y/reducedMotion';

/** Compact shell control that follows the OS until the user chooses a mode. */
function ReducedMotionToggle() {
  const { override, effective, setOverride } = useReducedMotion();
  const nextReduced = !effective;
  const label = nextReduced ? 'Use reduced motion' : 'Use full motion';

  return (
    <button
      type="button"
      className="shell-motion-toggle"
      aria-label={label}
      title={label}
      aria-pressed={override !== 'system' ? effective : undefined}
      onClick={() => setOverride(nextReduced ? 'reduced' : 'full')}
    >
      <span aria-hidden="true">{effective ? '◌' : '✦'}</span>
    </button>
  );
}

export default ReducedMotionToggle;
