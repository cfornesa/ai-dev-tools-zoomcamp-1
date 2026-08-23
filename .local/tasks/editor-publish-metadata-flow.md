## Goal

A user who types a valid title and/or description into the editor and then
clicks the header **Publish** button — without first clicking the separate
Details-panel **Save changes** button — publishes successfully on the first
try, using the values they just typed, with no metadata silently lost and no
confusing error that blames content the user can plainly see on screen.

**Chosen behavior (per the issue's "choose one" requirement): auto-persist,
then validate/publish.** When Publish is clicked, `PublishControl` first
persists whatever pending metadata is currently held in `EditorDetailsPanel`'s
local state (description, tags, `allow_public_remix`, `export_attribution`)
via the same `updateProjectMetadata` PATCH the Details panel's own "Save
changes" button uses, merges the response into `project`, and only then runs
`validateProjectMetadataForPublish` and opens the confirmation dialog (or
shows validation errors) against the freshly-saved values.

Rationale for auto-persist over block-and-instruct:
- The issue's own title — "make Publish **honor** metadata entered in the
  editor" — describes Publish using what's on screen, not refusing until the
  user finds and clicks a second, separately-labeled button.
- Blocking requires the user to *notice* an inline error, *infer* that a
  different button elsewhere on the page (Details panel "Save changes") is
  the fix, click it, then click Publish again — an indirect, easy-to-miss
  two-step recovery for a mistake the user didn't know they were making
  (nothing on screen currently tells them the textarea is local-only).
- Auto-persist is not lossier than blocking: the values already exist in
  React state either way, and the write is the exact same PATCH the user
  would have triggered manually. The only behavior change is *when* it
  fires (implicitly, on Publish) versus requiring an extra explicit click.
- The Publish confirmation dialog already tells the user their title,
  attribution, animation, and preview are about to become public before
  anything irreversible happens (`PublishConfirmDialog`), so folding a save
  of the same description/tags/checkboxes into that same moment does not
  introduce a new category of surprise — the whole action is already
  "about to make things public," and confirming it once covers both the
  save and the publish.
- Title edits already auto-save on their own (`EditableProjectTitle` in
  `frontend/src/pages/EditorWorkspace.tsx` PATCHes on blur/Enter, independent
  of the Details panel's "Save changes"), so this makes description/tags/
  checkbox handling consistent with how title already behaves, rather than
  introducing a third, blocking pattern just for those fields.

## Acceptance criteria

- [ ] Clicking **Publish** in `PublishControl.tsx` first calls
  `updateProjectMetadata` with the Details panel's *current, unsaved* field
  values (description, parsed tags, `allow_public_remix`,
  `export_attribution`) rather than reading stale values off `project`.
  This requires `EditorDetailsPanel`'s local field state to be reachable
  from `PublishControl` (e.g. lifted into `EditorWorkspace.tsx` and passed
  down to both components as props, or an equivalent shared-state
  mechanism) — `EditorWorkspace.tsx` is the natural owner since it already
  holds `project`/`setProject` and renders both `EditableProjectTitle` and
  `PublishControl` as siblings.
- [ ] **Typing a title, then a description, then clicking Publish without
  ever touching the Details panel's "Save changes" button** results in a
  successful publish using the typed values — confirmed in a component
  test (`PublishControl.test.tsx`/`EditorDetailsPanel.test.tsx` or a new
  integration-style test covering both together) and in
  `frontend/e2e/publishingAndRemix.spec.ts` against a real backend.
- [ ] **Typing only tags or only a checkbox change (no description text, or
  vice versa) then clicking Publish** persists whatever was pending in the
  Details panel at that moment, even if description alone is what
  ultimately blocks or unblocks publish — i.e. the persist step is
  unconditional on all pending Details-panel fields, not description-only.
- [ ] **Validation still fires after the auto-persist**, using the freshly
  saved values: if description is (still) blank or title is (still) the
  placeholder `"Untitled animation"`, Publish shows the existing inline
  `publish-title-error` / `publish-description-error` messaging and does
  **not** open the confirmation dialog — same as today, just evaluated
  after the persist instead of before it.
- [ ] **The Details-panel metadata PATCH fails with a 400 validation error**
  (e.g. tags exceed `MAX_TAGS`/`MAX_TAG_LENGTH`) during the Publish-triggered
  auto-persist: Publish stops before opening the confirmation dialog, the
  Details panel's own field-level errors are shown (reusing
  `EditorDetailsPanel`'s existing `fieldErrors` rendering, or an equivalent
  surfaced through `PublishControl`), and the user's typed values remain in
  the form completely unchanged — nothing is cleared or reset.
- [ ] **The Details-panel metadata PATCH fails on a network/5xx error**
  during the Publish-triggered auto-persist: Publish shows the existing
  `publish-form-error` style message ("Could not publish this project.
  Please try again." or an equivalently actionable variant naming the save
  step), the Publish button returns to its idle/enabled state, and the
  user's typed values remain in the form unchanged.
- [ ] **Retry after either failure above works**: clicking Publish again
  (with no further edits) re-attempts the persist-then-validate-then-open
  flow from scratch and succeeds once the underlying problem is gone (e.g.
  the tags are shortened, or the network recovers) — without requiring a
  page reload.
- [ ] **Canceling the confirmation dialog** (`onCancel` /
  `PublishConfirmDialog`'s Cancel button) after a successful auto-persist
  leaves the project private, leaves `project` (and the Details panel form)
  showing the just-saved values, and does not re-run the persist step
  again until Publish is clicked a second time.
- [ ] **Concurrent edit safety**: if the Details panel's local state has
  *not* changed since the last successful save (i.e. `project`'s stored
  values already match what's in the form — e.g. the user already clicked
  "Save changes" separately, or never touched the fields), clicking Publish
  does not send a redundant/no-op PATCH request before validating — this
  keeps behavior efficient and avoids masking a stale-`project` race with
  spurious writes. State the comparison used (e.g. shallow-diff against
  last-saved values) in the implementation.
- [ ] The Details panel's own "Save changes" button continues to work
  exactly as it does today (unaffected by this change) — a user can still
  explicitly save metadata without publishing.
- [ ] **Server-side validation and authorization remain authoritative
  regardless of this client flow.** The server's publish endpoint continues
  to independently re-validate title/description (see the existing
  `body.errors` handling in `handleConfirmPublish`) and enforce ownership/
  permission checks; a client that somehow bypasses the auto-persist (stale
  tab, direct API call, race with another edit) cannot publish a project
  whose server-side title/description do not actually meet the publish
  bar. No new trust is placed in client-computed values for the actual
  publish decision — only for when to show the confirmation dialog.
- [ ] `frontend/e2e/publishingAndRemix.spec.ts` gains (or already has
  extended to cover) a scenario starting from a project with
  blank/default metadata, entering a meaningful title and description
  through the real editor UI (not by seeding `project` directly), clicking
  Publish without a separate Details-panel save, confirming, and then
  verifying: the publish request succeeds, the project's visibility becomes
  public, and the publicly-visible metadata (title, description) matches
  what was typed.
- [ ] `make check` (backend + frontend lint/format/typecheck/test) passes.
  `make e2e` passes per its documented prerequisites in `AGENTS.md`.

## Out of scope

- Redesigning the Details panel / header layout, or merging the two
  separate metadata surfaces (Details panel vs. header title/publish
  controls) into one component. This task only changes *when* pending
  Details-panel state is persisted, not the UI structure.
- Auto-saving Details-panel metadata on every keystroke/blur (debounced
  autosave) independent of Publish. Out of scope for this task; if wanted,
  file a separate follow-up issue before starting it.
- Any change to `scenes/permissions.py` or server-side publish
  authorization logic — this task is client-flow-only; the server already
  independently re-validates and that behavior is being preserved, not
  modified.
- The Layers panel (issue #127), shape de-duplication (issue #126), and
  draft-sync (issue #125) work concurrently touching
  `frontend/src/pages/EditorWorkspace.tsx` — different UI regions (canvas/
  layers vs. header Publish control and Details panel). No coordination
  required beyond normal merge-conflict awareness when editing that shared
  file; if a conflict surfaces, resolve it by keeping both regions' changes
  intact rather than picking one side.

## Evidence and pending items

- **Status:** PROPOSED
- **Evidence so far:**
  - `frontend/src/pages/EditorDetailsPanel.tsx`'s `description`, `tags`,
    `allowRemix`, `exportAttribution` are local `useState` seeded once from
    `project.id` changing (line 51-58) and only pushed to `project` via
    `setProject(updated)` after a successful `updateProjectMetadata` PATCH
    in `handleSubmit` (line 60-94) — triggered only by that form's own
    submit button.
  - `frontend/src/pages/PublishControl.tsx`'s `handlePublishClick` (line
    89-97) reads `project?.title`/`project?.description` directly and runs
    `validateProjectMetadataForPublish` against those — never against the
    Details panel's local state — before deciding whether to open
    `PublishConfirmDialog`.
  - Title is the one field that does *not* have this gap:
    `EditableProjectTitle` in `frontend/src/pages/EditorWorkspace.tsx`
    (around line 133-170) PATCHes and updates `project` immediately on its
    own save, independent of the Details panel's "Save changes" button.
  - `frontend/src/validation/projectMetadata.ts`'s
    `validateProjectMetadataForPublish` (line 50-66) requires a non-blank,
    non-placeholder title and a non-blank description; this is the
    validation that currently fires against possibly-stale `project` data.
  - Existing tests (`PublishControl.test.tsx`, `EditorDetailsPanel.test.tsx`,
    `frontend/e2e/publishingAndRemix.spec.ts`, 860 lines) test each
    component/flow against an already-consistent `project` object or an
    already-completed metadata save; none currently reproduces "type
    metadata, click Publish immediately."
- **Pending verification:** None yet — this is a grooming pass only, no
  implementation has started.
- **Next action:** Lift `EditorDetailsPanel`'s local field state (or an
  equivalent "pending metadata" accessor) up to `EditorWorkspace.tsx` so
  `PublishControl` can read and persist it, per the first acceptance
  criterion.
- **Durable memory link:** none identified — this is ordinary React
  state-lifting, not a non-obvious platform constraint.

## Discovery gate

- [x] Searched `_docs/tasks.md`, `.local/tasks/`, and existing GitHub issues
  for a duplicate — item 97 in `_docs/tasks.md` already tracks this and
  links to issue #128; no separate duplicate found. Issues #125/#126/#127
  touch the same file (`EditorWorkspace.tsx`) but different UI regions and
  are noted above under "Out of scope" for coordination awareness only.
- [x] Added the matching GitHub issue link:
  [#128](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/128).
- [ ] Reconcile newly discovered out-of-scope work before closing this
  task — none discovered during this grooming pass beyond the items
  already listed under "Out of scope" (none of which needed a new GitHub
  issue since they're either pre-existing separate issues already tracked,
  or explicitly deferred, no-new-issue-needed scope trims).

## Constraints

- Stay within `frontend/src/pages/EditorDetailsPanel.tsx`,
  `frontend/src/pages/EditorWorkspace.tsx`, `frontend/src/pages/PublishControl.tsx`,
  `frontend/src/validation/projectMetadata.ts` (read/reference only — no
  validation *rule* changes are needed, only *when* they run), and their
  respective test files (`PublishControl.test.tsx`,
  `EditorDetailsPanel.test.tsx`) plus `frontend/e2e/publishingAndRemix.spec.ts`.
- Reuse the existing `updateProjectMetadata` API wrapper
  (`frontend/src/api/projects.ts`) — do not add a new endpoint or a new
  API call shape for this.
- Reuse existing error-rendering conventions (`FieldErrors`, `role="alert"`,
  the `publish-*-error`/`data-testid` patterns already in `PublishControl.tsx`)
  rather than inventing new error UI patterns.
- No backend/`scenes/` changes are expected; server-side publish validation
  and authorization are explicitly to remain unmodified and authoritative.
- Follow `AGENTS.md` for how to run `make check` and `make e2e` and their
  prerequisites before considering this done.
