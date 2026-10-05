import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Account settings reorder controls (#677)', () => {
  const fixtures = requireE2EFixtures();

  test('supports keyboard lift, move, drop, and Escape cancellation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/account/settings');

    const profileHandle = page.getByRole('button', { name: 'Reorder Public profile' });
    await expect(page.locator('[data-settings-section]').first()).toBeVisible();
    const initialOrder = await page
      .locator('[data-settings-section]')
      .evaluateAll((items) => items.map((item) => item.getAttribute('data-settings-section')));
    await expect(page.locator('.account-settings-drag-handle')).toHaveCount(initialOrder.length);
    await expect(profileHandle).toHaveCSS('touch-action', 'none');

    await profileHandle.focus();
    await profileHandle.press('Space');
    await expect(profileHandle).toHaveAttribute('aria-grabbed', 'true');
    const profileIndex = initialOrder.indexOf('profile');
    const moveKey = profileIndex > 0 ? 'ArrowUp' : 'ArrowDown';
    await profileHandle.press(moveKey);
    await expect(page.locator('.visually-hidden[role="status"]')).toContainText(
      `moved ${moveKey === 'ArrowUp' ? 'up' : 'down'}`,
    );
    await profileHandle.press('Space');
    await expect(profileHandle).toHaveAttribute('aria-grabbed', 'false');
    const movedOrder = await page
      .locator('[data-settings-section]')
      .evaluateAll((items) => items.map((item) => item.getAttribute('data-settings-section')));
    const expectedOrder = [...initialOrder];
    const targetIndex = profileIndex + (moveKey === 'ArrowUp' ? -1 : 1);
    [expectedOrder[profileIndex], expectedOrder[targetIndex]] = [
      expectedOrder[targetIndex],
      expectedOrder[profileIndex],
    ];
    expect(movedOrder).toEqual(expectedOrder);

    await profileHandle.focus();
    await profileHandle.press('Space');
    await profileHandle.press('ArrowDown');
    await profileHandle.press('Escape');
    await expect(profileHandle).toHaveAttribute('aria-grabbed', 'false');
    await expect(page.locator('.visually-hidden[role="status"]')).toContainText('cancelled');

    await page.screenshot({
      path: test.info().outputPath('account-settings-idle.png'),
      fullPage: true,
    });
  });

  test('shows a dashed placeholder during pointer drag on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/account/settings');

    const source = page.locator('[data-settings-section="profile"]');
    const target = page.locator('[data-settings-section="credentials"]');
    const handle = source.getByRole('button', { name: 'Reorder Public profile' });
    const targetBox = await target.boundingBox();
    if (!targetBox) throw new Error('Could not measure the credentials section.');
    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error('Could not measure the profile drag handle.');

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + 20, targetBox.y + 10, { steps: 5 });
    await expect(page.locator('.account-settings-drop-placeholder')).toBeVisible();
    await expect(source).toHaveClass(/is-dragging/);
    await page.screenshot({
      path: test.info().outputPath('account-settings-dragging-mobile.png'),
      fullPage: true,
    });
    await page.mouse.up();
    await expect(page.locator('.account-settings-drop-placeholder')).toHaveCount(0);
    await page.screenshot({
      path: test.info().outputPath('account-settings-dropped-mobile.png'),
      fullPage: true,
    });
  });
});
