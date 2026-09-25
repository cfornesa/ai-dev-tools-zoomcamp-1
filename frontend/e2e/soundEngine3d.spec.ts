/** Issues #306/#345: the live 3D sound controls perform an explicit user-gesture flow. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('3D sound engine', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('enables sound, exposes shared volume, and mutes cleanly', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
    // The canonical editor route is slug-based; keep the legacy route in the
    // matcher for disposable stacks that still expose it during migration.
    await page.waitForURL(/\/(?:projects3d\/[^/]+|users\/@[^/]+\/edit\/[^/]+)$/);

    const frame = page.getByTestId('scene3d-preview-canvas-frame');
    const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
    // Older bundles nested actions behind a hamburger. The current parity
    // contract renders stage actions directly; accept the legacy menu only
    // for a migration-era disposable stack.
    const legacyMenu = toolbar.getByRole('button', { name: 'Open piece controls menu' });
    if (await legacyMenu.count()) await legacyMenu.click();
    const enable = toolbar.getByRole('button', { name: 'Enable sound' });
    await expect(enable).toHaveAttribute('aria-pressed', 'false');
    await enable.click();

    const mute = toolbar.getByRole('button', { name: 'Mute sound' });
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    await toolbar.getByRole('button', { name: 'Piece controls', exact: true }).click();
    const volume = toolbar.getByLabel('Sound volume');
    await expect(volume).toBeVisible();
    await volume.fill('80');
    await expect(volume).toHaveValue('80');

    const ambientBpm = toolbar.getByLabel(/Ambient BPM/);
    await ambientBpm.fill('120');
    await expect(ambientBpm).toHaveValue('120');
    const ambientVolume = toolbar.getByLabel(/Ambient volume/);
    await ambientVolume.fill('30');
    await expect(ambientVolume).toHaveValue('30');
    const ambientMute = toolbar.getByLabel('Mute ambient');
    await ambientMute.check();
    await expect(ambientMute).toBeChecked();
    const scale = toolbar.getByRole('combobox', { name: 'Scale', exact: true });
    await scale.selectOption('major');
    await expect(scale).toHaveValue('major');

    const ambient = toolbar.getByLabel('Ambient instrument');
    const movement = toolbar.getByLabel('Movement instrument');
    const melodic = toolbar.getByLabel('Melodic instrument');
    await expect(ambient).toHaveValue('synth');
    await expect(movement).toHaveValue('synth');
    await expect(melodic).toHaveValue('synth');
    await movement.selectOption('fmsynth');
    await expect(movement).toHaveValue('fmsynth');
    await expect(ambient).toHaveValue('synth');
    await expect(melodic).toHaveValue('synth');

    await expect(toolbar.getByRole('group', { name: 'Keyboard synth' })).toBeVisible();
    const oscillator = toolbar.getByLabel('Oscillator');
    await oscillator.selectOption('square');
    await expect(oscillator).toHaveValue('square');
    await toolbar.getByLabel(/Octave:/).fill('2');
    await expect(toolbar.getByLabel(/Octave:/)).toHaveValue('2');

    await toolbar.getByRole('button', { name: 'Keyboard notes' }).click();
    const piano = toolbar.getByRole('group', { name: 'On-screen piano keyboard' });
    await expect(piano).toBeVisible();
    const c4 = piano.getByRole('button', { name: 'C4' });
    await c4.dispatchEvent('pointerdown');
    await expect(c4).toHaveAttribute('aria-pressed', 'true');
    await c4.dispatchEvent('pointerup');
    await expect(c4).toHaveAttribute('aria-pressed', 'false');

    await mute.click();
    await expect(toolbar.getByRole('button', { name: 'Enable sound' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(toolbar.getByLabel('Sound volume')).toHaveCount(0);
  });
});
