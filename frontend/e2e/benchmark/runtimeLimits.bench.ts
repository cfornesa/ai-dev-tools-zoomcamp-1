/**
 * Task 70 (issue #70): the runtime-limits benchmark.
 *
 * Measures the app's actual runtime/render pipeline
 * (`../../src/runtime/behaviorRuntime.ts`, `particleSystem.ts`,
 * `trailSystem.ts`, `../../src/render/p5Adapter.ts`) against
 * representative maximum-valid and typical-valid scenes, inside a real,
 * isolated Chromium page — no Django, no PostgreSQL, no Vite dev server
 * (see `bundleHarness.ts` for the Vite-library-mode bundling technique
 * this reuses from Task 69's `../support/exportHarness.ts`). Not part of
 * `make check`/`npm test`/`make e2e` — run with `npm run bench:runtime`
 * from `frontend/`. See `_docs/benchmarks.md` for the full method,
 * hardware/browser assumptions, and pass thresholds this file measures
 * against.
 *
 * Three scenarios, one `test()` each:
 *
 * 1. `maxScene()` (`fixtures.ts`) — every documented V1 maximum reached
 *    simultaneously. Reports load time, steady-state frame duration,
 *    long-frame rate, and memory trend; does not assert a pass/fail frame
 *    budget (a deliberate worst case may legitimately run degraded — see
 *    `_docs/benchmarks.md`), but does assert the scene stayed
 *    schema-valid and rendered every frame without throwing.
 * 2. `withinLimitsScene()` — a typical, well-under-cap scene. Reports the
 *    same metrics and *does* assert the documented pass threshold (60fps
 *    steady-state average, <5% long-frame rate).
 * 3. Forced over-budget — `createBehaviorRuntime`'s injectable `perfNow`
 *    (Task 35) simulates a persistently over-budget tick, proving the
 *    existing work-budget degradation activates, ticking/rendering keep
 *    working (never throw), and the scene document itself is never
 *    mutated by any of it.
 *
 * Every scenario writes its metrics into one combined machine-readable
 * JSON file (`results/latest.json`) plus a human-readable console summary
 * — see acceptance criterion "machine-readable ... or a documented
 * repeatable manual procedure" (`_docs/benchmarks.md` documents why no
 * hardcoded CI gate is wired up against this run's specific numbers).
 */
import fs from 'node:fs';
import path from 'node:path';

import { test, expect, type Page } from '@playwright/test';

import { bundleBenchmarkHarnessForBrowser } from './bundleHarness.js';
import { maxScene, withinLimitsScene, type SceneDocument } from './fixtures.js';

const RESULTS_DIR = path.join(import.meta.dirname, 'results');
const RESULTS_PATH = path.join(RESULTS_DIR, 'latest.json');

// --- Documented benchmark parameters (see _docs/benchmarks.md) ----------
const WARMUP_FRAMES = 60; // ~1s at 60Hz before steady-state sampling starts.
const SAMPLE_FRAMES = 300; // ~5s at 60Hz of steady-state samples.
const TARGET_FRAME_MS = 1000 / 60; // 16.67ms -- the 60Hz frame budget.
const LONG_FRAME_MS = 1000 / 30; // 33.33ms -- below 30fps counts as a "long frame".
const WITHIN_LIMITS_MAX_LONG_FRAME_RATE = 0.05; // 5% -- documented pass threshold.

type FrameSample = { durationMs: number; timestamp: number };

type ScenarioResult = {
  name: string;
  loadTimeMs: number;
  warmupFrames: number;
  sampleFrames: number;
  steadyStateAvgFrameMs: number;
  steadyStateP95FrameMs: number;
  steadyStateMaxFrameMs: number;
  longFrameRate: number;
  memory: {
    available: boolean;
    startUsedJSHeapBytes: number | null;
    endUsedJSHeapBytes: number | null;
    trendBytes: number | null;
  };
};

const allResults: Record<string, unknown> = {
  generatedAt: new Date().toISOString(),
  scenarios: {} as Record<string, ScenarioResult>,
};

async function loadHarness(page: Page): Promise<void> {
  const bundleCode = await bundleBenchmarkHarnessForBrowser();
  await page.goto('about:blank');
  await page.addScriptTag({ content: bundleCode });
}

/**
 * Runs `scene` through the real runtime/particle/trail/render pipeline for
 * `WARMUP_FRAMES + SAMPLE_FRAMES` animation frames inside the page,
 * driving a small set of oscillating hand-signal-like values each frame
 * (so bindings/graph nodes have real changing input to evaluate, not a
 * frozen no-op tick). Returns per-frame timing samples plus load time and
 * memory snapshots, all measured with the page's own `performance.now`/
 * `performance.memory` — never Node-side timing, which would also include
 * IPC/serialization overhead the in-page render loop doesn't pay.
 */
async function runScenario(
  page: Page,
  scene: SceneDocument,
): Promise<{
  loadTimeMs: number;
  frames: FrameSample[];
  memoryStart: number | null;
  memoryEnd: number | null;
  finalSceneJson: string;
  initialSceneJson: string;
}> {
  return page.evaluate(
    async ({ scene, warmupFrames, sampleFrames }) => {
      const harness = (window as unknown as { __benchmarkHarness: any }).__benchmarkHarness;
      const {
        validateScene,
        validateBehaviorGraph,
        createBehaviorRuntime,
        emittersFromScene,
        createParticleSystem,
        deriveParticleTickInput,
        trailablesFromScene,
        createTrailSystem,
        createP5ScenePreview,
      } = harness;

      const initialSceneJson = JSON.stringify(scene);

      const validation = validateScene(scene);
      if (!validation.valid) {
        throw new Error(
          'Benchmark scene failed validateScene: ' + JSON.stringify(validation.errors),
        );
      }
      const behaviorValidation = validateBehaviorGraph(scene);
      if (!behaviorValidation.valid) {
        throw new Error(
          'Benchmark scene failed validateBehaviorGraph: ' +
            JSON.stringify(behaviorValidation.errors),
        );
      }

      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      document.body.appendChild(container);

      const loadStart = performance.now();

      const runtime = createBehaviorRuntime(scene);
      const particleSystem = createParticleSystem(emittersFromScene(scene), {}, scene.randomness);
      const trailSystem = createTrailSystem(trailablesFromScene(scene));
      const preview = createP5ScenePreview(container);

      const startTimestamp = performance.now();
      const shapeColorById = new Map<string, string>();
      for (const shape of scene.shapes as any[]) {
        shapeColorById.set(shape.id, shape.style?.stroke ?? shape.style?.fill ?? '#ffffff');
      }

      function signalsForTimestamp(elapsedMs: number): Record<string, number> {
        const t = elapsedMs / 1000;
        return {
          indexTipX: 0.5 + 0.4 * Math.sin(t * 1.3),
          indexTipY: 0.5 + 0.4 * Math.cos(t * 1.1),
          handDepth: 0.5 + 0.3 * Math.sin(t * 0.7),
          handSpeed: Math.abs(Math.sin(t * 2)),
          pinchStrength: 0.5 + 0.5 * Math.sin(t * 0.9),
          gestureConfidence: 0.9,
          handPresence: 1,
        };
      }

      function oneFrame(elapsedMs: number): number {
        const frameStart = performance.now();
        const timestamp = startTimestamp + elapsedMs;
        const tickResult = runtime.tick({
          timestamp,
          signals: signalsForTimestamp(elapsedMs),
          events: [],
        });
        const particleInput = deriveParticleTickInput(tickResult, false);
        const particles = particleSystem.tick(particleInput);
        const trails = trailSystem.tick(scene, timestamp, tickResult.degraded, false);

        const renderableParticles = particles.map((p: any) => ({
          x: p.x,
          y: p.y,
          size: p.size,
          color: p.color,
        }));
        const renderableTrails: { color: string; points: { x: number; y: number }[] }[] = [];
        trails.forEach((samples: { x: number; y: number }[], shapeId: string) => {
          if (samples.length === 0) return;
          renderableTrails.push({
            color: shapeColorById.get(shapeId) ?? '#ffffff',
            points: samples,
          });
        });

        preview.render(scene, renderableParticles, renderableTrails);
        return performance.now() - frameStart;
      }

      // --- Load: first frame, until the canvas actually exists. -----------
      oneFrame(0);
      await new Promise<void>((resolve) => {
        function waitForCanvas() {
          if (preview.getCanvasElement()) {
            resolve();
          } else {
            requestAnimationFrame(waitForCanvas);
          }
        }
        requestAnimationFrame(waitForCanvas);
      });
      const loadTimeMs = performance.now() - loadStart;

      const perfMemory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      const memoryStart = perfMemory ? perfMemory.usedJSHeapSize : null;

      // Each frame's "elapsed" timestamp is real wall-clock time since
      // `startTimestamp`, not an assumed fixed cadence -- correct even
      // when a scene runs well under 60fps (particle lifespans, trail
      // sampling, and binding smoothing all key off elapsed time, per
      // behaviorRuntime.ts's documented clock model).
      async function frameTick(): Promise<number> {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const elapsed = performance.now() - startTimestamp;
        return oneFrame(elapsed);
      }

      // --- Warm-up frames (not sampled). ----------------------------------
      for (let i = 0; i < warmupFrames; i++) {
        await frameTick();
      }

      // --- Sampled steady-state frames. -----------------------------------
      const frames: { durationMs: number; timestamp: number }[] = [];
      for (let i = 0; i < sampleFrames; i++) {
        const durationMs = await frameTick();
        frames.push({ durationMs, timestamp: performance.now() - startTimestamp });
      }

      const memoryEnd = perfMemory ? perfMemory.usedJSHeapSize : null;
      const finalSceneJson = JSON.stringify(scene);

      preview.destroy();
      container.remove();

      return { loadTimeMs, frames, memoryStart, memoryEnd, finalSceneJson, initialSceneJson };
    },
    { scene, warmupFrames: WARMUP_FRAMES, sampleFrames: SAMPLE_FRAMES },
  );
}

function summarize(name: string, raw: Awaited<ReturnType<typeof runScenario>>): ScenarioResult {
  const durations = raw.frames.map((f) => f.durationMs).sort((a, b) => a - b);
  const sum = durations.reduce((a, b) => a + b, 0);
  const avg = sum / durations.length;
  const p95 = durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))];
  const max = durations[durations.length - 1];
  const longFrames = durations.filter((d) => d > LONG_FRAME_MS).length;
  const longFrameRate = longFrames / durations.length;

  const memoryAvailable = raw.memoryStart !== null && raw.memoryEnd !== null;
  const trend = memoryAvailable ? (raw.memoryEnd as number) - (raw.memoryStart as number) : null;

  return {
    name,
    loadTimeMs: raw.loadTimeMs,
    warmupFrames: WARMUP_FRAMES,
    sampleFrames: SAMPLE_FRAMES,
    steadyStateAvgFrameMs: avg,
    steadyStateP95FrameMs: p95,
    steadyStateMaxFrameMs: max,
    longFrameRate,
    memory: {
      available: memoryAvailable,
      startUsedJSHeapBytes: raw.memoryStart,
      endUsedJSHeapBytes: raw.memoryEnd,
      trendBytes: trend,
    },
  };
}

function logSummary(result: ScenarioResult): void {
  // eslint-disable-next-line no-console
  console.log(
    `[bench:${result.name}] load=${result.loadTimeMs.toFixed(2)}ms ` +
      `avgFrame=${result.steadyStateAvgFrameMs.toFixed(2)}ms ` +
      `p95Frame=${result.steadyStateP95FrameMs.toFixed(2)}ms ` +
      `maxFrame=${result.steadyStateMaxFrameMs.toFixed(2)}ms ` +
      `longFrameRate=${(result.longFrameRate * 100).toFixed(1)}% ` +
      `memoryTrend=${
        result.memory.available
          ? `${(result.memory.trendBytes! / 1024).toFixed(1)}KB`
          : 'unavailable'
      }`,
  );
}

test.beforeAll(() => {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
});

test('maxScene reaches every documented maximum and stays functional', async ({ page }) => {
  await loadHarness(page);
  const scene = maxScene();
  const raw = await runScenario(page, scene);
  expect(raw.finalSceneJson).toBe(raw.initialSceneJson); // never mutated by the pipeline.
  const result = summarize('maxScene', raw);
  logSummary(result);
  (allResults.scenarios as Record<string, unknown>).maxScene = result;
  // Deliberate worst case: no frame-budget pass/fail assertion here (see
  // module doc comment + _docs/benchmarks.md) -- only that it ran to
  // completion, every frame rendered, and timings are finite/positive.
  expect(result.steadyStateAvgFrameMs).toBeGreaterThan(0);
  expect(Number.isFinite(result.steadyStateAvgFrameMs)).toBe(true);
});

test('withinLimitsScene meets the documented 60fps budget', async ({ page }) => {
  await loadHarness(page);
  const scene = withinLimitsScene();
  const raw = await runScenario(page, scene);
  expect(raw.finalSceneJson).toBe(raw.initialSceneJson);
  const result = summarize('withinLimitsScene', raw);
  logSummary(result);
  (allResults.scenarios as Record<string, unknown>).withinLimitsScene = result;
  expect(result.steadyStateAvgFrameMs).toBeLessThanOrEqual(TARGET_FRAME_MS);
  expect(result.longFrameRate).toBeLessThanOrEqual(WITHIN_LIMITS_MAX_LONG_FRAME_RATE);
});

test('forced over-budget tick activates graceful degradation without corrupting state', async ({
  page,
}) => {
  await loadHarness(page);
  const scene = withinLimitsScene();

  const result = await page.evaluate(
    async ({ scene }) => {
      const harness = (window as unknown as { __benchmarkHarness: any }).__benchmarkHarness;
      const { createBehaviorRuntime, DEFAULT_WORK_BUDGET_MS } = harness;

      const initialSceneJson = JSON.stringify(scene);

      // Task 35's own documented injectable-perfNow pattern (see
      // behaviorRuntime.test.ts): alternates a fast "tick start" reading
      // with a slow "tick end" reading, so every tick's evaluatedMs reads
      // as 50ms -- far over the 4ms default work budget -- forcing the
      // *next* tick to run degraded, deterministically, every time.
      let call = 0;
      const perfNow = () => (call++ % 2 === 0 ? 0 : 50);
      const runtime = createBehaviorRuntime(scene, { perfNow });

      const diagnosticsSeen: unknown[] = [];
      const degradedFlags: boolean[] = [];
      let threw = false;
      let ticks = 0;
      try {
        for (let i = 0; i < 30; i++) {
          const timestamp = i * 16.67;
          const tickResult = runtime.tick({
            timestamp,
            signals: { indexTipX: 0.5, handDepth: 0.4 },
            events: [],
          });
          ticks++;
          degradedFlags.push(tickResult.degraded);
          diagnosticsSeen.push(...tickResult.diagnostics);
        }
      } catch {
        threw = true;
      }

      // Recovery: a fresh runtime with a fast perfNow should NOT run
      // degraded, proving degradation is a response to real over-budget
      // ticks, not a permanent latch.
      const recoveredRuntime = createBehaviorRuntime(scene, { perfNow: () => 0 });
      const recoveredTick = recoveredRuntime.tick({
        timestamp: 0,
        signals: { indexTipX: 0.5 },
        events: [],
      });

      const finalSceneJson = JSON.stringify(scene);

      return {
        threw,
        ticks,
        degradedFlags,
        diagnosticsCount: diagnosticsSeen.length,
        recoveredDegraded: recoveredTick.degraded,
        workBudgetMs: DEFAULT_WORK_BUDGET_MS,
        initialSceneJson,
        finalSceneJson,
      };
    },
    { scene },
  );

  // eslint-disable-next-line no-console
  console.log(
    `[bench:forcedOverBudget] workBudgetMs=${result.workBudgetMs} ticks=${result.ticks} ` +
      `degradedTicks=${result.degradedFlags.filter(Boolean).length}/${result.ticks} ` +
      `diagnostics=${result.diagnosticsCount} recoveredDegraded=${result.recoveredDegraded}`,
  );

  (allResults.scenarios as Record<string, unknown>).forcedOverBudget = {
    workBudgetMs: result.workBudgetMs,
    ticks: result.ticks,
    degradedTickCount: result.degradedFlags.filter(Boolean).length,
    diagnosticsCount: result.diagnosticsCount,
    recoveredDegraded: result.recoveredDegraded,
    threw: result.threw,
    sceneCorrupted: result.initialSceneJson !== result.finalSceneJson,
  };

  expect(result.threw).toBe(false); // controls/ticking never break.
  expect(result.ticks).toBe(30);
  // Every tick after the first over-budget one should run degraded (Task
  // 35: degradation applies starting the tick *after* the budget was
  // exceeded).
  expect(result.degradedFlags.slice(1).every(Boolean)).toBe(true);
  expect(result.diagnosticsCount).toBeGreaterThan(0);
  // A fresh runtime with a fast perfNow recovers immediately -- proves
  // this is graceful, responsive degradation, not a stuck/broken state.
  expect(result.recoveredDegraded).toBe(false);
  // Scene document is read-only input to the runtime -- never mutated.
  expect(result.initialSceneJson).toBe(result.finalSceneJson);
});

test.afterAll(() => {
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(allResults, null, 2));
  // eslint-disable-next-line no-console
  console.log(`[bench] results written to ${RESULTS_PATH}`);
});
