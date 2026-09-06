import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { expect, test, type BrowserContext } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #459: the downloadable Full ZIP's Steer button never worked for
 * a flat (Canvas2D/SVG) piece with `hand_steering: true` -- the export
 * runtime's `includeSteering` gate required a spatial library (Three.js/
 * A-Frame), even after #449 gave the *live* preview a lazily-built CSS 3D
 * shell that lets a flat piece's artwork be steered the same way. This
 * suite extracts a real Full ZIP from a flat-engine piece and drives real
 * execution against it -- not string matching -- proving the shell
 * activates, the artwork's own CSS transform actually changes, and reset
 * respects the same "on preserves, off disposes" rule #449 established.
 */

const RED_RECTANGLE =
  '<canvas id="art-piece-canvas" width="320" height="240"></canvas>' +
  '<script>var c=document.getElementById("art-piece-canvas");' +
  'var x=c.getContext("2d");x.fillStyle="#dc2626";x.fillRect(0,0,320,240);</script>';

/** Mocks a granted camera for the extracted, standalone document --
 * identical to artPieceFullZipRuntime.spec.ts's own helper, since
 * steering here is gated on Camera view exactly like the spatial case. */
async function mockGrantedCamera(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
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

test.describe('Generated Full ZIP: flat-piece Steer button (#459)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('a Canvas2D Full ZIP with hand_steering applies a real CSS transform to the artwork, and reset respects the on/off disposal rule', async ({
    page,
    context,
  }) => {
    await mockGrantedCamera(context);
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Flat Full ZIP steering fixture',
      description: 'A published flat piece used to verify the ported CSS 3D shell.',
      prompt: 'a red rectangle',
      engine: 'canvas2d',
      capabilities: { camera_view: true, hand_steering: true, download: true },
      source: RED_RECTANGLE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    await page.goto(`/art-pieces/p/${piece.public_id}`);
    await expect(
      page.getByRole('heading', { name: 'Flat Full ZIP steering fixture' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Open download menu' }).click();
    const zipDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download full piece' }).click();
    const zipFile = await zipDownload;
    const zip = await JSZip.loadAsync(fs.readFileSync((await zipFile.path())!));

    // The Steer button is already unconditionally rendered by
    // buildExportControls (only the runtime script side was gated) --
    // this asserts the *runtime* now genuinely wires it up for a flat
    // engine too, not just that the button exists in the markup.
    const indexHtml = await zip.files['index.html'].async('string');
    expect(indexHtml).toContain('data-action="hand"');
    // Canvas2D/SVG snippets are embedded verbatim in index.html itself --
    // unlike Three.js, there is no separate scripts/piece.js split.
    expect(indexHtml).toContain('art-piece-canvas');

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'art-piece-flat-zip-e2e-'));
    try {
      for (const [name, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        const target = path.join(root, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, await entry.async('nodebuffer'));
      }

      await context.route('**/*', (route) => {
        if (route.request().url().startsWith('file://')) void route.continue();
        else void route.abort();
      });

      await page.goto(`file://${path.join(root, 'index.html')}`);

      await page.getByRole('button', { name: 'Enable camera view' }).click();
      await expect(page.getByRole('button', { name: 'Disable camera view' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      const steerButton = page.getByRole('button', { name: 'Steer the piece' });
      await steerButton.click();
      await expect(page.getByRole('button', { name: 'Stop steering' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      // Enabling steering lazily builds the shell and homes it to (0,0,5)
      // -- capture that real, already-applied transform before steering
      // away from it.
      const homeTransform = await page
        .locator('#art-piece-canvas')
        .evaluate((el) => (el as HTMLElement).style.transform);
      expect(homeTransform).not.toBe('');

      // Real execution, not a button-state fluke: the artwork's own CSS
      // transform actually changes, driven directly through the export's
      // programmatic hook (there is no parent window/postMessage in a
      // standalone export, so this is the export's own equivalent of the
      // live preview's steer-signal message).
      await page.evaluate(() => {
        (
          window as unknown as { __steerArtPiece: (dx: number, dy: number, dz: number) => void }
        ).__steerArtPiece(1, 0.5, 0);
      });
      const steeredTransform = await page
        .locator('#art-piece-canvas')
        .evaluate((el) => (el as HTMLElement).style.transform);
      expect(steeredTransform).not.toBe(homeTransform);
      expect(steeredTransform).toMatch(/rotateY\(15deg\) rotateX\(-7\.5deg\)/);

      // Reset while steering is ON: re-homes the shell, but preserves
      // activation -- steering stays on, the CSS shell isn't torn down.
      await page.getByRole('button', { name: 'Reset view' }).click();
      await expect(page.getByRole('button', { name: 'Stop steering' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      const rehomedTransform = await page
        .locator('#art-piece-canvas')
        .evaluate((el) => (el as HTMLElement).style.transform);
      expect(rehomedTransform).toBe(homeTransform);

      // Reset while steering is OFF: disposes the shell, restoring the
      // artwork's original (pre-shell) style entirely.
      await page.getByRole('button', { name: 'Stop steering' }).click();
      await expect(page.getByRole('button', { name: 'Steer the piece' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      await page.getByRole('button', { name: 'Reset view' }).click();
      const disposedStyle = await page
        .locator('#art-piece-canvas')
        .evaluate((el) => (el as HTMLElement).getAttribute('style'));
      expect(disposedStyle).toBeNull();

      // Re-activating after disposal still works -- the shell can be
      // rebuilt, not a one-shot setup.
      await steerButton.click();
      await expect(page.getByRole('button', { name: 'Stop steering' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      await expect(page.locator('#art-piece-runtime-error')).toBeHidden();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
