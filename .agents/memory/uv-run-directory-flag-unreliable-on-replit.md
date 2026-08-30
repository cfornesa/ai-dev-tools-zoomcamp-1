# `uv run --directory X` is unreliable on Replit's Autoscale runtime — use `(cd X && uv run ...)`

Task 217 (issue #249) moved the backend into `backend/` and converted every
backend-facing shell invocation to `uv run --directory "$backend_dir" python
manage.py ...`, on the assumption that `--directory` reliably changes the
subprocess's working directory before running the command (per `uv`'s own
documented behavior, and confirmed working during that task's own local
macOS testing and its Replit *build*-stage log, e.g. `manage.py check
--deploy` via `--directory` succeeded during the deployment build).

**It is not reliable at Replit *runtime*.** The published deployment's
startup logs showed:

```
Applying database migrations before starting Django
...
Applying scenes.0021_thumbnail3d... OK
/home/runner/workspace/.venv/bin/python3: can't open file '/home/runner/workspace/manage.py': [Errno 2] No such file or directory
Django exited before becoming healthy (status 2)
```

Two damning details: the python3 binary path is `/home/runner/workspace/.venv/`
— the *old*, pre-restructure root-level venv, which still physically exists
on the Replit container's disk because it's gitignored and a `git pull`
never removes untracked files (the same class of problem as `.env` not
following a `git mv`) — and `manage.py` was looked up relative to
`/home/runner/workspace`, not `backend/`, meaning the actual subprocess cwd
was never changed. Critically, the *first* `uv run --directory` call in the
same script (`migrate`) succeeded moments earlier with the identical
pattern, and a subsequent full rerun of the exact same script *also*
succeeded — this is intermittent, not deterministic, consistent with `uv`
falling back to a stale/cached environment resolution under some race or
first-invocation condition on this platform, rather than unconditionally
`cd`-ing before exec every time.

**Fix:** every backend shell invocation was converted from
`uv run --directory "$X" ...` to `(cd "$X" && uv run ...)` (or
`(cd "$X" && exec uv run ...)` for a backgrounded/piped long-running
process) across `scripts/start.sh`, `scripts/dev.sh`, `scripts/post-merge.sh`,
`scripts/smoke-local.sh`, and `.replit`'s `[deployment].build`. An explicit
shell `cd` unambiguously sets the process working directory before `uv` or
`python` ever runs, independent of `uv`'s own `--directory` semantics or any
version/platform quirk. This also caught a real latent bug in
`scripts/dev.sh`: a python `-c` heredoc that did `pathlib.Path('.env')`
(a relative path) relying on `--directory` for correctness would have
silently written the generated `DJANGO_SECRET_KEY` to the wrong file
(repo-root `.env`, not `backend/.env`) had `--directory` ever actually
worked as advertised in that context.

**How to apply:** never reach for `uv run --directory X <relative-arg>` in
this repo again, especially for anything that runs on Replit's Autoscale
deployment or interactive workspace runtime (not just local dev, where it
happened to work in this session's own testing). Always wrap in an explicit
`(cd "$X" && uv run ...)` subshell. If a stale root-level `.venv` is ever
suspected on a Replit workspace again (e.g. this exact "can't open file"
symptom recurring), it can only be confirmed/cleared from within that
workspace's own shell — it is invisible to a local `git status` or clone.
