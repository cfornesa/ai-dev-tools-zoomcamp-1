---
name: postgres-multi-db-test-pitfalls
description: Three distinct pitfalls that broke the POSTGRES_TEST_DATABASE_URL-gated test category (issue #138); fix patterns for each.
metadata:
  type: project
---

Fixed 2026-08-23 (task 107, issue #138). `uv run --env-file .env pytest`
with `POSTGRES_TEST_DATABASE_URL` set had apparently never run to
completion before this session — three independent, latent bugs, none
reachable via `make check`/CI since that variable is never set there.

## 1. `RunPython` data migrations must pin the alias explicitly

`scenes/migrations/0010_seed_builtin_templates.py`'s `seed_built_in_templates`
called `Template.objects.create(...)` with no `.using(...)`. Django's
migration executor runs a `RunPython` operation once per registered
database alias when a test suite has more than one alias in `DATABASES`
(e.g. `default` + `postgres_test`), passing a `schema_editor` bound to
whichever alias is being migrated — but a manager call with no explicit
alias always resolves through `router.db_for_write()`, which with no
custom router configured is always `"default"`, regardless of which
alias's migration is actually running. Net effect: migrating the
`postgres_test` alias silently wrote the seed data a *second* time into
`default`, doubling row counts there and breaking totally unrelated
SQLite-only tests. Fix: `Template.objects.using(schema_editor.connection.alias).create(...)`
in both the forward and reverse `RunPython` functions. Any future data
migration in this repo needs the same `.using(schema_editor.connection.alias)`
discipline the moment a second database alias might be registered during
migration (i.e., always, since test setup registers `postgres_test`
whenever the env var is set).

## 2. Threaded `postgres_test`-only concurrency tests need `default` aliased onto the same physical DB

`test_postgres_concurrent_*` tests in `test_ai_accept_proposal_api.py`,
`test_project_fork_api.py`, and `test_edit_session_draft_sync_api.py`
seed fixtures via `.using("postgres_test")` but then drive real
`APIClient` requests or call application helpers (`_upsert_draft`) that
never specify `.using(...)` anywhere in their own code — application code
correctly has no idea it's under test. Two different Django mechanisms
default to `"default"` in that case: unrouted ORM reads/writes, and
`transaction.atomic()` itself (no router hook exists for the alias an
`atomic()` block targets). A router alone cannot fix both. The working
pattern, in `tests/_postgres_routing.py`
(`route_default_to_postgres_test()`): physically swap
`connections.databases["default"]` to the same connection settings as
`"postgres_test"` for the duration (closing/reopening connections around
the swap), *plus* a permissive `allow_relation`-only router, because
Django's default `allow_relation` falls back to a literal
`obj1._state.db == obj2._state.db` string comparison that doesn't know
two different alias names can point at the identical physical database.
Every worker thread must close **both** `"default"` and `"postgres_test"`
connections in its `finally` (`close_thread_connections()`), or
pytest-django's post-test `DROP DATABASE` teardown intermittently fails
with "is being accessed by other users" from a leaked thread-local
connection under the swapped `"default"` alias.

## 3. Plain PL/pgSQL `RAISE EXCEPTION` maps to `ProgrammingError`, not `OperationalError`

The trigger-enforced invariant tests in `test_project_scene_version_models.py`
and `test_template_fork_provenance_models.py` asserted
`pytest.raises(OperationalError)` around statements meant to violate a
`scenes/migrations/0002_postgres_invariants.py` trigger. A bare `RAISE
EXCEPTION` in PL/pgSQL with no explicit `SQLSTATE` defaults to `P0001`
(`raise_exception`), which psycopg maps to `psycopg.errors.RaiseException`
— a subclass of `psycopg.ProgrammingError`, not `OperationalError`. Django
re-raises using the same class family, so this specific exception-type
assumption was simply wrong from day one for every trigger this repo
raises via plain `RAISE EXCEPTION`. Correct pattern: `pytest.raises(django.db.utils.ProgrammingError)`.
Only assign a trigger's `RAISE EXCEPTION` an explicit SQLSTATE (which
*would* map elsewhere, e.g. to `IntegrityError` under class 23) if that
mapping is deliberately wanted.

## Also required: raw hand-written `INSERT INTO scenes_project` fixtures

Both raw-SQL trigger tests above insert `scenes_project` rows directly
and must supply every `NOT NULL` column without a DB-level default —
currently `is_deleted`, `export_attribution`, and `tags` (jsonb, `'[]'`)
in addition to the columns already listed, or Postgres raises
`NotNullViolation` before the trigger under test is ever reached. Check
`\d scenes_project` against a real migrated database when adding new
`NOT NULL` model fields with only an application-level (not
`db_default`) default — Django never backfills a DB-level default for
those, so any raw SQL fixture elsewhere in the suite silently goes stale
the next time such a field is added.
