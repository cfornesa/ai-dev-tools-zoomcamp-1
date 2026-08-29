---
name: e2e-draft-seed-client-seq-race
description: An e2e test that seeds a server draft with a small hardcoded client_seq can lose a race against the app's own periodic autosave for a freshly-created project.
metadata:
  type: project
---

`useDraftServerSync`'s periodic sync timer (`DEFAULT_SYNC_INTERVAL_MS` =
25s, `frontend/src/storage/draftServerSync.ts`) treats a never-explicitly-
saved project as always "dirty" — `resetCleanBaseline()` at mount leaves no
clean baseline to compare a snapshot against, so `isClean()` unconditionally
returns `false`. This means the app syncs the pristine, untouched blank
scene to the server on its own schedule from the moment a project is
created, with no user edit required.

**Why:** `frontend/e2e/aiAndRecovery.spec.ts`'s "local/server conflict" test
(issue [#193](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/193))
mounted a real editor via `createBlankProjectViaUI`, then seeded the server
draft directly with `client_seq: 1` and asserted on its exact content later.
Whenever enough real wall-clock time elapsed between project creation and
the seed (routine under CI/sandbox load — this reproduced 3/3 times in one
session's `make browser-qa` runs), the app's own periodic tick — also
`client_seq: 1`, the first sync attempt for a fresh controller — landed
first. `scenes/api.py::_upsert_draft`'s tie-break rejects `client_seq <=
draft.client_seq`, so the test's own seed silently lost (`applied: false`),
and the test then asserted on content that was never actually written.
Confirmed live: seeding with the test's exact payload against a real
running dev stack returned the app's own already-written draft, not the
seeded one.

**How to apply:** Any e2e test that seeds a server draft (`PUT
/api/projects/:id/draft/:sessionId/`) for a project whose editor has
already been mounted, and then asserts on that draft's exact *content*
(not just "a draft exists"), must not hardcode a small `client_seq` like
`1`. Use a value no ordinary app-driven sync could plausibly reach within a
single test's runtime (e.g. `1_000_000`) so the seed's own write always
wins the tie-break regardless of what the app's periodic timer already
wrote. Tests that only check draft *existence* (not specific content) are
unaffected by this race and don't need the same treatment — see the fix
commit (`ed9c082`) for which of this spec file's other `client_seq: 1`
seeds were and weren't vulnerable.
