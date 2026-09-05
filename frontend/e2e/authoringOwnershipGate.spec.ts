import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #458 (discovered while investigating #451): none of the four
 * authoring workspaces -- `EditorWorkspace.tsx`, `Project3DWorkspace.tsx`,
 * `AiEditorWorkspace.tsx`, `AiProject3DWorkspace.tsx` -- checked ownership
 * before rendering. `PROJECT_READ`/`PROJECT3D_READ` deliberately let any
 * visitor fetch a *published* project's detail response, so a non-owner
 * (or a fully signed-out visitor) navigating directly to an authoring URL
 * for a published project saw the full Edit/Publish/Unpublish/Save UI,
 * even though every write endpoint was already correctly owner-gated
 * server-side. This suite drives all four authoring routes as both an
 * anonymous visitor and a signed-in non-owner against a real published
 * project, and confirms the actual owner's own flow is unaffected.
 */

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('Authoring workspaces redirect a non-owner away from owner controls (#458)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('a published 2D project: signed-out and non-owner visitors never see owner controls at /projects/:id or /ai-projects/:id, at both viewports', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/projects/blank/', {});
    expect(created.status()).toBe(201);
    const project = (await created.json()) as { id: string };
    await apiPatch(context, `/api/projects/${project.id}/`, {
      title: 'Ownership gate 2D fixture',
      description: 'Used to verify the authoring ownership gate.',
    });
    const published = await apiPost(context, `/api/projects/${project.id}/publish/`);
    expect(published.status()).toBe(200);

    const anonContext = await context.browser()!.newContext();
    const anonPage = await anonContext.newPage();
    const otherContext = await context.browser()!.newContext();
    const otherPage = await otherContext.newPage();
    await loginViaUI(otherPage, fixture.other.email, fixture.password);

    for (const viewport of VIEWPORTS) {
      for (const visitorPage of [anonPage, otherPage]) {
        await visitorPage.setViewportSize(viewport);
        // The 2D manual/AI editors each fetch the owner-only SceneVersion
        // detail (`Action.VERSION_READ`, owner-only for every project
        // regardless of publish status) right after the project itself,
        // so a non-owner already 404s there and lands on the same
        // "You don't have access" state a private project produces --
        // never a URL redirect to the public viewer, but just as
        // effectively never the authoring UI either.
        await visitorPage.goto(`/projects/${project.id}`);
        await expect(visitorPage.getByRole('alert')).toContainText("don't have access");
        await expect(visitorPage.getByRole('button', { name: 'Edit title' })).toHaveCount(0);
        await expect(
          visitorPage.getByRole('button', { name: 'Unpublish', exact: true }),
        ).toHaveCount(0);

        await visitorPage.goto(`/ai-projects/${project.id}`);
        await expect(visitorPage.getByRole('alert')).toContainText("don't have access");
        await expect(visitorPage.getByRole('button', { name: 'Edit title' })).toHaveCount(0);
      }
    }

    await anonContext.close();
    await otherContext.close();

    // The owner's own authoring flow is unaffected.
    await page.goto(`/projects/${project.id}`);
    await expect(page.getByRole('heading', { name: 'Ownership gate 2D fixture' })).toBeVisible();
    await page.getByRole('button', { name: 'Open piece controls menu' }).click();
    await expect(
      page.getByRole('button', {
        name: /^(publication status: published|hide publication status: published)$/i,
      }),
    ).toBeVisible();
  });

  test('a published 3D project: signed-out and non-owner visitors are redirected off /projects3d/:id and /ai-projects3d/:id, at both viewports', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/projects3d/', {});
    expect(created.status()).toBe(201);
    const project = (await created.json()) as { id: string };
    const published = await apiPost(context, `/api/projects3d/${project.id}/publish/`);
    expect(published.status()).toBe(200);

    const anonContext = await context.browser()!.newContext();
    const anonPage = await anonContext.newPage();
    const otherContext = await context.browser()!.newContext();
    const otherPage = await otherContext.newPage();
    await loginViaUI(otherPage, fixture.other.email, fixture.password);

    for (const viewport of VIEWPORTS) {
      for (const visitorPage of [anonPage, otherPage]) {
        await visitorPage.setViewportSize(viewport);
        await visitorPage.goto(`/projects3d/${project.id}`);
        await expect(visitorPage).toHaveURL(new RegExp(`/p3d/${project.id}$`));
        await expect(
          visitorPage.getByRole('button', { name: 'Unpublish', exact: true }),
        ).toHaveCount(0);

        await visitorPage.goto(`/ai-projects3d/${project.id}`);
        await expect(visitorPage).toHaveURL(new RegExp(`/p3d/${project.id}$`));
      }
    }

    await anonContext.close();
    await otherContext.close();

    // The owner's own authoring flow is unaffected.
    await page.goto(`/projects3d/${project.id}`);
    await expect(page).toHaveURL(new RegExp(`/projects3d/${project.id}$`));
    await expect(page.getByRole('button', { name: 'Unpublish', exact: true })).toBeVisible();
  });

  test('a private (unpublished) project still denies a non-owner identically to before, for both families', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created2d = await apiPost(context, '/api/projects/blank/', {});
    const project2d = (await created2d.json()) as { id: string };
    const created3d = await apiPost(context, '/api/projects3d/', {});
    const project3d = (await created3d.json()) as { id: string };

    const otherContext = await context.browser()!.newContext();
    const otherPage = await otherContext.newPage();
    await loginViaUI(otherPage, fixture.other.email, fixture.password);

    const denied2d = await apiGet(otherContext, `/api/projects/${project2d.id}/`);
    expect(denied2d.status()).toBe(404);
    const denied3d = await apiGet(otherContext, `/api/projects3d/${project3d.id}/`);
    expect(denied3d.status()).toBe(404);

    await otherPage.goto(`/projects/${project2d.id}`);
    await expect(otherPage.getByRole('alert')).toBeVisible();
    await expect(otherPage.getByRole('button', { name: 'Edit title' })).toHaveCount(0);

    await otherContext.close();
  });
});
