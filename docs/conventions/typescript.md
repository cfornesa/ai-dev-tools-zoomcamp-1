# TypeScript conventions

Scope: `frontend/`. See [`CONVENTIONS.md`](../../CONVENTIONS.md) and
[`react.md`](react.md) (component/hook-specific rules live there).

## The real gap: `strict` mode is off

Confirmed absent from all three tsconfig files (`tsconfig.app.json`,
`tsconfig.node.json`, `tsconfig.e2e.json` — each self-contained, no shared
base/`extends`). Enabled today: `noUnusedLocals`, `noUnusedParameters`,
`erasableSyntaxOnly`, `noFallthroughCasesInSwitch`. **Not** enabled:
`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, and the rest of
the `strict` family.

**Do not flip `strict: true` in one change.** At this app's size (288 page
files, dozens of large modules), that would surface violations across the
whole frontend at once — the kind of change the hard no-regression rule
(`AGENTS.md` §13) requires a stated restoration path for, and at that scale
a single revert isn't a practical restoration path. The tracked rollout
issue measures the real violation count first (`tsc --strict --noEmit` as a
measurement, not a gate) and phases in flags by measured blast radius,
smallest first.

## Naming and module organization — already good, formalize it

Helper functions live in the same or a closely-named sibling file next to
what they support — colocation, not a shared name-prefix baked into the
function name. `frontend/src/pages/sceneShapes.ts`'s unexported `rotate
Around`/`pathLocalBounds` feed exported `applyMove`/`applyResize`/`apply
ShapeDrag`. `frontend/src/pages/sceneOutline.ts`'s unexported `isLayer`/
`rawLayers` feed exported `addLayer`/`renameLayer`/`moveItem`. Exported
operations are verb-first (`get`/`build`/`move`/`rename`/`delete`/`toggle`);
unexported predicates/accessors read as questions or nouns (`isLayer`,
`rawLayers`). **Rule:** keep this shape for new helpers — don't invent a
`sceneShapesHelperX` naming scheme when a same-file or sibling-file
unexported function already reads clearly from its usage site.

## Data-structure choice — the efficiency principle in practice

`sceneOutline.ts` already does the right thing for repeated lookups: it
builds a `Map` (`layersById`, `groupsById`, `shapesById`) once before a walk
that does several `.get()` calls, rather than repeated `.find()`. But
`outlineBreadcrumb` still calls `groups.find()`/`shapes.find()` for one-off
single lookups inside a loop bounded by `maxGroupNestingDepth = 6` — fine at
that bound, and a good example of "O(n) is fine here, cite the bound."
`sceneShapes.ts`'s `shapeLabel` (`allShapes.filter().findIndex()` per call)
is the counterexample: labeling a full shape list this way is O(n²) —
bounded by `schema/limits.json`'s `maxShapes: 200` today, but the pattern to
avoid going forward. See [`efficiency.md`](efficiency.md) for the full
write-up and the filed fix issue.

## Function/module size

Same rule as Python: many small functions per file is fine; one function
owning many unrelated concerns is not. See [`react.md`](react.md) for the
component/hook-specific version of this (it's the more common place it
shows up in this codebase).

## What's not yet machine-enforced

oxlint (`frontend/.oxlintrc.json`) sets only `react/rules-of-hooks: error`
and `react/only-export-components: warn`. No naming-convention or
complexity rule is configured. Before proposing one, check oxlint's actual
supported rule list for the installed version — don't assume a rule exists
because another linter has one.
