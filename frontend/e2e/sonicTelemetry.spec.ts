import { expect, test, type Page } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const CANVAS_RED_RECTANGLE =
  '<canvas id="art-piece-canvas" width="320" height="240"></canvas>' +
  '<script>var c=document.getElementById("art-piece-canvas");' +
  'var x=c.getContext("2d");x.fillStyle="#dc2626";x.fillRect(0,0,320,240);</script>';

type SonicTelemetry = {
  kind: 'ambient' | 'movement' | 'melodic';
  note: string;
  frequency: number;
  tempo: number;
  scale: string;
  key: { root: string; scale: string };
  transpose: number;
};

async function installSonicTelemetryCapture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const events: SonicTelemetry[] = [];
    Object.defineProperty(window, '__sonicTelemetry', {
      configurable: true,
      value: events,
    });
    window.addEventListener('augmentrart:sonic-note', (event) => {
      const detail = (event as CustomEvent<SonicTelemetry>).detail;
      if (detail) events.push(detail);
    });
  });
}

async function readSonicTelemetry(page: Page): Promise<SonicTelemetry[]> {
  return page.evaluate(
    () =>
      (window as typeof window & { __sonicTelemetry?: SonicTelemetry[] }).__sonicTelemetry ?? [],
  );
}

test.describe('Generated public sound telemetry (#918)', () => {
  test.setTimeout(60_000);

  test('captures eight ambient notes and the C4-C5 major keyboard sequence', async ({
    page,
    context,
  }) => {
    const fixture = requireE2EFixtures();
    await loginViaUI(page, fixture.owner.email, fixture.password);
    await installSonicTelemetryCapture(page);

    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Sonic telemetry fixture',
      description: 'Disposable major/C/90 sound telemetry fixture.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: {
        screenshot: true,
        sound: true,
        keyboard: true,
        download: false,
        fullscreen: false,
      },
      generation_metadata: {
        sonic: {
          tempo: 90,
          root: 'C',
          scale: 'major',
          keyboard_scale: 'major',
          instrument: 'synth',
          extras: {
            voices: { melodic: 'synth' },
            synth: { octave_min: 0, octave_max: 5 },
          },
        },
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
    await expect(page.getByRole('heading', { name: 'Sonic telemetry fixture' })).toBeVisible();
    await page.getByRole('button', { name: 'Piece controls', exact: true }).click();
    await expect(page.getByLabel(/^Scale:/)).toHaveValue('major');
    await expect(page.getByLabel('Key')).toHaveValue('C');
    await expect(page.getByLabel('Scale', { exact: true })).toHaveValue('major');
    await page.getByRole('button', { name: 'Unmute sound' }).click();
    await expect(page.getByTestId('sound-status')).toContainText('(running).');

    await expect
      .poll(
        async () => {
          const events = await readSonicTelemetry(page);
          return events.filter((event) => event.kind === 'ambient').length;
        },
        { timeout: 20_000 },
      )
      .toBeGreaterThanOrEqual(8);

    const ambient = (await readSonicTelemetry(page)).filter((event) => event.kind === 'ambient');
    expect(ambient.slice(0, 8)).toHaveLength(8);
    for (const event of ambient.slice(0, 8)) {
      expect(event).toMatchObject({
        kind: 'ambient',
        tempo: 90,
        scale: 'major',
        key: { root: 'C', scale: 'major' },
        transpose: 0,
      });
      expect(event.note).toMatch(/^[A-G](#|b)?[0-9]$/);
      expect(event.frequency).toBeGreaterThan(0);
    }

    const keyboard = page.getByRole('group', { name: 'Keyboard' });
    await keyboard.getByRole('button', { name: 'Keyboard notes' }).click();
    await expect(keyboard.getByRole('button', { name: 'Stop keyboard notes' })).toBeVisible();
    // Keyboard telemetry is emitted by the trusted parent frame. Focus the
    // page rather than the sandbox iframe, whose isolated document receives
    // key events without bubbling them into the parent window.
    await page.getByRole('heading', { name: 'Sonic telemetry fixture' }).click();
    for (const key of ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k']) {
      await page.keyboard.press(key);
    }

    await expect
      .poll(async () => {
        const events = await readSonicTelemetry(page);
        return events.filter((event) => event.kind === 'melodic').length;
      })
      .toBeGreaterThanOrEqual(8);

    const melodic = (await readSonicTelemetry(page)).filter((event) => event.kind === 'melodic');
    expect(melodic.slice(-8).map((event) => event.note)).toEqual([
      'C4',
      'D4',
      'E4',
      'F4',
      'G4',
      'A4',
      'B4',
      'C5',
    ]);
  });
});
