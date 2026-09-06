import fs from 'node:fs';

import { expect, test } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #442: `/account/settings/export` downloads a portable archive of
 * everything the caller owns -- profile, linked identities, entitlement/
 * billing status, AI credential *configuration* only, and every owned
 * Project/Project3D/ArtPiece with their full version history. Never
 * another user's data, never key material.
 */

test.describe('Account data export (#442)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('an anonymous visitor cannot export account data', async ({ context }) => {
    const response = await apiGet(context, '/api/account/export/');
    expect(response.status()).toBe(401);
  });

  test('downloads a real archive containing the owned project, 3D scene, and art piece, without leaking another owner or key material', async ({
    page,
    context,
    browser,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);

    const project = await apiPost(context, '/api/projects/blank/', {});
    expect(project.status()).toBe(201);
    const projectId = ((await project.json()) as { id: string }).id;
    const project3d = await apiPost(context, '/api/projects3d/', {});
    expect(project3d.status()).toBe(201);
    const project3dId = ((await project3d.json()) as { id: string }).id;
    const artPiece = await apiPost(context, '/api/art-pieces/', {
      title: 'Export fixture piece',
      description: 'Used to verify the account data export.',
      prompt: 'a red rectangle',
      engine: 'canvas2d',
      capabilities: {},
      source: '<canvas></canvas>',
    });
    expect(artPiece.status()).toBe(201);

    // A second owner, never referenced by the export below, proves
    // isolation -- not just that the export lists *something*.
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await loginViaUI(otherPage, fixture.other.email, fixture.password);
    const otherPiece = await apiPost(otherContext, '/api/art-pieces/', {
      title: "Someone else's export sentinel",
      description: 'Must never appear in fixture.owner export.',
      prompt: 'x',
      engine: 'canvas2d',
      capabilities: {},
      source: '<canvas></canvas>',
    });
    expect(otherPiece.status()).toBe(201);

    await page.goto('/account/settings/export');
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('account-export-download').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('account-export.json');

    const path = await download.path();
    const archive = JSON.parse(fs.readFileSync(path!, 'utf-8')) as {
      schema_version: number;
      profile: { username: string };
      projects: Array<{ public_id: string; versions: unknown[] }>;
      projects_3d: Array<{ public_id: string; versions: unknown[] }>;
      art_pieces: Array<{ title: string; versions: unknown[] }>;
      ai_credentials: Record<string, unknown>;
    };

    expect(archive.schema_version).toBe(1);
    expect(archive.profile.username).toBe(fixture.owner.username);
    // Look up by this test's own fixture id/title, rather than an exact
    // array length -- fixture.owner is shared across every browser
    // project this file runs under in one invocation, so it may already
    // own other projects/pieces from an earlier project's run.
    const exportedProject = archive.projects.find((p) => p.public_id === projectId);
    expect(exportedProject).toBeDefined();
    expect(exportedProject!.versions.length).toBeGreaterThanOrEqual(1);
    const exportedProject3d = archive.projects_3d.find((p) => p.public_id === project3dId);
    expect(exportedProject3d).toBeDefined();
    expect(exportedProject3d!.versions.length).toBeGreaterThanOrEqual(1);
    const exportedPiece = archive.art_pieces.find((p) => p.title === 'Export fixture piece');
    expect(exportedPiece).toBeDefined();
    expect(exportedPiece!.versions).toHaveLength(1);

    const raw = fs.readFileSync(path!, 'utf-8');
    expect(raw).not.toContain("Someone else's export sentinel");
    expect(raw).not.toMatch(/encrypted_key|"key":|decrypted/i);

    await expect(page.getByText('Your export has downloaded.')).toBeVisible();

    await otherContext.close();
  });
});
