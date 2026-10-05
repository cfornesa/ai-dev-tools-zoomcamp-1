import { expect, test, type TestInfo } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const fixtures = [
  { id: 'ratio-4-3', ratio: '4:3', engine: 'canvas2d' },
  { id: 'ratio-fallback', ratio: undefined, engine: 'canvas2d' },
  { id: 'ratio-21-9', ratio: '21:9', engine: 'canvas2d' },
  { id: 'ratio-9-16', ratio: '9:16', engine: 'canvas2d' },
  { id: 'interactive', ratio: '4:3', engine: 'c2js-interactive' },
] as const;

function sourceFor(engine: (typeof fixtures)[number]['engine']): string {
  if (engine === 'c2js-interactive') {
    return `window.sketch = ({ canvas, startFrame }) => {
      const context = canvas.getContext('2d');
      canvas.addEventListener('pointermove', (event) => {
        canvas.dataset.pointerX = String(event.offsetX);
      });
      startFrame(() => {
        context.fillStyle = '#172554';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#fbbf24';
        context.fillRect(Number(canvas.dataset.pointerX || 80), 40, 60, 60);
      });
    };`;
  }
  return (
    '<canvas id="phone-stage-canvas" width="320" height="180"></canvas>' +
    '<script>const canvas = document.querySelector("#phone-stage-canvas");' +
    'const context = canvas.getContext("2d"); context.fillStyle = "#172554";' +
    'context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = "#fbbf24";' +
    'context.fillRect(32, 32, 64, 64);</script>'
  );
}

test('public generated-piece stages keep declared phone ratios and place controls below artwork', async ({
  browser,
}, testInfo: TestInfo) => {
  test.setTimeout(240_000);
  const e2eFixtures = requireE2EFixtures();
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);
  const profileResponse = await apiGet(context, '/api/account/profile/');
  expect(profileResponse.ok()).toBe(true);
  const profile = (await profileResponse.json()) as { handle: string };
  const runId = Date.now().toString(36);
  const pieces = new Map<string, string>();

  for (const fixture of fixtures) {
    const created = await apiPost(context, '/api/art-pieces/', {
      title: `Phone stage ${fixture.id}`,
      description: 'A published fixture for responsive public-stage geometry.',
      prompt: `Stage ratio fixture ${fixture.id}`,
      engine: fixture.engine,
      public_slug: `phone-stage-${runId}-${fixture.id}`,
      capabilities: {
        screenshot: true,
        fullscreen: true,
        ...(fixture.id === 'ratio-4-3' ? { sound: true } : {}),
      },
      ...(fixture.ratio ? { generation_metadata: { aspect_ratio: fixture.ratio } } : {}),
      source: sourceFor(fixture.engine),
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);
    pieces.set(fixture.id, piece.public_id);
  }

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const fixture of fixtures) {
      const slug = `phone-stage-${runId}-${fixture.id}`;
      await page.goto(`/users/@${profile.handle}/pieces/${slug}`);
      const stage = page.getByRole('region', { name: 'Art piece stage' });
      const iframe = page.getByTitle('Art piece preview');
      const toolbarRow = page.getByTestId('regular-piece-toolbar-row');
      await expect(stage).toBeVisible();
      await expect(iframe).toBeVisible();
      await expect(toolbarRow.getByRole('toolbar', { name: 'Piece actions' })).toBeVisible();

      const geometry = await page.evaluate(() => {
        const stage = document.querySelector<HTMLElement>('.public-art-piece-stage')!;
        const iframe = stage.querySelector('iframe')!;
        const row = document.querySelector<HTMLElement>('.public-art-piece-toolbar-row')!;
        const stageBox = stage.getBoundingClientRect();
        const frameBox = iframe.getBoundingClientRect();
        const rowBox = row.getBoundingClientRect();
        return {
          stageAspectRatio: getComputedStyle(stage).aspectRatio,
          stageMinHeight: getComputedStyle(stage).minHeight,
          frame: {
            left: frameBox.left,
            right: frameBox.right,
            top: frameBox.top,
            bottom: frameBox.bottom,
            width: frameBox.width,
            height: frameBox.height,
          },
          stage: { top: stageBox.top, bottom: stageBox.bottom },
          row: { top: rowBox.top, bottom: rowBox.bottom },
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      });
      const expectedRatio = fixture.ratio?.replace(':', ' / ') ?? '16 / 9';

      if (viewport.width <= 700 && fixture.engine === 'c2js-interactive') {
        expect(geometry.stageAspectRatio).toBe('auto');
        expect(geometry.stageMinHeight).toBe(`${Math.min(viewport.height * 0.7, 26 * 16)}px`);
        expect(geometry.frame.height).toBeGreaterThanOrEqual(300);
        await expect(stage).toHaveAttribute('data-visitor-drawing', 'true');
        const visitorDrawing = page.getByRole('group', { name: 'Visitor drawing' });
        await expect(visitorDrawing).toBeVisible();
        const groupBox = await visitorDrawing.boundingBox();
        expect(groupBox).not.toBeNull();
        expect(groupBox!.y).toBeGreaterThanOrEqual(geometry.frame.bottom);
      } else {
        expect(geometry.stageAspectRatio).toBe(expectedRatio);
        expect(
          Math.abs(geometry.frame.width / geometry.frame.height - parseRatio(expectedRatio)),
        ).toBeLessThan(0.02);
        if (fixture.id === 'ratio-4-3') {
          const fullscreen = page.getByRole('button', {
            name: 'Expand piece to fullscreen',
            exact: true,
          });
          await fullscreen.click();
          await expect
            .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
            .toBe(true);
          const exitFullscreen = page.getByRole('button', { name: 'Exit fullscreen', exact: true });
          await expect(exitFullscreen).toHaveAttribute('aria-pressed', 'true');
          await exitFullscreen.click();
          await expect
            .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
            .toBe(false);
        }
      }

      if (viewport.width <= 700) {
        expect(geometry.row.top).toBeGreaterThanOrEqual(geometry.frame.bottom);
        expect(geometry.documentWidth).toBeLessThanOrEqual(viewport.width);
        // The legacy sr-only no-op menu shim is not a visible hit target and
        // remains tracked separately under #1187 until all consumers migrate.
        const targets = toolbarRow.locator('button:visible:not(.sr-only), a:visible:not(.sr-only)');
        for (let index = 0; index < (await targets.count()); index += 1) {
          const targetDetails = await targets.nth(index).evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
              className: element.className,
              label: element.getAttribute('aria-label'),
              width: rect.width,
              height: rect.height,
              background: getComputedStyle(element).backgroundColor,
            };
          });
          const box = await targets.nth(index).boundingBox();
          expect(box).not.toBeNull();
          expect(box!.width, JSON.stringify(targetDetails)).toBeGreaterThanOrEqual(44);
          expect(box!.height, JSON.stringify(targetDetails)).toBeGreaterThanOrEqual(44);
        }

        if (fixture.id === 'ratio-4-3') {
          await page.getByRole('button', { name: 'Piece controls', exact: true }).click();
          const soundButton = toolbarRow.getByRole('button', {
            name: 'Unmute sound',
            exact: true,
          });
          const soundReceivesPointer = await soundButton.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const hit = document.elementFromPoint(
              rect.left + rect.width / 2,
              rect.top + rect.height / 2,
            );
            return hit === element || (hit instanceof Node && element.contains(hit));
          });
          expect(soundReceivesPointer).toBe(true);
          await page.getByRole('button', { name: 'Piece controls', exact: true }).click();
        }
      } else {
        expect(geometry.row.top).toBeLessThanOrEqual(geometry.stage.bottom);
        expect(geometry.row.bottom).toBeLessThanOrEqual(geometry.stage.bottom);
      }

      if (viewport.width !== 768) {
        await page.screenshot({
          path: testInfo.outputPath(
            `public-stage-${fixture.id}-${viewport.width}x${viewport.height}.png`,
          ),
          fullPage: true,
        });
      }
    }
  }

  const interactiveId = pieces.get('interactive');
  expect(interactiveId).toBeTruthy();
  await context.close();
});

function parseRatio(value: string): number {
  const [width, height] = value.split('/').map(Number);
  return width / height;
}
