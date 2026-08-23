## Goal

Replace the compact "Scene outline" collapsible section inside the Tools
panel with a visually distinct, dedicated Layers panel that shows nesting,
visibility, lock state, and stacking order for every layer/group/shape, and
lets users reorder them by pointer drag-and-drop (with a clear insertion
indicator and rejection of invalid drops) or by an equally capable keyboard
control — with every reorder landing in the same canonical scene state
(`workingCopy.layers`/`.groups`/`.shapes` via `useSceneEditor`) that drives
canvas rendering, selection, the Inspector, save, undo/redo, and draft
recovery.

## Acceptance criteria

- [ ] **A distinct Layers panel exists.** At desktop widths (≥1024px, the
  existing non-narrow layout), the Layers panel renders as its own
  `role="region" aria-label="Layers"` landmark alongside Details/Tools/
  Preview/Inspector — not nested inside a Tools `CollapsibleSection` the way
  today's "Scene outline" section is (`frontend/src/pages/EditorWorkspace.tsx`
  ~line 1734, `frontend/src/pages/SceneOutlinePanel.tsx`). "Visually
  distinct" means it has its own panel chrome (heading, border/background
  treatment consistent with the other landmark panels), not just a
  collapsible sub-heading buried inside Tools.
- [ ] **`SceneOutlinePanel.tsx` is replaced, not duplicated.** The existing
  component's row-building logic already comes from `sceneOutline.ts`'s
  `buildOutline`; the new Layers panel reuses that same data source and the
  same underlying `useSceneEditor` mutations (`moveItem`, `moveLayer`,
  `moveItemToLayer`, `moveItemToGroup`, `toggleLayerVisible/Locked`,
  `toggleGroupVisible/Locked`, `renameLayer`, `groupSelected`/
  `ungroupSelected`/`deleteGroupSelected`, `addLayer`, `deleteLayer`) rather
  than introducing a second, parallel reorder implementation. The old
  "Scene outline" `CollapsibleSection` in the Tools panel is removed once
  the Layers panel covers its functionality — the repo does not keep both.
- [ ] **Responsive behavior fits the existing switcher.** `EditorPanelName`
  (`frontend/src/components/EditorPanelSwitcher.tsx`) gains a `'layers'`
  entry alongside `'details' | 'tools' | 'inspector'` (Preview stays
  permanently visible per issue #93 and is never a switcher tab). Below the
  1024px breakpoint (`EditorWorkspace.tsx`'s `isNarrow`/`panelHidden`), the
  Layers panel becomes a fourth tab in `EditorPanelSwitcher`, mutually
  exclusive with Details/Tools/Inspector, exactly like the other three.
  Decide and document where the panel-switcher default (`activePanel`
  currently defaults to `'tools'`) leaves off — this task does not need to
  change the default, only ensure `'layers'` is a reachable, fully
  functional tab at narrow widths, including drag-and-drop (see the
  pointer/touch criterion below) and the keyboard-parity controls.
- [ ] **Every row shows nesting, visibility, lock state, and stacking
  order.** Each layer/group/shape row displays: indentation proportional to
  `OutlineRow.depth` (already computed by `buildOutline`); a visible
  icon/label distinguishing layer vs. group vs. shape (existing
  `▥`/`▤`/`◆` glyphs or an equivalent); the row's own visibility and lock
  toggle state (`row.visible`/`row.locked` for layers/groups) *and* whether
  it is effectively hidden/locked by an ancestor
  (`row.inheritedVisible`/`row.inheritedLocked`, already computed) shown as
  a distinct, readable annotation — not just implied by graying out; and a
  stable, human-readable name (`row.name` for layers/groups, `row.label`
  from `shapeLabel` for shapes, per issue #110 — never a raw/truncated
  UUID). Stacking order is the row's position in the rendered list, which
  must always match the layer/group/shape draw order `buildOutline`
  produces (top of the list = drawn last = visually on top, consistent with
  the existing convention — state explicitly in the panel's own code
  comment which end is "front").
- [ ] **Pointer drag-and-drop with a clear insertion indicator.** A row can
  be picked up and dragged over other rows. While dragging, a visible
  insertion-line indicator shows exactly where the item will land (between
  two specific rows, or "into" a group/layer as its new first/last child)
  before the drop completes — not just a highlighted target row with no
  indication of before/after position. Valid drop targets:
  - Reordering a shape or group within its current parent (layer top level
    or the same group's `childIds`) to any position among its siblings.
  - Dragging a shape or group onto a *different* group on the same layer to
    reparent it into that group (reusing `moveItemToGroup`'s existing
    same-layer, no-descendant-cycle rules).
  - Dragging a shape or group onto a different layer's row (or a shape/
    group with no group parent within a different layer) to reparent it to
    that layer's top level (reusing `moveItemToLayer`'s existing rules).
  - Reordering layers themselves (reusing `moveLayer`).
  Invalid drops are prevented at drag time (the drop target shows a
  rejected/no-drop affordance, and releasing over it is a no-op) for:
  dragging a group into one of its own descendants or into itself; dragging
  a shape/group across layers into a group that already rejects the move
  per `moveItemToGroup`'s/`moveItemToLayer`'s existing `checkCandidate`
  gate (limit violations, cross-layer group moves); dragging a layer row
  onto a group/shape row (layers only reorder among themselves); and
  dragging any item into or within a layer/group that is effectively locked
  (see the lock-interaction criterion below). Every successful drop calls
  through the existing `sceneOutline.ts` mutation functions (via
  `useSceneEditor`) so validation, undo-step granularity (one commit per
  drop, matching the existing "one undo step per action" convention noted
  in `SceneOutlinePanel.tsx`), and `outlineError`/`lockError` surfacing are
  unchanged.
- [ ] **Keyboard reorder parity.** Every reorder and reparent action
  reachable by drag is also reachable without a pointer, producing the
  identical resulting scene state. The existing "Move up"/"Move down"
  buttons (`moveItem`/`moveLayer`) and the existing target-select +
  "Move to layer"/"Move to group" controls (`MoveControls` in
  `SceneOutlinePanel.tsx`) already satisfy this for their respective
  operations and should be preserved (in equivalent form) in the new panel
  rather than dropped — dragging must be additive, not a replacement for
  keyboard operability. State explicitly in the implementation which
  existing keyboard controls carry over unchanged and which (if any) gain a
  new keyboard-only equivalent for a drag capability that has no current
  keyboard path (there should be none, since drag only reaches positions
  the existing controls already reach).
- [ ] **Locked-layer/group drag interaction (scope-limited).** A row whose
  effective lock state (`isEffectivelyLocked` — already computed as
  `row.locked`/`row.inheritedLocked`) is true is not a valid drag *source*
  or *drop target* for reordering/reparenting: attempting to drag such a
  row, or drop another item into/before/after it in a way that would
  change its own or a locked container's membership, is prevented at drag
  time with a visible rejected-drop affordance, mirroring how invalid
  cross-layer moves are shown. This criterion is strictly about the
  Layers panel's drag/drop and keyboard-reorder affordances respecting the
  *existing* `isEffectivelyLocked` display value — it does not add new
  mutation-time lock enforcement beyond what already exists in
  `useSceneEditor.ts`'s `lockError` checks (full lock enforcement across
  every mutation path is issue #80's separately tracked scope). If a locked
  item can currently still be reordered via the existing "Move up"/"Move
  down" buttons (i.e. `moveItem`/`moveLayer` in `sceneOutline.ts` do not
  themselves check `isEffectivelyLocked`), that gap in the underlying
  mutation is out of scope for this task (see Out of scope) — this task
  only has to make the *new drag UI* itself refuse to initiate/complete a
  drag against a locked row, not retrofit the shared mutation functions.
- [ ] **No duplicate or missing rows.** For any scene (empty, one layer, N
  layers with nested groups), the Layers panel renders exactly one row per
  layer/group/shape in the canonical scene document, in `buildOutline`'s
  order — verified by a component test asserting row count against
  `sceneEditor.outline.length` (or equivalent) after add/remove/reorder/
  reparent/undo/redo sequences.
- [ ] **Browser (Playwright) coverage.** An end-to-end scenario (added to
  the existing e2e suite — see the file-path note in Constraints) creates
  at least three shapes across layers/groups, performs at least one
  pointer drag-and-drop reorder and one keyboard-only reorder, and asserts
  both (a) the visual stacking order on the rendered canvas (topmost
  z-order matches the new Layers panel order) and (b) the persisted scene
  order after save/reload matches, with no duplicate outline rows at any
  point in the sequence.
- [ ] `make check` (backend+frontend lint/format/typecheck/test) passes,
  and `make e2e` passes for the added/modified scenario under the
  prerequisites in `AGENTS.md`.

## Out of scope

- **Full lock-enforcement across every mutation path** (e.g. making
  `moveItem`/`moveLayer`/resize/rotate/etc. themselves reject an
  effectively-locked target at the `sceneOutline.ts`/`useSceneEditor.ts`
  level, beyond what already exists) — tracked separately by issue #80.
  This task only makes the new drag UI refuse to *initiate or complete* a
  drag against a locked row/target.
- **The concurrent duplicate-shapes investigation** (issue #126,
  `.local/tasks/editor-duplicate-shapes.md`) and **the draft-resurrection
  fix** (issue #125, `.local/tasks/editor-draft-resurrection.md`) — both
  touch overlapping editor files (`EditorWorkspace.tsx`, `useSceneEditor.ts`)
  but operate at the draft-sync/rendering-identity layer, not the canonical
  scene array's stacking order this task reorders. No blocking dependency
  was found: this task reads and reorders the same `workingCopy.shapes`/
  `.groups`/`.layers` arrays #126 is auditing for duplication, but does not
  change how shapes are counted or merged. If #126's investigation lands a
  fix that changes `sceneOutline.ts`'s `buildOutline` output shape or
  `useSceneEditor`'s outline-related return values, re-check this task's
  component tests against that change before merging either — flagged here
  for awareness, not as a hard block.
- **Publish/metadata flow issues** (issue #128) — unrelated surface.
- **Renaming groups/layers, adding/deleting layers, and the existing
  same-layer group/ungroup flow's own UI** — these controls already exist
  in `SceneOutlinePanel.tsx` and simply move into the new panel unchanged;
  this task does not redesign their interaction, only their container and
  the addition of drag-and-drop for reordering.
- **`frontend/e2e/editor.spec.ts` does not exist in the current repo** (the
  original issue named it as a relevant file, but the e2e directory only
  has `projectLifecycle.spec.ts`, `interactionRuntime.spec.ts`,
  `aiAndRecovery.spec.ts`, `responsiveShell.spec.ts`, and others — no file
  named `editor.spec.ts`). This task's e2e coverage should live in
  whichever existing spec file most naturally covers outline/stacking
  behavior (`interactionRuntime.spec.ts` is the closest existing match —
  it already exercises canvas rendering/interaction) or a new
  `layersPanel.spec.ts` if none fits — the implementer decides and records
  the choice in "Evidence and pending items" below. This mismatch is
  flagged rather than silently resolved because the issue's stated
  "Relevant files" list should not be trusted as-is for this file.

## Evidence and pending items

- **Status:** PROPOSED
- **Evidence so far:** Read `frontend/src/pages/SceneOutlinePanel.tsx`,
  `frontend/src/pages/sceneOutline.ts`, `frontend/src/pages/EditorWorkspace.tsx`
  (panel layout, `panelHidden`, `EditorPanelName` usage), and
  `frontend/src/components/EditorPanelSwitcher.tsx`. Confirmed: (1) all
  reorder/reparent mutations (`moveItem`, `moveLayer`, `moveItemToLayer`,
  `moveItemToGroup`) already exist as pure functions in `sceneOutline.ts`
  and are already wired through `useSceneEditor.ts` and exposed to
  `SceneOutlinePanel.tsx` — this task is a UI/interaction change (adding
  drag-and-drop and a dedicated panel), not a new data-layer design; (2)
  `isEffectivelyLocked`/`inheritedVisible`/`inheritedLocked` are already
  computed per row by `buildOutline` (issue #80/#110 work), so the new
  panel can read lock state directly rather than recomputing it; (3) the
  `EditorPanelName` union and `EditorPanelSwitcher`'s `PANELS` array are
  the two places a `'layers'` tab needs to be added for narrow-width
  support; (4) `frontend/e2e/editor.spec.ts` (named in the original issue)
  does not exist — see Out of scope for how this is handled; (5) issue #110
  (closed) already delivered readable labels, hierarchy, and inherited
  visibility/lock display — this task builds on top of that rather than
  redoing it, per the issue's own acknowledgment ("This remains a
  usability gap even though issue #110 improved labels and hierarchy").
- **Pending verification:** None yet — this is a grooming pass only, no
  implementation started.
- **Next action:** Decide the drag-and-drop implementation approach (native
  HTML5 drag events vs. a pointer-events-based library-free implementation
  vs. an existing dependency) — note per `AGENTS.md`, any new frontend
  dependency requires asking first before adding it to
  `frontend/package.json`.
- **Durable memory link:** None yet.

## Discovery gate

- [x] Searched `_docs/tasks.md`, `.local/tasks/`, and existing GitHub
  issues for a duplicate — `_docs/tasks.md` item 96 is this same task
  (already links issue #127); issue #110 (closed) is prior related work,
  cross-referenced above and in Out of scope is not needed since it's
  closed; issues #125/#126 are concurrent overlapping-file work,
  cross-referenced under Out of scope.
- [x] Matching GitHub issue link recorded: `_docs/tasks.md` item 96 already
  links [#127](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/127).
- [ ] Reconcile newly discovered out-of-scope work before closing this
  task — the `frontend/e2e/editor.spec.ts` file-path mismatch (see Out of
  scope) is a documentation discrepancy in the original issue, not a new
  bug; no new backlog entry was filed for it since it's resolved by this
  grooming pass itself (recording the correct target file). If the
  implementer finds an unrelated issue while building this panel, file it
  and update this checkbox before closing.

## Constraints

- Stay inside: `frontend/src/pages/EditorWorkspace.tsx`,
  `frontend/src/pages/SceneOutlinePanel.tsx` (replaced/renamed — consider
  `frontend/src/pages/LayersPanel.tsx` or similar, matching this repo's
  existing per-panel-component convention like `ShapeInspectorPanel.tsx`),
  `frontend/src/pages/sceneOutline.ts` (extend if a new pure helper is
  needed for drag-target validation preview; do not duplicate existing
  mutation logic), `frontend/src/pages/useSceneEditor.ts`,
  `frontend/src/components/EditorPanelSwitcher.tsx`, `frontend/src/index.css`,
  `frontend/src/pages/EditorWorkspace.outline.test.tsx` (rename/extend to
  match the new component), and a new or existing e2e spec file per the
  Out-of-scope note above.
- Do not change `schema/scene.schema.json` — draw order stays purely
  array-position-derived (per `sceneOutline.ts`'s existing "Draw-order
  rule" doc comment); no new `order`/`zIndex` field on shapes or groups.
- Reuse `checkCandidate`/`validateScene` for every drop's validity check
  (both live preview during drag, if implemented, and the actual commit on
  drop) rather than re-implementing limit/cycle checks in the UI layer.
- No new frontend dependency without asking first, per `AGENTS.md`'s
  "Rules" section.
- Follow `make check` and, for any added/modified e2e scenario, the
  `make e2e` prerequisites in `AGENTS.md` (`AI_PROVIDER=fake`, migrated
  PostgreSQL, running dev servers) before considering this task done.
