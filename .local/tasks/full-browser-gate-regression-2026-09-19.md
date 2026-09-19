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
- Discovery gate: #626 records the missing bounded execution contract found
  while run `35420287899` remained live beyond the previous terminal duration;
  its local record is `.local/tasks/full-browser-timeout-2026-09-19.md`.
- Terminal run `35420287899` completed with `243 passed`, `33 failed`, and
  `6 skipped`. The slug collision family remained absent. Residual failures
  are now split across #624 (account/admin route and settings contracts),
  #625 (stage card overflow), #627 (generated art-piece previews/runtime),
  and #628 (admin settings/profile-style/theme feedback).
- Terminal run `35422220437` on `522b978` completed with `259 passed`, `17
  failed`, and `6 skipped` in 32.6 minutes. The earlier stage-geometry and
  profile-style failures are no longer present; remaining failures are in
  #624/#627 plus AI recovery, live media-transfer 409s, and profile-handle
  fixture leakage.
- New duplicate-checked issues: [#629](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/629)
  for live media-transfer fixture conflicts and [#630](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/630)
  for profile-handle state leakage.
- Terminal run `35423929110` on `5042278` completed with `258 passed`, `18
  failed`, and `6 skipped` in 31.2 minutes. The route expectation changes in
  this commit were directionally wrong for protected admin routes: the app's
  current contract is `/studio`, so those assertions are restored before the
  next run. The remaining new test-state fixes are intentionally staged for
  the next verification.

## Out of scope

- Reopening or editing closed #419/#596.
- Reworking art-piece route/card/engine functionality already covered by the closed #600–#620 batch.
- Any write to a shared development, production, Replit, or user database.

## Evidence boundary

The failed run was `35415331889` on commit `1958280`: backend, frontend, workflow validation, disposable published routing, and WebKit regression passed; the full browser suite reported `84 failed`, `189 passed`, and `3 did not run`, with PostgreSQL repeatedly reporting `unique_project_public_slug_per_owner` for owner `6` and `untitled-animation-30`.

## Routing hint

Complex implementation: backend/data-layer/test-fixture and concurrency behavior, with browser verification. Stage 2b implementation-complex; independent review and QA required before closure.
