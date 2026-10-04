import type { Page } from '@playwright/test';

/** Saves the current persisted scene through the canonical editor action. */
export async function saveScene(page: Page): Promise<void> {
  await page
    .getByRole('group', { name: 'Primary editor actions' })
    .getByRole('button', { name: 'Save scene' })
    .click();
}
