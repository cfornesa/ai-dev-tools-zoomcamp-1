// @vitest-environment node
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { preview, type PreviewServer } from 'vite';
import { resolveBackendProxyTarget } from './viteBackendTarget.js';

describe('backend proxy target selection', () => {
  it('pins production preview to local HTTP even with an HTTPS browser-QA override', () => {
    expect(resolveBackendProxyTarget('preview', 'https://qa-backend.example.test')).toBe(
      'http://127.0.0.1:8000',
    );
  });

  it('keeps the browser-QA override available in development', () => {
    expect(resolveBackendProxyTarget('dev', 'http://127.0.0.1:8123')).toBe('http://127.0.0.1:8123');
  });
});

// Issue #700: the production run path (`vite preview`) must inject the
// server-rendered share metadata and feed-discovery links into the SPA shell.
describe('vite preview share metadata (production run path)', () => {
  let backend: Server;
  let web: PreviewServer;
  let dir: string;
  let baseUrl: string;
  let backendPort: number;
  const forwardedHosts = new Set<string>();
  const saved = { ...process.env };

  beforeAll(async () => {
    backend = createServer((request, response) => {
      const forwardedHost = request.headers['x-forwarded-host'];
      if (typeof forwardedHost === 'string') forwardedHosts.add(forwardedHost);
      if (request.headers['x-forwarded-proto'] !== 'https' || !forwardedHost) {
        response.writeHead(301, {
          Location: `https://127.0.0.1:${backendPort}${request.url}`,
        });
        response.end();
        return;
      }
      response.setHeader('Content-Type', 'application/json');
      if (request.url === '/health/') {
        response.statusCode = 200;
        response.end(JSON.stringify({ status: 'ok' }));
        return;
      }
      if (request.url?.startsWith('/api/public/share-meta/site/profile/')) {
        response.end(
          JSON.stringify({
            title: 'Artist <&> profile',
            description: 'Bio text',
            canonical_path: '/users/@artist',
            image_url: null,
          }),
        );
        return;
      }
      response.statusCode = 404;
      response.end('{}');
    });
    await new Promise<void>((done) => backend.listen(0, '127.0.0.1', done));
    backendPort = (backend.address() as AddressInfo).port;
    process.env.FRONTEND_SERVE_MODE = 'dev';
    process.env.BROWSER_QA_BACKEND_URL = `http://127.0.0.1:${backendPort}`;
    // Simulates a platform secret saved with whitespace and quotes.
    process.env.PUBLIC_SITE_ORIGIN = ' "https://example.test" ';

    dir = await mkdtemp(join(tmpdir(), 'share-meta-'));
    await writeFile(
      join(dir, 'index.html'),
      '<!doctype html><html><head><title>x</title></head><body></body></html>',
    );
    web = await preview({
      configFile: new URL('../vite.config.ts', import.meta.url).pathname,
      build: { outDir: dir },
      preview: { port: 0, host: '127.0.0.1', strictPort: false },
    });
    const address = web.httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await web?.close();
    await new Promise<void>((done) => backend?.close(() => done()));
    await rm(dir, { recursive: true, force: true });
    process.env = saved;
  });

  it('injects escaped Open Graph tags and feed alternates for a profile', async () => {
    const html = await (await fetch(`${baseUrl}/users/@artist`)).text();
    expect(forwardedHosts).toContain('example.test');
    expect(html).toContain('data-server-metadata="true"');
    expect(html).toContain('content="Artist &lt;&amp;&gt; profile"');
    expect(html).toContain('og:url" content="https://example.test/users/@artist"');
    expect(html).toContain(
      'type="application/atom+xml" href="https://example.test/users/@artist/feed.xml"',
    );
    expect(html).toContain('type="application/rss+xml"');
    expect(html).toContain('type="application/feed+json"');
  });

  it('still injects generic tags on the home route when the backend has no record', async () => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    expect(html).toContain('og:title');
    expect(html).toContain('https://example.test/');
  });

  it('accepts a bare host and removes a deployment-console path', async () => {
    process.env.PUBLIC_SITE_ORIGIN = 'bare.example.test/preview/';

    const html = await (await fetch(`${baseUrl}/`)).text();
    expect(html).toContain('https://bare.example.test/');
  });

  it('exposes a credential-free diagnostic and safely falls back for invalid origins', async () => {
    process.env.PUBLIC_SITE_ORIGIN = 'not a valid origin';
    process.env.DJANGO_ALLOWED_HOSTS = 'diagnostic.example.test';

    const response = await fetch(`${baseUrl}/__share-metadata-status`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({
      middleware_active: true,
      origin_valid: false,
      backend_reachable: true,
      last_error: null,
    });
    expect(forwardedHosts).toContain('diagnostic.example.test');
    const html = await (await fetch(`${baseUrl}/`)).text();
    expect(html).toContain('https://diagnostic.example.test/');
  });
});
