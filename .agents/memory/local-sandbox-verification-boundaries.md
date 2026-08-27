# Local sandbox verification boundaries

The managed macOS Codex workspace may prevent the repository's subprocess and
localhost-socket tests from completing, even when the implementation is
correct. In this environment `make check` can fail in
`tests/test_startup_configuration.py` with launcher subprocess timeouts and in
`tests/test_git_safe_push.py` with `PermissionError: [Errno 1] Operation not
permitted` while binding `127.0.0.1`. The default uv cache may also be
read-only; use a task-scoped writable `UV_CACHE_DIR` for diagnostic runs.

Treat these as verification boundaries unless reproduced in an approved CI or
deployment environment. Do not weaken product code or tests to accommodate
the sandbox; rerun the full gate where subprocesses and loopback binds are
allowed.
