/**
 * Issue #192: the real (non-seam) camera inference benchmark.
 *
 * Every prior #192 closure measured `mediapipeProvider.ts`'s scheduling
 * and compositing code around inference, never inference itself — the
 * e2e camera seam (`installMediaPipeTestSeam` in
 * `../publishingAndRemix.spec.ts`) replaces `GestureRecognizer` with a
 * stub whose `recognizeForVideo` returns instantly. This benchmark loads
 * the real, installed `@mediapipe/tasks-vision` package (no new
 * dependency), the real pinned Wasm runtime, and the real pinned
 * gesture-recognizer model over the network — same URLs
 * `mediapipeProvider.ts` uses in production — and runs real
 * `recognizeForVideo` calls against a real, decodable `MediaStreamTrack`
 * (a `<canvas>` animated in a loop and captured via
 * `HTMLCanvasElement.captureStream()`; unlike the e2e seam's fake
 * `MediaStream`, a real `<video>` element can actually decode this, so a
 * real recognizer can actually run inference against it). No physical
 * camera is used or required.
 *
 * Not part of `make check`/`npm test`/`make e2e` — like
 * `runtimeLimits.bench.ts`, this is a manual/on-demand benchmark, not a
 * pass/fail correctness suite: real GPU delegate performance is
 * fundamentally hardware/driver-dependent (see the module doc comment in
 * `../../src/tracking/mediapipeProvider.ts`'s "GPU delegate fallback"
 * section), so no hardcoded numeric budget is asserted here for either
 * delegate's inference latency — only that each delegate's outcome
 * (created + measured, or failed with a captured error) is reported.
 * Whether headless Chromium's own GPU delegate (typically software
 * rendering via ANGLE/SwiftShader in this environment, not a real GPU
 * driver) is representative of end-user hardware is exactly the
 * limitation this file's results must be read with — see
 * `_docs/tasks.md` task 161 and issue #192 for how this evidence is
 * used. Run with `npm run bench:camera-inference` from `frontend/`.
 */
import fs from 'node:fs';
import path from 'node:path';

import { test, type Page } from '@playwright/test';

import { bundleCameraInferenceHarnessForBrowser } from './cameraInferenceHarness.js';

const RESULTS_DIR = path.join(import.meta.dirname, 'results');
const RESULTS_PATH = path.join(RESULTS_DIR, 'camera-inference-latest.json');

const DELEGATES = ['GPU', 'CPU'] as const;
const MEASURE_DURATION_MS = 3000; // per delegate — enough calls for a stable p95 without a slow run.

type DelegateResult = {
  delegate: 'GPU' | 'CPU';
  created: boolean;
  createErrorMessage: string | null;
  createTimeMs: number | null;
  callCount: number;
  avgMs: number | null;
  p95Ms: number | null;
  maxMs: number | null;
};

async function loadHarness(page: Page): Promise<void> {
  const bundleCode = await bundleCameraInferenceHarnessForBrowser();
  await page.goto('about:blank');
  await page.addScriptTag({ content: bundleCode });
}

/**
 * Runs the real MediaPipe module/model against a real, canvas-captured
 * synthetic video track for each delegate in turn, measuring real
 * `recognizeForVideo` call latency. Everything happens inside the page —
 * `performance.now()` timings never cross the Node/browser boundary
 * mid-measurement.
 */
async function runBenchmark(page: Page): Promise<DelegateResult[]> {
  return page.evaluate(
    async ({ delegates, measureDurationMs }) => {
      const harness = (
        window as unknown as {
          __cameraInferenceHarness: {
            FilesetResolver: any;
            GestureRecognizer: any;
            MEDIAPIPE_WASM_BASE_URL: string;
            GESTURE_RECOGNIZER_MODEL_URL: string;
            MAX_HANDS_PER_FRAME: number;
          };
        }
      ).__cameraInferenceHarness;
      const {
        FilesetResolver,
        GestureRecognizer,
        MEDIAPIPE_WASM_BASE_URL,
        GESTURE_RECOGNIZER_MODEL_URL,
        MAX_HANDS_PER_FRAME,
      } = harness;

      // --- Build a real, decodable synthetic video track. No physical
      // camera: a <canvas> redrawn every frame, captured with the real
      // captureStream() API into a real MediaStreamTrack a <video>
      // element genuinely decodes -- unlike the e2e seam's fake
      // MediaStream, this is real video decode + real inference input.
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      let animationRunning = true;
      function drawFrame(): void {
        if (!animationRunning) return;
        const t = performance.now() / 1000;
        ctx.fillStyle = '#202020';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#e0a030';
        const x = 320 + 200 * Math.sin(t * 1.7);
        const y = 240 + 150 * Math.cos(t * 1.3);
        ctx.beginPath();
        ctx.arc(x, y, 60, 0, Math.PI * 2);
        ctx.fill();
        requestAnimationFrame(drawFrame);
      }
      drawFrame();

      const stream = (
        canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }
      ).captureStream(30);
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      document.body.appendChild(video);
      await video.play();
      await new Promise<void>((resolve) => {
        function check() {
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) resolve();
          else requestAnimationFrame(check);
        }
        check();
      });

      function nextVideoFrame(): Promise<void> {
        return new Promise((resolve) => {
          const anyVideo = video as HTMLVideoElement & {
            requestVideoFrameCallback?: (cb: () => void) => number;
          };
          if (anyVideo.requestVideoFrameCallback) {
            anyVideo.requestVideoFrameCallback(() => resolve());
          } else {
            requestAnimationFrame(() => resolve());
          }
        });
      }

      const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE_URL);

      const results: {
        delegate: 'GPU' | 'CPU';
        created: boolean;
        createErrorMessage: string | null;
        createTimeMs: number | null;
        callCount: number;
        avgMs: number | null;
        p95Ms: number | null;
        maxMs: number | null;
      }[] = [];

      for (const delegate of delegates as unknown as ('GPU' | 'CPU')[]) {
        const createStart = performance.now();
        let recognizer: any = null;
        let createErrorMessage: string | null = null;
        try {
          recognizer = await GestureRecognizer.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: GESTURE_RECOGNIZER_MODEL_URL, delegate },
            runningMode: 'VIDEO',
            numHands: MAX_HANDS_PER_FRAME,
          });
        } catch (cause) {
          createErrorMessage = cause instanceof Error ? cause.message : String(cause);
        }
        const createTimeMs = performance.now() - createStart;

        if (!recognizer) {
          results.push({
            delegate,
            created: false,
            createErrorMessage,
            createTimeMs,
            callCount: 0,
            avgMs: null,
            p95Ms: null,
            maxMs: null,
          });
          continue;
        }

        const latencies: number[] = [];
        let lastTimestamp = 0;
        const measureStart = performance.now();
        while (performance.now() - measureStart < measureDurationMs) {
          await nextVideoFrame();
          const nowMs = performance.now();
          const timestamp = Math.max(Math.round(nowMs), lastTimestamp + 1);
          lastTimestamp = timestamp;
          const callStart = performance.now();
          try {
            recognizer.recognizeForVideo(video, timestamp);
          } catch {
            // A single failed inference call shouldn't abort the whole
            // measurement window -- just isn't counted as a latency
            // sample.
            continue;
          }
          latencies.push(performance.now() - callStart);
        }

        try {
          recognizer.close();
        } catch {
          // Nothing left to report a close failure to.
        }

        const sorted = [...latencies].sort((a, b) => a - b);
        const avgMs = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null;
        const p95Ms = sorted.length
          ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
          : null;
        const maxMs = sorted.length ? sorted[sorted.length - 1] : null;

        results.push({
          delegate,
          created: true,
          createErrorMessage: null,
          createTimeMs,
          callCount: sorted.length,
          avgMs,
          p95Ms,
          maxMs,
        });
      }

      animationRunning = false;
      for (const track of stream.getTracks()) track.stop();
      video.remove();

      return results;
    },
    { delegates: DELEGATES, measureDurationMs: MEASURE_DURATION_MS },
  );
}

function logResult(result: DelegateResult): void {
  if (!result.created) {
    // eslint-disable-next-line no-console
    console.log(
      `[camera-inference-bench] delegate=${result.delegate} created=false ` +
        `createTimeMs=${result.createTimeMs?.toFixed(1)} error=${result.createErrorMessage}`,
    );
    return;
  }
  // eslint-disable-next-line no-console
  console.log(
    `[camera-inference-bench] delegate=${result.delegate} created=true ` +
      `createTimeMs=${result.createTimeMs?.toFixed(1)} calls=${result.callCount} ` +
      `avgMs=${result.avgMs?.toFixed(2)} p95Ms=${result.p95Ms?.toFixed(2)} maxMs=${result.maxMs?.toFixed(2)}`,
  );
}

test.beforeAll(() => {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
});

test('real GestureRecognizer inference cost, GPU vs CPU delegate, on a synthetic decodable video track', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await loadHarness(page);
  const results = await runBenchmark(page);
  for (const result of results) logResult(result);

  fs.writeFileSync(
    RESULTS_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
  );
  // eslint-disable-next-line no-console
  console.log(`[camera-inference-bench] results written to ${RESULTS_PATH}`);

  // No hardcoded numeric assertion (see module doc comment) -- but at
  // least one delegate must have produced real measurements, or this
  // benchmark caught nothing and should fail loudly rather than report
  // an empty/misleading result.
  const measured = results.filter((r) => r.created && r.callCount > 0);
  if (measured.length === 0) {
    throw new Error(
      'Neither GPU nor CPU delegate produced a real inference measurement: ' +
        JSON.stringify(results),
    );
  }
});
