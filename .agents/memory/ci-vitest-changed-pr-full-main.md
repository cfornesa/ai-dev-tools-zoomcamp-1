# Vitest changed-test PR path and full-main gate

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
