// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { preview } from 'vite';
import type { PreviewServer } from 'vite';
import { previewCachePolicy, PROXIED_DJANGO_PREFIXES } from './vitePreviewCachePolicy';

const TEST_OUT_DIR = 'dist/.preview-cache-policy-test';

const IMMUTABLE = 'public, max-age=31536000, immutable';

describe('previewCachePolicy', () => {
  it('returns immutable for Vite content-hashed JS/CSS assets', () => {
    expect(previewCachePolicy('/assets/index-DpMxBVH8.js')).toBe(IMMUTABLE);
    expect(previewCachePolicy('/assets/index-B2maC0l4.css')).toBe(IMMUTABLE);
    expect(previewCachePolicy('/assets/GraphView-DLioOiRN.css')).toBe(IMMUTABLE);
    expect(previewCachePolicy('/assets/jszip.min-BXqW2-9v.js')).toBe(IMMUTABLE);
  });

  it('returns immutable for hashed fonts and media assets', () => {
    expect(previewCachePolicy('/assets/icons-AbCdEfGh.woff2')).toBe(IMMUTABLE);
    expect(previewCachePolicy('/assets/demo-12345678.mp4')).toBe(IMMUTABLE);
    expect(previewCachePolicy('/assets/sprite-x1y2z3a4.webm')).toBe(IMMUTABLE);
  });

  it('returns no-cache for non-hashed assets under /assets/', () => {
    expect(previewCachePolicy('/assets/logo.png')).toBe('no-cache');
    expect(previewCachePolicy('/assets/legacy.js')).toBe('no-cache');
    expect(previewCachePolicy('/assets/unversioned.css')).toBe('no-cache');
  });

  it('returns no-cache for the shell and client-route fallbacks', () => {
    expect(previewCachePolicy('/')).toBe('no-cache');
    expect(previewCachePolicy('/gallery')).toBe('no-cache');
    expect(previewCachePolicy('/definitely-not-a-real-route')).toBe('no-cache');
  });

  it('returns null for proxied Django paths (criterion 5)', () => {
    for (const prefix of PROXIED_DJANGO_PREFIXES) {
      expect(previewCachePolicy(prefix)).toBeNull();
      expect(previewCachePolicy(`${prefix}/`)).toBeNull();
      expect(previewCachePolicy(`${prefix}/some/resource/`)).toBeNull();
    }

    // Representative real paths from the contract.
    expect(previewCachePolicy('/api/projects/')).toBeNull();
    expect(previewCachePolicy('/accounts/login/')).toBeNull();
    expect(previewCachePolicy('/health/')).toBeNull();
  });
});

describe('vite preview server cache headers', () => {
  let server: PreviewServer;
  let baseUrl: string;

  beforeAll(async () => {
    const assetsDir = resolve(TEST_OUT_DIR, 'assets');
    await rm(TEST_OUT_DIR, { recursive: true, force: true });
    await mkdir(assetsDir, { recursive: true });

    await writeFile(
      resolve(TEST_OUT_DIR, 'index.html'),
      '<!doctype html>' +
        '<html>' +
        '<head>' +
        '<link rel="icon" href="/favicon.ico" />' +
        '<link rel="stylesheet" crossorigin href="/assets/index-B2maC0l4.css" />' +
        '</head>' +
        '<body>' +
        '<script type="module" src="/assets/index-DpMxBVH8.js"></script>' +
        '</body>' +
        '</html>',
    );

    await writeFile(resolve(assetsDir, 'index-DpMxBVH8.js'), '');
    await writeFile(resolve(assetsDir, 'index-B2maC0l4.css'), '');
    await writeFile(resolve(TEST_OUT_DIR, 'favicon.ico'), '');

    server = await preview({
      logLevel: 'error',
      build: { outDir: TEST_OUT_DIR },
      preview: { port: 0, strictPort: false },
    });

    const firstUrl = server.resolvedUrls?.local[0] ?? server.resolvedUrls?.network[0];
    if (!firstUrl) {
      throw new Error('Preview server did not expose resolved URLs');
    }
    baseUrl = firstUrl.replace(/\/$/, '');
  });

  afterAll(async () => {
    await server.close();
    await rm(TEST_OUT_DIR, { recursive: true, force: true });
  });

  it('serves the shell with no-cache', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  it('serves client-route fallbacks with no-cache', async () => {
    const res = await fetch(`${baseUrl}/definitely-not-a-real-route`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  it('serves non-hashed assets with the documented no-cache policy', async () => {
    const res = await fetch(`${baseUrl}/favicon.ico`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  it('parses HTML asset references and asserts hashed-asset policy separately', async () => {
    const shell = await fetch(`${baseUrl}/`);
    const html = await shell.text();
    const refs = [...html.matchAll(/\/assets\/[^"'\s>]+\.(?:js|css)/g)].map((match) => match[0]);

    expect(refs.length).toBeGreaterThan(0);

    const seen = new Set<string>();
    for (const ref of refs) {
      if (seen.has(ref)) continue;
      seen.add(ref);

      const res = await fetch(`${baseUrl}${ref}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe(IMMUTABLE);
    }
  });

  it('does not mark proxied /health/ responses as immutable (criterion 5)', async () => {
    const res = await fetch(`${baseUrl}/health/`);
    const cacheControl = res.headers.get('cache-control') ?? '';
    expect(cacheControl).not.toContain('immutable');
  });
});
