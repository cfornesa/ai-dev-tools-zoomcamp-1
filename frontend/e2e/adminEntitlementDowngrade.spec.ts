import { expect, test } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 812 },
  { width: 375, height: 812 },
];

type EntitlementResponse = {
  capabilities: Record<
    string,
    { available: boolean; daily_cap: number | null; unlimited: boolean }
  >;
};

test.describe('reversible admin entitlements (#561)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`restores finite caps after admin revoke at ${viewport.width}x${viewport.height}`, async ({
      browser,
    }) => {
      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      await adminPage.setViewportSize(viewport);
      await loginViaUI(adminPage, fixtures.admin.email, fixtures.password);

      const clearAccess = await apiPost(adminContext, '/api/admin/content/access/', {
        identifier: fixtures.other.username,
        granted: false,
      });
      expect(clearAccess.ok()).toBe(true);

      const ordinaryContext = await browser.newContext();
      const ordinaryPage = await ordinaryContext.newPage();
      await ordinaryPage.setViewportSize(viewport);
      await loginViaUI(ordinaryPage, fixtures.other.email, fixtures.password);

      const baselineResponse = await apiGet(ordinaryContext, '/api/account/entitlements/');
      expect(baselineResponse.ok()).toBe(true);
      const baseline = (await baselineResponse.json()) as EntitlementResponse;
      expect(baseline.capabilities.editor_2d_local.available).toBe(true);
      expect(baseline.capabilities.ai_scene_create.unlimited).toBe(false);

      const grant = await apiPost(adminContext, '/api/admin/content/access/', {
        identifier: fixtures.other.username,
        granted: true,
      });
      expect(grant.ok()).toBe(true);

      const elevatedResponse = await apiGet(ordinaryContext, '/api/account/entitlements/');
      expect(elevatedResponse.ok()).toBe(true);
      const elevated = (await elevatedResponse.json()) as EntitlementResponse;
      expect(elevated.capabilities.ai_scene_create).toMatchObject({
        available: true,
        daily_cap: null,
        unlimited: true,
      });

      const revoke = await apiPost(adminContext, '/api/admin/content/access/', {
        identifier: fixtures.other.username,
        granted: false,
      });
      expect(revoke.ok()).toBe(true);

      const downgradedResponse = await apiGet(ordinaryContext, '/api/account/entitlements/');
      expect(downgradedResponse.ok()).toBe(true);
      const downgraded = (await downgradedResponse.json()) as EntitlementResponse;
      expect(downgraded.capabilities.editor_2d_local).toMatchObject({
        available: true,
        unlimited: false,
      });
      expect(downgraded.capabilities.ai_scene_create.unlimited).toBe(false);
      expect(downgraded.capabilities.ai_scene_create.daily_cap).not.toBeNull();

      await adminContext.close();
      await ordinaryContext.close();
    });
  }
});
