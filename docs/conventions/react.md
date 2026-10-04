# React conventions

Scope: `frontend/src/pages/`, `frontend/src/components/`. See
[`CONVENTIONS.md`](../../CONVENTIONS.md) and [`typescript.md`](typescript.md).

## The antipattern this codebase already found and is fixing

`EditorWorkspace.tsx` before this session's code-health audit: 4,366 lines,
69 top-level imports, ~77 `useState`/`useEffect`/`useCallback`/`useMemo`
calls, mixing camera-overlay state, HTML/CSS/JS code-tab sync, canvas
viewport (zoom/pan), AI-assist panel state, and edit-session lifecycle in
one component. **This is the antipattern**: one component/hook owning many
unrelated concerns, not a file being long. The fix already filed and
underway (`#979`–`#986`, tracked under `#988`) is concern-extraction into
named hooks — one hook per cohesive concern (`useCameraOverlay`,
`useCanvasViewport`, `useAiAssistPanels`, `useEditSessionLifecycle`, etc.),
each independently testable, each keeping the existing `.{slice}.test.tsx`
files (below) green throughout.

**Heuristic:** if a component/hook's purpose needs "and" to describe
("owns the camera overlay *and* the code-tab sync *and* the AI panels"),
split it. If it's one large hook doing many operations within *one*
cohesive concern — `useSceneEditor.ts` (1,721 lines: selection, undo/redo,
transforms, layers, groups, graph nodes, all scene-editing operations) is
this — that's size from breadth of one concern, not tangle, and isn't
automatically a split target.

## State scoping: document state vs. device preference

This codebase deliberately uses two patterns side by side, chosen by a real
distinction — codify the distinction, not a blanket "avoid globals" (one of
the two patterns *is* a global, and it's fine):

- **Document/app state** — belongs in React state or context, and is
  eventually persisted/sent to the backend. Example: `frontend/src/auth/
  context.ts` + `AuthContext.tsx` + `useAuth.ts` — provider-scoped session
  state.
- **Device/browser preference, not part of the document** — the
  "module-singleton state" pattern: a module-level `let state`, a
  `Set<() => void>` of listeners, a `notify()` broadcaster, exposed to React
  via `useSyncExternalStore`. Used identically in three places:
  `frontend/src/editor/snapSettings.ts`, `frontend/src/editor/
  cameraOverlaySettings.ts`, `frontend/src/a11y/reducedMotion.ts` — each
  `localStorage`-backed, never serialized, never sent to Django.

**The decision test for new state:** is this document state (goes in the
scene/project, could be persisted or sent to Django) or a device/browser
preference (local-only)? Document state → React state/context. Device
preference → the module-singleton + `useSyncExternalStore` pattern,
matching the three existing examples exactly. New global-ish state that
fails this test needs its own justification in the issue/PR, not a silent
fourth pattern.

## The `.{slice}.test.tsx` convention (undocumented until now — real and
load-bearing)

A large component/hook's test suite is split by feature slice:
`EditorWorkspace.tsx` has ~20+ sibling test files (`.zoomPan.test.tsx`,
`.multiTransform.test.tsx`, `.vertexEdit.test.tsx`, `.cameraOverlay.test.tsx`,
`.draftAutosave.test.tsx`, and more); `useSceneEditor.ts` has `.graph`,
`.multiTransform`, `.vertex`, `.lock`, `.shapeStyle`, `.canvasSettings`,
`.outline`, `.behaviorCards`. **Rule:** when extracting a hook/concern out
of a large component (per the antipattern fix above), its slice test file
moves/is renamed with it and stays the regression gate named in the issue's
"Regression-risk and restoration safeguard" section — exactly what
`#979`–`#986` already rely on.

## Accessibility hooks — reuse, don't reinvent

`frontend/src/a11y/` already has `useAlertDialogFocus` (WAI-ARIA
alertdialog: focus-in on open, Escape dismisses without triggering the
destructive action, focus-return on close), `useMenuButton` (WAI-ARIA Menu
Button), and `useRovingRadioGroup` (WAI-ARIA Radio Group), each used across
multiple components. **Rule:** a new dialog/menu/radio-group-shaped
interaction reuses one of these hooks rather than reimplementing focus/
keyboard handling inline. See [`accessibility.md`](accessibility.md) for
the full picture and [`design-ux.md`](design-ux.md) for when an unstyled
primitives library might be worth evaluating instead of a fourth hand-
rolled variant of the same pattern.

## Visibility of status — converge on the existing idiom

`EditorWorkspace.tsx`'s save-status region (`role="status" aria-live=
"polite"`) and `EntitlementsSummary.tsx`'s independent reimplementation of
the same idea (`role="alert" aria-live="assertive"` for errors, `role=
"status"` for loading) show the same idiom emerging without a shared
component. **Rule:** new async-status UI uses `role="status"`/`role="alert"`
+ `aria-live` the same way; consider factoring a shared `<StatusBanner>` if
a third independent reimplementation appears.
