/** Issue #1111: inline 3D stage controls remain distinct and operable. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { createServerProject3D } from './support/createProject3d.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('inline 3D stage toolbar geometry (#1111)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('keeps every inline stage action visible, separate, and operable', async ({
    page,
  }, testInfo) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createServerProject3D(page);
    const frame = page.getByTestId('scene3d-preview-canvas-frame');
    const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
    await expect(toolbar).toBeVisible();

    for (const viewport of [
      { width: 375, height: 812 },
      { width: 1280, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      const geometry = await toolbar.evaluate((element) => {
        const stage = element.getBoundingClientRect();
        const toolbarStyle = getComputedStyle(element);
        const responsiveRow = element.querySelector<HTMLElement>('.editor-piece-stage-toolbar');
        const responsiveStyle = responsiveRow ? getComputedStyle(responsiveRow) : null;
        const actions = Array.from(element.querySelectorAll<HTMLElement>('button, a')).filter(
          (control) =>
            control.getClientRects().length > 0 &&
            getComputedStyle(control).visibility !== 'hidden' &&
            !control.closest('[hidden]'),
        );
        return {
          stage: { x: stage.x, y: stage.y, right: stage.right, bottom: stage.bottom },
          toolbarStyle: {
            position: toolbarStyle.position,
            top: toolbarStyle.top,
            right: toolbarStyle.right,
            maxWidth: toolbarStyle.maxWidth,
          },
          responsiveRow: responsiveRow
            ? {
                box: (() => {
                  const box = responsiveRow.getBoundingClientRect();
                  return { x: box.x, y: box.y, right: box.right, bottom: box.bottom };
                })(),
                position: responsiveStyle?.position,
                top: responsiveStyle?.top,
                right: responsiveStyle?.right,
                maxWidth: responsiveStyle?.maxWidth,
              }
            : null,
          controls: actions.map((control) => {
            const box = control.getBoundingClientRect();
            const centerX = box.left + box.width / 2;
            const centerY = box.top + box.height / 2;
            const hit = document.elementFromPoint(centerX, centerY);
            const style = getComputedStyle(control);
            return {
              name: control.getAttribute('aria-label') ?? control.textContent?.trim() ?? '',
              box: { x: box.x, y: box.y, right: box.right, bottom: box.bottom },
              hitTargeted: Boolean(hit && (hit === control || control.contains(hit))),
              position: style.position,
              top: style.top,
              right: style.right,
              maxWidth: style.maxWidth,
            };
          }),
        };
      });
      expect(geometry.controls.length).toBeGreaterThan(0);
      for (const control of geometry.controls) {
        expect(control.box.x, `${control.name} left edge`).toBeGreaterThanOrEqual(geometry.stage.x);
        expect(control.box.right, `${control.name} right edge`).toBeLessThanOrEqual(
          geometry.stage.right,
        );
        expect(control.box.y, `${control.name} top edge`).toBeGreaterThanOrEqual(geometry.stage.y);
        expect(control.box.bottom, `${control.name} bottom edge`).toBeLessThanOrEqual(
          geometry.stage.bottom,
        );
        expect(control.hitTargeted, `${control.name} centre hit-test`).toBe(true);
      }
      for (const [index, control] of geometry.controls.entries()) {
        for (const other of geometry.controls.slice(index + 1)) {
          const overlaps =
            control.box.x < other.box.right &&
            control.box.right > other.box.x &&
            control.box.y < other.box.bottom &&
            control.box.bottom > other.box.y;
          expect(
            overlaps,
            `${control.name} overlaps ${other.name}: ${JSON.stringify({
              viewport,
              stage: geometry.stage,
              toolbar: geometry.toolbarStyle,
              responsiveRow: geometry.responsiveRow,
              control,
              other,
            })}`,
          ).toBe(false);
        }
      }
      await page.screenshot({
        path: testInfo.outputPath(`inline-toolbar-${viewport.width}.png`),
      });

      const fullscreen = toolbar.getByRole('button', {
        name: 'Expand piece to fullscreen',
        exact: true,
      });
      await fullscreen.click();
      await expect(
        toolbar.getByRole('button', { name: 'Exit fullscreen', exact: true }),
      ).toBeVisible();
      await toolbar.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
      await expect(fullscreen).toBeVisible();

      await toolbar.getByRole('button', { name: '3D authoring', exact: true }).click();
      await expect(toolbar.getByRole('group', { name: '3D authoring actions' })).toBeVisible();
      await toolbar.getByRole('button', { name: /close 3d authoring/i }).click();
      await toolbar.getByRole('button', { name: 'Piece controls', exact: true }).click();
      await expect(toolbar.getByRole('group', { name: 'Piece controls' })).toBeVisible();
      await toolbar.getByRole('button', { name: /hide piece controls/i }).click();
    }
  });
});
