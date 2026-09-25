import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test('structured Three.js Full ZIP sound controls activate and report state (#832)', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  const e2eFixtures = requireE2EFixtures();
  await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);
  const profile = (await (await apiGet(context, '/api/account/profile/')).json()) as {
    handle: string;
  };
  const created = await apiPost(context, '/api/projects3d/', {});
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { id: string };
  expect(
    (
      await apiPatch(context, `/api/projects3d/${project.id}/`, {
        title: 'Sound fixture',
      })
    ).ok(),
  ).toBe(true);
  expect((await apiPost(context, `/api/projects3d/${project.id}/publish/`)).ok()).toBe(true);
  const profilePieces = (await (
    await apiGet(context, `/api/users/@${profile.handle}/`)
  ).json()) as {
    pieces: Array<{ id: string; slug: string }>;
  };
  const piece = profilePieces.pieces.find((item) => item.id === project.id);
  if (!piece) throw new Error('Published structured 3D fixture was not in the public profile.');

  const downloadPromise = page.waitForEvent('download');
  await page.goto(`/users/@${profile.handle}/pieces/${piece.slug}`);
  await page.getByRole('button', { name: 'Open download menu' }).click();
  await page.getByRole('menuitem', { name: 'Download Full ZIP' }).click();
  const download = await downloadPromise;
  const zip = await JSZip.loadAsync(fs.readFileSync((await download.path())!));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'structured-sound-'));
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, await entry.async('nodebuffer'));
  }

  try {
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`file://${path.join(root, 'index.html')}`);
      await page.getByRole('button', { name: 'Piece controls' }).click();
      await expect(page.locator('#piece-sound-status')).toContainText('Sound is off.');
      await page.getByRole('button', { name: 'Enable sound' }).click();
      await expect(page.getByRole('button', { name: 'Mute sound' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(page.locator('#piece-sound-status')).toContainText('Ambient sound is playing.');
      await page.locator('#piece-ambient-bpm').fill('120');
      await expect(page.locator('#piece-ambient-bpm')).toHaveValue('120');
      await page.locator('#piece-ambient-volume').fill('30');
      await expect(page.locator('#piece-ambient-volume')).toHaveValue('30');
      await page.locator('#piece-ambient-muted').check();
      await expect(page.locator('#piece-ambient-muted')).toBeChecked();
      await page.locator('#piece-ambient-scale').selectOption('dorian');
      await expect(page.locator('#piece-ambient-scale')).toHaveValue('dorian');
      await page.locator('#piece-keyboard-volume').fill('65');
      await expect(page.locator('#piece-keyboard-volume')).toHaveValue('65');
      await page.locator('#piece-keyboard-oscillator').selectOption('square');
      await expect(page.locator('#piece-keyboard-oscillator')).toHaveValue('square');
      await page.locator('#piece-keyboard-filter-type').selectOption('highpass');
      await expect(page.locator('#piece-keyboard-filter-type')).toHaveValue('highpass');
      await page.locator('#piece-keyboard-filter-cutoff').fill('4000');
      await page.locator('#piece-keyboard-filter-resonance').fill('2');
      await page.locator('#piece-keyboard-attack').fill('0.2');
      await page.locator('#piece-keyboard-decay').fill('0.4');
      await page.locator('#piece-keyboard-sustain').fill('0.6');
      await page.locator('#piece-keyboard-release').fill('0.8');
      await page.locator('#piece-keyboard-octave').fill('1');
      await expect(page.locator('#piece-keyboard-octave')).toHaveValue('1');
      await page.getByRole('button', { name: 'Keyboard notes' }).click();
      await expect(page.locator('#piece-keyboard-status')).toContainText('Keyboard notes enabled.');
      await page.keyboard.press('a');
      await expect(page.locator('#piece-keyboard-status')).toContainText(
        'Keyboard note A is playing.',
      );
      await page.screenshot({
        path: `test-results/structured-sound-${viewport.width}.png`,
        fullPage: true,
      });
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
