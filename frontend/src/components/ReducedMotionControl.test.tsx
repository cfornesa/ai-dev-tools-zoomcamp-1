import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The reduced-motion store (`../a11y/reducedMotion.ts`) is a module-level
 * singleton by design (see that file's own comment), so — unlike most
 * components in this codebase — every test here must import a *fresh*
 * copy of both the store and this component via `vi.resetModules()` +
 * dynamic `import()`. A plain top-of-file `import` would share one store
 * instance across every test in this file, letting an override set in one
 * test (and its localStorage write) leak into the next.
 */
async function freshControl() {
  vi.resetModules();
  const [{ default: ReducedMotionControl }, storeModule] = await Promise.all([
    import('./ReducedMotionControl'),
    import('../a11y/reducedMotion'),
  ]);
  return {
    ReducedMotionControl,
    MOTION_OVERRIDE_STORAGE_KEY: storeModule.MOTION_OVERRIDE_STORAGE_KEY,
  };
}

describe('ReducedMotionControl', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders three accessible radio options with System checked by default', async () => {
    const { ReducedMotionControl } = await freshControl();
    render(<ReducedMotionControl />);
    const group = screen.getByRole('radiogroup', { name: 'Reduce motion' });
    expect(group).toBeInTheDocument();

    const system = screen.getByRole('radio', { name: 'Match system' });
    const reduced = screen.getByRole('radio', { name: 'Reduced' });
    const full = screen.getByRole('radio', { name: 'Full' });
    expect(system).toHaveAttribute('aria-checked', 'true');
    expect(reduced).toHaveAttribute('aria-checked', 'false');
    expect(full).toHaveAttribute('aria-checked', 'false');
  });

  it('exposes the current effective state accessibly via a status region', async () => {
    const { ReducedMotionControl } = await freshControl();
    render(<ReducedMotionControl />);
    expect(screen.getByRole('status')).toHaveTextContent('Motion is currently full.');
  });

  it('forcing Reduced updates aria-checked and the status region', async () => {
    const { ReducedMotionControl } = await freshControl();
    const user = userEvent.setup({ delay: null });
    render(<ReducedMotionControl />);

    await user.click(screen.getByRole('radio', { name: 'Reduced' }));

    expect(screen.getByRole('radio', { name: 'Reduced' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Match system' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Motion is currently reduced.');
  });

  it('forcing Full updates aria-checked and the status region', async () => {
    const { ReducedMotionControl } = await freshControl();
    const user = userEvent.setup({ delay: null });
    render(<ReducedMotionControl />);

    await user.click(screen.getByRole('radio', { name: 'Full' }));

    expect(screen.getByRole('radio', { name: 'Full' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Motion is currently full.');
  });

  it('persists the override so it can be recovered after a reload', async () => {
    const { ReducedMotionControl, MOTION_OVERRIDE_STORAGE_KEY } = await freshControl();
    const user = userEvent.setup({ delay: null });
    render(<ReducedMotionControl />);

    await user.click(screen.getByRole('radio', { name: 'Reduced' }));

    expect(window.localStorage.getItem(MOTION_OVERRIDE_STORAGE_KEY)).toBe('reduced');
  });

  it('gives the checked option the same visible selected-state class hook as other radio groups', async () => {
    const { ReducedMotionControl } = await freshControl();
    const user = userEvent.setup({ delay: null });
    render(<ReducedMotionControl />);
    const reduced = screen.getByRole('radio', { name: 'Reduced' });
    expect(reduced).toHaveClass('demo-radio-option');

    await user.click(reduced);
    expect(reduced).toHaveAttribute('aria-checked', 'true');
  });

  it('recovers a previously stored override on mount (stored-preference recovery)', async () => {
    const { MOTION_OVERRIDE_STORAGE_KEY } = await freshControl();
    window.localStorage.setItem(MOTION_OVERRIDE_STORAGE_KEY, 'reduced');
    const { ReducedMotionControl } = await freshControl();

    render(<ReducedMotionControl />);

    expect(screen.getByRole('radio', { name: 'Reduced' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Motion is currently reduced.');
  });

  it('is a roving-tabindex radiogroup: arrow keys move focus and selection, wrapping at both ends', async () => {
    const { ReducedMotionControl } = await freshControl();
    const user = userEvent.setup({ delay: null });
    render(<ReducedMotionControl />);

    const system = screen.getByRole('radio', { name: 'Match system' });
    const reduced = screen.getByRole('radio', { name: 'Reduced' });
    const full = screen.getByRole('radio', { name: 'Full' });

    // Only the checked ("Match system") radio is in the Tab sequence.
    expect(system).toHaveAttribute('tabindex', '0');
    expect(reduced).toHaveAttribute('tabindex', '-1');
    expect(full).toHaveAttribute('tabindex', '-1');

    system.focus();
    await user.keyboard('{ArrowRight}');
    expect(reduced).toHaveFocus();
    expect(reduced).toHaveAttribute('aria-checked', 'true');
    expect(reduced).toHaveAttribute('tabindex', '0');
    expect(system).toHaveAttribute('aria-checked', 'false');
    expect(system).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{ArrowRight}');
    expect(full).toHaveFocus();
    expect(full).toHaveAttribute('aria-checked', 'true');

    // Wraps forward from the last option back to the first.
    await user.keyboard('{ArrowRight}');
    expect(system).toHaveFocus();
    expect(system).toHaveAttribute('aria-checked', 'true');

    // Wraps backward from the first option to the last.
    await user.keyboard('{ArrowLeft}');
    expect(full).toHaveFocus();
    expect(full).toHaveAttribute('aria-checked', 'true');
  });
});
