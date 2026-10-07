/** Batch 20 / #1280: exercise the owner create-to-publication journey for
 * every structured and generated kind, from both blank/manual and AI starts.
 * This uses the normal disposable Playwright fixtures and AI_PROVIDER=fake;
 * it never calls a live provider. */
import { expect, test, type Page } from '@playwright/test';

import { apiGet, apiPatch } from './support/api.js';
import { createServerProject2D } from './support/createProject.js';
import { createServerProject3D } from './support/createProject3d.js';
import { createServerProjectAndOpenAIProposalPanel } from './support/aiProposal.js';
import { loginViaUI } from './support/auth.js';
import { closeEditScene, openEditScene } from './support/openEditScene.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import { saveScene } from './support/saveScene.js';
import { setAIScenario } from './support/aiScenario.js';

type StructuredKind = '2d' | '3d';
type GeneratedLibrary =
  'canvas2d' | 'svg' | 'p5js' | 'c2js' | 'c2js-interactive' | 'threejs' | 'aframe';
type PieceKind = StructuredKind | GeneratedLibrary;
type CreationMode = 'manual' | 'ai';

const fixtures = requireE2EFixtures();
const libraries: GeneratedLibrary[] = [
  'canvas2d',
  'svg',
  'p5js',
  'c2js',
  'c2js-interactive',
  'threejs',
  'aframe',
];
const previewMarkers: Record<GeneratedLibrary, string> = {
  canvas2d: '#art-piece-canvas',
  svg: 'svg',
  p5js: 'canvas',
  c2js: '#c2-canvas',
  'c2js-interactive': '#c2-canvas',
  threejs: '#art-piece-container canvas',
  aframe: 'a-scene',
};

type CreatedPiece = {
  id: string;
  title: string;
  publicPath: string;
  kind: PieceKind;
  generated: boolean;
};

type MatrixFailure = {
  kind: PieceKind;
  mode: CreationMode;
  step: string;
  error: string;
};

type MatrixCaseEvidence = {
  kind: PieceKind;
  mode: CreationMode;
  piece_id: string | null;
  title: string;
  viewport: '1280x900';
  result: 'PASS' | 'FAIL';
  last_step: string;
  observation: string;
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function canonicalPublicPath(page: Page): string {
  const route = new URL(page.url()).pathname;
  const match = /^\/users\/(@[^/]+)\/edit\/([^/]+)$/.exec(route);
  if (!match) throw new Error(`Expected canonical owner editor URL, got ${route}`);
  return `/users/${match[1]}/pieces/${match[2]}`;
}

async function createStructured(
  page: Page,
  mode: CreationMode,
  kind: StructuredKind,
  title: string,
): Promise<CreatedPiece> {
  let id: string;
  if (mode === 'manual') {
    id = kind === '2d' ? await createServerProject2D(page) : await createServerProject3D(page);
  } else {
    const { projectId, panel } = await createServerProjectAndOpenAIProposalPanel(page, kind);
    id = projectId;
    await setAIScenario(page, 'success');
    await panel
      .getByRole('textbox', { name: 'Describe the scene you want to generate' })
      .fill(`Create a simple ${kind.toUpperCase()} test scene for ${title}.`);
    const generateResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname ===
          `/api/projects${kind === '3d' ? '3d' : ''}/${id}/ai/create-scene/`,
    );
    await panel.getByRole('button', { name: 'Generate scene' }).click();
    const response = await generateResponse;
    if (!response.ok()) {
      throw new Error(
        `Fake ${kind} scene generation returned HTTP ${response.status()}: ${await response.text()}`,
      );
    }
    const proposal = panel.getByRole('region', { name: 'AI proposal preview' });
    await expect(proposal).toBeVisible({ timeout: 30_000 });
    await proposal.getByRole('button', { name: 'Accept', exact: true }).click();
    const saveStatus =
      kind === '2d'
        ? page.getByTestId('editor-save-status')
        : page.getByTestId('project3d-save-status');
    await expect(saveStatus).toHaveText(/Saved as version 2/);
  }

  const detailPath = kind === '2d' ? `/api/projects/${id}/` : `/api/projects3d/${id}/`;
  const metadata = await apiPatch(page.context(), detailPath, {
    title,
    description: `Batch 20 ${mode} ${kind} acceptance fixture.`,
  });
  expect(metadata.ok(), `Could not label ${kind} fixture: HTTP ${metadata.status()}`).toBe(true);
  return { id, title, publicPath: canonicalPublicPath(page), kind, generated: false };
}

async function createGenerated(
  page: Page,
  mode: CreationMode,
  library: GeneratedLibrary,
  title: string,
  context: import('@playwright/test').BrowserContext,
): Promise<CreatedPiece> {
  if (mode === 'manual') {
    await page.goto(`/art-pieces?mode=blank&engine=${library}`);
    await expect(page.getByTestId('art-piece-starter-mode')).toContainText(
      'No AI request is made.',
    );
  } else {
    await page.goto(`/art-pieces?engine=${library}`);
    await page
      .getByLabel('Describe the art piece you want to generate')
      .fill(`A simple geometric ${library} test piece.`);
    const generated = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/ai/art-pieces/generate/',
    );
    await page.getByRole('button', { name: 'Generate', exact: true }).click();
    const response = await generated;
    expect(response.ok(), `${library} fake generation returned HTTP ${response.status()}`).toBe(
      true,
    );
  }

  const frame = page.getByTestId('art-piece-preview').contentFrame();
  await expect(frame.locator(previewMarkers[library])).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('art-piece-crashed')).toHaveCount(0);
  await page.getByLabel('Piece title').fill(title);
  await page
    .getByLabel('Piece description')
    .fill(`Batch 20 ${mode} ${library} acceptance fixture.`);
  await page.getByTestId('art-piece-save').click();
  await expect(page.getByText(`Saved as ${title} (draft).`)).toBeVisible();

  const listedResponse = await apiGet(context, '/api/art-pieces/');
  expect(listedResponse.ok()).toBe(true);
  const items = (await listedResponse.json()) as Array<{
    public_id: string;
    public_slug: string;
    title: string;
    engine: string;
  }>;
  const saved = items.find((item) => item.title === title && item.engine === library);
  expect(saved, `${library} saved piece should appear in its owner API`).toBeDefined();
  return {
    id: saved!.public_id,
    title,
    publicPath: `/users/@e2e_owner/pieces/${saved!.public_slug}`,
    kind: library,
    generated: true,
  };
}

async function saveSecondVersion(page: Page, piece: CreatedPiece): Promise<void> {
  if (piece.generated) {
    await page.goto(`/art-pieces/${piece.id}/edit`);
    await page.waitForURL(/\/users\/@[^/]+\/edit\/[^/]+$/);
    await page.getByTestId('art-piece-editor-edit-source').click();
    const source = page.getByLabel('Editable source preview');
    const previous = await source.inputValue();
    const suffix =
      piece.kind === 'p5js' ||
      piece.kind === 'c2js' ||
      piece.kind === 'c2js-interactive' ||
      piece.kind === 'threejs'
        ? '\n// Batch 20 manual version check'
        : '\n<!-- Batch 20 manual version check -->';
    await source.fill(`${previous}${suffix}`);
    const saveVersion = page.getByTestId('art-piece-editor-save-version');
    await expect(saveVersion).toBeVisible({ timeout: 20_000 });
    await saveVersion.click();
    await expect(
      page.getByTestId('art-piece-editor-version-list').getByRole('listitem'),
    ).toHaveCount(2);
    return;
  }

  if (piece.kind === '2d') {
    await openEditScene(page);
    await page.getByRole('button', { name: 'Add circle' }).click();
    await saveScene(page);
    await expect(page.getByTestId('editor-save-status')).toHaveText(/Saved as version [23]/);
    await closeEditScene(page);
    return;
  }

  const frame = page.getByTestId('scene3d-preview-canvas-frame');
  const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
  await toolbar.getByRole('button', { name: '3D authoring' }).click();
  await toolbar.getByRole('button', { name: 'Add sphere' }).click();
  await page.getByRole('button', { name: 'Save scene', exact: true }).click();
  await expect(page.getByTestId('project3d-save-status')).toHaveText(/Saved as version [23]/);
  const closeAuthoring = toolbar.getByRole('button', { name: 'Close 3d authoring', exact: true });
  if (await closeAuthoring.isVisible()) await closeAuthoring.click();
}

async function publishPiece(page: Page, piece: CreatedPiece): Promise<void> {
  if (piece.generated) {
    await page.goto(`/users/@e2e_owner/edit/${piece.publicPath.split('/').at(-1)}`);
    const status = page.getByRole('group', { name: 'Publication status', exact: true });
    await status.getByRole('button', { name: 'Published', exact: true }).click();
    const confirm = page.getByRole('alertdialog', { name: /Publish/ });
    await confirm.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('art-piece-editor-publication-status')).toContainText(
      'Published (public)',
    );
    return;
  }
  if (piece.kind === '2d') {
    const actions = page.getByRole('group', { name: 'Primary editor actions' });
    const file = actions.getByRole('button', { name: 'File', exact: true });
    if ((await file.getAttribute('aria-expanded')) !== 'true') await file.click();
    const status = actions.getByRole('group', { name: 'Publication status', exact: true });
    await status.getByRole('button', { name: 'Published', exact: true }).click();
    const confirm = page.getByRole('alertdialog', { name: /Publish/ });
    await confirm.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('visibility-status')).toContainText('Published (public)');
    return;
  }
  await page
    .getByRole('group', { name: 'Publication status', exact: true })
    .getByRole('button', { name: 'Published', exact: true })
    .click();
  const confirm = page.getByRole('alertdialog', { name: /Publish/ });
  await confirm.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');
}

async function unpublishPiece(page: Page, piece: CreatedPiece): Promise<void> {
  if (piece.generated) {
    const status = page.getByRole('group', { name: 'Publication status', exact: true });
    await status.getByRole('button', { name: 'Draft', exact: true }).click();
    await expect(page.getByTestId('art-piece-editor-publication-status')).toContainText(
      'Draft (private)',
    );
  } else if (piece.kind === '2d') {
    const actions = page.getByRole('group', { name: 'Primary editor actions' });
    const file = actions.getByRole('button', { name: 'File', exact: true });
    if ((await file.getAttribute('aria-expanded')) !== 'true') await file.click();
    await actions
      .getByRole('group', { name: 'Publication status', exact: true })
      .getByRole('button', { name: 'Draft', exact: true })
      .click();
    await expect(page.getByTestId('visibility-status')).toContainText('Draft (private)');
  } else {
    await page
      .getByRole('group', { name: 'Publication status', exact: true })
      .getByRole('button', { name: 'Draft', exact: true })
      .click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Private');
  }
}

test('every piece kind completes manual and AI create-to-publication parity', async ({
  page,
  context,
  browser,
}, testInfo) => {
  test.setTimeout(1_200_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginViaUI(page, fixtures.owner.email, fixtures.password);
  const suffix = Date.now().toString(36);
  const failures: MatrixFailure[] = [];
  const caseEvidence: MatrixCaseEvidence[] = [];
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();

  const kinds: PieceKind[] = ['2d', '3d', ...libraries];
  try {
    for (const kind of kinds) {
      for (const mode of ['manual', 'ai'] as const) {
        let currentStep = 'create';
        let piece: CreatedPiece | undefined;
        const title = `Parity ${kind} ${mode} ${suffix}`;
        try {
          await test.step(`${kind} / ${mode}: create`, async () => {
            if (kind === '2d' || kind === '3d') {
              piece = await createStructured(page, mode, kind, title);
            } else {
              piece = await createGenerated(page, mode, kind, title, context);
            }
          });

          currentStep = 'edit and save a second version';
          await test.step(`${kind} / ${mode}: edit and save a second version`, async () => {
            if (!piece) throw new Error('Creation step did not return a piece.');
            await saveSecondVersion(page, piece);
          });

          currentStep = 'appears in Studio';
          await test.step(`${kind} / ${mode}: appears in Studio`, async () => {
            if (!piece) throw new Error('Creation step did not return a piece.');
            await page.goto(`/studio${piece.generated ? '?kind=generated' : ''}`);
            await expect(
              page.getByRole('heading', { name: piece.title, exact: true }),
            ).toBeVisible();
            if (piece.generated) {
              await expect(page.getByRole('combobox', { name: 'Piece kind' })).toHaveValue(
                'generated',
              );
            }
          });

          currentStep = 'publish';
          await test.step(`${kind} / ${mode}: publish`, async () => {
            if (!piece) throw new Error('Creation step did not return a piece.');
            await page.goto(piece.publicPath.replace('/pieces/', '/edit/'));
            await publishPiece(page, piece);
          });

          currentStep = 'public gallery and sitemap';
          await test.step(`${kind} / ${mode}: public gallery and sitemap`, async () => {
            if (!piece) throw new Error('Creation step did not return a piece.');
            await anonymousPage.goto('/gallery?type=all');
            await expect(anonymousPage.getByTestId(`gallery-card-${piece.id}`)).toBeVisible();
            const sitemap = await anonymousPage.request.get('/sitemap.xml');
            expect(sitemap.ok(), 'Public sitemap should respond successfully.').toBe(true);
            expect(await sitemap.text()).toContain(piece.publicPath);
          });

          currentStep = 'unpublish and verify removal';
          await test.step(`${kind} / ${mode}: unpublish and verify removal`, async () => {
            if (!piece) throw new Error('Creation step did not return a piece.');
            await page.goto(piece.publicPath.replace('/pieces/', '/edit/'));
            await unpublishPiece(page, piece);
            await anonymousPage.goto('/gallery?type=all');
            await expect(anonymousPage.getByTestId(`gallery-card-${piece.id}`)).toHaveCount(0);
            const sitemap = await anonymousPage.request.get('/sitemap.xml');
            expect(await sitemap.text()).not.toContain(piece.publicPath);
          });
          if (!piece) throw new Error('Creation step did not return a piece.');
          caseEvidence.push({
            kind,
            mode,
            piece_id: piece.id,
            title,
            viewport: '1280x900',
            result: 'PASS',
            last_step: 'unpublish and verify removal',
            observation:
              'Owner Studio showed the piece; anonymous gallery and sitemap showed it only while published.',
          });
        } catch (error) {
          const failure = {
            kind,
            mode,
            step: currentStep,
            error: `${message(error)}\nURL=${page.url()}`,
          };
          failures.push(failure);
          caseEvidence.push({
            kind,
            mode,
            piece_id: piece?.id ?? null,
            title,
            viewport: '1280x900',
            result: 'FAIL',
            last_step: currentStep,
            observation: failure.error,
          });
          console.error(`Parity failure ${kind}/${mode}/${currentStep}: ${failure.error}`);
        }
      }
    }
  } finally {
    await anonymousContext.close();
  }

  await testInfo.attach('piece-parity-failures', {
    body: JSON.stringify(failures, null, 2),
    contentType: 'application/json',
  });
  await testInfo.attach('piece-parity-cases', {
    body: JSON.stringify(caseEvidence, null, 2),
    contentType: 'application/json',
  });
  expect(
    failures,
    `Failures by piece kind and step:\n${JSON.stringify(failures, null, 2)}`,
  ).toEqual([]);
});
