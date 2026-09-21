import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('Admin spacing (#681)', () => {
  const fixtures = requireE2EFixtures();

  test('uses shared spacing tokens and full-width long fields without overflow', async ({
    browser,
  }, testInfo) => {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.admin.email, fixtures.password);

      await page.goto('/admin/settings');
      await expect(page.getByRole('heading', { name: 'Admin settings' })).toBeVisible();
      await expect(page.getByRole('form', { name: 'Site title settings' })).toBeVisible();
      const settingsMetrics = await page.locator('.admin-settings').evaluate((root) => {
        const section = root.querySelector<HTMLElement>('.admin-console-section');
        const form = root.querySelector<HTMLElement>('.admin-settings-form');
        const label = form?.querySelector<HTMLElement>('label');
        const input = form?.querySelector<HTMLElement>('input:not([type="checkbox"])');
        if (!section || !form || !label || !input) throw new Error('Expected admin settings form.');
        const sectionStyle = getComputedStyle(section);
        const formStyle = getComputedStyle(form);
        const labelStyle = getComputedStyle(label);
        const rootStyle = getComputedStyle(root);
        return {
          sectionPadding: sectionStyle.padding,
          formGap: formStyle.gap,
          labelGap: labelStyle.gap,
          inputWidth: input.getBoundingClientRect().width,
          inputParentWidth: label.getBoundingClientRect().width,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          space2: rootStyle.getPropertyValue('--space-2').trim(),
          space4: rootStyle.getPropertyValue('--space-4').trim(),
          space6: rootStyle.getPropertyValue('--space-6').trim(),
        };
      });
      expect(settingsMetrics).toMatchObject({
        sectionPadding: '24px',
        formGap: '16px',
        labelGap: '8px',
        space2: '8px',
        space4: '16px',
        space6: '24px',
      });
      expect(settingsMetrics.inputWidth).toBeGreaterThanOrEqual(
        settingsMetrics.inputParentWidth - 1,
      );
      expect(settingsMetrics.overflow).toBeLessThanOrEqual(0);

      await page.screenshot({
        path: testInfo.outputPath(
          'admin-settings-spacing-' + viewport.width + 'x' + viewport.height + '.png',
        ),
        fullPage: true,
      });

      await page.goto('/admin/pages');
      await expect(page.getByRole('heading', { name: 'Pages' })).toBeVisible();
      await page.getByRole('button', { name: 'New page' }).click();
      const pageForm = page.getByRole('form', { name: 'CMS page editor' });
      await expect(pageForm).toBeVisible();
      await pageForm
        .getByLabel('Description', { exact: true })
        .fill('Long description '.repeat(30));

      const pageMetrics = await pageForm.evaluate((form) => {
        const textarea = form.querySelector<HTMLTextAreaElement>('textarea');
        if (!textarea) throw new Error('Expected CMS long-text field.');
        const formStyle = getComputedStyle(form);
        const textareaStyle = getComputedStyle(textarea);
        return {
          formGap: formStyle.gap,
          textareaWidth: textarea.getBoundingClientRect().width,
          formWidth: form.getBoundingClientRect().width,
          textareaBoxSizing: textareaStyle.boxSizing,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      expect(pageMetrics.formGap).toBe('16px');
      expect(pageMetrics.textareaWidth).toBeGreaterThanOrEqual(pageMetrics.formWidth - 1);
      expect(pageMetrics.textareaBoxSizing).toBe('border-box');
      expect(pageMetrics.overflow).toBeLessThanOrEqual(0);

      await page.screenshot({
        path: testInfo.outputPath(
          'admin-pages-spacing-' + viewport.width + 'x' + viewport.height + '.png',
        ),
        fullPage: true,
      });
      await page.getByRole('button', { name: 'Cancel' }).click();
      await context.close();
    }
  });
});
