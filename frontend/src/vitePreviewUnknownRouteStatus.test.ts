// @vitest-environment node

import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { preview, type PreviewServer } from 'vite';

describe('vite preview unknown-route status (production run path)', () => {
  let backend: Server;
  let web: PreviewServer;
  let directory: string;
  let baseUrl: string;
  let backendPort: number;
  const savedEnvironment = { ...process.env };

  beforeAll(async () => {
    backend = createServer((request, response) => {
      if (request.url === '/health/') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end('{"status":"ok"}');
        return;
      }
      response.writeHead(401, { 'Content-Type': 'application/json' });
      response.end('{"detail":"authentication required"}');
    });
    await new Promise<void>((done) => backend.listen(0, '127.0.0.1', done));
    backendPort = (backend.address() as AddressInfo).port;
    process.env.FRONTEND_SERVE_MODE = 'dev';
    process.env.BROWSER_QA_BACKEND_URL = `http://127.0.0.1:${backendPort}`;

    directory = await mkdtemp(join(tmpdir(), 'preview-route-status-'));
    const assets = join(directory, 'assets');
    await mkdir(assets, { recursive: true });
    await writeFile(
      join(directory, 'index.html'),
      '<!doctype html><html><head><title>route shell</title></head><body><div id="root"></div></body></html>',
    );
    await writeFile(join(assets, 'app-12345678.js'), 'window.appLoaded = true;');
    web = await preview({
      configFile: resolve('vite.config.ts'),
      build: { outDir: directory },
      preview: { host: '127.0.0.1', port: 0, strictPort: false },
    });
    const address = web.httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await web?.close();
    await new Promise<void>((done) => backend?.close(() => done()));
    await rm(directory, { recursive: true, force: true });
    process.env = savedEnvironment;
  });

  it('serves a known App.tsx route as the shell with 200', async () => {
    const response = await fetch(`${baseUrl}/gallery`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<div id="root"></div>');
  });

  it('serves the same shell with 404 for an unknown client route', async () => {
    const response = await fetch(`${baseUrl}/definitely-not-a-route`);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('<div id="root"></div>');
  });

  it('leaves static asset delivery unchanged', async () => {
    const response = await fetch(`${baseUrl}/assets/app-12345678.js`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('window.appLoaded = true;');
  });

  it('leaves API and health responses proxied to Django', async () => {
    const api = await fetch(`${baseUrl}/api/whoami/`);
    const accounts = await fetch(`${baseUrl}/accounts/login/`);
    const health = await fetch(`${baseUrl}/health/`);
    expect(api.status).toBe(401);
    expect(api.headers.get('content-type')).toContain('application/json');
    expect(accounts.status).toBe(401);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });
  });
});
