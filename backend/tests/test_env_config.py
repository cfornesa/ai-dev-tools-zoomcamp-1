"""Tests for environment-variable-driven Django settings (issue #2, Task 3).

These exercise `backend/backend/settings.py` directly by re-importing it under a
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
    "DATABASE_URL",
]

# All variables backend/backend/settings.py and backend/backend/test_settings.py look at,
# required or not. Cleared before every reload so leftovers from
# backend.test_settings' os.environ.setdefault() (or a previous test in
# this file) can't leak into the next case.
ALL_SETTINGS_ENV_VARS = REQUIRED_ENV_VARS + [
    "DJANGO_DEBUG",
    "DJANGO_ALLOWED_HOSTS",
    "CSRF_TRUSTED_ORIGINS",
    "DJANGO_SECURE_SSL_REDIRECT",
    "DJANGO_SESSION_COOKIE_SECURE",
    "DJANGO_CSRF_COOKIE_SECURE",
    "DJANGO_SECURE_HSTS_SECONDS",
    "DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS",
    "DJANGO_SECURE_HSTS_PRELOAD",
    "EMAIL_BACKEND",
    "EMAIL_PORT",
    "GITHUB_OAUTH_CLIENT_ID",
    "GITHUB_OAUTH_CLIENT_SECRET",
    "ADMIN_IDENTITIES",
]

VALID_ENV = {
    "DJANGO_SECRET_KEY": "example-derived-secret-key",
    "DJANGO_DEBUG": "True",
    "DJANGO_ALLOWED_HOSTS": "localhost,127.0.0.1",
    "CSRF_TRUSTED_ORIGINS": "https://animate.creatrweb.com, http://localhost:8000/",
    "DATABASE_URL": "postgres://gesture_studio:changeme@localhost:5432/gesture_studio",
}


def _reload_settings(monkeypatch, env, remove=()):
    """Re-import backend.settings under a fresh environment.

    Restores whatever module object was previously registered under
    `backend.settings` in sys.modules afterwards, so this never disturbs
    the real `django.conf.settings` singleton used by the rest of the
    suite (it holds its own reference to the module it originally
    imported, independent of sys.modules).
    """
    original_module = sys.modules.get("backend.settings")

    for key in ALL_SETTINGS_ENV_VARS:
        monkeypatch.delenv(key, raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    for key in remove:
        monkeypatch.delenv(key, raising=False)

    sys.modules.pop("backend.settings", None)
    try:
        return importlib.import_module("backend.settings")
    finally:
        if original_module is not None:
            sys.modules["backend.settings"] = original_module
        else:
            sys.modules.pop("backend.settings", None)


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
    assert settings_module.CSRF_TRUSTED_ORIGINS == [
        "https://animate.creatrweb.com",
        "http://localhost:8000",
        "https://animate.creatrweb.com",
        "https://creatrweb.replit.app",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
    ]
    assert settings_module.SECURE_PROXY_SSL_HEADER == ("HTTP_X_FORWARDED_PROTO", "https")
    assert settings_module.USE_X_FORWARDED_HOST is True
    assert settings_module.DATABASES["default"] == {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "gesture_studio",
        "USER": "gesture_studio",
        "PASSWORD": "changeme",
        "HOST": "localhost",
        "PORT": "5432",
    }


def test_optional_debug_defaults_to_false_when_unset(monkeypatch):
    """DJANGO_DEBUG is optional and defaults to False (safe default)."""
    env = dict(VALID_ENV)
    del env["DJANGO_DEBUG"]

    settings_module = _reload_settings(monkeypatch, env)

    assert settings_module.DEBUG is False


def test_production_defaults_enable_reviewed_security_and_delivery(monkeypatch):
    env = dict(VALID_ENV)
    env["DJANGO_DEBUG"] = "False"

    settings_module = _reload_settings(monkeypatch, env)

    assert settings_module.SECURE_SSL_REDIRECT is True
    assert settings_module.SESSION_COOKIE_SECURE is True
    assert settings_module.CSRF_COOKIE_SECURE is True
    assert settings_module.SECURE_HSTS_SECONDS == 31536000
    assert settings_module.SECURE_HSTS_INCLUDE_SUBDOMAINS is True
    assert settings_module.EMAIL_BACKEND.endswith("smtp.EmailBackend")
    assert settings_module.CACHES["default"]["BACKEND"] == (
        "backend.database_cache.AtomicDatabaseCache"
    )
    assert settings_module.CACHES["default"]["LOCATION"] == "django_cache"


def test_production_rejects_wildcard_hosts(monkeypatch):
    env = dict(VALID_ENV)
    env.update(DJANGO_DEBUG="False", DJANGO_ALLOWED_HOSTS="*")

    with pytest.raises(ImproperlyConfigured, match="wildcards"):
        _reload_settings(monkeypatch, env)


def test_production_rejects_insecure_cookie_override(monkeypatch):
    env = dict(VALID_ENV)
    env.update(DJANGO_DEBUG="False", DJANGO_CSRF_COOKIE_SECURE="False")

    with pytest.raises(ImproperlyConfigured, match="secure session and CSRF"):
        _reload_settings(monkeypatch, env)


def test_optional_allowed_hosts_defaults_when_unset(monkeypatch):
    """DJANGO_ALLOWED_HOSTS is optional and defaults to localhost hosts."""
    env = dict(VALID_ENV)
    del env["DJANGO_ALLOWED_HOSTS"]

    settings_module = _reload_settings(monkeypatch, env)

    assert settings_module.ALLOWED_HOSTS == ["localhost", "127.0.0.1"]


def test_default_csrf_origins_allow_vite_browser_requests(monkeypatch):
    """Local browser traffic reaches Django through Vite rather than port 8000."""
    env = dict(VALID_ENV)
    del env["CSRF_TRUSTED_ORIGINS"]

    settings_module = _reload_settings(monkeypatch, env)

    assert "http://localhost:5000" in settings_module.CSRF_TRUSTED_ORIGINS
    assert "http://127.0.0.1:5000" in settings_module.CSRF_TRUSTED_ORIGINS


@pytest.mark.parametrize(
    "invalid_origin",
    ["animate.creatrweb.com", "*", "https://animate.creatrweb.com/path", "ftp://example.com"],
)
def test_csrf_trusted_origins_rejects_non_origins(monkeypatch, invalid_origin):
    env = dict(VALID_ENV)
    env["CSRF_TRUSTED_ORIGINS"] = invalid_origin

    with pytest.raises(ImproperlyConfigured, match="CSRF_TRUSTED_ORIGINS"):
        _reload_settings(monkeypatch, env)


@pytest.mark.parametrize(
    "bad_url,expected_message",
    [
        ("mysql://user:pass@localhost:3306/db", "postgres://' or 'postgresql://'"),
        ("not-a-url-at-all", "postgres://' or 'postgresql://'"),
        ("postgres:///missing-host", "missing a hostname"),
        ("postgres://user:pass@localhost:5432/", "missing a database name"),
    ],
)
def test_malformed_database_url_raises_clear_error(monkeypatch, bad_url, expected_message):
    """A malformed DATABASE_URL fails fast with a message naming the problem."""
    env = dict(VALID_ENV)
    env["DATABASE_URL"] = bad_url

    with pytest.raises(ImproperlyConfigured) as exc_info:
        _reload_settings(monkeypatch, env)

    assert expected_message in str(exc_info.value)


def test_github_oauth_disabled_by_default_when_unset(monkeypatch):
    """GitHub sign-in (issue #420) is off unless explicitly configured."""
    settings_module = _reload_settings(monkeypatch, VALID_ENV)

    assert settings_module.GITHUB_OAUTH_ENABLED is False
    assert "github" not in settings_module.SOCIALACCOUNT_PROVIDERS


def test_github_oauth_enabled_when_both_variables_set(monkeypatch):
    env = dict(VALID_ENV)
    env["GITHUB_OAUTH_CLIENT_ID"] = "test-github-client-id"
    env["GITHUB_OAUTH_CLIENT_SECRET"] = "test-github-client-secret"

    settings_module = _reload_settings(monkeypatch, env)

    assert settings_module.GITHUB_OAUTH_ENABLED is True
    assert settings_module.SOCIALACCOUNT_PROVIDERS["github"]["APP"]["client_id"] == (
        "test-github-client-id"
    )
    assert settings_module.SOCIALACCOUNT_PROVIDERS["github"]["APP"]["secret"] == (
        "test-github-client-secret"
    )


@pytest.mark.parametrize(
    "partial_env",
    [
        {"GITHUB_OAUTH_CLIENT_ID": "only-the-id-set"},
        {"GITHUB_OAUTH_CLIENT_SECRET": "only-the-secret-set"},
    ],
)
def test_github_oauth_partial_config_raises_clear_error(monkeypatch, partial_env):
    """Setting only one of the two GitHub variables is a startup config error."""
    env = dict(VALID_ENV)
    env.update(partial_env)

    with pytest.raises(ImproperlyConfigured, match="GITHUB_OAUTH_CLIENT_ID"):
        _reload_settings(monkeypatch, env)


def test_admin_identities_empty_by_default(monkeypatch):
    """ADMIN_IDENTITIES (issue #421) is optional and grants nobody by default."""
    settings_module = _reload_settings(monkeypatch, VALID_ENV)

    assert settings_module.ADMIN_IDENTITIES == frozenset()


def test_admin_identities_parses_normalized_email_and_username(monkeypatch):
    env = dict(VALID_ENV)
    env["ADMIN_IDENTITIES"] = " email:Owner@Example.com , username:site-admin ,,"

    settings_module = _reload_settings(monkeypatch, env)

    assert settings_module.ADMIN_IDENTITIES == frozenset(
        {("email", "owner@example.com"), ("username", "site-admin")}
    )


@pytest.mark.parametrize(
    "malformed",
    [
        "not-a-valid-entry",
        "email:",
        "username:",
        "phone:5551234567",
        "email:valid@example.com,not-a-valid-entry",
    ],
)
def test_admin_identities_rejects_malformed_entries(monkeypatch, malformed):
    env = dict(VALID_ENV)
    env["ADMIN_IDENTITIES"] = malformed

    with pytest.raises(ImproperlyConfigured, match="ADMIN_IDENTITIES entry"):
        _reload_settings(monkeypatch, env)
