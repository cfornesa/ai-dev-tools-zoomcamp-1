"""PostgreSQL-backed tests for `backend.views.database_is_available`.

These exercise the exact availability check the `/health/` endpoint uses,
against a real PostgreSQL server, for both a successful connection and a
connection failure. They opt in via the `POSTGRES_TEST_DATABASE_URL`
environment variable (see `backend/backend/test_settings.py`) and skip themselves
when it isn't set, so `uv run pytest` still passes offline on a clean
checkout without a real database. Set `POSTGRES_TEST_DATABASE_URL` to a
real `postgres://` URL (e.g. in `.env`) to exercise these against
PostgreSQL.

`django_db_blocker.unblock()` is used instead of `@pytest.mark.django_db`
so these only open a raw connection to check availability, without
pytest-django creating or migrating a test database for either alias —
required for the "broken" alias, which is unreachable by design.
"""

import pytest
from django.conf import settings

from backend.views import database_is_available

pytestmark = pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping PostgreSQL-backed tests.",
)


def test_database_is_available_true_for_reachable_postgres(django_db_blocker):
    """A real, reachable PostgreSQL connection reports available."""
    with django_db_blocker.unblock():
        assert database_is_available(using="postgres_test") is True


def test_database_is_available_false_for_unreachable_postgres(django_db_blocker):
    """A real, unreachable PostgreSQL connection reports unavailable, not an exception."""
    with django_db_blocker.unblock():
        assert database_is_available(using="postgres_test_broken") is False
