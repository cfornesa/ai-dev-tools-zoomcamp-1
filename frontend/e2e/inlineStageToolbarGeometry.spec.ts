/** Issue #1111: inline 3D stage controls remain distinct and operable. */
import { expect, test } from '@playwright/test';

import { apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { createServerProject3D } from './support/createProject3d.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

const DRAWING_PLANE_SCENE = {
  schemaVersion: 1,
  documentType: 'scene3d',
  id: 'scene3d-mobile-plane-hit-target',
  scene: { backgroundColor: '#0b1020' },
  renderer: { preferred: 'aframe' },
  camera: {
    position: { x: 0, y: 0, z: 8 },
    target: { x: 0, y: 0, z: 0 },
    fov: 50,
    near: 0.1,
    far: 1000,
  },
  lights: [{ id: 'amb', type: 'ambient', color: '#ffffff', intensity: 1 }],
  groups: [],
  objects: [
    {
      id: 'drawing-plane-1',
      name: 'Drawing plane 1',
      type: 'drawingPlane',
      groupId: null,
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        opacity: 1,
      },
      material: { color: '#ffffff' },
      visible: true,
      width: 4,
      height: 3,
      drawing: {
        width: 1024,
        height: 768,
        background: null,
        shapes: [
          {
            id: 'g',
            type: 'rect',
            x: 0,
            y: 0,
            width: 1024,
            height: 768,
            fill: '#22c55e',
            stroke: null,
          },
        ],
      },
    },
  ],
  randomness: { seed: 0, enabled: false },
};

test.describe('inline 3D stage toolbar geometry (#1111)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('keeps the selected A-Frame move handle and inline buttons hit-testable', async ({
    page,
  }, testInfo) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    for (const viewport of [
      { width: 375, height: 812 },
      { width: 1280, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      const id = await createServerProject3D(page);
      expect(
        (
          await apiPost(page.context(), `/api/projects3d/${id}/versions/`, {
            scene_json: DRAWING_PLANE_SCENE,
            origin: 'manual',
          })
        ).status(),
      ).toBe(201);
      await page.reload();
      await expect(page.locator('iframe[title="A-Frame scene preview"]')).toBeVisible({
        timeout: 45_000,
      });
      await page.waitForTimeout(3000);
      const frame = page.getByTestId('scene3d-preview-canvas-frame');
      const overlay = page.getByTestId('plane-selection-overlay');
      await page.getByRole('button', { name: 'Drawing plane 1', exact: true }).first().click();
      await expect(overlay).toBeVisible({ timeout: 20_000 });
      const handle = page.getByTestId('plane-handle-move');
      await expect(handle).toBeVisible();
      await frame.scrollIntoViewIfNeeded();
      const hitTargets = await page.evaluate(() => {
        const handleElement = document.querySelector<HTMLElement>(
          '[data-testid="plane-handle-move"]',
        );
        const toolbarHost = document.querySelector<HTMLElement>(
          '[role="toolbar"][aria-label="Preview actions"]',
        );
        const frame = document.querySelector<HTMLElement>(
          '[data-testid="scene3d-preview-canvas-frame"]',
        );
        const toolbarActions = toolbarHost?.querySelector<HTMLElement>(
          '[role="group"][aria-label="Preview actions"]',
        );
        const editorActions = document.querySelector<HTMLElement>('[aria-label="Editor actions"]');
        const planeToolbar = document.querySelector<HTMLElement>(
          '[data-testid="plane-selection-toolbar"]',
        );
        const overlayElement = handleElement?.closest<HTMLElement>('.plane-selection-overlay');
        if (
          !handleElement ||
          !toolbarHost ||
          !toolbarActions ||
          !editorActions ||
          !planeToolbar ||
          !overlayElement ||
          !frame
        ) {
          return {
            matches: Array.from(
              document.querySelectorAll<HTMLElement>(
                '.editor-piece-stage-toolbar, .scene3d-preview-actions, .piece-stage-toolbar, [aria-label="Editor actions"], .plane-selection-overlay',
              ),
            ).map((element) => ({
              className: element.className,
              role: element.getAttribute('role'),
              ariaLabel: element.getAttribute('aria-label'),
              box: (() => {
                const rect = element.getBoundingClientRect();
                return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
              })(),
            })),
            handleAncestors: handleElement
              ? Array.from(
                  (function* () {
                    let current: HTMLElement | null = handleElement;
                    for (let depth = 0; current && depth < 8; depth += 1) {
                      yield current;
                      current = current.parentElement;
                    }
                  })(),
                ).map((element) => ({
                  tag: element.tagName,
                  className: element.className,
                  role: element.getAttribute('role'),
                  ariaLabel: element.getAttribute('aria-label'),
                }))
              : [],
            missing: {
              handle: !handleElement,
              toolbarHost: !toolbarHost,
              toolbarActions: !toolbarActions,
              editorActions: !editorActions,
              planeToolbar: !planeToolbar,
              overlay: !overlayElement,
              frame: !frame,
            },
            handleBox: null,
            handleStack: [],
            handleHit: false,
            editorActionsBox: null,
            editorActionsStyle: null,
            toolbarHostBox: null,
            toolbarHostStyle: null,
            toolbarActionsBox: null,
            toolbarActionsStyle: null,
            frameBox: null,
            frameAspect: null,
            documentWidth: null,
            viewportWidth: window.innerWidth,
            planeToolbarBox: null,
            planeControls: [],
            overlayBox: null,
            overlayStyle: null,
            controls: [],
          };
        }
        const box = (element: Element) => {
          const rect = element.getBoundingClientRect();
          return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
        };
        const handleBox = handleElement.getBoundingClientRect();
        const x = handleBox.left + handleBox.width / 2;
        const y = handleBox.top + handleBox.height / 2;
        const stack = document.elementsFromPoint(x, y);
        const style = (element: Element) => {
          const computed = getComputedStyle(element);
          return {
            position: computed.position,
            pointerEvents: computed.pointerEvents,
            zIndex: computed.zIndex,
            top: computed.top,
            right: computed.right,
            maxWidth: computed.maxWidth,
          };
        };
        const controls = Array.from(toolbarHost.querySelectorAll<HTMLElement>('button, a')).filter(
          (element) => {
            const computed = getComputedStyle(element);
            return (
              element.getClientRects().length > 0 &&
              computed.visibility !== 'hidden' &&
              computed.display !== 'none' &&
              !element.classList.contains('sr-only') &&
              !element.closest('[hidden]')
            );
          },
        );
        const planeControls = Array.from(
          planeToolbar.querySelectorAll<HTMLElement>('button, a'),
        ).filter((element) => {
          const computed = getComputedStyle(element);
          return (
            element.getClientRects().length > 0 &&
            computed.visibility !== 'hidden' &&
            computed.display !== 'none' &&
            !element.closest('[hidden]')
          );
        });
        const boxRecord = (element: Element) => {
          const rect = element.getBoundingClientRect();
          return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
        };
        return {
          handleBox: box(handleElement),
          handleStack: stack.slice(0, 6).map((element) => ({
            tag: element.tagName,
            className: (element as HTMLElement).className,
            ariaLabel: element.getAttribute('aria-label'),
            testId: element.getAttribute('data-testid'),
          })),
          handleHit: Boolean(
            stack[0] && (stack[0] === handleElement || handleElement.contains(stack[0])),
          ),
          editorActionsBox: box(editorActions),
          editorActionsStyle: style(editorActions),
          toolbarHostBox: box(toolbarHost),
          toolbarHostStyle: style(toolbarHost),
          toolbarActionsBox: box(toolbarActions),
          toolbarActionsStyle: style(toolbarActions),
          frameBox: box(frame),
          frameAspect: frame.getBoundingClientRect().width / frame.getBoundingClientRect().height,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          planeToolbarBox: box(planeToolbar),
          planeControls: planeControls.map((element) => {
            const rect = element.getBoundingClientRect();
            const target = document.elementFromPoint(
              rect.left + rect.width / 2,
              rect.top + rect.height / 2,
            );
            return {
              name: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
              hit: Boolean(target && (target === element || element.contains(target))),
              box: boxRecord(element),
            };
          }),
          overlayBox: box(overlayElement),
          overlayStyle: style(overlayElement),
          controls: controls.map((element) => {
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const target = document.elementFromPoint(centerX, centerY);
            return {
              name: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
              hit: Boolean(target && (target === element || element.contains(target))),
              box: box(element),
            };
          }),
        };
      });
      expect(hitTargets, `missing selection elements at ${viewport.width}px`).not.toBeNull();
      await page.screenshot({
        path: testInfo.outputPath(`plane-handle-hit-target-${viewport.width}.png`),
      });
      const evidence = JSON.stringify({ viewport, ...hitTargets });
      expect(hitTargets!.handleHit, `move handle centre must hit the handle: ${evidence}`).toBe(
        true,
      );
      expect(hitTargets!.frameAspect, `stage remains 16:9: ${evidence}`).toBeCloseTo(16 / 9, 2);
      expect(hitTargets!.documentWidth, `no horizontal document overflow: ${evidence}`).toBe(
        hitTargets!.viewportWidth,
      );
      if (viewport.width === 375) {
        expect(
          hitTargets!.planeToolbarBox!.y,
          `phone plane toolbar starts below the scene frame: ${evidence}`,
        ).toBeGreaterThanOrEqual(hitTargets!.frameBox!.bottom);
      }
      for (const planeControl of hitTargets!.planeControls) {
        expect(
          planeControl.hit,
          `${planeControl.name} centre must hit its control: ${evidence}`,
        ).toBe(true);
        for (const inlineControl of hitTargets!.controls) {
          const overlaps =
            planeControl.box.x < inlineControl.box.right &&
            planeControl.box.right > inlineControl.box.x &&
            planeControl.box.y < inlineControl.box.bottom &&
            planeControl.box.bottom > inlineControl.box.y;
          expect(
            overlaps,
            `${planeControl.name} overlaps inline action ${inlineControl.name}: ${evidence}`,
          ).toBe(false);
        }
      }
      for (const control of hitTargets!.controls) {
        expect(control.hit, `${control.name} centre must hit its control: ${evidence}`).toBe(true);
        expect(control.box.x, `${control.name} left edge: ${evidence}`).toBeGreaterThanOrEqual(
          hitTargets!.frameBox!.x,
        );
        expect(control.box.right, `${control.name} right edge: ${evidence}`).toBeLessThanOrEqual(
          hitTargets!.frameBox!.right,
        );
        expect(control.box.y, `${control.name} top edge: ${evidence}`).toBeGreaterThanOrEqual(
          hitTargets!.frameBox!.y,
        );
        expect(control.box.bottom, `${control.name} bottom edge: ${evidence}`).toBeLessThanOrEqual(
          hitTargets!.frameBox!.bottom,
        );
      }
      for (const [index, control] of hitTargets!.controls.entries()) {
        for (const other of hitTargets!.controls.slice(index + 1)) {
          const overlaps =
            control.box.x < other.box.right &&
            control.box.right > other.box.x &&
            control.box.y < other.box.bottom &&
            control.box.bottom > other.box.y;
          expect(overlaps, `${control.name} overlaps ${other.name}: ${evidence}`).toBe(false);
        }
      }
    }
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
