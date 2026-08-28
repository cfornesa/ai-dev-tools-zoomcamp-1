/**
 * Issue #192: Node-side bundling helper for the real (non-seam) camera
 * inference benchmark (`cameraInference.bench.ts`) — the same
 * Vite-library-mode technique `bundleHarness.ts`/`../support/exportHarness.ts`
 * use, applied to `@mediapipe/tasks-vision` itself. Every other #192
 * closure measured only `mediapipeProvider.ts`'s scheduling/compositing
 * code, because the e2e camera seam (`installMediaPipeTestSeam`) replaces
 * `GestureRecognizer` with a stub whose `recognizeForVideo` returns
 * instantly (see the durable memory topic
 * `.agents/memory/camera-synthetic-verification-gap.md`). This harness
 * bundles the real, installed `@mediapipe/tasks-vision` package (no new
 * dependency — it's already a pinned `dependencies` entry) so the
 * benchmark can create a real `GestureRecognizer`, load the real pinned
 * Wasm runtime and model over the network from the same CDN URLs
 * `mediapipeProvider.ts` uses, and measure real per-frame inference cost
 * for the GPU and CPU delegates separately.
 */
import fs from 'node:fs';
import path from 'node:path';

const FRONTEND_ROOT = path.resolve(import.meta.dirname, '..', '..');

const BROWSER_ENTRY_SOURCE = `import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';
import {
  MEDIAPIPE_WASM_BASE_URL,
  GESTURE_RECOGNIZER_MODEL_URL,
} from '../../src/tracking/mediapipeProvider';
import { MAX_HANDS_PER_FRAME } from '../../src/tracking/types';

(window as unknown as { __cameraInferenceHarness: unknown }).__cameraInferenceHarness = {
  FilesetResolver,
  GestureRecognizer,
  MEDIAPIPE_WASM_BASE_URL,
  GESTURE_RECOGNIZER_MODEL_URL,
  MAX_HANDS_PER_FRAME,
};
`;

const BUNDLE_ENTRY_PATH = path.join(
  import.meta.dirname,
  '.generatedCameraInferenceHarnessEntry.ts',
);

let bundlePromise: Promise<string> | null = null;

/** Bundles the real `@mediapipe/tasks-vision` module plus the app's own
 * pinned URL/hand-count constants into a single IIFE script string via
 * Vite's library-mode `build()` API, memoized for the whole run. Returns
 * the bundle's JS source — the caller loads it into a page with
 * `page.addScriptTag({ content })`. No dev server, no Django, no camera. */
export async function bundleCameraInferenceHarnessForBrowser(): Promise<string> {
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
              name: 'CameraInferenceHarnessBundle',
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
          'Vite library build produced no output chunk for the camera inference harness bundle.',
        );
      } finally {
        fs.rmSync(BUNDLE_ENTRY_PATH, { force: true });
      }
    })();
  }
  return bundlePromise;
}
