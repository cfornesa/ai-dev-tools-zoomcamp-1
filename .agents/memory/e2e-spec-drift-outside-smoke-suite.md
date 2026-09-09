Non-smoke E2E spec files can silently stop passing for months and nothing
catches it, because `make e2e`/`npx playwright test` is never part of
`make check`/CI's push-triggered smoke suite (only 4 files + the nightly
full-matrix cron run it — see `full-matrix-scheduled-not-manual.md`).

Concretely: `layersPanel.spec.ts` (issue #127) assumed shape/layer
authoring buttons (Add circle/rectangle/layer, Combine into group, Save)
were directly reachable in the always-visible LayersPanel toolbar per issue
#131. Issue #427 later moved that whole toolbar behind the stage's "Edit
scene" popover (`e2e/support/openEditScene.ts`) — every test in the file
started hanging on the very first `Add circle` click, and stayed that way
until this session's Tier-C consolidation pass actually ran the file
locally and found it. Nothing in CI, `make check`, or routine development
would have surfaced this on its own.

**Why:** UI refactors (issues like #427/#444 moving controls behind stage
popovers) routinely land without updating every E2E spec that assumed the
old DOM shape, and there's no automated signal that a given spec file has
gone stale — a test that hangs to its own timeout still just looks like
"this suite is slow," not "this file is broken."

**How to apply:** treat "I'm about to touch/verify an E2E spec file
outside the 4-file smoke suite" as a signal to actually run it against a
live local stack before trusting its assertions, not just `--list`/
typecheck it. If a file assumes shape not confirmed by a recent run, check
whether a UI-relocation issue (grep this repo's own issue numbers in
`e2e/support/openEditScene.ts` and similar helpers) postdates the spec
file's own last real edit. When a popover/modal's own overlay blocks
clicks on elements outside "the stage" (confirmed here: the Preview
region's group-selection checkboxes and `SelectionHud`'s buttons are both
covered by `piece-stage-command-overlay` while the Edit-scene popover is
open), close it before those clicks and reopen before the next toolbar-only
action — `openEditScene()`'s own exact-name "Edit scene" trigger lookup
does not tolerate a trigger already reading "Hide edit scene" from an
earlier open/close cycle in the same test; write a locally scoped
tolerant reopen (anchored, case-insensitive regex matching both trigger
states, mirrored from `publishingAndRemix.spec.ts`'s own
`choosePublished`/`chooseDraft` pattern) rather than assuming the shared
helper covers every sequencing.
