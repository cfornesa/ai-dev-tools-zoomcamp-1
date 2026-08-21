"""Django settings module used only by the test suite.

`config/settings.py` reads several required environment variables (see
`.env.example`) and raises `ImproperlyConfigured`, naming the missing
variable, if any are absent — by design, so a real deployment never
silently runs with a missing secret.

pytest-django imports `DJANGO_SETTINGS_MODULE` very early, before any
`conftest.py` has a chance to run, so env var defaults can't be injected
from a `conftest.py` in time for that import. This module supplies safe,
non-secret default values (via `os.environ.setdefault`, so a real `.env`
always takes priority) and then defers to `config.settings` for
everything else, so `uv run pytest` works offline on a clean checkout
without requiring a `.env` file.

`DATABASE_URL` is given a placeholder value purely so `config.settings`
parses successfully; the resulting PostgreSQL `DATABASES['default']` is
then overridden below with an explicit in-memory SQLite database, per
Task 3 ("an explicit test-only SQLite path for tests that do not rely on
PostgreSQL semantics"). Tests that specifically need PostgreSQL semantics
(see `tests/test_health.py`) opt in via the real `POSTGRES_TEST_DATABASE_URL`
environment variable and skip themselves when it isn't set, so `uv run
pytest` still works offline on a clean checkout without a real database.

This module is only referenced by `DJANGO_SETTINGS_MODULE` in
`pyproject.toml`'s pytest configuration. The fail-fast behaviour itself is
tested directly against `config.settings` in `tests/test_env_config.py`.
"""

import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("DJANGO_DEBUG", "True")
os.environ.setdefault("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
os.environ.setdefault(
    "DATABASE_URL", "postgres://placeholder:placeholder@localhost:5432/placeholder"
)
os.environ.setdefault(
    "GOOGLE_OAUTH_CLIENT_ID", "test-google-oauth-client-id.apps.googleusercontent.com"
)
os.environ.setdefault(
    "GOOGLE_OAUTH_CLIENT_SECRET", "test-google-oauth-client-secret-not-for-production"
)
os.environ.setdefault(
    "MISTRAL_CREDENTIAL_ENCRYPTION_KEY",
    "hDmcNCp7WCvpOjI3tmEd0-foRjnnjh_-OgVogBK30V4=",
)

from config.settings import *  # noqa: E402,F401,F403

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Optional PostgreSQL-backed test database (tests/test_health.py). Only
# configured when a real POSTGRES_TEST_DATABASE_URL is present in the
# environment; those tests skip themselves otherwise. "postgres_test_broken"
# reuses the same credentials against a port nothing listens on, so it
# fails fast with a connection-refused error rather than hanging.
_postgres_test_database_url = os.environ.get("POSTGRES_TEST_DATABASE_URL")
if _postgres_test_database_url:
    from config.database import parse_database_url as _parse_database_url

    DATABASES["postgres_test"] = _parse_database_url(_postgres_test_database_url)

    _postgres_test_broken = dict(DATABASES["postgres_test"])
    _postgres_test_broken["PORT"] = "1"
    DATABASES["postgres_test_broken"] = _postgres_test_broken
