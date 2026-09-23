import fs from 'node:fs';

import JSZip from 'jszip';
import { expect, test, type Page } from '@playwright/test';

import { apiDelete, apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const ENGINES = [
  { id: 'svg', marker: 'svg', immersive: true },
  { id: 'threejs', marker: '#art-piece-container canvas', immersive: true },
  { id: 'aframe', marker: 'a-scene', immersive: true },
  { id: 'p5js', marker: 'canvas', immersive: true },
  { id: 'c2js', marker: '#c2-canvas', immersive: true },
  { id: 'c2js-interactive', marker: '#c2-canvas', immersive: true },
] as const;

type SavedPiece = {
  public_id: string;
  public_slug: string;
  engine: string;
  title: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  current_version: {
    source: string;
    capabilities: Record<string, boolean>;
  };
};

async function waitForGeneratedRuntime(page: Page, marker: string): Promise<void> {
  const frame = page.frameLocator('iframe[title="Art piece preview"]');
  await frame.locator(marker).waitFor({ state: 'attached', timeout: 15_000 });
  await expect(page.getByTestId('art-piece-save')).toBeVisible();
  await expect(page.getByTestId('art-piece-capabilities')).toBeVisible();
}

test.describe('AI authoring six-engine Persona matrix (#743)', () => {
  const fixtures = requireE2EFixtures();

  test('generates, saves, and reopens every engine through the Studio UI', async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const profileResponse = await apiGet(context, '/api/account/profile/');
    expect(profileResponse.ok()).toBe(true);
    const profile = (await profileResponse.json()) as { handle: string };
    expect(profile.handle).toBeTruthy();

    const runId = Date.now().toString(36);
    const personaResponse = await apiPost(context, '/api/account/ai-personas/', {
      name: `Six-engine Persona ${runId}`,
      prompt_text: 'Use luminous geometric forms and a coherent visual language.',
    });
    expect(personaResponse.status()).toBe(201);
    const persona = (await personaResponse.json()) as { id: number };
    const personasResponse = await apiGet(context, '/api/account/ai-personas/');
    expect(personasResponse.ok()).toBe(true);
    const personas = (await personasResponse.json()) as Array<{ id: number; name: string }>;
    expect(personas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: persona.id, name: `Six-engine Persona ${runId}` }),
      ]),
    );

    const savedPieces: SavedPiece[] = [];
    try {
      for (const engine of ENGINES) {
        const title = `AI matrix ${engine.id} ${runId}`;
        const prompt = `Create a luminous ${engine.id} art piece for the selected Persona.`;
        await page.goto('/art-pieces');
        await expect(page.getByRole('heading', { name: 'Art piece studio' })).toBeVisible();
        await expect(page.locator(`#art-piece-persona option[value="${persona.id}"]`)).toHaveCount(
          1,
        );
        await page.getByLabel('Library').selectOption(engine.id);
        await page.getByLabel('Persona').selectOption(String(persona.id));

        const generateRequest = page.waitForRequest(
          (request) =>
            request.url().includes('/api/ai/art-pieces/generate/') && request.method() === 'POST',
        );
        await page.getByLabel('Describe the art piece you want to generate').fill(prompt);
        await page.getByRole('button', { name: 'Generate' }).click();
        const request = await generateRequest;
        expect(request.postDataJSON()).toMatchObject({
          library: engine.id,
          prompt,
          persona_id: persona.id,
        });

        await waitForGeneratedRuntime(page, engine.marker);
        await page.getByTestId('art-piece-capability-screenshot').locator('input').check();
        await page.getByTestId('art-piece-capability-download').locator('input').check();
        await page.getByTestId('art-piece-capability-immersive').locator('input').check();
        await page.getByTestId('art-piece-capability-sound').locator('input').check();
        await page.getByTestId('art-piece-capability-camera_view').locator('input').check();
        await page.getByTestId('art-piece-capability-hand_steering').locator('input').check();
        await page.getByLabel('Piece title').fill(title);
        await page.getByLabel('Piece description').fill(`Saved ${engine.id} from AI Persona flow.`);
        await page.getByTestId('art-piece-save').click();
        await expect(page.getByText(new RegExp(`^Saved as ${title}`))).toBeVisible();

        const listResponse = await apiGet(context, '/api/art-pieces/');
        expect(listResponse.ok()).toBe(true);
        const list = (await listResponse.json()) as Array<{
          public_id: string;
          public_slug: string;
          title: string;
        }>;
        const listed = list.find((piece) => piece.title === title);
        expect(listed).toBeDefined();

        const publishResponse = page.waitForResponse(
          (response) =>
            response.url().includes(`/api/art-pieces/${listed!.public_id}/`) &&
            response.request().method() === 'PATCH',
        );
        await page.getByLabel('Status').selectOption('published');
        const publishedResponse = await publishResponse;
        expect(publishedResponse.status()).toBe(200);
        expect((await publishedResponse.json()) as { status: string }).toMatchObject({
          status: 'published',
        });
        await expect(page.getByLabel('Status')).toHaveValue('published');

        const detailResponse = await apiGet(context, `/api/art-pieces/${listed!.public_id}/`);
        expect(detailResponse.status()).toBe(200);
        const saved = (await detailResponse.json()) as SavedPiece;
        expect(saved).toMatchObject({
          public_id: listed!.public_id,
          public_slug: listed!.public_slug,
          engine: engine.id,
          title,
          description: `Saved ${engine.id} from AI Persona flow.`,
          status: 'published',
        });
        expect(saved.current_version.source.length).toBeGreaterThan(0);
        expect(saved.current_version.capabilities).toMatchObject({
          screenshot: true,
          download: true,
          immersive: true,
          sound: true,
          camera_view: true,
          hand_steering: true,
        });
        savedPieces.push(saved);
      }

      for (const saved of savedPieces) {
        for (const viewport of [
          { width: 1440, height: 900 },
          { width: 375, height: 812 },
        ]) {
          await test.step(`${saved.engine} regular public surface at ${viewport.width}x${viewport.height}`, async () => {
            await page.setViewportSize(viewport);
            await page.goto(`/art-pieces/p/${saved.public_id}`);
            await expect(page.getByRole('heading', { name: saved.title })).toBeVisible();
            await expect(page.locator('iframe[title="Art piece preview"]')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Open download menu' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Open immersive view' })).toHaveCount(0);

            await page.getByRole('button', { name: 'Open download menu' }).click();
            const downloadPromise = page.waitForEvent('download');
            await page.getByRole('menuitem', { name: 'Download Full ZIP' }).click();
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toMatch(/\.zip$/);
            const filePath = await download.path();
            expect(filePath).toBeTruthy();
            const bytes = fs.readFileSync(filePath!);
            expect(bytes.subarray(0, 2).toString()).toBe('PK');
            const zip = await JSZip.loadAsync(bytes);
            expect(Object.keys(zip.files)).toContain('index.html');
          });
        }

        await page.goto(`/users/@${profile.handle}/pieces/${saved.public_slug}`);
        await expect(page.getByRole('heading', { name: saved.title })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Open immersive view' })).toBeVisible();
        await test.step(`${saved.engine} canonical immersive surface`, async () => {
          await page.goto(`/users/@${profile.handle}/immersive/${saved.public_slug}`);
          await expect(page.getByRole('button', { name: 'Close immersive view' })).toBeVisible();
          await expect(page.locator('iframe[title="Immersive art piece preview"]')).toBeVisible();
        });
      }
    } finally {
      await apiDelete(context, `/api/account/ai-personas/${persona.id}/`);
    }
  });
});
