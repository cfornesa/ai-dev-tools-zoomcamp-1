# Runtime-limits benchmark (Task 70, issue #70)

Reproducible benchmarks demonstrating that representative maximum-valid
scenes meet the editor's frame budget, or activate the runtime's existing
documented graceful degradation. Measures the app's actual runtime/render
pipeline — `frontend/src/runtime/behaviorRuntime.ts`, `particleSystem.ts`,
`trailSystem.ts`, and `frontend/src/render/p5Adapter.ts` — inside a real,
isolated Chromium page. See `AGENTS.md`'s "Layout" section for where these
modules sit; see `schema/limits.json` for the exact V1 complexity caps this
benchmark reaches.

## Why this is a genuine, executable benchmark, not a theoretical one

Every module under benchmark is pure client-side TypeScript. Task 69
(issue #69) established that these can be bundled with Vite's
library-mode `build()` API into a single IIFE and loaded into a real
Chromium page via `page.addScriptTag` — no Django, no PostgreSQL, no Vite
dev server, no mocked timing. This task's harness
(`frontend/e2e/benchmark/bundleHarness.ts`) reuses that exact technique
(`frontend/e2e/support/exportHarness.ts`'s
`bundleExportModuleForBrowser`), pointed at the runtime/render/validation
modules instead of the export-generation modules. All timing
(`performance.now`, `requestAnimationFrame`) and memory
(`performance.memory`) measurements happen inside the page, not in the
Node test process, so they include real browser paint/GC costs and never
IPC/serialization overhead.

Run it yourself:

```
cd frontend
npm run bench:runtime
```

This runs `frontend/e2e/benchmark/runtimeLimits.bench.ts` via its own
Playwright config (`frontend/playwright.bench.config.ts`) — deliberately
separate from `playwright.config.ts` (Task 65's project-lifecycle suite):
no server needs to be running, no fixture users are created, and no
`globalSetup`/`globalTeardown` runs. It writes machine-readable results to
`frontend/e2e/benchmark/results/latest.json` and prints a human-readable
one-line summary per scenario to the console.

**Not part of `make check`/`npm test`/`make e2e`.** Like the Task 65 E2E
suite, this is a manual/on-demand check, run before a release or after a
runtime/render change, not a per-commit correctness gate — see "Why no CI
gate is wired up" below for the specific reasoning for a _benchmark_
(distinct from Task 65's reasoning, which was about needing a real
Django/PostgreSQL server).

## Benchmark fixtures

`frontend/e2e/benchmark/fixtures.ts` builds two scene documents
programmatically (not hand-authored JSON), so the exact count against each
`schema/limits.json` cap is auditable in code, not asserted by eye:

### `maxScene()` — every documented V1 maximum, simultaneously

| Dimension                                         | Cap (`schema/limits.json` unless noted) | Reached                                                                                                                 |
| ------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Shapes                                            | `maxShapes` = 200                       | 200                                                                                                                     |
| Groups                                            | `maxGroups` = 50                        | 50                                                                                                                      |
| Group nesting depth                               | `maxGroupNestingDepth` = 6              | 6 (a real 6-deep chain with shape leaves, not just a validator count)                                                   |
| Group child ids (one group)                       | `maxGroupChildIds` = 100                | 100                                                                                                                     |
| Layers                                            | `maxLayers` = 20                        | 20                                                                                                                      |
| Path points (two shapes)                          | `maxPathPoints` = 500                   | 500 each                                                                                                                |
| Graph nodes                                       | `maxGraphNodes` = 100                   | 100                                                                                                                     |
| Graph connections                                 | `maxGraphConnections` = 150             | 150                                                                                                                     |
| Conditional (`ifElse`) nodes                      | `maxConditionalNodes` = 3               | 3                                                                                                                       |
| Bindings                                          | `maxBindings` = 100                     | 100 (96 shape-scope across 12 shapes × all 8 channels, 4 interaction-scope filling every interaction channel)           |
| Particle emitters                                 | `maxParticleEmitters` = 4               | 4                                                                                                                       |
| Particle emission rate (sum)                      | `maxTotalParticleRate` = 800            | 800 (200/emitter)                                                                                                       |
| Live particles (runtime cap, `particleSystem.ts`) | `MAX_TOTAL_LIVE_PARTICLES` = 800        | saturates to the cap in steady state (rate/lifespan chosen so each emitter's live count reaches its 200-particle share) |
| Trail length (60 of the 200 shapes)               | `$defs.trail.length` max = 100          | 100 samples each                                                                                                        |
| Physics force components (all 4 emitters)         | `physicsForce` min/max = ±10 (drag 0–1) | gravity/forceX/forceY = ±10, drag = 1                                                                                   |

The graph's 100-node/150-connection layout is a real (non-redundant)
wiring, not padding: 5 `handSignal` sources feed 55 `add` nodes (2 inputs
each) and 3 independent `ifElse` subgraphs (each with 1 input + 2 visual
sinks), and the `add` nodes fan out to 31 `shapeProperty` visual sinks —
see the exact accounting in `fixtures.ts`'s `maxScene()` doc comment.

A small vitest smoke check (run once during development, not kept as a
permanent suite member — see below) confirmed `validateScene` and
`validateBehaviorGraph` both accept `maxScene()` with zero errors and that
every count above is exact, not merely "under the cap." The benchmark
harness itself re-validates both fixtures at the start of every run before
timing anything, so a future regression that breaks fixture validity fails
loudly instead of silently timing an invalid scene.

### `withinLimitsScene()` — a typical, well-under-cap scene

20 shapes (one 6-member group, two with 30-sample trails), one particle
emitter at a fifth of the rate cap, a 6-node graph (one `mapRange` →
`clamp` → `ifElse` chain), and 12 bindings. Stands in for an ordinary
scene a user would actually ship, to confirm the reference environment
comfortably meets budget on realistic content — not only that the
pathological maximum survives.

## Method

Per scenario (`frontend/e2e/benchmark/runtimeLimits.bench.ts`):

1. Bundle and load the runtime/render/validation modules into an isolated
   `about:blank` Chromium page.
2. Re-validate the fixture (`validateScene` + `validateBehaviorGraph`) —
   abort loudly if either fails.
3. Construct the real pipeline: `createBehaviorRuntime(scene)`,
   `createParticleSystem(emittersFromScene(scene), {}, scene.randomness)`,
   `createTrailSystem(trailablesFromScene(scene))`,
   `createP5ScenePreview(container)`, against a real `<div>` appended to
   the page.
4. **Load time**: elapsed time from before runtime/particle/trail/preview
   construction to the first successful frame (the p5 `<canvas>` element
   existing after the first `render()` call resolves across
   `requestAnimationFrame`).
5. **Every frame** (warm-up and sampled alike): compute a small set of
   oscillating hand-signal-like values (`indexTipX`/`indexTipY`/
   `handDepth`/`handSpeed`/`pinchStrength`, sine/cosine functions of real
   elapsed time) so bindings and graph nodes evaluate real, changing input
   every tick, not a frozen no-op; call `runtime.tick()`, then
   `particleSystem.tick()`, then `trailSystem.tick()`, then
   `preview.render(scene, particles, trails)`; time the whole frame
   (`performance.now()` before/after) as one sample. Elapsed timestamps
   are real wall-clock time since the run started, not an assumed fixed
   cadence, so timing stays correct even on a scene running well under
   60fps (particle lifespans and trail sampling both key off elapsed
   time).
6. **Warm-up**: 60 frames (~1s at 60Hz), discarded from steady-state
   statistics — lets JIT warm-up, the particle system reach its steady
   live-count, and any one-time allocation settle before sampling.
7. **Sample count**: 300 frames (~5s at 60Hz) of steady-state samples per
   scenario.
8. **Steady-state frame duration**: mean of the 300 sampled frame
   durations. Also reports p95 and max.
9. **Long-frame rate**: percentage of the 300 sampled frames whose
   duration exceeds 33.33ms (below 30fps — see "Thresholds" below).
10. **Memory trend**: `performance.memory.usedJSHeapSize` sampled once
    right after load and once after the last sampled frame; the harness
    launches Chromium with `--enable-precise-memory-info`
    (`playwright.bench.config.ts`) so this reads a real value rather than
    a coarse bucket. Reported as the byte delta between those two points.
    See "Memory measurement" below for what this does and doesn't prove.
11. After every frame, the scene document is re-serialized and compared
    byte-for-byte against its pre-run serialization — proving the runtime
    pipeline never mutates its input scene, which the forced-degradation
    scenario (below) also checks explicitly.

### Forced over-budget scenario

Uses `createBehaviorRuntime`'s existing injectable `perfNow` option
(Task 35) with the exact pattern `behaviorRuntime.test.ts` already
established (`let call = 0; const perfNow = () => (call++ % 2 === 0 ? 0 :
50)`), which makes every tick's measured `evaluatedMs` read as 50ms —
far over the 4ms `DEFAULT_WORK_BUDGET_MS` — forcing the documented
work-budget degradation path (smoothing skipped, lowest-priority bindings
dropped, `RuntimeDiagnostic` emitted) to activate on every tick after the
first. Runs 30 ticks against `withinLimitsScene()` and asserts:

- No tick throws (controls/ticking keep working under sustained overload).
- Every tick after the first runs `degraded: true` (matches Task 35's
  documented "next tick runs degraded" policy).
- At least one `frameBudgetExceeded` diagnostic is emitted per
  over-budget tick.
- A **separate**, freshly constructed runtime with a fast `perfNow`
  (`() => 0`) does **not** run degraded — proving degradation is a live
  response to genuinely slow ticks, not a permanent latch a scene could
  get stuck in.
- The scene document's JSON serialization is byte-identical before and
  after all 30 ticks — no state corruption.

## Hardware/browser assumptions (this run)

**These numbers describe one specific developer machine and headless
Chromium build. They are not a claim about end-user hardware, mobile
devices, low-end laptops, or a loaded CI runner — see "Why no CI gate" for
why this matters.**

- Host: macOS (Darwin), Apple Silicon (arm64), 8 logical CPUs, 17GB RAM.
- Node: v24.15.0.
- Playwright: 1.62.1, driving its own bundled Chromium 151.0.7922.34.
- Browser mode: headless (Playwright's default), single worker, no other
  load on the machine during the run.
- Vite: library-mode `build()` (no dev server), `target: 'es2020'`,
  unminified.

Headless Chromium's rendering path differs from a real windowed browser on
real end-user hardware (different compositor path, no display scaling/
HiDPI cost, no OS-level window management overhead) — actual on-screen
frame times on a real device, especially a mid/low-end laptop or a mobile
browser, will likely be higher than what's reported here. Treat these
numbers as a **relative** signal (does the max scene degrade gracefully
relative to the typical scene? did a change regress frame time?) more than
an absolute guarantee for every device the product ships to.

## Thresholds (this task's own documented choice)

`docs/plan.md`'s "Validation and performance limits" section documents
_that_ a "per-frame execution budget with graceful quality reduction" must
exist, and `behaviorRuntime.ts` (Task 35) already picked the concrete
number for the runtime's own per-tick work budget: `DEFAULT_WORK_BUDGET_MS
= 4`ms, against a documented 60Hz/16.67ms frame reference. Neither
document specifies a numeric frame-_render_ budget (as opposed to the
runtime's tick-evaluation budget), so this task documents its own
reasonable choice, consistent with that same 60Hz reference:

- **Steady-state average frame duration** ≤ 16.67ms (60fps) — pass
  threshold for `withinLimitsScene()`, asserted by the benchmark test
  itself.
- **Long-frame rate** (frames > 33.33ms, i.e. below 30fps) ≤ 5% — pass
  threshold for `withinLimitsScene()`, asserted by the benchmark test
  itself.
- **`maxScene()`** intentionally has **no** hardcoded pass/fail frame
  threshold in the benchmark test — it's a deliberate worst case, and
  V1's own documented policy for an over-budget _tick_ is graceful
  degradation, not a hard failure (see Task 35). The benchmark instead
  asserts it runs to completion, every frame renders without throwing,
  and reports its actual numbers for a human to judge against the
  thresholds above. On the reference run described here, `maxScene()`
  comfortably met the 60fps threshold too (see "Results" below) — but
  that is this machine's result, not a guarantee.

## Memory measurement

`performance.memory.usedJSHeapSize` is Chromium-specific, coarse (V8 may
not run a GC between the two sample points, so a real leak can look flat
over a short window), and not standardized — no fallback proxy was
substituted because none of the alternatives (`performance
.measureUserAgentSpecificMemory()`, requiring cross-origin isolation;
process RSS from outside the page) are meaningfully more precise for a
single-page, 5-second run. `--enable-precise-memory-info` is passed at
browser launch (`playwright.bench.config.ts`) specifically so
`usedJSHeapSize` reads a real per-page value rather than a bucketed one.
For genuine leak detection, re-run with a larger `SAMPLE_FRAMES` (or loop
the whole scenario multiple times) and watch the trend across multiple
independent runs, not a single 5-second window.

## Results (reference run)

From `frontend/e2e/benchmark/results/latest.json`, generated by the run
described in "Hardware/browser assumptions" above:

| Scenario              | Load time | Steady-state avg frame | p95 frame | Max frame | Long-frame rate | Memory trend (5s) |
| --------------------- | --------- | ---------------------- | --------- | --------- | --------------- | ----------------- |
| `maxScene()`          | 36.6ms    | 4.40ms                 | 4.80ms    | 6.40ms    | 0.0%            | 0.0KB             |
| `withinLimitsScene()` | 7.6ms     | 1.88ms                 | 2.30ms    | 2.70ms    | 0.0%            | 0.0KB             |

Both scenarios met the 16.67ms/60fps steady-state threshold and the 5%
long-frame threshold on this reference machine, with the maxed-out scene
running at roughly 2.3× the per-frame cost of the typical scene — headroom
that would likely narrow (and could invert the pass/fail outcome) on
slower/mobile hardware, which is exactly why this result is not wired
into CI as a hard gate.

Forced over-budget scenario: 29 of 30 ticks ran degraded (the first tick
has no prior over-budget tick to react to, matching Task 35's documented
policy), every over-budget tick emitted a `frameBudgetExceeded`
diagnostic, no tick threw, a separately constructed fast-`perfNow` runtime
did not run degraded (proving recovery), and the scene document's JSON
serialization was byte-identical before and after — no state corruption.

Re-run `npm run bench:runtime` from `frontend/` to reproduce or refresh
these numbers; the machine-readable file is overwritten on every run.

## Why no CI gate is wired up (and what would exist instead)

The acceptance criterion is "machine-readable in CI **or** a documented
repeatable manual release procedure" — this task takes the second option,
deliberately:

- The concrete pass/fail numbers above are specific to one developer's
  Apple Silicon machine running headless Chromium. Wiring a hardcoded
  `expect(avgFrameMs).toBeLessThan(X)` gate for `maxScene()` into CI would
  make the gate pass or fail based on _which runner happened to execute
  it_ rather than on whether the runtime pipeline actually regressed —
  exactly the kind of flaky, hardware-dependent gate this task's
  constraints ask not to introduce.
- `withinLimitsScene()`'s thresholds (60fps/5% long-frame rate) _are_
  asserted by the benchmark test itself, every time it runs — so running
  `npm run bench:runtime` in any environment (a developer machine, a
  dedicated benchmark runner, before a release) already gives a genuine
  pass/fail signal for the realistic-scene case, machine-readable via its
  Playwright exit code and `results/latest.json`.
- The **manual release procedure**: before a release that touches
  `behaviorRuntime.ts`/`particleSystem.ts`/`trailSystem.ts`/
  `p5Adapter.ts`, run `npm run bench:runtime` from `frontend/`, compare
  `results/latest.json` against the previous release's committed copy
  (same file path — diff the two), and treat a material regression in
  `withinLimitsScene()`'s numbers, or a `maxScene()` steady-state average
  crossing 16.67ms where it previously didn't, as a signal to investigate
  before shipping.
- If a later task provisions a dedicated, consistent benchmark runner
  (fixed hardware, not a shared/variable CI fleet), re-deriving
  environment-specific thresholds from a baseline captured on _that_
  runner and wiring `bench:runtime` into a scheduled (not per-commit) CI
  job would be a reasonable follow-up — out of scope here.

## Limits and boundaries (V1 boundary — not proposed for change)

This benchmark did not surface any documented `schema/limits.json` cap as
obviously too aggressive or too conservative on the reference machine —
`maxScene()` ran well within the documented frame budget. Per issue #70's
own constraint, no limit was changed as part of this task; if a future
benchmark run on more representative (e.g. lower-end or mobile) hardware
does reveal a genuine problem with a specific limit, that belongs in a
separately groomed follow-up issue, not a silent edit to
`schema/limits.json` here.
