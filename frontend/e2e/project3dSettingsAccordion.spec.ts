import { expect, test } from '@playwright/test';

import { apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const SCENE = {
  schemaVersion: 1,
  documentType: 'scene3d',
  id: 'settings-accordion-fixture',
  scene: { backgroundColor: '#101018' },
  camera: {
    position: { x: 0, y: 5, z: 10 },
    target: { x: 0, y: 0, z: 0 },
    fov: 50,
    near: 0.1,
    far: 1000,
  },
  lights: [{ id: 'ambient', type: 'ambient', color: '#ffffff', intensity: 1 }],
  groups: [],
  objects: [],
  randomness: { seed: 1, enabled: false },
};

test.describe('3D project settings accordion (#1037)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`keeps Web address and Sound independent at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const created = await apiPost(page.context(), '/api/projects3d/', {});
      expect(created.status()).toBe(201);
      const project = (await created.json()) as { id: string };
      const version = await apiPost(page.context(), `/api/projects3d/${project.id}/versions/`, {
        scene_json: SCENE,
        origin: 'manual',
      });
      expect(version.status()).toBe(201);

      await page.goto(`/projects3d/${project.id}`);
      const settings = page.getByRole('region', { name: 'Project settings' });
      await expect(settings).toBeVisible();
      const web = settings.getByRole('button', { name: 'Web address' });
      const sound = settings.getByRole('button', { name: 'Sound' });
      await expect(web).toHaveAttribute('aria-expanded', 'false');
      await expect(sound).toHaveAttribute('aria-expanded', 'false');

      await web.click();
      await expect(web).toHaveAttribute('aria-expanded', 'true');
      await expect(settings.locator('#project3d-web-address-panel')).toBeVisible();
      await expect(sound).toHaveAttribute('aria-expanded', 'false');

      await sound.click();
      await expect(sound).toHaveAttribute('aria-expanded', 'true');
      await expect(settings.locator('#project3d-sound-panel')).toBeVisible();
      await expect(web).toHaveAttribute('aria-expanded', 'true');

      const askAi = settings.getByRole('button', { name: 'Ask AI to improve this scene' });
      await expect(askAi).toHaveAttribute('aria-expanded', 'false');
      await askAi.click();
      await expect(askAi).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByTestId('project3d-ai-improve-panel')).toBeVisible();

      const bounds = await settings.evaluate((element) => {
        const panels = Array.from(
          element.querySelectorAll<HTMLElement>('.project3d-accordion-panel'),
        );
        return panels.map((panel) => ({
          panel: panel.getBoundingClientRect().width,
          parent: panel.parentElement?.getBoundingClientRect().width ?? 0,
        }));
      });
      for (const bound of bounds) {
        expect(Math.abs(bound.panel - bound.parent)).toBeLessThanOrEqual(2);
      }
    });
  }
});
