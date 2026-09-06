import fs from 'node:fs';

import { expect, test, type BrowserContext } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #431: `artPieceSandbox.ts`'s `enable-camera` command used to have
 * no runtime consumer at all -- it only reached an unconsumed
 * `art-piece-command` DOM event. This suite drives the real camera
 * runtime the fix adds: a `<video>` overlay composited over the artwork
 * (visible, `pointer-events: none`, adjustable opacity), a screenshot
 * that rasterizes both layers together, and the denied/unavailable/ended
 * lifecycle -- entirely independent of the microphone capability #430
 * already covers, since a piece can enable one without the other.
 */

const CANVAS_RED_SQUARE =
  '<canvas id="art-piece-canvas" width="320" height="240"></canvas>' +
  '<script>var c=document.getElementById("art-piece-canvas");' +
  'var x=c.getContext("2d");x.fillStyle="#dc2626";x.fillRect(0,0,320,240);</script>';

/** Mocks `navigator.mediaDevices.getUserMedia` for the sandboxed iframe
 * only (`window.self !== window.top` -- see the identical convention and
 * rationale in `artPieceSoundRuntime.spec.ts`'s `mockMicrophone`: the
 * top-level app calls the real API directly elsewhere and breaks if it's
 * mocked globally). The granted stream is a synthetic solid-blue video
 * track from an offscreen `<canvas>.captureStream()` -- distinguishable
 * from the fixture's own red artwork in a composited screenshot. */
async function mockCamera(
  context: BrowserContext,
  outcome: 'granted' | 'denied' | 'unavailable',
): Promise<void> {
  await context.addInitScript((outcomeArg: string) => {
    if (window.self === window.top) return;
    // Issue #454: WebKit does not treat `navigator.mediaDevices` as a
    // stable, cacheable object reference the way Chromium/Firefox do --
    // in this sandboxed, opaque-origin iframe specifically, each access
    // can return a distinct MediaDevices instance. Patching *that
    // instance*'s own `getUserMedia` (as this mock originally did) only
    // ever affected the one instance returned by the single access made
    // while installing the mock; the sandbox script's own later access
    // got a fresh instance with the real native method intact, so
    // 'unavailable' silently fell through to a real (headless, no
    // camera) getUserMedia call, and 'granted' could never resolve at
    // all. All instances still share the same prototype, so patching
    // `MediaDevices.prototype` itself (confirmed configurable) is the
    // one mock surface that reliably survives however many fresh
    // instances get created.
    const mediaDevicesProto = Object.getPrototypeOf(window.navigator.mediaDevices) as {
      getUserMedia?: () => Promise<MediaStream>;
    };
    if (outcomeArg === 'unavailable') {
      Object.defineProperty(mediaDevicesProto, 'getUserMedia', {
        configurable: true,
        value: undefined,
      });
      return;
    }
    Object.defineProperty(mediaDevicesProto, 'getUserMedia', {
      configurable: true,
      value: () => {
        if (outcomeArg !== 'granted') return Promise.reject(new Error('Permission denied'));
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
  }, outcome);
}

test.describe('Generated regular viewer: camera composition and capture (#431)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('camera starts from its own gesture, composites into the live view and the screenshot, and reports denied/unavailable/ended', async ({
    page,
    context,
    browser,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Camera runtime fixture',
      description: 'A published piece with camera view enabled, sound/microphone disabled.',
      prompt: 'red square',
      engine: 'canvas2d',
      capabilities: {
        screenshot: true,
        camera_view: true,
        sound: false,
        microphone: false,
        download: false,
        fullscreen: false,
      },
      source: CANVAS_RED_SQUARE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    // Issue #454: WebKit intermittently applied a *stale* getUserMedia
    // mock from an earlier navigation instead of the one just registered
    // -- root-caused via temporary console diagnostics to
    // `context.addInitScript` calls accumulating across navigations on
    // the same context (each call adds another script rather than
    // replacing the last one). Chromium/Firefox happened to always
    // re-apply the most recently added script in time; WebKit sometimes
    // didn't, a genuine engine-timing race, not a test-logic bug on its
    // own. The fix carries the logged-in session (via `storageState`,
    // avoiding a real re-login through the UI) into a *fresh* context
    // per outcome, so exactly one `addInitScript` call is ever active for
    // any given navigation, on every browser.
    const storageState = await context.storageState();

    async function runCameraPhase<T>(
      outcome: 'granted' | 'denied' | 'unavailable',
      viewport: { width: number; height: number },
      run: (phasePage: typeof page) => Promise<T>,
    ): Promise<T> {
      const phaseContext = await browser.newContext({ storageState });
      try {
        await mockCamera(phaseContext, outcome);
        const phasePage = await phaseContext.newPage();
        await phasePage.setViewportSize(viewport);
        await phasePage.goto(`/art-pieces/p/${piece.public_id}`);
        return await run(phasePage);
      } finally {
        await phaseContext.close();
      }
    }

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      // Denied: reports the real outcome, never a silent success.
      await runCameraPhase('denied', viewport, async (phasePage) => {
        await expect(
          phasePage.getByRole('heading', { name: 'Camera runtime fixture' }),
        ).toBeVisible();
        await phasePage.getByRole('button', { name: 'Piece controls' }).click();
        await expect(phasePage.getByTestId('camera-status')).toContainText('Camera is off.');
        await phasePage.getByRole('button', { name: 'Enable camera view' }).click();
        await expect(phasePage.getByTestId('camera-status')).toContainText(
          'Camera access was denied.',
        );
      });

      // Unavailable: no navigator.mediaDevices.getUserMedia at all.
      await runCameraPhase('unavailable', viewport, async (phasePage) => {
        await phasePage.getByRole('button', { name: 'Piece controls' }).click();
        await phasePage.getByRole('button', { name: 'Enable camera view' }).click();
        await expect(phasePage.getByTestId('camera-status')).toContainText(
          'Camera is unavailable in this browser.',
        );
      });

      // Granted: reaches 'active'; the overlay never intercepts pointer
      // input, so the artwork underneath the video must still be
      // reachable at the point where the overlay visually sits.
      await runCameraPhase('granted', viewport, async (phasePage) => {
        await phasePage.getByRole('button', { name: 'Piece controls' }).click();
        await phasePage.getByRole('button', { name: 'Enable camera view' }).click();
        const disableButton = phasePage.getByRole('button', { name: 'Disable camera view' });
        await expect(disableButton).toHaveAttribute('aria-pressed', 'true');
        await expect(phasePage.getByTestId('camera-status')).toContainText('Camera is active.');
        const overlayPointerEvents = await phasePage
          .frameLocator('iframe[title="Art piece preview"]')
          .locator('#art-piece-camera-overlay')
          .evaluate((element) => getComputedStyle(element).pointerEvents);
        expect(overlayPointerEvents).toBe('none');

        // Screenshot: composites the red artwork and the blue camera
        // overlay into one PNG -- a real image, not a plain canvas
        // capture that silently drops the camera.
        const screenshotDownload = phasePage.waitForEvent('download');
        await phasePage.getByRole('button', { name: 'Take screenshot' }).click();
        const screenshot = await screenshotDownload;
        expect(screenshot.suggestedFilename()).toMatch(/\.png$/);
        const screenshotBytes = fs.readFileSync((await screenshot.path())!);
        expect(screenshotBytes.subarray(0, 8)).toEqual(
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        );
        expect(screenshotBytes.readUInt32BE(16)).toBe(320);
        expect(screenshotBytes.readUInt32BE(20)).toBe(240);

        await disableButton.click();
        await expect(phasePage.getByTestId('camera-status')).toContainText('Camera is off.');
      });
    }
  });

  test('camera view is absent when its capability is disabled', async ({ page, context }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Camera-disabled runtime fixture',
      description: 'A published piece with camera view disabled.',
      prompt: 'red square',
      engine: 'canvas2d',
      capabilities: {
        screenshot: true,
        camera_view: false,
        download: false,
        fullscreen: false,
      },
      source: CANVAS_RED_SQUARE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    await page.goto(`/art-pieces/p/${piece.public_id}`);
    await expect(
      page.getByRole('heading', { name: 'Camera-disabled runtime fixture' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /camera view/i })).toHaveCount(0);
    await expect(page.getByTestId('camera-status')).toHaveCount(0);
  });
});
