/** Issue #1120: mobile 2D stage actions stay distinct and hit-testable. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { createServerProject2D } from './support/createProject.js';
import { openPieceControlsMenu } from './support/openEditScene.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('inline 2D stage toolbar geometry (#1120)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 1280, height: 900 },
  ]) {
    test(`keeps every visible Piece action distinct and operable at ${viewport.width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await createServerProject2D(page);
      await openPieceControlsMenu(page);

      const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
      await expect(toolbar).toBeVisible();
      await page.getByTestId('editor-piece-stage-shell').scrollIntoViewIfNeeded();
      const geometry = await page.evaluate(() => {
        const stage = document.querySelector<HTMLElement>(
          '[data-testid="editor-piece-stage-shell"]',
        );
        const toolbar = document.querySelector<HTMLElement>(
          '[role="toolbar"][aria-label="Piece actions"]',
        );
        const ink = toolbar?.querySelector<HTMLElement>('[data-testid="ink-mode-button"]');
        const fullscreen = toolbar?.querySelector<HTMLElement>(
          'button[aria-label="Expand piece to fullscreen"]',
        );
        if (!stage || !toolbar || !ink || !fullscreen) {
          return {
            missing: { stage: !stage, toolbar: !toolbar, ink: !ink, fullscreen: !fullscreen },
          };
        }
        const rect = (element: Element) => {
          const box = element.getBoundingClientRect();
          return {
            x: box.x,
            y: box.y,
            right: box.right,
            bottom: box.bottom,
            width: box.width,
            height: box.height,
          };
        };
        const controls = Array.from(toolbar.querySelectorAll<HTMLElement>('button')).filter(
          (element) => {
            const style = getComputedStyle(element);
            return (
              element.getClientRects().length > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              !element.closest('[hidden]') &&
              !element.classList.contains('sr-only')
            );
          },
        );
        return {
          stage: rect(stage),
          toolbar: rect(toolbar),
          toolbarMode: toolbar.getAttribute('data-toolbar-mode'),
          toolbarStyle: {
            position: getComputedStyle(toolbar).position,
            maxWidth: getComputedStyle(toolbar).maxWidth,
            inset: getComputedStyle(toolbar).inset,
          },
          fullscreenPositioningContext: fullscreen.offsetParent
            ? {
                className: (fullscreen.offsetParent as HTMLElement).className,
                rect: rect(fullscreen.offsetParent),
                position: getComputedStyle(fullscreen.offsetParent).position,
                maxWidth: getComputedStyle(fullscreen.offsetParent).maxWidth,
              }
            : null,
          fullscreenAncestors: Array.from(
            (function* () {
              let current: HTMLElement | null = fullscreen;
              for (let depth = 0; current && depth < 5; depth += 1) {
                yield current;
                current = current.parentElement;
              }
            })(),
          ).map((element) => ({
            tag: element.tagName,
            className: element.className,
            rect: rect(element),
            position: getComputedStyle(element).position,
            maxWidth: getComputedStyle(element).maxWidth,
          })),
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          controls: controls.map((element) => {
            const box = element.getBoundingClientRect();
            const x = box.left + box.width / 2;
            const y = box.top + box.height / 2;
            const stack = document.elementsFromPoint(x, y);
            const style = getComputedStyle(element);
            return {
              name: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
              testId: element.getAttribute('data-testid'),
              rect: rect(element),
              style: { position: style.position, right: style.right, maxWidth: style.maxWidth },
              hit: Boolean(stack[0] && (stack[0] === element || element.contains(stack[0]))),
              stack: stack.slice(0, 4).map((top) => ({
                tag: top.tagName,
                ariaLabel: top.getAttribute('aria-label'),
                testId: top.getAttribute('data-testid'),
              })),
            };
          }),
        };
      });
      console.log(`2D_TOOLBAR_GEOMETRY ${JSON.stringify({ viewport, geometry })}`);
      expect(geometry, `all stage controls exist at ${viewport.width}px`).not.toHaveProperty(
        'missing',
      );
      if ('missing' in geometry) {
        throw new Error(
          `Stage controls missing at ${viewport.width}px: ${JSON.stringify(geometry)}`,
        );
      }
      const evidence = JSON.stringify({ viewport, geometry });
      const controls = geometry.controls;
      const screenshot = await page.screenshot({
        path: testInfo.outputPath(`2d-inline-toolbar-${viewport.width}.png`),
      });
      await testInfo.attach(`2d-inline-toolbar-${viewport.width}.png`, {
        body: screenshot,
        contentType: 'image/png',
      });
      expect(controls.length, `visible actions were found: ${evidence}`).toBeGreaterThan(0);
      for (const control of controls) {
        expect(control.hit, `${control.name} centre hits its own button: ${evidence}`).toBe(true);
      }
      for (const [index, control] of controls.entries()) {
        for (const other of controls.slice(index + 1)) {
          const overlaps =
            control.rect.x < other.rect.right &&
            control.rect.right > other.rect.x &&
            control.rect.y < other.rect.bottom &&
            control.rect.bottom > other.rect.y;
          expect(overlaps, `${control.name} overlaps ${other.name}: ${evidence}`).toBe(false);
        }
      }
      expect(
        geometry.documentWidth,
        `the 2D toolbar does not create horizontal document overflow: ${evidence}`,
      ).toBe(geometry.viewportWidth);

      await toolbar.getByTestId('ink-mode-button').click();
      await expect(page.getByTestId('ink-editor')).toBeVisible();
    });
  }
});
