# Task 107 / issue #138, Finding 2: `test_postgres_concurrent_*` tests seed
# fixtures on the `postgres_test` alias directly (`Project.objects.using(
# "postgres_test").create(...)`) but then drive real HTTP requests through
# `APIClient`, or call application helpers like `_upsert_draft`, none of
# which specify `.using(...)` anywhere in their own code. Two different
# things default to the SQLite `"default"` alias in that case: unrouted
# ORM reads/writes (`router.db_for_read`/`db_for_write`, which resolve to
# `"default"` with no routers configured), *and* `transaction.atomic()`
# itself, which always targets `"default"` unless told otherwise -- a
# database router has no hook for that second one, so a router alone
# cannot fix this (still raises "select_for_update cannot be used outside
# of a transaction" once the reads are routed correctly but the
# surrounding atomic() block is still opened against the empty `default`).
#
# `route_default_to_postgres_test()` makes the `"default"` alias
# *physically be* the same PostgreSQL connection as `"postgres_test"` for
# its duration, by swapping `connections.databases["default"]`. Every
# unrouted read, write, and `transaction.atomic()` block then genuinely
# targets the database the fixtures were created on. `connections.databases`
# is a plain dict on the process-wide `connections` singleton (not
# thread-local), so this is visible to every worker thread these tests
# spawn, including ones that open their `"default"` connection only after
# the swap.
#
# That swap alone still isn't enough: fixtures were created via `.using(
# "postgres_test")`, so their `instance._state.db` is the string
# `"postgres_test"`, while a freshly constructed, not-yet-saved object
# (e.g. `SceneVersion.objects.create(project=forked_project, ...)`) has
# `_state.db is None`. Assigning one to the other as a foreign key calls
# `router.allow_relation(obj1, obj2)`, whose *default* behavior with no
# routers configured is `obj1._state.db == obj2._state.db` -- a plain
# string comparison, unaware that both aliases now point at the identical
# physical database, so it raises `ValueError: ... the current database
# router prevents this relation`. A permissive router that always allows
# the relation (matching Django's own recommended pattern of returning
# `True` from `allow_relation` for co-located databases) is needed
# alongside the physical swap.
from contextlib import contextmanager

from django.db import connections
from django.test import override_settings


class _AllowAllRelations:
    def allow_relation(self, obj1, obj2, **hints):
        return True


def close_thread_connections():
    """Close both aliases' connections for the calling thread.

    Call this from each worker thread's `finally` block. While
    `route_default_to_postgres_test()` is active, a thread's request may
    have opened a `"default"` connection (now aliased to the same physical
    database as `"postgres_test"`) in addition to any explicit
    `"postgres_test"` one; leaving either open past the thread's lifetime
    keeps a session open against the test database, which then fails
    pytest-django's `DROP DATABASE` teardown with "is being accessed by
    other users".
    """
    connections["default"].close()
    connections["postgres_test"].close()


@contextmanager
def route_default_to_postgres_test():
    original = connections.databases["default"]
    connections["default"].close()
    connections.databases["default"] = dict(connections.databases["postgres_test"])
    try:
        with override_settings(DATABASE_ROUTERS=[_AllowAllRelations()]):
            yield
    finally:
        connections["default"].close()
        connections.databases["default"] = original
