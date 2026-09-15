---
name: Server-authoritative sync conflict resolution
description: Durable rules for applying deterministic offline conflict resolutions against versioned scene state.
---

Conflict resolution must compare the submitted base scene version with the
authoritative current project version while holding a project-level lock. A
fresh base creates one immutable SceneVersion linked to the idempotency receipt;
a stale base returns the authoritative snapshot and context without creating a
receipt or version. Replay of the same operation returns the original applied
version. Do not use last-write-wins for artwork-bearing records.

On PostgreSQL, lock the project row directly when nullable current/active
relations are present: `select_for_update()` across nullable joins can fail
with `FOR UPDATE cannot be applied to the nullable side of an outer join`.
Load related versions after acquiring the project lock. The receipt remains the
immutable audit record, and the applied-version foreign key makes the result
deterministically inspectable.

Confirmed 2026-09-15 in #544: migration `scenes.0065_sync_receipt_applied_scene_version`,
focused backend tests, full `make check`, and authenticated Chromium evidence
at 1280x900 and 375x812 all passed on a disposable local PostgreSQL stack.
