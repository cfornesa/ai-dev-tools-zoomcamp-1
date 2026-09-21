import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { previewCachePolicy } from './src/vitePreviewCachePolicy.js';

// Deliberately '127.0.0.1', not 'localhost': Django's runserver only ever
// binds IPv4 (127.0.0.1:8000). On a machine where 'localhost' resolves to
// '::1' (IPv6) first -- the default on macOS -- and something else (e.g. an
// unrelated project's Docker Desktop container port-forward, which listens
// on the IPv6 wildcard) is *also* using port 8000, 'localhost:8000' silently
// resolves to that other service instead of Django, and every proxied
// request (/api, /accounts, /health) gets a response from the wrong
// backend with no error at all -- see
// .agents/memory/local-port-8000-docker-conflict.md. Pinning to
// 127.0.0.1 makes this proxy target unambiguous regardless of what else is
// listening on ::1 on this machine.
const backendProxyTarget = process.env.BROWSER_QA_BACKEND_URL ?? 'http://127.0.0.1:8000';

const djangoProxy = {
  '/api': { target: backendProxyTarget, changeOrigin: false },
  '/accounts': { target: backendProxyTarget, changeOrigin: false },
  '/health': { target: backendProxyTarget, changeOrigin: false },
  '/llms.txt': { target: backendProxyTarget, changeOrigin: false },
  '/llms-full.txt': { target: backendProxyTarget, changeOrigin: false },
};

type ShareMetadata = {
  title: string;
  description: string;
  canonical_path: string;
  image_url: string | null;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

function publicOrigin(): string {
  const origin = process.env.PUBLIC_SITE_ORIGIN ?? 'http://localhost:5000';
  const parsed = new URL(origin);
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('PUBLIC_SITE_ORIGIN must be an origin such as https://augmentrart.com');
  }
  return parsed.origin;
}

function routeDescriptor(pathname: string): { kind: string; publicId: string } | null {
  const direct = pathname.match(/^\/(art-pieces\/p|p3d|p)\/([^/]+)\/?$/);
  if (direct) {
    const kind = direct[1] === 'p' ? '2d' : direct[1] === 'p3d' ? '3d' : 'generated';
    return { kind, publicId: direct[2] };
  }
  return null;
}

function siteMetadataDescriptor(pathname: string): string | null {
  if (pathname === '/' || pathname === '/home') return '/api/public/share-meta/site/home/';
  const profile = pathname.match(/^\/users\/@([^/]+)\/?$/);
  if (profile) {
    return `/api/public/share-meta/site/profile/${encodeURIComponent(profile[1])}/`;
  }
  const collection = pathname.match(/^\/users\/@([^/]+)\/collections\/([^/]+)\/?$/);
  if (collection) {
    return `/api/public/share-meta/site/collection/${encodeURIComponent(collection[1])}/${encodeURIComponent(collection[2])}/`;
  }
  return null;
}

async function fetchShareMetadata(pathname: string): Promise<ShareMetadata | null> {
  const sitePath = siteMetadataDescriptor(pathname);
  if (sitePath) {
    const response = await fetch(`${backendProxyTarget}${sitePath}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return (await response.json()) as ShareMetadata;
  }
  const direct = routeDescriptor(pathname);
  let kind: string;
  let publicId: string;
  if (direct) {
    ({ kind, publicId } = direct);
  } else {
    const canonical = pathname.match(/^\/users\/@([^/]+)\/pieces\/([^/]+)\/?$/);
    if (!canonical) return null;
    const response = await fetch(
      `${backendProxyTarget}/api/users/@${encodeURIComponent(canonical[1])}/pieces/${encodeURIComponent(canonical[2])}/`,
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      type?: string;
      piece?: { id?: string; public_id?: string };
    };
    kind = payload.type === 'generated' ? 'generated' : payload.type === '3d' ? '3d' : '2d';
    publicId = payload.piece?.id ?? payload.piece?.public_id ?? '';
    if (!publicId) return null;
  }
  const response = await fetch(
    `${backendProxyTarget}/api/public/share-meta/${kind}/${encodeURIComponent(publicId)}/`,
    { headers: { Accept: 'application/json' } },
  );
  if (!response.ok) return null;
  return (await response.json()) as ShareMetadata;
}

function metadataTags(metadata: ShareMetadata | null, requestPath: string): string {
  const origin = publicOrigin();
  const canonicalUrl = `${origin}${metadata?.canonical_path ?? requestPath}`;
  const title = metadata?.title ?? 'AugmentrART';
  const description = metadata?.description ?? 'Interactive artwork by AugmentrART.';
  const imageUrl = metadata?.image_url ? `${origin}${metadata.image_url}` : null;
  const tags = [
    `<meta property="og:title" content="${escapeHtml(title)}" data-server-metadata="true" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" data-server-metadata="true" />`,
    `<meta property="og:type" content="article" data-server-metadata="true" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" data-server-metadata="true" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" data-server-metadata="true" />`,
    '<meta name="twitter:card" content="summary_large_image" data-server-metadata="true" />',
  ];
  if (imageUrl) {
    tags.push(
      `<meta property="og:image" content="${escapeHtml(imageUrl)}" data-server-metadata="true" />`,
      '<meta property="og:image:width" content="1200" data-server-metadata="true" />',
      '<meta property="og:image:height" content="630" data-server-metadata="true" />',
      `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" data-server-metadata="true" />`,
    );
  }
  return tags.join('\n    ');
}

function shareMetadataPlugin(): Plugin {
  const install = (
    server: {
      middlewares: { use: (handler: (...args: any[]) => void) => void };
      config: { root: string; build: { outDir: string } };
    },
    preview: boolean,
  ) => {
    server.middlewares.use(async (request, response, next) => {
      if (request.method !== 'GET') return next();
      const requestPath = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (
        !routeDescriptor(requestPath) &&
        !/^\/users\/@[^/]+\/pieces\/[^/]+\/?$/.test(requestPath) &&
        !siteMetadataDescriptor(requestPath)
      ) {
        return next();
      }
      try {
        const metadata = await fetchShareMetadata(requestPath);
        const indexPath = preview
          ? resolve(server.config.root, server.config.build.outDir, 'index.html')
          : resolve(server.config.root, 'index.html');
        let html = await fs.readFile(indexPath, 'utf8');
        if (!preview && 'transformIndexHtml' in server) {
          html = await (
            server as typeof server & {
              transformIndexHtml: (url: string, html: string) => Promise<string>;
            }
          ).transformIndexHtml(requestPath, html);
        }
        html = html.replace('</head>', `    ${metadataTags(metadata, requestPath)}\n  </head>`);
        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(html);
      } catch {
        next();
      }
    });
  };
  return {
    name: 'creatrweb-server-share-metadata',
    configureServer(server) {
      install(server, false);
    },
    configurePreviewServer(server) {
      install(server, true);
    },
  };
}

/**
 * Vite preview-server plugin implementing the production cache policy for
 * issue #489.
 *
 * Production serves `frontend/dist/` via `vite preview` (see
 * `scripts/start-production.sh` → `scripts/start.sh`). This plugin's
 * `configurePreviewServer` hook runs before Vite's static (sirv) and HTML
 * fallback middleware, so it can set Cache-Control based on the request URL:
 *
 * - `/api/*`, `/accounts/*`, `/health/*` are left untouched; those requests
 *   are proxied to Django and Django owns the headers (criterion 5).
 * - `/assets/*` files whose names contain a Vite content hash are served with
 *   `public, max-age=31536000, immutable` (criterion 3).
 * - Everything else (`/`, client-route fallbacks, non-hashed assets) is
 *   `no-cache`, so a fresh deployment is always picked up (criteria 2 & 4).
 *
 * Vite's HTML fallback middleware will overwrite the header back to
 * `no-cache` for HTML responses, which is exactly what we want.
 *
 * This hook only runs for `vite preview`; `npm run dev` is unaffected.
 */
const previewCachePolicyPlugin = (): Plugin => ({
  name: 'creatrweb-preview-cache-policy',
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
      const policy = previewCachePolicy(pathname);
      if (policy !== null) {
        res.setHeader('Cache-Control', policy);
      }
      next();
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), previewCachePolicyPlugin(), shareMetadataPlugin()],
  server: {
    host: true,
    port: 5000,
    // Fail loudly if 5000 is already taken (e.g. macOS AirPlay Receiver)
    // instead of silently drifting to 5001/5002/etc. Google OAuth's
    // Authorized redirect URI is registered against port 5000 specifically
    // -- see AGENTS.md's "Environment setup" section for the full
    // port <-> CSRF_TRUSTED_ORIGINS <-> OAuth redirect URI relationship.
    strictPort: true,
    allowedHosts: true,
    fs: {
      // Allows importing the canonical scene schema/limits/fixtures from
      // ../schema (outside frontend/), the single source of truth shared
      // with the Django validator — see schema/README.md.
      allow: ['..'],
    },
    proxy: {
      // Proxies API/auth calls to the Django dev server so the browser sees
      // everything as same-origin — Django's session cookie (and CSRF) then
      // works with no CORS/SameSite configuration needed. api/client.ts
      // calls relative paths ('/api/...') for exactly this reason; only
      // override VITE_API_BASE_URL for a genuinely cross-origin deployment.
      //
      // changeOrigin: false preserves the browser's original Host header
      // (localhost:5000) instead of rewriting it to the proxy target
      // (localhost:8000). Without this, Django's allauth builds Google's
      // OAuth redirect_uri from the Host header it actually receives --
      // localhost:8000, which Google was never told about -- producing
      // redirect_uri_mismatch even though the browser is correctly on
      // port 5000 the whole time.
      ...djangoProxy,
    },
  },
  preview: {
    // `vite preview` does not inherit `server.proxy`; production therefore
    // needs the same Django routes explicitly or text resources fall through
    // to the SPA shell instead of reaching their existing Django views.
    proxy: djangoProxy,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: false,
    // Task 65 (issue #65): frontend/e2e/ holds the Playwright suite, which
    // vitest's default include pattern would otherwise also try to run as
    // unit tests (it imports '@playwright/test', not vitest, and needs a
    // real running server -- see playwright.config.ts). Exclude it here
    // the same way vitest's own default `exclude` already excludes
    // node_modules/dist/etc.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // Issue #302: repeated, non-deterministic ~5s-timeout failures on
    // whichever test file happened to draw a slow worker during a full
    // `make check`/`npm test` run (never a fixed file, and every affected
    // test passes instantly in isolation) -- consistent with Vitest's
    // *default* 5000ms `testTimeout` being too tight once ~180 test files'
    // worth of worker threads are genuinely contending for this machine's
    // CPU, not with any actual test being slow or broken. Tripling both
    // timeouts gives real async work (userEvent interactions, timers,
    // component mount/unmount) enough headroom under that contention
    // without masking a test that's actually hung (15s is still a hard
    // ceiling, not "wait forever").
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
