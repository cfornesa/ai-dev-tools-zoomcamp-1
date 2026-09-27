# Proposed issue — Reconcile media-asset AI E2E fixture with current editor routes

## Source and discovery

Discovered during task-distillation of #923/#924 on 2026-09-27. The current
`/create` flow opens `/local-projects/:id`, a browser-local IndexedDB editor
with no AI proposal panel. #924's fixed entry point and verification text
assume that `/create` opens the server-backed AI editor and therefore cannot
exercise its own acceptance criteria against the current product.

## Scope

Update #924's fixture and implementation contract to use the current,
authenticated server-backed AI editor entry point (or explicitly expand the
local-first editor with an AI surface if that is the intended product). Keep
local-only media boundaries explicit: browser-local asset bytes must not be
sent to Django, and the test must assert the correct resolver path for the
chosen editor.

## Acceptance criteria

- The selected entry route is reachable by the current product and exposes
  both the media library and AI proposal controls.
- The fixture creates/imports an unplaced image asset through that route and
  runs the deterministic add-asset-layer scenario at 1280x900 and 375x812.
- The resulting assertions cover chip metadata, candidate preview,
  accept/reject, rendered pixels, reload/resolver behavior, and the
  unimported-asset negative case without sending blob bytes.
- #924 is updated or linked so no stale `/create` assumption remains.

## Routing

Stage 1 task-distillation/issue-scoping; no implementation until the route
choice is reconciled. Duplicate audit: #923 owns the shared media-targeting
implementation, #924 owns the new-piece browser scenario, #925 owns the
existing-piece browser scenario, and #938 owns local-first generated-piece
creation. None owns this route/fixture reconciliation.
