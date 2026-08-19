/**
 * Task 70 (issue #70): Node-side bundling helper for the runtime-limits
 * benchmark (`runtimeLimits.bench.ts`) — the exact Vite-library-mode
 * technique `../support/exportHarness.ts`'s `bundleExportModuleForBrowser`
 * introduced for Task 69, reused verbatim rather than reimplemented: the
 * runtime modules under benchmark
 * (`../../src/runtime/behaviorRuntime.ts`/`particleSystem.ts`/
 * `trailSystem.ts`, `../../src/render/p5Adapter.ts`,
 * `../../src/validation/scene.ts`) share the same transitive `ajv`
 * subpath-import problem Task 69's own doc comment documents (Playwright's
 * plain Node ESM loader rejects `ajv/dist/2020`; Vite's resolver accepts
 * it), so they need the same real-browser-via-Vite-library-build treatment
 * to run and be measured inside an actual Chromium page rather than a
 * mocked/Node-side stand-in — see that file's module doc comment for the
 * full rationale, which applies here unchanged.
 *
 * This is a from-scratch entry (not a call into `exportHarness.ts`
 * itself) because the benchmark needs a different export surface: the
 * live runtime/particle/trail/render constructors themselves, not the
 * export-generation functions.
 */
import fs from 'node:fs';
import path from 'node:path';

const FRONTEND_ROOT = path.resolve(import.meta.dirname, '..', '..');

const BROWSER_ENTRY_SOURCE = `import { validateScene } from '../../src/validation/scene';
import {
  createBehaviorRuntime,
  validateBehaviorGraph,
  DEFAULT_WORK_BUDGET_MS,
} from '../../src/runtime/behaviorRuntime';
import {
  emittersFromScene,
  createParticleSystem,
  deriveParticleTickInput,
  MAX_TOTAL_LIVE_PARTICLES,
} from '../../src/runtime/particleSystem';
import {
  trailablesFromScene,
  createTrailSystem,
  MAX_TRAIL_LENGTH_PER_SHAPE,
} from '../../src/runtime/trailSystem';
import { createP5ScenePreview } from '../../src/render/p5Adapter';

(window as unknown as { __benchmarkHarness: unknown }).__benchmarkHarness = {
  validateScene,
  validateBehaviorGraph,
  createBehaviorRuntime,
  DEFAULT_WORK_BUDGET_MS,
  emittersFromScene,
  createParticleSystem,
  deriveParticleTickInput,
  MAX_TOTAL_LIVE_PARTICLES,
  trailablesFromScene,
  createTrailSystem,
  MAX_TRAIL_LENGTH_PER_SHAPE,
  createP5ScenePreview,
};
`;

const BUNDLE_ENTRY_PATH = path.join(import.meta.dirname, '.generatedBenchmarkHarnessEntry.ts');

let bundlePromise: Promise<string> | null = null;

/** Bundles the runtime/render/validation modules under benchmark into a
 * single IIFE script string via Vite's library-mode `build()` API,
 * memoized for the whole run. Returns the bundle's JS source — the caller
 * loads it into a page with `page.addScriptTag({ content })`. No dev
 * server, no Django, no network request. */
export async function bundleBenchmarkHarnessForBrowser(): Promise<string> {
  if (!bundlePromise) {
    bundlePromise = (async () => {
      const { build } = await import('vite');
      fs.writeFileSync(BUNDLE_ENTRY_PATH, BROWSER_ENTRY_SOURCE);
      try {
        const output = await build({
          root: FRONTEND_ROOT,
          logLevel: 'warn',
          configFile: false,
          build: {
            write: false,
            minify: false,
            target: 'es2020',
            lib: {
              entry: BUNDLE_ENTRY_PATH,
              formats: ['iife'],
              name: 'BenchmarkHarnessBundle',
            },
          },
        });
        const results = Array.isArray(output) ? output : [output];
        for (const result of results) {
          if ('output' in result) {
            const chunk = result.output.find(
              (item): item is Extract<typeof item, { type: 'chunk' }> => item.type === 'chunk',
            );
            if (chunk) return chunk.code;
          }
        }
        throw new Error(
          'Vite library build produced no output chunk for the benchmark harness bundle.',
        );
      } finally {
        fs.rmSync(BUNDLE_ENTRY_PATH, { force: true });
      }
    })();
  }
  return bundlePromise;
}
