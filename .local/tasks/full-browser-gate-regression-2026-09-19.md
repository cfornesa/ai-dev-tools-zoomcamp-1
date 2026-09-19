# Full browser gate regression — current-revision fixture/slug isolation

## Status

`IN PROGRESS` — slug-collision repair is verified in the latest workflow run;
account-settings and stage-geometry follow-ups remain before terminal QA.

## Goal

Make the workflow-dispatch full browser acceptance gate reliable on the current revision by isolating the first failing fixture/setup failure and preventing repeated `unique_project_public_slug_per_owner` collisions from poisoning later tests.

## Entry point

`.github/workflows/ci.yml` → `Browser acceptance E2E` → `Run full browser acceptance suite`.

## Fixed fixture

Use the existing CI PostgreSQL service and deterministic Playwright fixture users. Reproduce with the current `main` revision and the full suite (`282` tests, one worker), preserving the existing disposable database and no shared/production data.

## Acceptance criteria

- [ ] A workflow-dispatch run of `npm run test:e2e` reaches a terminal result without the repeated `unique_project_public_slug_per_owner` collision family for generated `untitled-animation-*` projects.
- [ ] The first failing test, if any, is isolated with a stable fixture and a direct failure rather than a cascade of route/setup failures.
- [ ] The canonical slug behavior remains unchanged for explicit user slugs: collisions are rejected, and auto-generated slugs advance deterministically and safely under concurrent creation.
- [ ] The full browser run records exact counts and the failing spec/test names in the issue closure comment; no closed issue is reopened.
- [ ] Focused art-piece coverage remains green for regular, immersive, embed, editor, thumbnail, and offline six-engine paths after the fix.

## Verification

- `UV_CACHE_DIR=/tmp/codex-uv-cache NPM_CONFIG_CACHE=/tmp/codex-npm-cache make check`
- `make compose-preflight`
- `cd frontend && npx playwright test --list`
- `gh workflow run ci.yml --ref main`
- `gh run watch <run-id> --interval 15 --exit-status`
- `gh run view <run-id> --job <browser-job-id> --log`

## Current implementation evidence

- The repeated slug collision was root-caused to `_next_slug()` using the
  filtered default manager while soft-deleted rows remain protected by the
  database uniqueness constraint.
- `backend/scenes/canonical_piece_signals.py` now uses each model's
  `all_objects` manager for collision checks.
- `backend/tests/test_canonical_piece_slug_race.py` covers Project, Project3D,
  and ArtPiece replacement after soft deletion; the rebuilt disposable
  PostgreSQL container passes the focused suite (`7 passed`).
- The first full-browser failure is a separate stale assertion in #623:
  anonymous billing currently redirects to `/gallery?type=all`, not `/`.
- Workflow run `35418436064` confirmed the slug-collision family is gone:
  `236 passed`, `40 failed`, `6 skipped`, with no
  `unique_project_public_slug_per_owner` failures. The remaining failures are
  grouped under #624 (account-settings visibility and landing-route contract)
  and #625 (stage command geometry/overflow across browser surfaces).
- #623 is closed `QA: PASS`; its five billing scenarios passed in the same
  workflow run.

## Out of scope

- Reopening or editing closed #419/#596.
- Reworking art-piece route/card/engine functionality already covered by the closed #600–#620 batch.
- Any write to a shared development, production, Replit, or user database.

## Evidence boundary

The failed run was `35415331889` on commit `1958280`: backend, frontend, workflow validation, disposable published routing, and WebKit regression passed; the full browser suite reported `84 failed`, `189 passed`, and `3 did not run`, with PostgreSQL repeatedly reporting `unique_project_public_slug_per_owner` for owner `6` and `untitled-animation-30`.

## Routing hint

Complex implementation: backend/data-layer/test-fixture and concurrency behavior, with browser verification. Stage 2b implementation-complex; independent review and QA required before closure.
