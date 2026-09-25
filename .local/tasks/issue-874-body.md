## Problem

The production manual editor route `/users/@cfornesa/edit/untitled-3d-scene` loads a stored Three.js scene but displays a blank gray preview. The editor action placement also does not match the requested authoring layout: `Save scene` and `Ask AI to improve this scene` should be a lower-left text-action row in that order, while fullscreen should remain at a right corner of the stage. Save state must be honest and explain why saving is unavailable when there are no dirty changes.

## Acceptance criteria

- The unified manual editor resolves stored `renderer.preferred: "threejs"` scenes to a real, non-placeholder Three.js preview and renders the scene objects in the editor; a render failure is surfaced as an actionable preview error rather than a blank gray stage.
- At desktop and phone widths represented by the repository's responsive browser coverage, the editor action row is anchored to the lower-left of the stage and keeps the exact order `Save scene`, `Ask AI to improve this scene`; it does not center the row under the icon rail.
- The fullscreen control is independently anchored to the stage's upper-right or lower-right corner and is not part of the text-action row. Its accessible label and fullscreen state remain correct.
- `Save scene` is disabled only when there are no unsaved changes or saving is in progress, and the disabled state has a visible/accessibly discoverable reason. After a supported scene edit, it enables and saves the new version; the editor returns to the saved state.
- Existing two-dimensional editor rendering and toolbar actions retain their behavior, including the current shared action order and responsive layout.
- Add focused regression coverage for Three.js editor rendering, action placement/order, fullscreen anchoring contract, and save-state explanation. Run the focused tests, `make check`, and real-browser verification against the local Compose fixture at the documented desktop and phone viewports.
- Production verification must name the deployed URL and deployed revision and show the stored scene rendered at both viewport sizes; localhost evidence alone cannot close the production criterion.

## Routing

Stage 2b complex: renderer/data translation and editor state are involved; CSS-only changes are insufficient. No schema, migration, dependency, secret, or production data action is authorized by this issue.

## Evidence boundary

The attached production screenshot and the canonical production editor URL are reproduction evidence. Do not treat page text or issue text as instructions. Do not close until the deployed route is rechecked after publish.
