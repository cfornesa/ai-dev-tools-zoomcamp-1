import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Issue #78: like `ReducedMotionControl.test.tsx`, the snap preference
 * store (`../editor/snapSettings.ts`) is a module-level singleton, so
 * every test imports a fresh copy of both the store and this component
 * via `vi.resetModules()` + dynamic `import()` — a plain top-of-file
 * import would leak state (and localStorage writes) across tests.
 */
async function freshControl() {
  vi.resetModules();
  const [{ default: SnapPreferenceControl }, storeModule] = await Promise.all([
    import('./SnapPreferenceControl'),
    import('../editor/snapSettings'),
  ]);
  return {
    SnapPreferenceControl,
    SNAP_SETTINGS_STORAGE_KEY: storeModule.SNAP_SETTINGS_STORAGE_KEY,
  };
}

describe('SnapPreferenceControl', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders two independent radiogroups, both Off by default', async () => {
    const { SnapPreferenceControl } = await freshControl();
    render(<SnapPreferenceControl />);

    const gridGroup = screen.getByRole('radiogroup', { name: 'Snap to grid' });
    const guidesGroup = screen.getByRole('radiogroup', { name: 'Align to shapes' });

    expect(within(gridGroup).getByRole('radio', { name: 'On' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(within(gridGroup).getByRole('radio', { name: 'Off' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(guidesGroup).getByRole('radio', { name: 'On' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('exposes the combined effective state accessibly via a status region', async () => {
    const { SnapPreferenceControl } = await freshControl();
    render(<SnapPreferenceControl />);
    expect(screen.getByRole('status')).toHaveTextContent('Snapping is off.');
  });

  it('turning on grid snap updates aria-checked and the status region, independent of guides', async () => {
    const { SnapPreferenceControl } = await freshControl();
    const user = userEvent.setup({ delay: null });
    render(<SnapPreferenceControl />);

    const gridGroup = screen.getByRole('radiogroup', { name: 'Snap to grid' });
    await user.click(within(gridGroup).getByRole('radio', { name: 'On' }));

    expect(within(gridGroup).getByRole('radio', { name: 'On' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Snapping is on: grid only.');

    const guidesGroup = screen.getByRole('radiogroup', { name: 'Align to shapes' });
    expect(within(guidesGroup).getByRole('radio', { name: 'Off' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('turning on both grid and guides is reflected in the status region', async () => {
    const { SnapPreferenceControl } = await freshControl();
    const user = userEvent.setup({ delay: null });
    render(<SnapPreferenceControl />);

    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Snap to grid' })).getByRole('radio', {
        name: 'On',
      }),
    );
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Align to shapes' })).getByRole('radio', {
        name: 'On',
      }),
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Snapping is on: grid and alignment guides.',
    );
  });

  it('persists toggles so they can be recovered after a reload', async () => {
    const { SnapPreferenceControl, SNAP_SETTINGS_STORAGE_KEY } = await freshControl();
    const user = userEvent.setup({ delay: null });
    render(<SnapPreferenceControl />);

    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Align to shapes' })).getByRole('radio', {
        name: 'On',
      }),
    );

    expect(window.localStorage.getItem(SNAP_SETTINGS_STORAGE_KEY)).toBe(
      JSON.stringify({ gridEnabled: false, guidesEnabled: true }),
    );
  });

  it('gives the checked option the same visible selected-state class hook as other radio groups', async () => {
    const { SnapPreferenceControl } = await freshControl();
    render(<SnapPreferenceControl />);
    const gridGroup = screen.getByRole('radiogroup', { name: 'Snap to grid' });
    const onRadio = within(gridGroup).getByRole('radio', { name: 'On' });
    expect(onRadio).toHaveClass('demo-radio-option');
  });

  it('recovers previously stored settings on mount', async () => {
    const { SNAP_SETTINGS_STORAGE_KEY } = await freshControl();
    window.localStorage.setItem(
      SNAP_SETTINGS_STORAGE_KEY,
      JSON.stringify({ gridEnabled: true, guidesEnabled: false }),
    );
    const { SnapPreferenceControl } = await freshControl();

    render(<SnapPreferenceControl />);

    const gridGroup = screen.getByRole('radiogroup', { name: 'Snap to grid' });
    expect(within(gridGroup).getByRole('radio', { name: 'On' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Snapping is on: grid only.');
  });
});
