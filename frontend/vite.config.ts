import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5000,
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
      '/api': 'http://localhost:8000',
      '/accounts': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
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
