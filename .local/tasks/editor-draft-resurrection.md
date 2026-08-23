## Goal

After an explicit Save (or an equivalent authoritative persist — Exit
without saving, restoring a historical version, or accepting an AI
proposal), no local (IndexedDB) or server draft write may recreate a
recovery draft for the pre-action working copy: once the working copy has
no unsaved changes relative to the currently persisted version, nothing in
`useDraftAutosave`/`useDraftServerSync` may write a draft until a real,
new edit makes it dirty again.

## Acceptance criteria

- [ ] Root cause confirmed and fixed: `DraftServerSyncController`'s
  periodic `setInterval` (`frontend/src/storage/draftServerSync.ts`,
  `start()`) is stopped, paused, or made a no-op whenever the working copy
  it would sync has no unsaved changes relative to the currently persisted
  version — not just cleared once via `deleteServerDraft()`
  (`frontend/src/pages/useDraftServerSync.ts`). Reproduces the exact
  evidence sequence from the issue (`POST /versions/` 201 → `DELETE
  /draft/<session>/` 204 → a later `PUT /draft/<session>/` 200) as a
  regression test, and the test asserts the `PUT` no longer happens.
- [ ] After `EditorWorkspace.tsx`'s `handleVersionSaved` runs (explicit
  Save success), waiting past both the local debounce window
  (`DEFAULT_DEBOUNCE_MS`, 1.5s) and one full server periodic interval
  (`DEFAULT_SYNC_INTERVAL_MS`, 25s) produces zero further
  `putDraftRecord`/IndexedDB writes and zero further
  `upsertDraftSync`/`PUT /draft/` requests, as long as the working copy is
  not edited again.
- [ ] If the user resumes editing after a Save (making the working copy
  dirty again), local and server autosave resume writing on their normal
  schedule — the fix must not permanently disable autosave for the rest of
  the session, only suppress writes while there is nothing unsaved.
- [ ] `handleConfirmExit`'s Exit-without-saving path
  (`frontend/src/pages/EditorWorkspace.tsx`) gets the same guarantee: after
  `draftAutosave.clearDraft()`/`draftServerSync.deleteServerDraft()` are
  called and the user is navigated to `/`, no in-flight or already-queued
  periodic/debounced write for that project/session is allowed to
  re-create a draft, whether or not the component has fully unmounted yet.
- [ ] `pagehide`/`visibilitychange`-triggered sync
  (`DraftServerSyncController.syncOnPageHide`) never re-creates a server
  draft for a working copy that already matches the persisted version at
  the moment it fires (e.g., page hidden immediately after a Save
  completed). It still fires normally when the working copy is genuinely
  dirty at hide time (crash-recovery purpose preserved).
- [ ] Restoring a historical version (`VersionHistoryPanel`'s
  `onRestored` handler) and accepting an AI proposal
  (`AIProposalPanel`'s `onAccepted` handler) are treated consistently with
  explicit Save: both already persist a new authoritative version
  server-side, so both must clear the local draft (today only `onAccepted`
  calls `draftAutosave.clearDraft()`; `onRestored` calls neither) and
  must not leave behind a server draft duplicating content already
  captured in the new persisted version (today both call
  `syncAfterMeaningfulAction`, which re-writes a server draft matching the
  just-persisted content). After either action completes, reloading the
  project shows no recovery prompt and no draft row exists for that
  session that differs from "no changes since last save."
- [ ] A local debounced autosave write that is already mid-flight (timer
  fired, awaiting the IndexedDB handle) at the exact moment
  `clearDraft()` runs during Save is still correctly superseded — add a
  regression test for this exact interleaving using
  `DraftAutosaveController`'s existing `seq`/`cancelPending` mechanism
  (this ordering appears correct by design already; the test locks in
  that it stays correct after this fix).
- [ ] If the cleanup delete itself fails (`DELETE /draft/<session>/`
  returns a network error or non-2xx), the failure is surfaced through the
  existing `draftFailureNotice` mechanism
  (`frontend/src/pages/EditorWorkspace.tsx`'s failure-polling effect) and
  the just-saved version remains the authoritative, loadable state — a
  failed cleanup must never roll back or hide the successful save.
- [ ] After a failed cleanup delete, the orphaned draft row does not keep
  getting refreshed/kept-alive by periodic sync (it is simply stale and
  inert until it expires or a cleanup command reclaims it) — this follows
  directly from gating periodic/meaningful-action sync on "is there an
  unsaved change," not from retrying the delete.
- [ ] Reopening a project immediately after a clean Save (no further
  edits) never shows the "Recover unsaved work?" prompt, whether the
  reload happens before or after the periodic sync interval would have
  elapsed (covers both the pre-existing `NO_SCENE_CHANGES_SUMMARY` filter
  from issue #124 and this task's new "don't write while clean" fix as
  independent, overlapping safety nets).
- [ ] A second browser tab/session (different `sessionId`, same project)
  editing concurrently is unaffected by the first tab's Save — its own
  autosave/server-sync continues normally, scoped to its own session id.
- [ ] Unmounting `EditorWorkspace` (route navigation away) immediately
  after clicking Save, before the async cleanup promises resolve, still
  results in both cleanup calls completing (or failing and being surfaced
  on next load, per the cleanup-failure criteria above) and in the
  periodic timer being torn down — no dangling `setInterval` outlives the
  component.
- [ ] All of the above races (save, autosave, page-hide, AI accept,
  restore, unmount) are covered by new or extended tests: component/unit
  tests for `useDraftAutosave.ts`/`useDraftServerSync.ts`/
  `draftServerSync.ts`/`draftAutosave.ts`, plus at least one
  `frontend/e2e/aiAndRecovery.spec.ts` scenario that saves, waits past a
  full periodic sync interval (or fakes the timer), reloads, and asserts
  no recovery prompt appears.

## Out of scope

- Changing the periodic sync cadence, debounce window, or draft expiry
  policy (`DEFAULT_SYNC_INTERVAL_MS`, `DEFAULT_DEBOUNCE_MS`,
  `LOCAL_DRAFT_MAX_AGE_MS`) — this task only changes *when* a write is
  attempted, not the timing constants themselves.
- Issue #126 ("Prevent duplicated shapes from appearing after editor load
  or recovery") — a separate, already-filed investigation into duplicate
  shapes possibly introduced by draft recovery; do not fold that
  investigation into this task even though both touch draft recovery.
- Any change to `useDraftRecovery.ts`'s `pickNewer`/`NO_SCENE_CHANGES_SUMMARY`
  filtering logic itself (issue #124's fix) — this task adds a second,
  independent safety net upstream of that filter rather than modifying it.
- Redesigning `syncAfterMeaningfulAction`'s general trigger list (currently
  restore and AI-accept) to add new "meaningful actions" — only the
  clear-after-persist consistency described above is in scope.

## Evidence and pending items

- **Status:** PROPOSED
- **Evidence so far:** The 2026-08-23 deployment request sequence for one
  project/session: `POST /versions/` → 201, `DELETE /draft/<session>/` →
  204, later `PUT /draft/<session>/` → 200. Root cause traced by code
  reading: `useDraftServerSync.ts`'s `deleteServerDraft()`
  (`frontend/src/pages/useDraftServerSync.ts:102-105`) deletes the current
  server draft row but never stops or gates
  `DraftServerSyncController`'s periodic `setInterval`
  (`frontend/src/storage/draftServerSync.ts:134-139`), which keeps firing
  on its existing cadence and calls `performSync` unconditionally with
  whatever `workingCopy` currently is — even when it is unchanged from the
  version that was just saved — re-creating the row on its next tick.
  `onRestored`/`onAccepted` compound the same class of issue: both persist
  a new version and then explicitly call `syncAfterMeaningfulAction`,
  re-writing a server draft that duplicates the just-persisted content;
  `onRestored` additionally never clears the local IndexedDB draft at all.
- **Pending verification:** None yet performed against a running stack —
  this is a planning/spec pass only, no code changed.
- **Next action:** Implement the "no draft write while the working copy
  is clean" gate in `DraftServerSyncController`/`useDraftServerSync.ts`
  (and align `onRestored`/`onAccepted` cleanup), then add the regression
  tests listed in the acceptance criteria.
- **Durable memory link:** None yet — if the fix uncovers a non-obvious,
  durable constraint (e.g., about timer lifecycle across React StrictMode
  double-invocation, or about `fetch(..., {keepalive:true})` behavior
  during unmount), add a topic page under `.agents/memory/` and link it
  here before closing this task.

## Discovery gate

- [x] Searched `_docs/tasks.md`, `.local/tasks/`, and existing GitHub
  issues for a duplicate — none found. Issue #124 (closed) is a related
  but distinct prior fix (recovery-prompt suppression for a no-op
  candidate); issue #126 (open) is a separate duplicate-shapes
  investigation, cross-referenced under Out of scope above.
- [x] Matching GitHub issue link recorded: `_docs/tasks.md` item 94 already
  links [#125](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/125).
- [ ] Reconcile newly discovered out-of-scope work before closing this
  task — none identified during grooming beyond what is already listed
  under Out of scope (both already have their own tracking: #126 is
  filed; the others are explicit non-goals, not deferred work, so no new
  follow-up issue is needed).

## Constraints

- Stay inside: `frontend/src/pages/EditorWorkspace.tsx`,
  `frontend/src/pages/useDraftAutosave.ts`,
  `frontend/src/pages/useDraftServerSync.ts`,
  `frontend/src/storage/draftAutosave.ts`,
  `frontend/src/storage/draftServerSync.ts`,
  `frontend/e2e/aiAndRecovery.spec.ts`, and their existing unit/component
  test siblings (e.g. `EditorWorkspace.draftSyncError.test.tsx` or
  equivalent). Do not touch `useDraftRecovery.ts`'s filtering logic (see
  Out of scope).
- No new dependencies — `pyproject.toml`/`frontend/package.json` changes
  require asking first per `AGENTS.md`; this fix should not need any.
- Preserve existing public behavior/contracts documented in each file's
  module comments (debounce/interval constants, `keepalive` fetch choice
  for page-hide, `client_seq` server-side race resolution, per-session
  `sessionId` isolation) — only change *whether/when* a write is
  attempted, not the underlying write/race mechanics already in place.
- Follow `make check` (backend+frontend lint/format/typecheck/test) and,
  for the added e2e scenario, the `make e2e` prerequisites in `AGENTS.md`
  (`AI_PROVIDER=fake`, migrated PostgreSQL, running dev servers) before
  considering this task done.
