## Goal

Make local-project metadata updates produce a strictly newer `updatedAt`
value, even when an IndexedDB update occurs within the same JavaScript
millisecond as project creation or a prior update.

## Fixed entry point / fixture

`frontend/src/storage/localProjectRepository.ts:updateProject` and its existing
`localProjectRepository.test.ts` project CRUD test.

## Acceptance criteria

- `updateProject` always returns and persists an `updatedAt` later than the
  existing record's timestamp, without changing `createdAt`.
- The behavior remains ISO-8601 UTC and does not depend on arbitrary sleeps or
  wall-clock test timing.
- The focused repository test and the full frontend suite pass repeatedly.
- No IndexedDB schema, public API, dependency, or route contract changes.

## Out of scope

Draft history policy, server timestamps, migrations, and unrelated local
workspace save/reopen behavior from closed #536.

## Routing

Stage 2a mechanical: a small local repository timestamp helper and focused
regression assertion; no auth, schema, or migration logic.

## Discovery

Found while running the required full `make check` for #959. The failure is
reproducible in `localProjectRepository.test.ts` when `updateProject` and
`createProject` share one millisecond. Duplicate audit found no open issue;
closed #536 covers durable file save/reopen, not this timestamp invariant.
