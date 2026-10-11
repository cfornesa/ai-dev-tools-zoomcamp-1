# Vitest changed-test PR path and full-main gate

## Observed behavior correction (2026-10-11; one run; see #1350)

The text below states the **intended** design. In CI run 38114346743 (PR #1348, exact head `aef8b228`, event `pull_request`) the "Test (vitest)" step logged `> vitest run && npm run test:ratchet --changed <base-sha> --passWithNoTests` and Vitest reported `Test Files 326 passed (326)`. `npm test -- --changed ...` appends the extra arguments to the end of the `test` script (`vitest run && npm run test:ratchet`), so they reached the ratchet script and Vitest ran the whole suite. This is one observed run; whether earlier PR runs behaved the same is unverified. Until [#1350](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1350) decides the intended behavior, do not describe PR Vitest as changed-only (PR bodies and QA notes included), and do not treat a PR Vitest pass as a changed-only slice.

The frontend Vitest suite is large enough that running every test on every
pull request delays feedback. CI therefore uses Vitest's dependency-aware
`--changed <pull-request-base-sha>` selection on pull requests, with a full
history checkout and `--passWithNoTests` for documentation-only changes.

This is a feedback optimization, not a coverage deletion. Pushes to `main`,
manual workflow dispatches, and release validation continue to run the
unsliced `npm test` suite. A PR that changes shared runtime, schema, or route
code still receives the tests Vitest can trace from the changed module, while
the post-merge full gate remains authoritative.

Do not replace the full-main gate with changed-test selection, and do not use
parallel Vitest shards without measuring resource contention: the 2026-09-19
local two-shard experiment took about 177 seconds and introduced editor-test
timeouts under concurrent load.
