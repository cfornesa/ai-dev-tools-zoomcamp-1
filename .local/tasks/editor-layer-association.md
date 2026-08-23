# Make Shapes and Their Attributes Understandable Through Layers

## What & Why

Implement Task 80 / GitHub issue #110. The editor has layer and group data,
but shape rows use type plus truncated IDs and the connection to Inspector
attributes is difficult to understand.

## Done looks like

- Layers, groups, and shapes have readable labels and clear nesting.
- Canvas, outline, and Inspector selection all identify the same item.
- Inspector context identifies the selected shape/type and layer/group.
- Visibility and lock inheritance are apparent and do not mislead editing.
- Keyboard and screen-reader users can navigate the same hierarchy.
- Existing grouping, ordering, locking, and schema validity remain intact.

## Out of scope

- Overall panel sizing.
- Pointer-drag interaction mechanics.

## Relevant files

- `frontend/src/pages/SceneOutlinePanel.tsx`
- `frontend/src/pages/sceneOutline.ts`
- `frontend/src/pages/ShapeInspectorPanel.tsx`
- `frontend/src/pages/useSceneEditor.ts`
- `frontend/src/pages/EditorWorkspace.outline.test.tsx`
- `frontend/src/pages/EditorWorkspace.shapeInspector.test.tsx`