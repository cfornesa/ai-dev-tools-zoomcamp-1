import { expect, test } from '@playwright/test';

import { apiDelete, apiGet, apiPost, apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('immersive collection gallery (#557)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`navigates a bounded live collection room at ${viewport.width}x${viewport.height}`, async ({
      browser,
    }) => {
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);
      const profile = await apiGet(ownerContext, '/api/account/profile/');
      const handle = ((await profile.json()) as { handle: string }).handle;

      const projects: string[] = [];
      for (const title of ['Immersive first', 'Immersive second']) {
        const created = await apiPost(ownerContext, '/api/projects/blank/', {});
        expect(created.status()).toBe(201);
        const project = (await created.json()) as { id: string };
        projects.push(project.id);
        expect(
          (
            await apiPatch(ownerContext, `/api/projects/${project.id}/`, {
              title,
              description: 'Immersive collection fixture.',
            })
          ).status(),
        ).toBe(200);
        expect((await apiPost(ownerContext, `/api/projects/${project.id}/publish/`)).status()).toBe(
          200,
        );
      }

      const created = await apiPost(ownerContext, '/api/account/collections/', {
        title: `Immersive room ${viewport.width}`,
      });
      expect(created.status()).toBe(201);
      const collection = (await created.json()) as { id: string; slug: string };
      expect(
        (
          await apiPost(ownerContext, `/api/account/collections/${collection.id}/items/`, {
            items: projects.map((id) => ({ kind: 'project', id })),
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await apiPost(ownerContext, `/api/account/collections/${collection.id}/publish/`)
        ).status(),
      ).toBe(200);

      const page = await browser.newPage();
      await page.setViewportSize(viewport);
      await page.goto(`/users/@${handle}/collections/${collection.slug}/immersive`);
      await expect(
        page.getByRole('heading', { name: `Immersive room ${viewport.width}` }),
      ).toBeVisible();
      await expect(page.locator('[data-live-slot-budget="1"]')).toBeVisible();
      await expect(page.getByTitle('Live view of Immersive first')).toHaveAttribute(
        'src',
        '/embed/p/' + projects[0],
      );
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByTitle('Live view of Immersive second')).toHaveAttribute(
        'src',
        '/embed/p/' + projects[1],
      );
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect(page.getByTitle('Live view of Immersive first')).toBeVisible();

      const embedPage = await browser.newPage();
      await embedPage.setViewportSize(viewport);
      await embedPage.goto(`/embed/collections/@${handle}/${collection.slug}`);
      await expect(
        embedPage.getByRole('heading', { name: `Immersive room ${viewport.width}` }),
      ).toHaveCount(0);
      await expect(embedPage.getByRole('button', { name: 'Next' })).toBeVisible();

      await apiDelete(ownerContext, `/api/account/collections/${collection.id}/`);
      for (const id of projects) await apiDelete(ownerContext, `/api/projects/${id}/`);
      await ownerContext.close();
      await page.close();
      await embedPage.close();
    });
  }
});
