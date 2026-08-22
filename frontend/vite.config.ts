import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
      '/api': { target: 'http://localhost:8000', changeOrigin: false },
      '/accounts': { target: 'http://localhost:8000', changeOrigin: false },
      '/health': { target: 'http://localhost:8000', changeOrigin: false },
    },
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
  },
});
