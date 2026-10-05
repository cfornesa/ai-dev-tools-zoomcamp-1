# Efficiency conventions (Big-O / data-structure justification)

See [`CONVENTIONS.md`](../../CONVENTIONS.md) for the one-line principle:
**every data-structure choice is justified against this codebase's actual
scale.** This page has the yardstick and the worked examples — good and
bad, all real, all cited.

## The yardstick: this app already publishes its own scale ceilings

- `schema/limits.json` — `maxShapes: 200`, `maxGroups: 50`,
  `maxGroupNestingDepth: 6`, `maxGroupChildIds: 100`, `maxLayers: 200`,
  `maxPathPoints: 500`, `maxGraphNodes: 100`, `maxGraphConnections: 150`,
  `maxConditionalNodes: 3`, `maxBindings: 100`, `maxParticleEmitters: 4`,
  `maxTotalParticleRate: 800`, `maxScenePayloadBytes: 307200`. Enforced
  identically by frontend and backend validators against the same JSON.
- `docs/benchmarks.md` — `DEFAULT_WORK_BUDGET_MS = 4` per tick, measured
  against a 60Hz/16.67ms frame budget, verified on real headless Chromium
  (not mocked timing) against a `maxScene()` fixture (every limit hit
  simultaneously: measured avg 4.40ms/frame, p95 4.80ms) and a realistic
  `withinLimitsScene()` (~20 shapes: avg 1.88ms).

**Rule:** when you introduce or change a data structure in a hot path, cite
which of these numbers bounds it. "This is O(n²) but n ≤ 200 per `schema/
limits.json`, so worst case is 40,000 comparisons" is a real justification.
"This is O(n²)" with no scale reference is not — it forces the reviewer to
go find the bound themselves, or worse, not find it.

## Good examples, worth citing as "do this"

- **`backend/scenes/*.py`'s Django querysets** — `select_related`/
  `prefetch_related` used consistently across ~15 files (`gallery.py`'s
  `eligible_projects()`/`eligible_projects3d()`/`eligible_collections()`,
  `profile_feeds.py`, `public_search_api.py`, `canonical_piece_api.py`,
  etc.). This is the right default: avoid N+1 queries on any list/feed
  endpoint from the start, not as an afterthought.
- **`frontend/src/runtime/behaviorRuntime.ts`** — every lookup `Map`
  (`graphNodeById`, `smoothingStateByBinding`, `ifElseStateByGraphNode`, and
  others) is built once at construction (`createBehaviorRuntime`), outside
  `tick()`, and mutated in place tick-over-tick — never rebuilt per frame.
  `evaluateGraphVisualOutputs` *does* allocate two fresh `Map`s per tick
  (`memo`, `ifElseDecisions`), but that's a deliberate, documented
  per-tick memoization cache with a stated correctness reason (an If/Else
  node's debounce state must update at most once per tick regardless of
  fan-out), not a naive rescan.
- **`frontend/src/pages/sceneOutline.ts`** — functions doing *repeated*
  lookups build a `Map` first (`layersById`/`groupsById` before an ancestor
  walk); functions doing *one* lookup use `.find()` — the mix is deliberate,
  not sloppy, and matches the actual access pattern.

## Real counterexamples — bounded today, filed as fixes

- **`backend/scenes/collections.py`**: `_item_record` does one
  `.filter().first()` query per collection item instead of a batched fetch
  (a textbook N+1 on a public list-rendering endpoint); `public_collection_
  context` does one `PublicProfile.objects.filter(...).first()` per row
  instead of extending the existing `select_related` chain. Filed as its
  own issue — same file, same fix shape, same root cause.
- **`frontend/src/runtime/behaviorRuntime.ts`'s `applyRuntimeOutputsToScene`
  → `patchTransformOrStyle`**: `list.findIndex((item) => item.id ===
  output.targetId)` — a linear scan per continuous output, run every frame,
  against `nextShapes`/`nextGroups` arrays instead of the `Map`s the rest of
  this same file uses everywhere else. Worst case ~100 bindings × 200
  shapes = 20,000 comparisons/frame — consistent with, and likely
  contributing to, the measured 4.40ms/frame on the pathological fixture.
  Not an incident (still inside budget), but the clearest "array +
  `findIndex` where a `Map` would be O(1)" example in the one file this
  codebase explicitly benchmarks. Filed as its own issue; verification
  re-runs `docs/benchmarks.md`'s benchmark and requires the result not
  regress.
- **`frontend/src/pages/sceneShapes.ts`'s `shapeLabel`**:
  `allShapes.filter((s) => s.type === shape.type).findIndex(...)` per call.
  Its own doc comment says callers "labeling every shape in a scene" call
  it per shape — making a full shape-list render O(n²). Bounded by
  `maxShapes: 200` today (worst case ~40,000 comparisons) — a "fix
  opportunistically" item, not an incident. Filed as its own issue.

## What's not yet machine-enforced

No linter here checks Big-O or flags an N+1 query — this is entirely a
review-discipline convention. `docs/benchmarks.md` explicitly declines to
wire its own numbers into CI as a hard gate (hardware variance would make
results runner-dependent, not regression-dependent); it prescribes a manual
pre-release diff instead. Don't claim this is automated when proposing a
change against this page.
