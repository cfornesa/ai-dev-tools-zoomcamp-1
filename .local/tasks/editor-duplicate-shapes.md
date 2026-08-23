## Goal

Isolate the exact mechanism that makes shapes appear duplicated in the
editor (persisted duplicate shape IDs, a draft/version recovery merge that
combines rather than replaces, or a rendering/selection layer drawing more
than one instance per shape), then fix that specific mechanism so exactly
one rendered instance ever exists per canonical shape ID, without silently
dropping any legitimate shape.

## Acceptance criteria

- [ ] **Classification is stated explicitly before any fix lands.** The
  implementer writes a short root-cause note (in this file's "Evidence and
  pending items" section) naming which of the three categories below
  reproduces the bug, with the reproduction steps/test that proves it:
  - (a) the persisted `scene_json` itself contains two shape entries with
    the same `id`, or two structurally-different shapes that both draw at
    the same position;
  - (b) a draft/version recovery or AI-proposal-accept path combines an
    old and a new shape array (appends/merges) instead of replacing the
    working copy wholesale;
  - (c) the canonical shape collection has exactly one entry per ID, but
    something renders/selects more than one visual instance for it (e.g.
    the p5 canvas layer and an SVG overlay both drawing the same shape, or
    a stale render call not superseded by a newer one).
  A fix that isn't preceded by this classification does not satisfy this
  criterion, even if it happens to make the symptom go away.
- [ ] **A deterministic, checked-in reproduction exists** — a unit/
  component test (preferred) or a documented manual `frontend/e2e/`
  scenario — that fails against the current code for the classified
  category and passes after the fix. "Deterministic" means it does not
  depend on real network timing/race luck to fail; if the root cause is a
  race, the test forces the race (e.g. via fake timers, controlled promise
  resolution order, or a direct call sequence) rather than hoping it
  reproduces.
- [ ] `scenes/validation.py` and `frontend/src/validation/scene.ts` both
  already reject a scene with duplicate `id`s within `shapes` (rule
  `duplicateId` — see `scenes/validation.py:174` and
  `frontend/src/validation/scene.ts:206`). Confirm (with a test, if one
  doesn't already exist) that this rejection actually fires on every path
  that can persist a scene relevant to this bug: explicit Save, server
  draft PUT, local IndexedDB draft write, version restore, and AI-proposal
  accept. If any of those paths can currently write a duplicate-ID scene
  without going through `validateScene`, close that gap.
- [ ] If category (a) is confirmed and a duplicate-ID scene can already
  exist in stored data (e.g. from before this fix), define and implement a
  normalization step that de-duplicates by ID (keep one deterministic
  winner per ID — e.g. last-in-array-order, documented explicitly) without
  removing shapes that only *look* similar but have distinct IDs. State
  the chosen tie-break rule in the code comment and in this file.
- [ ] Loading a version, recovering a local draft, recovering a server
  draft, saving, reloading the page, and undo/redo each preserve exactly
  one rendered object and exactly one outline row per shape ID — verified
  by a test that counts rendered/outline entries against the canonical
  `shapes` array length, not just eyeballing the canvas.
- [ ] Selection, the Inspector panel, the outline/Layers list, hit-testing
  (`hitTestTopmostShapeAt` in `frontend/src/pages/sceneShapes.ts`), and
  draw/stacking order stay one-to-one with the canonical shape collection
  through every sequence in the acceptance criterion above — no case where
  the outline shows N rows but the canvas renders N+1 (or N-1) instances,
  or where selecting a shape in the outline highlights more than one
  canvas object.
- [ ] Regression coverage added asserts both (1) the persisted/working-copy
  shape ID set has no duplicates after each operation in scope, and (2)
  the rendered instance count (canvas nodes from `buildScenePlan`/
  `p5Adapter.ts`, or the outline row count from
  `frontend/src/pages/sceneOutline.ts`'s `buildOutline`) matches that set's
  size — not just one or the other, since either alone could pass while
  the other still shows duplication.
- [ ] The fix does not regress `frontend/e2e/editor.spec.ts` or
  `frontend/e2e/aiAndRecovery.spec.ts`; if either needed a new scenario to
  cover this bug's reproduction, that scenario is added and passes under
  `make e2e`'s documented prerequisites (`AGENTS.md`).
- [ ] `make check` passes (backend+frontend lint/format/typecheck/test).

## Candidate root-cause hypotheses (to check first, not assumed true)

These were found by reading the code, not by reproducing the bug in a
browser — treat them as a prioritized checklist for the investigation, not
a diagnosis. State in "Evidence and pending items" which were ruled out and
which (if any) were confirmed.

1. **External `setWorkingCopy` calls race the undo-history hook's stale
   closures.** `frontend/src/pages/EditorWorkspace.tsx`'s
   `VersionHistoryPanel.onRestored` (~line 1821) and
   `AIProposalPanel.onAccepted` (~line 1868) both call
   `setWorkingCopy(structuredClone(version.scene_json))` directly, bypassing
   `useSceneEditor.ts`'s `commit()` (which is the only thing that pushes
   onto the `past` undo stack and clears `future`, at
   `frontend/src/pages/useSceneEditor.ts:361-369`). `commit()` closes over
   `workingCopy` from its own render rather than reading a ref. If a
   user-triggered mutation (e.g. `addShape`, `duplicateShape`) fires from a
   stale render right after a restore/AI-accept — before React has
   re-rendered `useSceneEditor` with the replaced `workingCopy` — that
   mutation's `commit(withShapes(workingCopy, [...]))` would build its
   next state from the *pre-replacement* shape array, silently discarding
   the just-restored/just-accepted scene and reintroducing whatever shapes
   were present before it. Depending on exact timing this could present as
   "duplicated shapes" if the two arrays share IDs regenerated close
   together, or as reverted content. Check whether `commit`,
   `addShape`/`duplicateShape`/etc. read `workingCopyRef.current` (the ref
   kept in sync at `useSceneEditor.ts:272-275`) or the stale `workingCopy`
   render variable — this is the first thing to verify against the actual
   hook code.
2. **`useDraftRecovery.ts`'s `recover()` and the version-restore/AI-accept
   handlers all replace the working copy wholesale (`setWorkingCopy(candidate.sceneJson)`
   or `structuredClone(version.scene_json)`)** — none of them append or
   merge arrays as read. This makes category (b) (recovery *merging* old
   and new) look less likely from `useDraftRecovery.ts` itself, but the
   three replacement call sites are uncoordinated (each is a separate
   `setWorkingCopy` call with no shared gate), so a rapid double-trigger
   (e.g. the recovery prompt's "Recover" click landing at nearly the same
   moment as an in-flight autosave write elsewhere) is worth checking for
   a last-write-wins issue that isn't a merge but still ends up showing
   stale plus new content depending on render timing.
3. **`crypto.randomUUID()` collisions are effectively impossible** —
   `createShape`/`duplicateShape`/`addLayer`/`groupItems` in
   `frontend/src/pages/sceneShapes.ts` and `sceneOutline.ts` all mint fresh
   IDs this way. Rule this out quickly rather than spending investigation
   time on it; it is not a plausible root cause on its own.
4. **`p5Adapter.ts`'s render loop looks clean on inspection** — `render()`
   rebuilds `currentPlan` from `buildScenePlan(scene)` on every call
   (`frontend/src/render/p5Adapter.ts:298-322`), and `sk.draw()` calls
   `sk.background(...)` before iterating `currentPlan.nodes` fresh each
   redraw (lines 272-293) — there is no accumulation across frames in this
   file as read. If category (c) is confirmed, look instead at whether
   `EditorWorkspace.tsx` renders shapes through *two* paths simultaneously
   (the p5 canvas plus a separate SVG selection-handle overlay, referenced
   around `EditorWorkspace.tsx:1349`) that could both draw a shape's body
   rather than the overlay only drawing handles.
5. **No server-side or client-side array-merge logic was found for
   `scene_json`/`draft_json` persistence** (`scenes/models.py`,
   `frontend/src/storage/draftServerSync.ts`) — persistence appears to be
   whole-document replace, not a field-level merge. Category (a) via a
   backend merge bug looks unlikely, but confirm directly rather than
   trusting this read, since a grep-based pass can miss request-level
   concurrency behavior (e.g. two overlapping `PUT /draft/<session>/`
   requests both succeeding against different `client_seq` values).

## Out of scope

- Issue #125 ("Stop autosave from resurrecting drafts after an explicit
  save," `.local/tasks/editor-draft-resurrection.md`) — a concurrently
  in-flight fix touching the same draft-recovery machinery
  (`useDraftAutosave.ts`, `useDraftServerSync.ts`, `draftAutosave.ts`,
  `draftServerSync.ts`, and `EditorWorkspace.tsx`'s save/exit/restore/
  AI-accept handlers). Do not fold that work into this task and do not
  assume its implementation specifics — but re-run this task's
  reproduction *after* #125 lands, since a resurrected-draft race is a
  plausible contributor to duplicate-looking shapes and #125 may already
  fix part of what this investigation finds. If #125's fix does not
  eliminate the duplication, that is evidence for classification (a) or
  (c) over (b).
- Any new Layers-panel UI work (issue #127,
  `.local/tasks/editor-dedicated-layers-panel.md`) — that task replaces
  the outline UI entirely; this task must not block on or redesign it,
  only ensure the *existing* outline stays one-to-one with shapes.
- Publish/metadata flow issues (issue #128) — unrelated surface.
- Performance optimization of the renderer — this task is about
  correctness (one instance per shape), not render speed.
- If the investigation uncovers a *distinct* bug unrelated to shape
  duplication (e.g. while reading `EditorWorkspace.tsx`'s SVG overlay code
  in hypothesis 4), do not fix it inline — file a follow-up issue per the
  Discovery gate below and link it here instead.

## Evidence and pending items

- **Status:** PROPOSED
- **Evidence so far:** The reporting browser session threw no JavaScript
  exception while exercising version loading, draft recovery, repeated
  draft writes, explicit save, draft deletion, and reload/navigation —
  this is why the issue is scoped as an investigation rather than a known
  fix. Code reading (this grooming pass) found: (1) `duplicateId`
  validation already exists and is enforced both frontend
  (`frontend/src/validation/scene.ts:206`) and backend
  (`scenes/validation.py:174`); (2) three call sites
  (`VersionHistoryPanel.onRestored`, `AIProposalPanel.onAccepted`,
  `useDraftRecovery.recover()`) all replace `workingCopy` wholesale via
  direct `setWorkingCopy` calls that bypass `useSceneEditor.ts`'s `commit()`
  undo-history bookkeeping — see "Candidate root-cause hypotheses" above
  for why this is the leading hypothesis; (3) `p5Adapter.ts`'s draw loop
  clears and rebuilds its node list every redraw, with no accumulation
  found on inspection. None of this has been confirmed by actually running
  the app — it is a reading-only pass.
- **Pending verification:** Reproduce the duplication with a controlled
  test per hypothesis 1 first (fastest to check: force `commit()` to fire
  with a stale `workingCopy` closure immediately after a
  `setWorkingCopy(structuredClone(...))` replacement, using fake timers or
  a direct sequential call in a component test, and assert whether the
  resulting shape array contains stale + new entries). If that doesn't
  reproduce, walk hypotheses 2 through 5 in order.
- **Next action:** Write the forced-race component test for hypothesis 1
  against `useSceneEditor.ts` + `EditorWorkspace.tsx`'s restore/AI-accept
  handlers before writing any fix.
- **Durable memory link:** None yet. If the confirmed root cause is a
  non-obvious constraint (e.g. a documented reason `commit()` reads
  render-scoped `workingCopy` rather than `workingCopyRef.current`, or a
  p5.js instance-mode redraw quirk), add a topic page under
  `.agents/memory/` and link it here before closing this task.

## Discovery gate

- [x] Searched `_docs/tasks.md`, `.local/tasks/`, and existing GitHub
  issues for a duplicate — none found. `_docs/tasks.md` item 95 is this
  same task (already links issue #126); `.local/tasks/editor-draft-resurrection.md`
  (issue #125, item 94) is the related-but-distinct concurrent fix,
  cross-referenced under Out of scope above.
- [x] Matching GitHub issue link recorded: `_docs/tasks.md` item 95 already
  links [#126](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/126).
- [ ] Reconcile newly discovered out-of-scope work before closing this
  task — none identified during this grooming pass beyond what's already
  listed under Out of scope. If the implementer's investigation later
  turns up an unrelated bug (see the last Out-of-scope bullet), file it
  and update this checkbox before closing.

## Constraints

- Stay inside: `frontend/src/pages/EditorWorkspace.tsx`,
  `frontend/src/pages/useSceneEditor.ts`, `frontend/src/pages/sceneShapes.ts`,
  `frontend/src/pages/sceneOutline.ts`, `frontend/src/pages/useDraftRecovery.ts`,
  `frontend/src/storage/draftAutosave.ts`, `frontend/src/storage/draftServerSync.ts`,
  `schema/scene.schema.json`, `frontend/e2e/editor.spec.ts`,
  `frontend/e2e/aiAndRecovery.spec.ts`, and their existing unit/component
  test siblings. Reading `frontend/src/render/p5Adapter.ts` and
  `scenes/models.py`/`scenes/validation.py` for diagnosis is fine; avoid
  changing them unless the confirmed root cause requires it, and if it
  does, keep the change minimal and justified in this file.
- Do not modify `schema/scene.schema.json`'s `uniqueItems`/id constraints
  themselves (per the existing repo-wide convention other tasks in this
  area follow — see `sceneShapes.ts`'s own comments on not modifying the
  schema) unless the classification step proves the schema itself is the
  gap; if so, coordinate the change with `schema/README.md`'s stated
  contract between `scenes/validation.py` and
  `frontend/src/validation/scene.ts`.
- No new dependencies — `pyproject.toml`/`frontend/package.json` changes
  require asking first per `AGENTS.md`.
- Coordinate with issue #125's in-flight fix rather than duplicating it:
  if the classification step finds the root cause is actually the
  draft-resurrection race #125 is already fixing, do not re-fix it here —
  re-run this task's reproduction after #125 merges and record the result.
- Follow `make check` (backend+frontend lint/format/typecheck/test) and,
  for any added/modified e2e scenario, the `make e2e` prerequisites in
  `AGENTS.md` (`AI_PROVIDER=fake`, migrated PostgreSQL, running dev
  servers) before considering this task done.
