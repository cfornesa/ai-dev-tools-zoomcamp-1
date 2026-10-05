import { expect, test } from '@playwright/test';

import { createServerProjectAndOpenAIProposalPanel } from './support/aiProposal.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
] as const;

test.describe('2D AI panel layout (#678)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`keeps fields full width at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const { panel } = await createServerProjectAndOpenAIProposalPanel(page, '2d');
      await expect(panel).toBeVisible();
      const prompt = panel.getByLabel('Describe the scene you want to generate');
      await expect(prompt).toHaveCSS('resize', 'vertical');
      const promptBox = await prompt.boundingBox();
      const panelBox = await panel.boundingBox();
      expect(promptBox).not.toBeNull();
      expect(panelBox).not.toBeNull();
      expect(promptBox!.width).toBeGreaterThanOrEqual(panelBox!.width - 2);
      expect(promptBox!.height).toBeGreaterThanOrEqual(96);
      const selectWidths = await panel
        .locator('select')
        .evaluateAll((elements) =>
          elements.map((element) => [
            element.getBoundingClientRect().width,
            element.parentElement?.getBoundingClientRect().width ?? 0,
          ]),
        );
      expect(selectWidths.every(([width, parentWidth]) => width >= parentWidth - 2)).toBe(true);
      await expect(panel.getByRole('radiogroup')).toHaveCount(2);
      expect(await panel.locator('button').count()).toBeGreaterThanOrEqual(4);

      const overflow = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        rootScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        layoutBoxes: ['#root', '.app-shell', '#main-content', '.cosmic-starfield'].map(
          (selector) => {
            const element = document.querySelector<HTMLElement>(selector);
            if (!element) return { selector, found: false };
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
              selector,
              found: true,
              x: rect.x,
              right: rect.right,
              width: rect.width,
              overflowX: style.overflowX,
              overflowY: style.overflowY,
              position: style.position,
            };
          },
        ),
        overflowCandidates: [...document.querySelectorAll<HTMLElement>('*')]
          .map((element) => ({
            selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${
              element.className && typeof element.className === 'string'
                ? `.${element.className.trim().split(/\s+/).join('.')}`
                : ''
            }`,
            right: element.getBoundingClientRect().right,
            width: element.getBoundingClientRect().width,
          }))
          .filter(({ right }) => right > window.innerWidth + 1)
          .slice(0, 8),
      }));
      await page.screenshot({
        path: test.info().outputPath(`ai-2d-${viewport.width}.png`),
        fullPage: true,
      });
      expect(overflow.rootScrollWidth > overflow.viewportWidth, JSON.stringify(overflow)).toBe(
        false,
      );
    });
  }

  test('keeps the desktop prompt clear of display toggles and both controls keyboard-operable (#1228)', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const { panel } = await createServerProjectAndOpenAIProposalPanel(page, '2d');
    const prompt = panel.getByLabel('Describe the scene you want to generate');
    const displaySettings = page.getByRole('complementary', { name: 'Display settings' });

    await expect(prompt).toBeVisible();
    await expect(displaySettings).toBeVisible();
    const [promptBox, togglesBox] = await Promise.all([
      prompt.boundingBox(),
      displaySettings.boundingBox(),
    ]);
    expect(promptBox).not.toBeNull();
    expect(togglesBox).not.toBeNull();
    const overlaps =
      promptBox!.x < togglesBox!.x + togglesBox!.width &&
      promptBox!.x + promptBox!.width > togglesBox!.x &&
      promptBox!.y < togglesBox!.y + togglesBox!.height &&
      promptBox!.y + promptBox!.height > togglesBox!.y;
    const workspaceStyle = await page
      .locator('#main-content .editor-workspace:has([data-testid="editor-ai-layer-panel"])')
      .evaluate((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return {
          className: element.className,
          paddingRight: style.paddingRight,
          boxSizing: style.boxSizing,
          left: box.left,
          right: box.right,
        };
      });
    expect(overlaps, JSON.stringify({ promptBox, togglesBox, workspaceStyle })).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath('ai-2d-display-toggle-clearance-1280.png'),
      fullPage: true,
    });

    await prompt.click({
      position: { x: promptBox!.width - 12, y: promptBox!.height - 12 },
    });
    await prompt.fill('Pointer interaction remains available.');
    await expect(prompt).toHaveValue('Pointer interaction remains available.');

    const themeToggle = page.locator('.shell-theme-toggle');
    const initialThemeLabel = await themeToggle.getAttribute('aria-label');
    await themeToggle.focus();
    await expect(themeToggle).toBeFocused();
    await page.keyboard.press('Space');
    await expect(themeToggle).not.toHaveAttribute('aria-label', initialThemeLabel!);
    await page.keyboard.press('Space');
    await expect(themeToggle).toHaveAttribute('aria-label', initialThemeLabel!);

    const motionToggle = page.locator('.shell-motion-toggle');
    const initialMotionLabel = await motionToggle.getAttribute('aria-label');
    await motionToggle.focus();
    await expect(motionToggle).toBeFocused();
    await page.keyboard.press('Space');
    await expect(motionToggle).not.toHaveAttribute('aria-label', initialMotionLabel!);
    await page.keyboard.press('Space');
    await expect(motionToggle).toHaveAttribute('aria-label', initialMotionLabel!);
  });
});
