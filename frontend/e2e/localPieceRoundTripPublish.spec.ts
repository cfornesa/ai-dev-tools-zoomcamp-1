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

test.describe('Local generated transfer integrity (#1287)', () => {
  const fixtures = requireE2EFixtures();

  test('renders, reloads, and publishes a local SVG version without changing stored source', async ({
    page,
    browser,
  }, testInfo: TestInfo) => {
    await page.setViewportSize(VIEWPORTS[0]);
    await loginViaUI(page, fixtures.split.email, fixtures.password);
    await page.goto('/create');
    await page.getByRole('button', { name: 'Create a local generated piece', exact: true }).click();
    await page.waitForURL(/\/local-generated\/[^/]+$/);
    const localId = new URL(page.url()).pathname.split('/').at(-1)!;
    const source =
      '<svg id="local-transfer-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="36" fill="#00e5ff"/></svg>';
    await page.getByLabel('Generated source').fill(source);
    await expect(page.getByLabel('Generated source')).toHaveValue(source);
    await page.getByRole('button', { name: 'Save local version' }).click();
    await expect(page.getByRole('status')).toContainText(/Saved locally/);
    const frame = page.frameLocator('.local-generated-preview iframe');
    await page.screenshot({ path: testInfo.outputPath('local-svg-desktop.png'), fullPage: true });
    const previewMarkup = await frame.locator('body').innerHTML();
    await testInfo.attach('local-svg-preview-markup.html', {
      contentType: 'text/html',
      body: previewMarkup,
    });
    await expect(frame.locator('svg circle'), previewMarkup).toBeVisible();

    const before = await localProjectDb<{
      scenes: Array<{ sceneJson: Record<string, unknown> }>;
      versions: Array<{ sequence: number; payload: Record<string, unknown> }>;
    }>(page, {
      kind: 'read-project-content',
      ownerId: fixtures.split.username,
      projectId: localId,
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Local generated SVG' })).toBeVisible();
    await expect(
      page.frameLocator('.local-generated-preview iframe').locator('svg circle'),
    ).toBeVisible();
    await page.setViewportSize(VIEWPORTS[1]);
    await page.screenshot({ path: testInfo.outputPath('local-svg-mobile.png'), fullPage: true });
    const after = await localProjectDb<{
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

    await page.getByRole('button', { name: 'Make public' }).click();
    const dialog = page.getByRole('alertdialog', { name: /Make .* public\?/ });
    await dialog.getByLabel('Description').fill('A local SVG version that survives reload.');
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
        request.method() === 'PATCH' &&
        /\/api\/art-pieces\/[^/]+\/$/.test(new URL(response.url()).pathname)
      );
    });
    await dialog.getByRole('button', { name: 'Publish' }).click();
    const intakeResponse = await intakeResponsePromise;
    const intakeBody = await intakeResponse.json();
    await testInfo.attach('local-svg-intake-capture.json', {
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
      public_slug?: string;
      status?: string;
    };
    expect(intakePackage?.manifest.kind).toBe('generated');
    expect(intakePackage?.manifest.source?.engine).toBe('svg');
    expect(intakePackage?.manifest.source?.code).toContain('local-transfer-svg');
    await testInfo.attach('local-svg-transfer-capture.json', {
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
    expect(intakeBody).toMatchObject({ kind: 'generated', visibility: 'private', version: 1 });
    expect(publishResponse.status()).toBe(200);
    expect(published.status).toBe('published');

    const publicSlug = published.public_slug;
    expect(publicSlug).toBeTruthy();
    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    for (const viewport of VIEWPORTS) {
      await anonymousPage.setViewportSize(viewport);
      await anonymousPage.goto(`/users/@e2e_split_artist/pieces/${publicSlug}`);
      await expect(
        anonymousPage.getByRole('heading', { name: 'Local generated SVG' }),
      ).toBeVisible();
      await expect(
        anonymousPage.frameLocator('iframe[title="Art piece preview"]').locator('svg'),
      ).toBeVisible();
      await anonymousPage.screenshot({
        path: testInfo.outputPath(`public-svg-${viewport.width}.png`),
        fullPage: true,
      });
    }
    await anonymousContext.close();
  });

  test('shows an intake validation reason and leaves rejected local SVG data unchanged', async ({
    page,
  }, testInfo: TestInfo) => {
    await page.setViewportSize(VIEWPORTS[0]);
    await loginViaUI(page, fixtures.split.email, fixtures.password);
    await page.goto('/create');
    await page.getByRole('button', { name: 'Create a local generated piece', exact: true }).click();
    await page.waitForURL(/\/local-generated\/[^/]+$/);
    const localId = new URL(page.url()).pathname.split('/').at(-1)!;
    const source =
      '<svg id="rejected-local-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="#00e5ff"/></svg>';
    await page.getByLabel('Generated source').fill(source);
    await page.getByRole('button', { name: 'Save local version' }).click();
    await expect(page.getByRole('status')).toContainText(/Saved locally/);
    const before = await localProjectDb<{
      scenes: Array<{ sceneJson: Record<string, unknown> }>;
      versions: Array<{ sequence: number; payload: Record<string, unknown> }>;
    }>(page, {
      kind: 'read-project-content',
      ownerId: fixtures.split.username,
      projectId: localId,
    });
    const capturedRequests: PackageManifest[] = [];
    await page.route('**/api/pieces/intake/', async (route) => {
      const body = route.request().postDataBuffer();
      const contentType = route.request().headers()['content-type'] ?? '';
      const boundary = /boundary=([^;]+)/i.exec(contentType)?.[1];
      if (!body || !boundary) throw new Error('The rejected intake had no multipart package.');
      const start = body.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
      const end = body.indexOf(Buffer.from(`\r\n--${boundary}`), start);
      const entries = unzipSync(new Uint8Array(body.subarray(start, end)));
      capturedRequests.push(JSON.parse(strFromU8(entries['manifest.json'])) as PackageManifest);
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Generated source does not match its declared engine.' }),
      });
    });
    const laterPublishRequests: string[] = [];
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith('/api/art-pieces/') && request.method() === 'PATCH') {
        laterPublishRequests.push(pathname);
      }
    });
    await page.getByRole('button', { name: 'Make public' }).click();
    const dialog = page.getByRole('alertdialog', { name: /Make .* public\?/ });
    await dialog.getByLabel('Description').fill('Rejected without losing the local version.');
    const intakeResponsePromise = page.waitForResponse((response) => {
      return transferRoute(new URL(response.url()).pathname);
    });
    await dialog.getByRole('button', { name: 'Publish' }).click();
    const intakeResponse = await intakeResponsePromise;
    const intakeBody = await intakeResponse.json();
    await expect(page.getByRole('alert')).toHaveText(
      'Could not publish: Generated source does not match its declared engine.',
    );
    expect(intakeResponse.status()).toBe(400);
    expect(capturedRequests[0]?.kind).toBe('generated');
    expect(intakeBody).toEqual({ detail: 'Generated source does not match its declared engine.' });
    expect(laterPublishRequests).toEqual([]);
    expect(page.getByRole('button', { name: 'Make public' })).toBeVisible();
    const after = await localProjectDb<{
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
    await testInfo.attach('local-svg-rejection-capture.json', {
      contentType: 'application/json',
      body: JSON.stringify(
        { intakeRequest: capturedRequests[0], intakeResponse: { status: 400, body: intakeBody } },
        null,
        2,
      ),
    });
  });
});
