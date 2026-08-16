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

This module is only referenced by `DJANGO_SETTINGS_MODULE` in
`pyproject.toml`'s pytest configuration. The fail-fast behaviour itself is
tested directly against `config.settings` in `tests/test_env_config.py`.
"""

import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("DJANGO_DEBUG", "True")
os.environ.setdefault("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
os.environ.setdefault("POSTGRES_DB", "gesture_studio_test")
os.environ.setdefault("POSTGRES_USER", "gesture_studio_test")
os.environ.setdefault("POSTGRES_PASSWORD", "test-password-not-for-production")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")

from config.settings import *  # noqa: E402,F401,F403
