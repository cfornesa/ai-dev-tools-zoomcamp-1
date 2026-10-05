# Testing conventions

See [`CONVENTIONS.md`](../../CONVENTIONS.md). `AGENTS.md`'s "Commands" and
"End-to-end tests (Playwright)" sections are the canonical source for *how*
to run each suite — this page is about *how tests are organized and named*,
which isn't documented anywhere else.

## Backend

Standard pytest, `backend/tests/` plus package-level tests. `backend.
test_settings` supplies safe offline defaults (SQLite for `default`;
`POSTGRES_TEST_DATABASE_URL`-gated tests self-skip without it) — see
`AGENTS.md` for the exact commands. No special naming convention beyond
standard `test_*.py`/`Test*` discovery.

## Frontend: the `.{slice}.test.tsx` convention

Real, consistent, and previously undocumented: a large component or hook
gets one base `<Name>.test.tsx` plus sibling files splitting its suite by
feature slice — `<Name>.<slice>.test.tsx`. `EditorWorkspace.tsx` has ~20+
such files (`.zoomPan`, `.multiTransform`, `.vertexEdit`, `.cameraOverlay`,
`.draftAutosave`, `.draftRecovery`, `.behaviorCards`, `.shapes`, `.snap`,
`.lock`, `.layers`, `.a11y`, and more); `useSceneEditor.ts` has `.graph`,
`.multiTransform`, `.vertex`, `.lock`, `.shapeStyle`, `.canvasSettings`,
`.outline`, `.behaviorCards`; `sceneShapes.ts` has `.snap`, `.transform`,
`.vertex`.

**Rule:** when adding a new feature slice to a large component/hook, add
`<Name>.<newSlice>.test.tsx` rather than growing the base test file
indefinitely. When extracting a concern into its own hook/module (per
[`react.md`](react.md)'s decomposition rule), move its slice test file with
it — it's not just a test, it's the regression gate the extraction issue's
"Regression-risk and restoration safeguard" section names.

## Accessibility testing

11 dedicated `*.a11y.test.tsx` files exist, using `jest-axe` to assert zero
axe-core violations (e.g. `CameraControl.a11y.test.tsx` across every camera
lifecycle state). `ReducedMotionControl.test.tsx` is a good model for going
beyond axe: it asserts real ARIA roles (`role="radiogroup"`, `role=
"radio"`), state transitions (`aria-checked`), a live-region announcement
(`role="status"`), and full keyboard behavior (roving `tabindex`, arrow-key
navigation with wraparound). **Rule:** a new interactive component that
manages its own focus/keyboard behavior gets an `.a11y.test.tsx` covering
axe-core *and* the specific keyboard/ARIA-state assertions, not axe alone —
axe catches structural ARIA errors, not "does Tab actually move focus where
it should."

## End-to-end (Playwright)

Covered fully in `AGENTS.md` — don't duplicate here. One addition: a new
E2E scenario that exercises a decomposed hook (per `react.md`) should be
checked against that hook's own `.{slice}.test.tsx` coverage first; E2E is
for real-browser/cross-surface guarantees SQLite/unit tests can't provide
(concurrency, real camera/mic constraints), not a substitute for unit-level
slice tests.
