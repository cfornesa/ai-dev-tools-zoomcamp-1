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

  const editorPath = new URL(project.editor_url, page.url()).pathname.replace(/\/?$/, '/');
  const editorApiPath = `/api${editorPath}`;
  const editorReady = page.waitForResponse(
    (editorResponse) =>
      editorResponse.request().method() === 'GET' &&
      new URL(editorResponse.url()).pathname === editorApiPath,
  );
  await page.goto(project.editor_url);
  await page.waitForURL(/\/users\/@[^/]+\/edit\/[^/]+\/?$/);
  const editorResponse = await editorReady;
  if (!editorResponse.ok()) {
    throw new Error(
      `Could not load the server-backed 3D project editor: HTTP ${editorResponse.status()}`,
    );
  }
  const editorPayload = (await editorResponse.json()) as { piece?: { id?: string } };
  if (editorPayload.piece?.id !== project.id) {
    throw new Error('The 3D editor did not load the project created for this test');
  }
  return project.id;
}

/** Creates a local-only 3D project through the creation page and opens its IndexedDB editor. */
export async function createLocalProject3DViaUI(page: Page): Promise<string> {
  await page.goto('/create');
  await page.getByRole('button', { name: 'Create a new 3D project', exact: true }).click();
  await page.waitForURL(/\/local-projects\/[^/]+$/);
  const id = /\/local-projects\/([^/]+)$/.exec(new URL(page.url()).pathname)?.[1];
  if (!id) throw new Error('The local 3D project route did not contain a project id');
  await page.getByTestId('project3d-save-status').waitFor({ state: 'visible' });
  return id;
}

/**
 * Creates a server-backed 3D project through the Gallery's creation menu and opens its editor.
 */
export async function createBlank3DProjectViaUI(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'More creation options' }).click();
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/projects3d/',
  );
  await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
  const { id } = (await (await created).json()) as { id: string };
  await page.waitForURL(/\/users\/@[^/]+\/edit\/[^/]+$/);
  return id;
}
