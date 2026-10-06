// @vitest-environment node
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isIP, type AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { preview, type PreviewServer } from 'vite';
import { resolveBackendProxyTarget } from './viteBackendTarget.js';

describe('backend proxy target selection', () => {
  it('uses the deployment backend override for production preview', () => {
    const previous = process.env.BACKEND_PROXY_TARGET;
    process.env.BACKEND_PROXY_TARGET = 'http://127.0.0.1:8001';
    expect(resolveBackendProxyTarget('preview', 'https://qa-backend.example.test')).toBe(
      'http://127.0.0.1:8001',
    );
    if (previous === undefined) delete process.env.BACKEND_PROXY_TARGET;
    else process.env.BACKEND_PROXY_TARGET = previous;
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
  const forwardedClientAddresses = new Set<string>();
  const forwardedOAuthRequests: Array<{ path: string; host: string; clientAddress: string }> = [];
  const saved = { ...process.env };

  beforeAll(async () => {
    backend = createServer((request, response) => {
      if (request.url?.startsWith('/.well-known/') || request.url?.startsWith('/oauth/')) {
        const forwardedAddress = request.headers['x-forwarded-for'];
        forwardedOAuthRequests.push({
          path: request.url,
          host: request.headers.host ?? '',
          clientAddress: Array.isArray(forwardedAddress)
            ? forwardedAddress.join(', ')
            : (forwardedAddress ?? ''),
        });
        response.setHeader('Content-Type', 'application/json');
        response.statusCode = 200;
        response.end(JSON.stringify({ source: 'django', path: request.url }));
        return;
      }
      const forwardedHost = request.headers['x-forwarded-host'];
      if (typeof forwardedHost === 'string') forwardedHosts.add(forwardedHost);
      if (request.url === '/mcp/' && request.method === 'POST') {
        const forwardedAddress = request.headers['x-forwarded-for'];
        if (typeof forwardedAddress === 'string') forwardedClientAddresses.add(forwardedAddress);
        response.setHeader('Content-Type', 'application/json');
        response.statusCode = 200;
        response.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: { tools: [{ name: 'health_check' }] },
          }),
        );
        return;
      }
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
      if (
        request.url === '/api/public/share-meta/site/home/' ||
        request.url === '/api/public/share-meta/site/gallery/' ||
        request.url === '/api/public/share-meta/site/collections/' ||
        request.url === '/api/public/share-meta/site/generated/'
      ) {
        const collection = request.url.endsWith('/collections/');
        const generated = request.url.endsWith('/generated/');
        response.end(
          JSON.stringify({
            title: 'AugmentrART',
            description: 'Public gallery',
            canonical_path: collection
              ? '/collections'
              : generated
                ? '/gallery?type=generated'
                : request.url.includes('/gallery/')
                  ? '/gallery'
                  : '/',
            image_url: '/favicon.svg',
            ...(collection ? { gallery_heading: 'Public collections' } : {}),
            ...(generated ? { gallery_heading: 'Generated art gallery' } : {}),
            gallery_items: [
              {
                title: collection
                  ? 'Spring collection'
                  : generated
                    ? 'Generated ocean'
                    : '<script>Gallery injection</script> & ocean',
                description: collection
                  ? 'Public collection description'
                  : generated
                    ? 'Generated piece description'
                    : '<img src=x onerror=alert(1)>',
                path: collection
                  ? '/users/@artist/collections/spring'
                  : generated
                    ? '/users/@artist/pieces/generated-ocean'
                    : '/users/@artist/pieces/ocean?view=public&sort=new',
              },
            ],
          }),
        );
        return;
      }
      if (request.url?.startsWith('/api/public/share-meta/site/profile/')) {
        response.end(
          JSON.stringify({
            title: 'Artist <&> profile',
            description: 'Bio text',
            author: 'By Artist (@artist)',
            canonical_path: '/users/@artist',
            image_url: null,
          }),
        );
        return;
      }
      if (request.url?.includes('/api/users/@artist/pieces/')) {
        response.end(JSON.stringify({ type: '3d', piece: { id: 'canonical-piece-id' } }));
        return;
      }
      if (request.url === '/api/public/share-meta/3d/canonical-piece-id/') {
        response.end(
          JSON.stringify({
            title: 'Canonical 3D piece',
            description: 'Canonical description',
            author: 'By Artist (@artist)',
            canonical_path: '/users/@artist/pieces/canonical-piece',
            image_url: '/api/public/share-image/3d/canonical-piece-id.png',
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
    expect(html).toContain('property="article:author" content="By Artist (@artist)"');
    expect(html).toContain('og:url" content="https://example.test/users/@artist"');
    expect(html).toContain(
      'type="application/atom+xml" href="https://example.test/users/@artist/feed.xml"',
    );
    expect(html).toContain('type="application/rss+xml"');
    expect(html).toContain('type="application/feed+json"');
  });

  it('proxies the MCP transport to Django on the production preview path', async () => {
    const response = await fetch(`${baseUrl}/mcp/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect([...forwardedClientAddresses].some((address) => isIP(address) > 0)).toBe(true);
    await expect(response.json()).resolves.toMatchObject({
      result: { tools: [{ name: 'health_check' }] },
    });
  });

  it('proxies OAuth discovery and authorization routes while preserving host and client address', async () => {
    const paths = [
      '/.well-known/oauth-authorization-server',
      '/.well-known/oauth-protected-resource/mcp/',
      '/oauth/authorize/',
      '/oauth/token/',
      '/oauth/revoke_token/',
    ];

    for (const path of paths) {
      const method = path.endsWith('/token/') || path.endsWith('/revoke_token/') ? 'POST' : 'GET';
      const response = await fetch(`${baseUrl}${path}`, { method });

      expect(response.status, path).toBe(200);
      expect(response.headers.get('content-type'), path).toContain('application/json');
      await expect(response.json()).resolves.toEqual({ source: 'django', path });
    }

    const previewHost = new URL(baseUrl).host;
    expect(forwardedOAuthRequests.map(({ path }) => path)).toEqual(paths);
    expect(forwardedOAuthRequests.every(({ host }) => host === previewHost)).toBe(true);
    expect(forwardedOAuthRequests.every(({ clientAddress }) => isIP(clientAddress) > 0)).toBe(true);
  });

  it('keeps unknown preview routes at the existing 404 response', async () => {
    const response = await fetch(`${baseUrl}/not-a-known-route-for-oauth-proxy`);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  it('still injects generic tags on the home route when the backend has no record', async () => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    expect(html).toContain('og:title');
    expect(html).toContain('https://example.test/');
    expect(html).toContain('<noscript><section aria-label="Public gallery">');
    expect(html).toContain(
      '<a href="/users/@artist/pieces/ocean?view=public&amp;sort=new">&lt;script&gt;Gallery injection&lt;/script&gt; &amp; ocean</a>',
    );
    expect(html).toContain('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script>Gallery injection</script>');
  });

  it('injects canonical link-bearing gallery content into a no-JavaScript shell', async () => {
    const html = await (await fetch(`${baseUrl}/gallery`)).text();
    expect(html).toContain('og:url" content="https://example.test/gallery"');
    expect(html).toContain('<noscript><section aria-label="Public gallery">');
    expect(html).toContain('href="/users/@artist/pieces/ocean?view=public&amp;sort=new"');
  });

  it('renders a crawlable collections index and a generated-art fallback', async () => {
    const collections = await (await fetch(`${baseUrl}/collections`)).text();
    expect(collections).toContain('og:url" content="https://example.test/collections"');
    expect(collections).toContain('<h1>Public collections</h1>');
    expect(collections).toContain('href="/users/@artist/collections/spring">Spring collection</a>');

    const generated = await (await fetch(`${baseUrl}/art-pieces/gallery`)).text();
    expect(generated).toContain('og:url" content="https://example.test/gallery?type=generated"');
    expect(generated).toContain('<h1>Generated art gallery</h1>');
    expect(generated).toContain('href="/users/@artist/pieces/generated-ocean">Generated ocean</a>');
  });

  it('injects metadata for canonical regular and immersive piece routes', async () => {
    for (const route of [
      '/users/@artist/pieces/canonical-piece',
      '/users/@artist/immersive/canonical-piece',
    ]) {
      const html = await (await fetch(`${baseUrl}${route}`)).text();
      expect(html).toContain('property="og:title" content="Canonical 3D piece"');
      expect(html).toContain(
        'property="og:url" content="https://example.test/users/@artist/pieces/canonical-piece"',
      );
      expect(html).toContain('property="og:image"');
    }
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
