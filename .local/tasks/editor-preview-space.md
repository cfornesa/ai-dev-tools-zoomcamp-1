# Give the Editor Preview and Control Panels Usable Space

## What & Why

Implement Task 79 / GitHub issue #109. The current editor gives Preview,
Details, Tools, and Inspector roughly equal space, which makes the live canvas
small and leaves controls difficult to interpret.

## Done looks like

- Preview has a clearly usable dominant area at desktop widths.
- Supporting panels remain readable and do not force tiny controls.
- Canvas and SVG overlays preserve aspect ratio and pointer alignment when
  scaled.
- Tablet and narrow layouts remain intentional and free of horizontal
  overflow.
- Existing accessibility, keyboard, reduced-motion, and scene behavior pass.

## Out of scope

- Layer hierarchy or shape naming.
- Pointer gesture mechanics.

## Relevant files

- `frontend/src/pages/EditorWorkspace.tsx`
- `frontend/src/components/EditorPanelSwitcher.tsx`
- `frontend/src/index.css`
- `frontend/src/pages/EditorWorkspace.test.tsx`
- `frontend/src/pages/EditorWorkspace.a11y.test.tsx`