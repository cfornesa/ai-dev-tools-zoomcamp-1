import { expect, test, type Page } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #428: the Studio's own save path (`ArtPieceStudio.tsx`'s
 * `handleSave`) never sent a `capabilities` object at all -- every piece
 * created through the real UI silently persisted the server's empty-dict
 * default, no matter what a user might have wanted to enable. Every other
 * art-piece spec seeds its fixture via `apiPost` directly, bypassing this
 * gap entirely. This suite drives the actual generate -> configure -> save
 * flow instead, for both a flat (Canvas2D) and a spatial (Three.js)
 * library, and separately proves the server rejects non-boolean
 * capability values instead of silently coercing them.
 */

async function generate(page: Page, library: string, prompt: string): Promise<void> {
  await page.goto('/art-pieces');
  await page.getByLabel('Library').selectOption(library);
  await page.getByLabel('Describe the art piece you want to generate').fill(prompt);
  await page.getByRole('button', { name: 'Generate' }).click();
  await expect(page.getByTestId('art-piece-preview')).toBeVisible();
  // #457: the sandbox's "ready" handshake depends on requestAnimationFrame
  // inside the cross-origin preview iframe, which Chromium throttles while
  // the iframe is scrolled out of view -- exactly where it renders on this
  // form-heavy page. Scrolling it into view is also just what a real user
  // does to look at the piece they generated.
  await page.getByTestId('art-piece-preview').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('art-piece-save')).toBeVisible();
}

test.describe('Generated studio /art-pieces: capability contract (#428)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  const VIEWPORTS = [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ];

  for (const viewport of VIEWPORTS) {
    test(`a flat library generation offers no spatial capabilities and persists exactly the selected set at ${viewport.width}x${viewport.height}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixture.owner.email, fixture.password);
      await generate(page, 'canvas2d', 'a red rectangle');

      // Spatial-only capabilities are visibly unavailable with a reason,
      // and cannot be checked.
      const handSteering = page.getByTestId('art-piece-capability-hand_steering');
      const immersive = page.getByTestId('art-piece-capability-immersive');
      await expect(handSteering).toContainText('Three.js/A-Frame only');
      await expect(immersive).toContainText('Three.js/A-Frame only');
      await expect(handSteering.locator('input')).toBeDisabled();
      await expect(immersive.locator('input')).toBeDisabled();

      await page.getByTestId('art-piece-capability-screenshot').locator('input').check();
      await page.getByTestId('art-piece-capability-download').locator('input').check();
      await page.getByTestId('art-piece-capability-sound').locator('input').check();

      const title = `Capability contract flat fixture ${viewport.width}`;
      await page.getByLabel('Piece title').fill(title);
      await page
        .getByLabel('Piece description')
        .fill('Verifies the persisted capability contract.');
      await page.getByTestId('art-piece-save').click();
      await expect(page.getByText(new RegExp(`^Saved as ${title}`))).toBeVisible();

      const list = await apiGet(context, '/api/art-pieces/');
      const pieces = (await list.json()) as Array<{ title: string; public_id: string }>;
      const saved = pieces.find((piece) => piece.title === title);
      expect(saved).toBeDefined();

      const detail = await apiGet(context, `/api/art-pieces/${saved!.public_id}/`);
      expect(detail.status()).toBe(200);
      const piece = (await detail.json()) as {
        current_version: { capabilities: Record<string, boolean> };
      };
      expect(piece.current_version.capabilities).toEqual({
        sound: true,
        keyboard: false,
        microphone: false,
        camera_view: false,
        hand_steering: false,
        fullscreen: false,
        screenshot: true,
        download: true,
        immersive: false,
      });
    });

    test(`a spatial library generation offers hand-steering and immersive, and reload preserves the exact saved contract at ${viewport.width}x${viewport.height}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixture.owner.email, fixture.password);
      await generate(page, 'threejs', 'a rotating cube');

      const handSteering = page.getByTestId('art-piece-capability-hand_steering');
      const immersive = page.getByTestId('art-piece-capability-immersive');
      await expect(handSteering).not.toContainText('Three.js/A-Frame only');
      await expect(immersive).not.toContainText('Three.js/A-Frame only');
      await expect(handSteering.locator('input')).toBeEnabled();
      await expect(immersive.locator('input')).toBeEnabled();

      await handSteering.locator('input').check();
      await immersive.locator('input').check();
      await page.getByTestId('art-piece-capability-camera_view').locator('input').check();

      const title = `Capability contract spatial fixture ${viewport.width}`;
      await page.getByLabel('Piece title').fill(title);
      await page
        .getByLabel('Piece description')
        .fill('Verifies spatial capabilities persist and reload identically.');
      await page.getByTestId('art-piece-save').click();
      await expect(page.getByText(new RegExp(`^Saved as ${title}`))).toBeVisible();

      const list = await apiGet(context, '/api/art-pieces/');
      const pieces = (await list.json()) as Array<{ title: string; public_id: string }>;
      const saved = pieces.find((piece) => piece.title === title);
      expect(saved).toBeDefined();

      // Reload from a fresh page load -- proves the persisted contract, not
      // just in-memory component state.
      await page.goto(`/art-pieces/manage`);
      const detail = await apiGet(context, `/api/art-pieces/${saved!.public_id}/`);
      const piece = (await detail.json()) as {
        current_version: { capabilities: Record<string, boolean> };
      };
      expect(piece.current_version.capabilities).toEqual({
        sound: false,
        keyboard: false,
        microphone: false,
        camera_view: true,
        hand_steering: true,
        fullscreen: false,
        screenshot: false,
        download: false,
        immersive: true,
      });
    });
  }

  test('the server rejects unknown keys and non-boolean capability values instead of silently coercing them', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);

    const unknownKey = await apiPost(context, '/api/art-pieces/', {
      title: 'Rejected unknown key',
      description: 'Should never persist.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: { screenshot: true, made_up_capability: true },
      source: '<canvas></canvas>',
    });
    expect(unknownKey.status()).toBe(400);

    // A truthy-but-non-boolean value (a non-empty string) previously
    // coerced silently to `true` via Python's `bool("false")` -- the real
    // #428 bug this test would have caught.
    const nonBoolean = await apiPost(context, '/api/art-pieces/', {
      title: 'Rejected non-boolean value',
      description: 'Should never persist.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: { sound: 'false' },
      source: '<canvas></canvas>',
    });
    expect(nonBoolean.status()).toBe(400);

    const numeric = await apiPost(context, '/api/art-pieces/', {
      title: 'Rejected numeric value',
      description: 'Should never persist.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: { sound: 1 },
      source: '<canvas></canvas>',
    });
    expect(numeric.status()).toBe(400);
  });

  test('cross-user denial: another owner cannot read or overwrite this piece', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Capability contract denial fixture',
      description: 'Owner-only.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: { screenshot: true },
      source: '<canvas></canvas>',
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };

    const otherContext = await context.browser()!.newContext();
    const otherPage = await otherContext.newPage();
    await loginViaUI(otherPage, fixture.other.email, fixture.password);

    const denied = await apiGet(otherContext, `/api/art-pieces/${piece.public_id}/`);
    expect(denied.status()).toBe(404);

    const deniedWrite = await apiPost(
      otherContext,
      `/api/art-pieces/${piece.public_id}/versions/`,
      { source: '<canvas></canvas>', capabilities: { hand_steering: true } },
    );
    expect(deniedWrite.status()).toBe(404);

    await otherContext.close();
  });

  test('failure recovery: a save error leaves the form editable and retryable', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    await generate(page, 'canvas2d', 'a red rectangle');

    await page.getByLabel('Piece title').fill('Retry fixture');
    await page.getByLabel('Piece description').fill('First attempt is forced to fail.');

    // Force the save request to fail once, exactly like a transient
    // network/server error a real user could hit.
    let intercepted = false;
    await page.route('**/api/art-pieces/', (route) => {
      if (route.request().method() === 'POST' && !intercepted) {
        intercepted = true;
        void route.fulfill({ status: 500, body: '{}' });
        return;
      }
      void route.continue();
    });

    await page.getByTestId('art-piece-save').click();
    await expect(page.getByRole('alert')).toContainText('Could not save this art piece');
    await expect(page.getByTestId('art-piece-save')).toHaveText('Save piece');

    await page.getByTestId('art-piece-save').click();
    await expect(page.getByText(/^Saved as Retry fixture/)).toBeVisible();

    const list = await apiGet(context, '/api/art-pieces/');
    const pieces = (await list.json()) as Array<{ title: string }>;
    expect(pieces.filter((piece) => piece.title === 'Retry fixture')).toHaveLength(1);
  });
});
