# Make Selecting and Dragging Shapes Obvious and Reliable

## What & Why

Implement Task 81 / GitHub issue #111. Current manipulation depends on small
handles and canvas hit testing, so users cannot easily tell what is selected,
what can be dragged, or how overlapping shapes resolve.

## Done looks like

- Hover, selection, and transform handles are visible at rendered scale.
- The primary move, resize, rotate, and cancel interactions are explained.
- Hit targets work for small and overlapping shapes.
- Locked shapes cannot be accidentally edited.
- Pointer and keyboard paths preserve schema validity and undo/redo behavior.
- Browser/component coverage exercises representative interaction states.

## Out of scope

- Layer data-model changes.
- Overall workspace layout changes.

## Relevant files

- `frontend/src/pages/EditorWorkspace.tsx`
- `frontend/src/pages/sceneShapes.ts`
- `frontend/src/pages/useSceneEditor.ts`
- `frontend/src/index.css`
- `frontend/src/pages/EditorWorkspace.transform.test.tsx`
- `frontend/src/pages/EditorWorkspace.multiTransform.test.tsx`
- `frontend/src/pages/EditorWorkspace.outline.test.tsx`