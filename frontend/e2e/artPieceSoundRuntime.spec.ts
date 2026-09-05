import { expect, test, type BrowserContext } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #430: `artPieceSandbox.ts` used to only `dispatchEvent` an
 * unconsumed `art-piece-command` for `toggle-sound`/`enable-microphone` --
 * no application runtime ever started an `AudioContext` or called
 * `getUserMedia`, so every "Sound"/"Microphone" control was purely
 * decorative. This suite drives the real sandboxed runtime the fix adds:
 * a lazily-created `AudioContext`+`GainNode` for Sound/volume/keyboard
 * notes, and a genuinely separate `getUserMedia({ audio: true })` gesture
 * for the microphone (mocked here -- no real hardware in CI/disposable
 * runs), asserting the *acknowledged* state each command reports back,
 * never just that a command was sent.
 */

const CANVAS_RED_RECTANGLE =
  '<canvas id="art-piece-canvas" width="320" height="240"></canvas>' +
  '<script>var c=document.getElementById("art-piece-canvas");' +
  'var x=c.getContext("2d");x.fillStyle="#dc2626";x.fillRect(0,0,320,240);</script>';

/** Mocks `navigator.mediaDevices.getUserMedia` for every frame in this
 * context (including the sandboxed, opaque-origin `srcDoc` iframe --
 * `context.addInitScript` targets frame creation, not same-origin
 * script access) -- mirrors `publishingAndRemix.spec.ts`'s own
 * `installMediaPipeTestSeam` convention for camera, adapted to
 * audio-only and to a minimal fake stream shape the sandbox's own
 * `stopMicrophone()` (`stream.getTracks().forEach(t => t.stop())`) can
 * consume without needing a real `MediaStream`. */
async function mockMicrophone(
  context: BrowserContext,
  outcome: 'granted' | 'denied' | 'unavailable',
): Promise<void> {
  await context.addInitScript((outcomeArg: string) => {
    // Scoped to the sandboxed iframe only (`window.self !== window.top`)
    // -- the top-level app's own unrelated code may call
    // `navigator.mediaDevices.getUserMedia` directly (without an
    // existence guard) elsewhere on the page, so overriding it there too
    // would break rendering outside the art-piece sandbox entirely.
    if (window.self === window.top) return;
    if (outcomeArg === 'unavailable') {
      Object.defineProperty(window.navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: undefined,
      });
      return;
    }
    Object.defineProperty(window.navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: () =>
        outcomeArg === 'granted'
          ? Promise.resolve({ getTracks: () => [{ stop: () => {} }] })
          : Promise.reject(new Error('Permission denied')),
    });
  }, outcome);
}

test.describe('Generated regular viewer: sound and microphone runtime (#430)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('sound only starts from activation, volume and keyboard notes change real runtime state', async ({
    page,
    context,
  }) => {
    await mockMicrophone(context, 'granted');
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Sound runtime fixture',
      description: 'A published piece with sound, keyboard and microphone enabled.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: {
        screenshot: true,
        sound: true,
        keyboard: true,
        microphone: true,
        download: false,
        fullscreen: false,
      },
      source: CANVAS_RED_RECTANGLE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`/art-pieces/p/${piece.public_id}`);
      await expect(page.getByRole('heading', { name: 'Sound runtime fixture' })).toBeVisible();
      // The volume slider and status text live in the "Piece controls"
      // disclosure, same as camera/hand-steering/reset -- open it once.
      await page.getByRole('button', { name: 'Piece controls' }).click();

      // Sound never auto-starts -- the piece just loaded and no command
      // has been sent yet.
      const muteButton = page.getByRole('button', { name: 'Unmute sound' });
      await expect(muteButton).toBeVisible();
      await expect(muteButton).toHaveAttribute('aria-pressed', 'false');

      await muteButton.click();
      const nowMuteButton = page.getByRole('button', { name: 'Mute sound' });
      await expect(nowMuteButton).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('sound-status')).toContainText('Sound is on at 20% volume.');

      // Volume: a real slider change is acknowledged back with the new
      // value, not just echoed from the DOM input itself.
      const volumeSlider = page.getByLabel('Sound volume');
      await volumeSlider.fill('0.75');
      await expect(page.getByTestId('sound-status')).toContainText('Sound is on at 75% volume.');

      // Keyboard notes: focus the sandboxed iframe (a real click, not a
      // simulated key on the parent document -- the sandbox's own
      // `keydown` listener lives inside the iframe's window) then press a
      // mapped key.
      await page
        .frameLocator('iframe[title="Art piece preview"]')
        .locator('canvas')
        .click({ position: { x: 10, y: 10 } });
      await page.keyboard.press('a');
      await expect(page.getByTestId('keyboard-note-status')).toContainText('Last note played: a.');

      // Mute again: sound stops, and a subsequent keypress must not
      // report a new note (the sandbox only plays a tone while soundOn).
      await nowMuteButton.click();
      await expect(page.getByTestId('sound-status')).toContainText('Sound is off.');
      await expect(page.getByTestId('keyboard-note-status')).toContainText(
        'Turn on Sound to play keyboard notes.',
      );
    }
  });

  test('microphone requires its own gesture, shares no implicit camera grant, and reports denied/unavailable states', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Microphone runtime fixture',
      description: 'A published piece with microphone enabled, camera disabled.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: {
        screenshot: true,
        microphone: true,
        camera_view: false,
        download: false,
        fullscreen: false,
      },
      source: CANVAS_RED_RECTANGLE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    // Denied: the sandbox's own catch() reports 'denied', never a silent
    // success.
    await mockMicrophone(context, 'denied');
    await page.goto(`/art-pieces/p/${piece.public_id}`);
    await expect(page.getByRole('heading', { name: 'Microphone runtime fixture' })).toBeVisible();
    await page.getByRole('button', { name: 'Piece controls' }).click();
    await expect(page.getByTestId('microphone-status')).toContainText('Microphone is off.');
    await page.getByRole('button', { name: 'Enable microphone' }).click();
    await expect(page.getByTestId('microphone-status')).toContainText(
      'Microphone access was denied.',
    );

    // Unavailable: no navigator.mediaDevices.getUserMedia at all.
    await mockMicrophone(context, 'unavailable');
    await page.goto(`/art-pieces/p/${piece.public_id}`);
    await page.getByRole('button', { name: 'Piece controls' }).click();
    await page.getByRole('button', { name: 'Enable microphone' }).click();
    await expect(page.getByTestId('microphone-status')).toContainText(
      'Microphone is unavailable in this browser.',
    );

    // Granted: reaches 'active', and disabling stops it again -- the
    // full activate/deactivate lifecycle, not just the happy path.
    await mockMicrophone(context, 'granted');
    await page.goto(`/art-pieces/p/${piece.public_id}`);
    await page.getByRole('button', { name: 'Piece controls' }).click();
    const enableButton = page.getByRole('button', { name: 'Enable microphone' });
    await enableButton.click();
    const disableButton = page.getByRole('button', { name: 'Disable microphone' });
    await expect(disableButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('microphone-status')).toContainText('Microphone is active.');
    await disableButton.click();
    await expect(page.getByTestId('microphone-status')).toContainText('Microphone is off.');
  });

  test('sound, keyboard and microphone controls are absent when their capabilities are disabled', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'All-disabled runtime fixture',
      description: 'A published piece with sound, keyboard and microphone disabled.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: {
        screenshot: true,
        sound: false,
        keyboard: false,
        microphone: false,
        camera_view: false,
        download: false,
        fullscreen: false,
      },
      source: CANVAS_RED_RECTANGLE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    await page.goto(`/art-pieces/p/${piece.public_id}`);
    await expect(page.getByRole('heading', { name: 'All-disabled runtime fixture' })).toBeVisible();
    await expect(page.getByRole('button', { name: /mute sound/i })).toHaveCount(0);
    await expect(page.getByTestId('sound-status')).toHaveCount(0);
    await expect(page.getByTestId('keyboard-note-status')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /microphone/i })).toHaveCount(0);
    await expect(page.getByTestId('microphone-status')).toHaveCount(0);
  });
});
