/**
 * Task 73 (issue #73): privacy audit acceptance criterion 2 -- "Server
 * responses, application logs, client bundles, source maps, scenes,
 * drafts, and exports contain no provider credentials."
 *
 * Every other AI-provider-key test in this repo
 * (`tests/test_ai_provider_key_and_logging_safety.py`) proves the key
 * never appears in a Django response/log by construction: no `ai_provider`
 * request/response type has a key-shaped field, and the key is read only
 * from `os.environ` inside `ai_provider/config.py`, never accepted as a
 * parameter. This test proves the complementary, frontend-side half of
 * the same guarantee with *positive* evidence rather than static review:
 * it runs the real production build (`vite build`, exactly what `npm run
 * build`/deployment run) with a distinctive, unmistakably key-shaped value
 * set as `MISTRAL_API_KEY` in the *process* environment (deliberately not
 * `VITE_MISTRAL_API_KEY` -- Vite only ever inlines `VITE_`-prefixed
 * variables into client code, per `frontend/.env.example`'s own documented
 * convention and `AGENTS.md`), then scans every emitted file in `dist/`
 * for that exact value.
 *
 * If this test ever failed, it would mean either (a) some frontend source
 * file actually reads `import.meta.env.MISTRAL_API_KEY` or
 * `process.env.MISTRAL_API_KEY` and Vite's static-replace inlined it
 * (impossible today -- `frontend/src` has no such reference, confirmed by
 * this task's own audit, and this test is what keeps that true), or (b) a
 * future dependency/plugin leaks raw process env into build output some
 * other way. Either is exactly the kind of regression a grep-based static
 * review can miss but a real build-and-scan catches.
 *
 * No browser page is needed for this test -- it drives Node's `child_process`
 * directly (the exact same way `npm run build` would be invoked in CI),
 * so it needs no `browser`/`page` fixture and self-contained-runs the same
 * way `exportArtifacts.spec.ts`'s Tier 1 tests do (no Django, no
 * PostgreSQL, no Vite dev server, no `globalSetup` reachability gate).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const FRONTEND_ROOT = path.resolve(import.meta.dirname, '..');
const DIST_DIR = path.join(FRONTEND_ROOT, 'dist');

const DISTINCTIVE_KEY_MARKER = 'sk-E2E-BUILD-SCAN-MISTRAL-SECRET-4b7f1a9c3e';

function listFilesRecursive(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFilesRecursive(full) : [full];
  });
}

test.describe('Production build output never embeds a provider credential', () => {
  test('a distinctive MISTRAL_API_KEY value set in the build process env never appears anywhere in dist/, and no source map is emitted', async () => {
    // Real production build, exactly `npm run build`'s own script
    // (`tsc -b && vite build`) -- not a mocked/library-mode bundle, so
    // this exercises the literal artifact a deployment would ship.
    execFileSync('npm', ['run', 'build'], {
      cwd: FRONTEND_ROOT,
      env: { ...process.env, MISTRAL_API_KEY: DISTINCTIVE_KEY_MARKER },
      stdio: 'pipe',
    });

    expect(fs.existsSync(DIST_DIR)).toBe(true);
    const files = listFilesRecursive(DIST_DIR);
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    const sourceMaps: string[] = [];
    for (const file of files) {
      if (file.endsWith('.map')) {
        sourceMaps.push(file);
        continue;
      }
      const contents = fs.readFileSync(file, 'utf-8');
      if (contents.includes(DISTINCTIVE_KEY_MARKER)) {
        offenders.push(file);
      }
    }

    expect(offenders, `credential marker found in: ${offenders.join(', ')}`).toEqual([]);
    // Vite's default `build.sourcemap` is `false` and this repo's
    // `vite.config.ts` never overrides it -- asserted directly here so a
    // future config change that turns sourcemaps on gets caught by this
    // same test (a source map would re-expose original source text,
    // including anything this scan already checked for).
    expect(sourceMaps, `unexpected source maps: ${sourceMaps.join(', ')}`).toEqual([]);
  });
});
