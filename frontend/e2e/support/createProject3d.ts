import type { Page } from '@playwright/test';

import { apiPost } from './api.js';

type CreatedServerProject3D = { id: string; editor_url?: string | null };

/**
 * Creates a 3D project in server-backed PostgreSQL storage through the API,
 * opens its canonical editor route, and returns the server project id.
 */
export async function createServerProject3D(page: Page): Promise<string> {
  const response = await apiPost(page.context(), '/api/projects3d/');
  if (!response.ok()) {
    throw new Error(`Could not create a server-backed 3D project: HTTP ${response.status()}`);
  }

  const project = (await response.json()) as CreatedServerProject3D;
  if (!project.id || !project.editor_url) {
    throw new Error('The 3D project create response did not include an id and editor_url');
  }

  await page.goto(project.editor_url);
  await page.waitForURL(/\/users\/@[^/]+\/edit\/[^/]+\/?$/);
  return project.id;
}

/**
 * Creates a blank 3D project through the Gallery's "More creation options" menu and waits for the
 * canonical `/users/@handle/edit/:slug` route, returning the project's real id (read from the create
 * response, since the slug in the URL is not the id). Issue #746/#795: the create flow no longer lands on
 * the legacy `/projects3d/:id` route, so specs must not wait for that URL.
 */
export async function createBlank3DProjectViaUI(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'More creation options' }).click();
  const created = page.waitForResponse(
    (res) =>
      res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/projects3d/',
  );
  await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
  const { id } = (await (await created).json()) as { id: string };
  await page.waitForURL(/\/users\/@[^/]+\/edit\/[^/]+$/);
  return id;
}
