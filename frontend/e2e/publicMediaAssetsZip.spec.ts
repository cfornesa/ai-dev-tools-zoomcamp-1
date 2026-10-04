import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { expect, test } from '@playwright/test';

import {
  cleanupPublicMediaFixture,
  createPublicMediaFixture,
  type PublicMediaFixture,
} from './support/publicMediaFixture.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

function serveDirectory(root: string): Promise<{ url: string; close: () => Promise<void> }> {
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
  };
  const server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent((request.url ?? '/').split('?')[0]);
    const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
    const filePath = path.join(root, relativePath);
    if (!filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(404).end();
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        'Content-Type': mimeTypes[path.extname(filePath)] ?? 'application/octet-stream',
      });
      response.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}/index.html`,
        close: () => new Promise((closeResolve) => server.close(() => closeResolve())),
      });
    });
  });
}

test.describe('real public media ZIP export (#975)', () => {
  requireE2EFixtures();
  let fixture: PublicMediaFixture;

  test.beforeAll(() => {
    fixture = createPublicMediaFixture();
    if (!fixture.available || !fixture.public_id || !fixture.asset_id) {
      throw new Error(`Public media fixture unavailable: ${fixture.reason ?? 'unknown reason'}`);
    }
  });

  test.afterAll(() => {
    cleanupPublicMediaFixture();
  });

  test('downloads a self-contained ZIP with the referenced image and serves it offline', async ({
    page,
    context,
  }, testInfo) => {
    const sourceRequests: string[] = [];
    page.on('request', (request) => sourceRequests.push(request.url()));

    await page.goto(`/p/${fixture.public_id}`);
    await expect(page.getByRole('heading', { name: 'Public media fixture' })).toBeVisible();
    await page.getByRole('button', { name: 'Open download menu' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Download Full ZIP' }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();

    const archive = await JSZip.loadAsync(fs.readFileSync(downloadPath!));
    expect(archive.file('index.html')).not.toBeNull();
    expect(archive.file(`assets/${fixture.asset_id}`)).not.toBeNull();
    const indexHtml = await archive.file('index.html')!.async('string');
    expect(indexHtml).toContain('id="media-assets"');
    expect(indexHtml).toContain(fixture.asset_id);

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'public-media-zip-e2e-'));
    try {
      for (const [name, entry] of Object.entries(archive.files)) {
        if (entry.dir) continue;
        const target = path.join(root, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, await entry.async('nodebuffer'));
      }

      await context.route('**/*', (route) => {
        if (route.request().url().startsWith('http://127.0.0.1:')) {
          void route.continue();
        } else {
          void route.abort();
        }
      });
      const server = await serveDirectory(root);
      try {
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize(viewport);
          await page.goto(server.url);
          await expect(page.locator('canvas')).toBeVisible();
          await expect
            .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
            .toBeLessThanOrEqual(viewport.width);
          await page.screenshot({
            path: testInfo.outputPath(`zip-${viewport.width}.png`),
            fullPage: true,
          });
        }
      } finally {
        await server.close();
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }

    expect(sourceRequests.some((url) => url.includes('/api/pieces/2d/'))).toBe(true);
    expect(
      sourceRequests.some((url) => url.includes('/api/pieces/2d/') && url.includes('/assets/')),
    ).toBe(true);
  });
});
