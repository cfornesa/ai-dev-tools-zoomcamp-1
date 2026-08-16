"""Tests for environment-variable-driven Django settings (issue #2).

These exercise `config/settings.py` directly by re-importing it under a
controlled environment, rather than through the already-configured
`django.conf.settings` singleton (which is set up once per process by
pytest-django and must not be disturbed for other tests). No real
PostgreSQL server or network access is used or required.
"""

import importlib
import sys

import pytest
from django.core.exceptions import ImproperlyConfigured

REQUIRED_ENV_VARS = [
    "DJANGO_SECRET_KEY",
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_HOST",
    "POSTGRES_PORT",
]

# All variables config/settings.py and config/test_settings.py look at,
# required or not. Cleared before every reload so leftovers from
# config.test_settings' os.environ.setdefault() (or a previous test in
# this file) can't leak into the next case.
ALL_SETTINGS_ENV_VARS = REQUIRED_ENV_VARS + [
    "DJANGO_DEBUG",
    "DJANGO_ALLOWED_HOSTS",
]

VALID_ENV = {
    "DJANGO_SECRET_KEY": "example-derived-secret-key",
    "DJANGO_DEBUG": "True",
    "DJANGO_ALLOWED_HOSTS": "localhost,127.0.0.1",
    "POSTGRES_DB": "gesture_studio",
    "POSTGRES_USER": "gesture_studio",
    "POSTGRES_PASSWORD": "changeme",
    "POSTGRES_HOST": "localhost",
    "POSTGRES_PORT": "5432",
}


def _reload_settings(monkeypatch, env, remove=()):
    """Re-import config.settings under a fresh environment.

    Restores whatever module object was previously registered under
    `config.settings` in sys.modules afterwards, so this never disturbs
    the real `django.conf.settings` singleton used by the rest of the
    suite (it holds its own reference to the module it originally
    imported, independent of sys.modules).
    """
    original_module = sys.modules.get("config.settings")

    for key in ALL_SETTINGS_ENV_VARS:
        monkeypatch.delenv(key, raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    for key in remove:
        monkeypatch.delenv(key, raising=False)

    sys.modules.pop("config.settings", None)
    try:
        return importlib.import_module("config.settings")
    finally:
        if original_module is not None:
            sys.modules["config.settings"] = original_module
        else:
            sys.modules.pop("config.settings", None)


@pytest.mark.parametrize("missing_var", REQUIRED_ENV_VARS)
def test_missing_required_env_var_raises_clear_error(monkeypatch, missing_var):
    """A missing required variable fails fast, naming the variable."""
    with pytest.raises(ImproperlyConfigured) as exc_info:
        _reload_settings(monkeypatch, VALID_ENV, remove=[missing_var])

    assert missing_var in str(exc_info.value)


def test_valid_example_derived_env_loads_settings(monkeypatch):
    """Values shaped like `.env.example` let settings load successfully."""
    settings_module = _reload_settings(monkeypatch, VALID_ENV)

    assert settings_module.SECRET_KEY == VALID_ENV["DJANGO_SECRET_KEY"]
    assert settings_module.DEBUG is True
    assert settings_module.ALLOWED_HOSTS == ["localhost", "127.0.0.1"]
    assert settings_module.POSTGRES_DB == VALID_ENV["POSTGRES_DB"]
    assert settings_module.POSTGRES_USER == VALID_ENV["POSTGRES_USER"]
    assert settings_module.POSTGRES_PASSWORD == VALID_ENV["POSTGRES_PASSWORD"]
    assert settings_module.POSTGRES_HOST == VALID_ENV["POSTGRES_HOST"]
    assert settings_module.POSTGRES_PORT == VALID_ENV["POSTGRES_PORT"]


def test_optional_debug_defaults_to_false_when_unset(monkeypatch):
    """DJANGO_DEBUG is optional and defaults to False (safe default)."""
    env = dict(VALID_ENV)
    del env["DJANGO_DEBUG"]

    settings_module = _reload_settings(monkeypatch, env)

    assert settings_module.DEBUG is False


def test_optional_allowed_hosts_defaults_when_unset(monkeypatch):
    """DJANGO_ALLOWED_HOSTS is optional and defaults to localhost hosts."""
    env = dict(VALID_ENV)
    del env["DJANGO_ALLOWED_HOSTS"]

    settings_module = _reload_settings(monkeypatch, env)

    assert settings_module.ALLOWED_HOSTS == ["localhost", "127.0.0.1"]
