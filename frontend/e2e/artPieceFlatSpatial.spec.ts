import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #449: `enable-hand-steering` used to unconditionally report
 * `unsupported-engine` for a Canvas2D/SVG piece, since neither engine has
 * a native registerable spatial camera the way a Three.js/A-Frame
 * snippet does. `artPieceSandbox.ts` now lazily builds a CSS 3D
 * presentation of the flat piece's own *existing*, unmodified artwork on
 * first activation and registers a synthetic camera adapter through the
 * exact same `window.__registerArtPieceCamera` hook #432 already
 * defines -- so the shared steer-signal/reset-view handlers drive it
 * identically to a real Three.js camera. This suite verifies the real
 * runtime effects (a CSS transform actually applied to the artwork
 * element, pointer-interaction suspended only while steering is active,
 * and the shell disposed only once Reset is pressed with steering off)
 * for both fixed engine fixtures, at both viewports.
 */

const CANVAS2D_RED_RECTANGLE =
  '<canvas id="art-piece-canvas" width="320" height="240"></canvas>' +
  '<script>var c=document.getElementById("art-piece-canvas");' +
  'var x=c.getContext("2d");x.fillStyle="#dc2626";x.fillRect(0,0,320,240);</script>';

const SVG_BLUE_CIRCLE =
  '<svg id="art-piece-svg" viewBox="0 0 320 240" width="320" height="240">' +
  '<circle cx="160" cy="120" r="80" fill="#2563eb" /></svg>';

async function mockGrantedCamera(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    if (window.self === window.top) return;
    Object.defineProperty(window.navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: () => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const context2d = canvas.getContext('2d')!;
        context2d.fillStyle = '#2563eb';
        context2d.fillRect(0, 0, 32, 32);
        const stream = (
          canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }
        ).captureStream(5);
        return Promise.resolve(stream);
      },
    });
  });
}

async function steer(page: Page, delta: { dx?: number; dy?: number; dz?: number }): Promise<void> {
  await page.evaluate((deltaArg) => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="Art piece preview"]');
    iframe?.contentWindow?.postMessage(
      { source: 'art-piece-parent', version: 1, type: 'steer-signal', ...deltaArg },
      '*',
    );
  }, delta);
}

function artworkSelector(engine: 'canvas2d' | 'svg'): string {
  return engine === 'canvas2d' ? '#art-piece-canvas' : '#art-piece-svg';
}

async function readArtworkStyle(
  page: Page,
  engine: 'canvas2d' | 'svg',
): Promise<{ transform: string; pointerEvents: string; hasStyleAttribute: boolean }> {
  return page
    .frameLocator('iframe[title="Art piece preview"]')
    .locator(artworkSelector(engine))
    .evaluate((el) => ({
      transform: (el as HTMLElement).style.transform,
      pointerEvents: getComputedStyle(el).pointerEvents,
      hasStyleAttribute: el.hasAttribute('style'),
    }));
}

test.describe('Generated flat-piece runtime: reversible spatial steering for Canvas2D/SVG (#449)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  const FIXTURES: Array<{ engine: 'canvas2d' | 'svg'; source: string; label: string }> = [
    { engine: 'canvas2d', source: CANVAS2D_RED_RECTANGLE, label: 'Canvas2D' },
    { engine: 'svg', source: SVG_BLUE_CIRCLE, label: 'SVG' },
  ];
  const VIEWPORTS = [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ];

  for (const { engine, source, label } of FIXTURES) {
    for (const viewport of VIEWPORTS) {
      test(`${label}: steering lazily builds a spatial shell, applies bounded pose changes, and disposes correctly at ${viewport.width}x${viewport.height}`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize(viewport);
        await mockGrantedCamera(context);
        await loginViaUI(page, fixture.owner.email, fixture.password);
        const created = await apiPost(context, '/api/art-pieces/', {
          title: `Flat spatial ${label} fixture ${viewport.width}`,
          description: `Verifies reversible spatial steering for ${label}.`,
          prompt: label,
          engine,
          capabilities: { screenshot: true, camera_view: true, hand_steering: true },
          source,
        });
        expect(created.status()).toBe(201);
        const piece = (await created.json()) as { public_id: string };
        const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
          status: 'published',
        });
        expect(published.status()).toBe(200);

        // No camera/mic permission on load, and Guide never touches
        // steering state either.
        await page.goto(`/art-pieces/p/${piece.public_id}`);
        await expect(
          page.getByRole('heading', { name: `Flat spatial ${label} fixture ${viewport.width}` }),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Piece controls' }).click();
        // Instrument getUserMedia to record whether *anything* calls it
        // merely from loading the page or opening/closing the Guide
        // dialog -- neither should ever request a device permission.
        await page
          .frameLocator('iframe[title="Art piece preview"]')
          .locator('body')
          .evaluate(() => {
            (window as unknown as { __gumCalled: boolean }).__gumCalled = false;
            const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
            navigator.mediaDevices.getUserMedia = (...args: Parameters<typeof original>) => {
              (window as unknown as { __gumCalled: boolean }).__gumCalled = true;
              return original(...args);
            };
          });
        await page.getByRole('button', { name: 'Show hand gesture guide' }).click();
        await expect(page.getByRole('dialog', { name: 'Hand gesture guide' })).toBeVisible();
        await page.getByRole('button', { name: 'Close' }).click();
        const gumCalledFromLoadOrGuide = await page
          .frameLocator('iframe[title="Art piece preview"]')
          .locator('body')
          .evaluate(() => (window as unknown as { __gumCalled: boolean }).__gumCalled);
        expect(gumCalledFromLoadOrGuide).toBe(false);

        // Steering requires Camera view first, same #432 gate.
        await expect(page.getByTestId('steering-status')).toContainText('Steering is off.');
        await page.getByRole('button', { name: 'Steer the piece' }).click();
        await expect(page.getByTestId('steering-status')).toContainText(
          'Turn on Camera view before steering.',
        );

        // Before activation, the artwork carries no shell transform at
        // all -- the shell is genuinely lazy, not pre-built on load.
        const beforeActivation = await readArtworkStyle(page, engine);
        expect(beforeActivation.transform).toBe('');
        expect(beforeActivation.hasStyleAttribute).toBe(false);

        await page.getByRole('button', { name: 'Enable camera view' }).click();
        await expect(page.getByTestId('camera-status')).toContainText('Camera is active.');
        await page.getByRole('button', { name: 'Steer the piece' }).click();
        const stopButton = page.getByRole('button', { name: 'Stop steering' });
        await expect(stopButton).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('steering-status')).toContainText('Steering is active.');

        // The shell now exists: a real transform is applied, and pointer
        // interaction is suspended while it owns navigation.
        const activated = await readArtworkStyle(page, engine);
        expect(activated.transform.length).toBeGreaterThan(0);
        expect(activated.pointerEvents).toBe('none');

        // A real, bounded pose change -- (0,0,5) + dx=2 is (2,0,5),
        // radius sqrt(29)~=5.385, within [1.5, 20] so unclamped -- and
        // the artwork's own CSS transform reflects it (rotateY(30deg)).
        await steer(page, { dx: 2 });
        await expect(page.getByTestId('steering-pose')).toContainText('2.00,0.00,5.00');
        const steered = await readArtworkStyle(page, engine);
        expect(steered.transform).toContain('rotateY(30deg)');

        // Reset while steering is ON re-homes the pose but preserves
        // activation -- the shell stays, pointer interaction stays
        // suspended.
        await page.getByRole('button', { name: 'Reset view' }).click();
        await expect(page.getByTestId('steering-pose')).toContainText('0.00,0.00,5.00');
        await expect(stopButton).toHaveAttribute('aria-pressed', 'true');
        const afterResetWhileOn = await readArtworkStyle(page, engine);
        expect(afterResetWhileOn.pointerEvents).toBe('none');

        // Steer Off freezes the current pose and restores interaction --
        // it does not itself reset or dispose anything.
        await steer(page, { dx: 3 });
        await expect(page.getByTestId('steering-pose')).toContainText('3.00,0.00,5.00');
        await stopButton.click();
        await expect(page.getByTestId('steering-status')).toContainText('Steering is off.');
        const afterStop = await readArtworkStyle(page, engine);
        expect(afterStop.pointerEvents).toBe('auto');
        expect(afterStop.transform).toContain('rotateY(45deg)');

        // Reset after steering off returns to the exact framed home
        // presentation and disposes the shell entirely -- the artwork's
        // original style attribute (none, for these fixtures) is
        // restored, not merely re-homed.
        // A postMessage-driven reset is delivered asynchronously -- poll
        // rather than reading state in the same tick as the click.
        await page.getByRole('button', { name: 'Reset view' }).click();
        await expect
          .poll(async () => (await readArtworkStyle(page, engine)).hasStyleAttribute)
          .toBe(false);

        // Screenshot still works after the full lifecycle, at both
        // viewports.
        const screenshotDownload = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Take screenshot' }).click();
        const screenshot = await screenshotDownload;
        expect(screenshot.suggestedFilename()).toMatch(/\.png$/);
      });
    }
  }
});
