/** Issue #740: author a reference-style 2D and 3D piece end to end. */
import fs from 'node:fs';

import JSZip from 'jszip';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { apiDelete, apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const CASES = [
  { engine: 'svg', marker: 'svg', camera: false },
  { engine: 'threejs', marker: '#art-piece-container canvas', camera: true },
] as const;

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
] as const;

type CreatedPiece = {
  public_id: string;
  public_slug: string;
  title: string;
  engine: string;
  current_version: {
    capabilities: Record<string, boolean>;
    camera_placement: 'overlay' | 'background' | null;
  };
};

async function waitForStudioRuntime(page: Page, marker: string): Promise<void> {
  const frame = page.frameLocator('iframe[title="Art piece preview"]');
  await frame.locator(marker).waitFor({ state: 'attached', timeout: 15_000 });
  await expect(page.getByTestId('art-piece-capabilities')).toBeVisible();
}

async function downloadFullZip(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open download menu' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Download Full ZIP' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  const archive = await JSZip.loadAsync(fs.readFileSync(path!));
  expect(Object.keys(archive.files)).toContain('index.html');
}

async function createPieceThroughStudio(
  page: Page,
  context: BrowserContext,
  personaId: number,
  engine: (typeof CASES)[number],
  viewportName: string,
  runId: string,
): Promise<CreatedPiece> {
  await page.goto('/art-pieces');
  await expect(page.getByRole('heading', { name: 'Art piece studio' })).toBeVisible();
  await expect(page.locator(`#art-piece-persona option[value="${personaId}"]`)).toHaveCount(1);
  await page.getByLabel('Library').selectOption(engine.engine);
  await page.getByLabel('Persona').selectOption(String(personaId));

  const prompt = `Create a ${engine.engine} luminous interactive art piece for the selected Persona.`;
  const title = `Authoring ${engine.engine} ${viewportName} ${runId}`;
  const generateRequest = page.waitForRequest(
    (request) =>
      request.url().includes('/api/ai/art-pieces/generate/') && request.method() === 'POST',
  );
  await page.getByLabel('Describe the art piece you want to generate').fill(prompt);
  await page.getByRole('button', { name: 'Generate' }).click();
  expect((await generateRequest).postDataJSON()).toMatchObject({
    library: engine.engine,
    prompt,
    persona_id: personaId,
  });

  await waitForStudioRuntime(page, engine.marker);
  await page.getByTestId('art-piece-capability-screenshot').locator('input').check();
  await page.getByTestId('art-piece-capability-download').locator('input').check();
  await page.getByTestId('art-piece-capability-immersive').locator('input').check();
  await page.getByTestId('art-piece-capability-sound').locator('input').check();
  await page.getByTestId('art-piece-capability-camera_view').locator('input').check();
  await page.getByTestId('art-piece-capability-hand_steering').locator('input').check();
  if (engine.camera) {
    await expect(page.getByTestId('art-piece-camera-placement')).toBeVisible();
    await page.getByLabel('Camera feed placement').selectOption('background');
  }
  await page.getByLabel('Piece title').fill(title);
  await page
    .getByLabel('Piece description')
    .fill(`Created through the ${engine.engine} authoring workflow.`);

  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/art-pieces/') &&
      response.request().method() === 'POST' &&
      response.status() === 201,
  );
  await page.getByTestId('art-piece-save').click();
  const piece = (await (await saveResponse).json()) as CreatedPiece;
  expect(piece.engine).toBe(engine.engine);
  expect(piece.title).toBe(title);
  expect(piece.current_version.capabilities).toMatchObject({
    screenshot: true,
    download: true,
    immersive: true,
    sound: true,
    camera_view: true,
    hand_steering: true,
  });
  if (engine.camera) expect(piece.current_version.camera_placement).toBe('background');

  const publishResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/art-pieces/${piece.public_id}/`) &&
      response.request().method() === 'PATCH',
  );
  await page.getByLabel('Status').selectOption('published');
  expect((await publishResponse).status()).toBe(200);
  await expect(page.getByLabel('Status')).toHaveValue('published');
  return piece;
}

test.describe('reference-style authoring workflow (#740)', () => {
  const fixtures = requireE2EFixtures();

  test('creates, publishes, views, downloads, and refines 2D/3D pieces', async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const profile = (await (await apiGet(context, '/api/account/profile/')).json()) as {
      handle: string;
    };
    const runId = Date.now().toString(36);
    const personaResponse = await apiPost(context, '/api/account/ai-personas/', {
      name: `Authoring Persona ${runId}`,
      prompt_text:
        'Use luminous geometric forms, clear interaction cues, and a coherent visual language.',
    });
    expect(personaResponse.status()).toBe(201);
    const persona = (await personaResponse.json()) as { id: number };
    const created: CreatedPiece[] = [];

    try {
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        for (const engine of CASES) {
          const piece = await createPieceThroughStudio(
            page,
            context,
            persona.id,
            engine,
            viewport.name,
            runId,
          );
          created.push(piece);

          await page.goto(`/users/@${profile.handle}/pieces/${piece.public_slug}`);
          await expect(page.getByRole('heading', { name: piece.title })).toBeVisible();
          await expect(page.locator('iframe[title="Art piece preview"]')).toBeVisible();
          await expect(page.getByRole('button', { name: 'Open immersive view' })).toBeVisible();
          await downloadFullZip(page);

          await page.goto(`/users/@${profile.handle}/immersive/${piece.public_slug}`);
          await expect(page.getByRole('button', { name: 'Close immersive view' })).toBeVisible();
          await expect(page.locator('iframe[title="Immersive art piece preview"]')).toBeVisible();
        }
      }

      const threeD = created.find((piece) => piece.engine === 'threejs');
      expect(threeD).toBeDefined();
      await page.goto(`/art-pieces/${threeD!.public_id}/edit`);
      await expect(page.getByRole('heading', { name: `Edit ${threeD!.title}` })).toBeVisible();
      await page.getByLabel('Piece description').fill('Refined through the owner workflow.');
      await page.getByTestId('art-piece-editor-save-metadata').click();
      await expect(page.getByRole('heading', { name: `Edit ${threeD!.title}` })).toBeVisible();
      await expect(
        page.getByTestId('art-piece-editor-version-list').getByRole('listitem'),
      ).toHaveCount(1);

      await page
        .getByLabel('Describe the revision you want to generate')
        .fill('Make the geometric forms brighter.');
      await page.getByRole('button', { name: 'Refine piece' }).click();
      await expect(page.getByTestId('art-piece-refine-plan')).toBeVisible();
      const accepted = page.getByTestId('art-piece-refine-accepted');
      const saveVersion = page.getByTestId('art-piece-editor-save-version');
      await expect(accepted.or(saveVersion)).toBeVisible();
      if (await accepted.isVisible()) {
        await expect(accepted).toContainText('version');
      } else {
        await saveVersion.click();
      }
      await expect(
        page.getByTestId('art-piece-editor-version-list').getByRole('listitem'),
      ).toHaveCount(2);
      const versions = await apiGet(context, `/api/art-pieces/${threeD!.public_id}/versions/`);
      expect(versions.status()).toBe(200);
      expect(await versions.json()).toHaveLength(2);
    } finally {
      for (const piece of created) await apiDelete(context, `/api/art-pieces/${piece.public_id}/`);
      await apiDelete(context, `/api/account/ai-personas/${persona.id}/`);
    }
  });
});
