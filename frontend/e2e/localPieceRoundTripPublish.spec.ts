import { expect, test, type Request as PlaywrightRequest, type TestInfo } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { loginViaUI } from './support/auth.js';
import { localProjectDb } from './support/localProjectDb.js';
import { requireE2EFixtures } from './support/prerequisites.js';

type PackageManifest = {
  kind: string;
  records: Array<{ fileIndex: number }>;
  files: Array<{ index: number; path: string }>;
  source?: { engine?: string; code?: string };
};

type CapturedPackage = { manifest: PackageManifest; records: unknown[] };

function captureIntakePackage(request: PlaywrightRequest): CapturedPackage {
  const body = request.postDataBuffer();
  if (!body) throw new Error('The package intake request had no multipart body.');
  const contentType = request.headers()['content-type'] ?? '';
  const boundary = /boundary=([^;]+)/i.exec(contentType)?.[1];
  if (!boundary) throw new Error('The package intake request had no multipart boundary.');
  const zipStart = body.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const zipEnd = body.indexOf(Buffer.from(`\r\n--${boundary}`), zipStart);
  if (zipStart < 0 || zipEnd < 0) throw new Error('The package ZIP was not found in the request.');
  const entries = unzipSync(new Uint8Array(body.subarray(zipStart, zipEnd)));
  const manifest = JSON.parse(strFromU8(entries['manifest.json'])) as PackageManifest;
  const records = manifest.records.map((record) => {
    const file = manifest.files.find((candidate) => candidate.index === record.fileIndex);
    if (!file || !entries[file.path]) throw new Error('The package record file was missing.');
    return JSON.parse(strFromU8(entries[file.path])) as unknown;
  });
  return { manifest, records };
}

function transferRoute(pathname: string): boolean {
  return pathname === '/api/pieces/intake/';
}

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('Local-only piece publish-as-transfer (#942)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`warns, validates, uploads, and publishes a local-only 2D piece at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);

      await page.goto('/create');
      await page.getByRole('button', { name: 'Create a new 2D project', exact: true }).click();
      await page.waitForURL(/\/local-projects\/[^/]+$/);

      let intakeCalls = 0;
      let publishCalls = 0;
      await page.route('**/api/account/storage/estimate/**', async (route) => {
        await route.fulfill({
          json: {
            remaining_after: {
              private: { bytes: 50_000_000, files: 97 },
              public: { bytes: 50_000_000, files: 97 },
            },
            fits: { private: true, public: true },
          },
        });
      });
      await page.route('**/api/pieces/intake/', async (route) => {
        intakeCalls += 1;
        await route.fulfill({
          status: 201,
          json: {
            kind: '2d',
            public_id: 'e2e-published-piece',
            version: 1,
            visibility: 'private',
            media_count: 0,
          },
        });
      });
      await page.route('**/api/projects/e2e-published-piece/publish/', async (route) => {
        publishCalls += 1;
        await route.fulfill({
          json: {
            id: 'e2e-published-piece',
            title: 'Local project',
            description: 'A short description.',
            visibility: 'public',
            owner: fixtures.owner.email,
            editor_url: '/users/@e2e/edit/local-project',
          },
        });
      });

      await page.getByRole('button', { name: 'Make public' }).click();
      const dialog = page.getByRole('alertdialog', { name: /Make .* public\?/ });
      await expect(dialog).toBeVisible();
      const publishButton = dialog.getByRole('button', { name: 'Publish' });
      await expect(publishButton).toBeDisabled();

      await dialog.getByLabel('Title').fill('Local project');
      await dialog.getByLabel('Description').fill('A short description.');
      await expect(publishButton).toBeEnabled();
      await publishButton.click();

      await page.waitForURL('**/users/@e2e/edit/local-project');
      expect(intakeCalls).toBe(1);
      expect(publishCalls).toBe(1);
    });
  }

  test('refuses to upload over quota and leaves the local piece editable', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);

    await page.goto('/create');
    await page.getByRole('button', { name: 'Create a new 2D project', exact: true }).click();
    await page.waitForURL(/\/local-projects\/[^/]+$/);

    let intakeCalls = 0;
    await page.route('**/api/account/storage/estimate/**', async (route) => {
      await route.fulfill({
        json: {
          remaining_after: {
            private: { bytes: 50_000_000, files: 97 },
            public: { bytes: 0, files: 0 },
          },
          fits: { private: true, public: false },
        },
      });
    });
    await page.route('**/api/pieces/intake/', async (route) => {
      intakeCalls += 1;
      await route.continue();
    });

    await page.getByRole('button', { name: 'Make public' }).click();
    const dialog = page.getByRole('alertdialog', { name: /Make .* public\?/ });
    await dialog.getByLabel('Title').fill('Local project');
    await dialog.getByLabel('Description').fill('A short description.');
    await dialog.getByRole('button', { name: 'Publish' }).click();

    await expect(page.getByText(/Over quota/)).toBeVisible();
    expect(intakeCalls).toBe(0);
    // The local piece remains local-only and still editable, not half-transferred.
    await expect(page.getByRole('button', { name: 'Make public' })).toBeVisible();
  });
});

test.describe('Local versioned 3D transfer integrity (#1286)', () => {
  const fixtures = requireE2EFixtures();

  test('renders, reloads, captures, and publishes a local 3D primitive for a split-handle owner', async ({
    page,
    browser,
  }, testInfo: TestInfo) => {
    await page.setViewportSize(VIEWPORTS[0]);
    await loginViaUI(page, fixtures.split.email, fixtures.password);
    const localServerWrites: string[] = [];
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (
        ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method()) &&
        !/\/publish\/$/.test(pathname) &&
        (/^\/api\/projects(?:3d)?\//.test(pathname) || pathname === '/api/projects3d/')
      ) {
        localServerWrites.push(`${request.method()} ${pathname}`);
      }
    });

    await page.goto('/create');
    await page.getByRole('button', { name: 'Create a new 3D project', exact: true }).click();
    await page.waitForURL(/\/local-projects\/[^/]+$/);
    const localId = new URL(page.url()).pathname.split('/').at(-1)!;
    await page.getByRole('button', { name: '3D authoring' }).click();
    await page.getByRole('button', { name: 'Add sphere' }).click();
    await page.getByRole('button', { name: 'Hide 3d authoring' }).click();
    await expect(page.getByText('Sphere 1', { exact: true })).toBeVisible();
    await expect(page.getByTestId('scene3d-preview-canvas')).toBeVisible();
    await page.getByRole('button', { name: 'Save scene' }).click();
    await expect(page.getByTestId('project3d-save-status')).toHaveText(/Saved as version 2/);

    const before = await localProjectDb<{
      project: Record<string, unknown>;
      scenes: Array<{ sceneJson: Record<string, unknown> }>;
      versions: Array<{ sequence: number; payload: Record<string, unknown> }>;
    }>(page, {
      kind: 'read-project-content',
      ownerId: fixtures.split.username,
      projectId: localId,
    });
    const localScene = before.versions.at(-1)?.payload;
    const localObjects = localScene?.objects;
    expect(Array.isArray(localObjects)).toBe(true);
    expect((localObjects as Array<{ type: string }>).map((object) => object.type)).toContain(
      'sphere',
    );
    await page.screenshot({ path: testInfo.outputPath('local-3d-desktop.png'), fullPage: true });

    await page.reload();
    await expect(page.getByText('Sphere 1', { exact: true })).toBeVisible();
    await expect(page.getByTestId('scene3d-preview-canvas')).toBeVisible();
    await page.setViewportSize(VIEWPORTS[1]);
    await page.screenshot({ path: testInfo.outputPath('local-3d-mobile.png'), fullPage: true });
    const after = await localProjectDb<{
      project: Record<string, unknown>;
      scenes: Array<{ sceneJson: Record<string, unknown> }>;
      versions: Array<{ sequence: number; payload: Record<string, unknown> }>;
    }>(page, {
      kind: 'read-project-content',
      ownerId: fixtures.split.username,
      projectId: localId,
    });
    expect(after.scenes.map((scene) => scene.sceneJson)).toEqual(
      before.scenes.map((scene) => scene.sceneJson),
    );
    expect(after.versions.map((version) => version.payload)).toEqual(
      before.versions.map((version) => version.payload),
    );
    expect(localServerWrites).toEqual([]);

    await page.getByRole('button', { name: 'Make public' }).click();
    const dialog = page.getByRole('alertdialog', { name: /Make .* public\?/ });
    await dialog.getByLabel('Title').fill('Local 3D transfer acceptance');
    await dialog.getByLabel('Description').fill('A saved sphere in a local version.');
    let intakePackage: CapturedPackage | undefined;
    await page.route('**/api/pieces/intake/', async (route) => {
      intakePackage = captureIntakePackage(route.request());
      await route.continue();
    });
    const intakeResponsePromise = page.waitForResponse((response) => {
      return transferRoute(new URL(response.url()).pathname);
    });
    const publishResponsePromise = page.waitForResponse((response) => {
      const request = response.request();
      return (
        request.method() === 'POST' &&
        /\/api\/projects3d\/[^/]+\/publish\/$/.test(new URL(response.url()).pathname)
      );
    });
    await dialog.getByRole('button', { name: 'Publish' }).click();
    const intakeResponse = await intakeResponsePromise;
    const intakeBody = await intakeResponse.json();
    await testInfo.attach('local-3d-intake-capture.json', {
      contentType: 'application/json',
      body: JSON.stringify(
        {
          intakeRequest: {
            method: intakeResponse.request().method(),
            contentType: intakeResponse.request().headers()['content-type'],
          },
          intakeResponse: { status: intakeResponse.status(), body: intakeBody },
        },
        null,
        2,
      ),
    });
    expect(intakeResponse.status(), JSON.stringify(intakeBody)).toBe(201);
    const publishResponse = await publishResponsePromise;
    const published = (await publishResponse.json()) as {
      editor_url?: string | null;
      public_slug?: string;
      visibility?: string;
    };
    expect(intakePackage?.manifest.kind).toBe('3d');
    expect(intakePackage?.records).toHaveLength(2);
    expect(intakePackage?.records[1]).toMatchObject({
      camera: expect.any(Object),
      objects: [expect.objectContaining({ type: 'sphere', visible: true })],
    });
    await testInfo.attach('local-3d-transfer-capture.json', {
      contentType: 'application/json',
      body: JSON.stringify(
        {
          intakeRequest: intakePackage,
          intakeResponse: { status: intakeResponse.status(), body: intakeBody },
          publishRequest: {
            method: publishResponse.request().method(),
            url: new URL(publishResponse.url()).pathname,
            body: publishResponse.request().postData(),
          },
          publishResponse: { status: publishResponse.status(), body: published },
        },
        null,
        2,
      ),
    });
    expect(intakeResponse.status()).toBe(201);
    expect(intakeBody).toMatchObject({ kind: '3d', visibility: 'private', version: 2 });
    expect(publishResponse.status()).toBe(200);
    expect(published.visibility).toBe('public');
    expect(localServerWrites).toEqual([]);

    const publicSlug = published.public_slug;
    expect(publicSlug).toBeTruthy();
    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.setViewportSize(VIEWPORTS[0]);
    await anonymousPage.goto(`/users/@e2e_split_artist/pieces/${publicSlug}`);
    await expect(anonymousPage.getByTestId('scene3d-preview-canvas')).toBeVisible();
    await anonymousPage.screenshot({
      path: testInfo.outputPath('public-3d-desktop.png'),
      fullPage: true,
    });
    await anonymousPage.setViewportSize(VIEWPORTS[1]);
    await expect(anonymousPage.getByTestId('scene3d-preview-canvas')).toBeVisible();
    await anonymousPage.screenshot({
      path: testInfo.outputPath('public-3d-mobile.png'),
      fullPage: true,
    });
    await anonymousContext.close();
  });
});
