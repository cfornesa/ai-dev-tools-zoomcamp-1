"""Parse Replit-supplied `DATABASE_URL` values into a Django DATABASES entry.

Replit injects `DATABASE_URL` for its managed PostgreSQL databases, scoped
separately per development and production environment (see AGENTS.md and
`_docs/plan.md`'s "Database deployment boundary" section) — Django does not
need to know which environment it is running in, only how to parse
whatever URL it is given.
"""

from urllib.parse import unquote, urlsplit

from django.core.exceptions import ImproperlyConfigured

_POSTGRES_SCHEMES = {"postgres", "postgresql"}


def parse_database_url(url: str) -> dict:
    """Return a Django DATABASES entry for a `postgres://` or `postgresql://` URL."""
    parts = urlsplit(url)

    if parts.scheme not in _POSTGRES_SCHEMES:
        raise ImproperlyConfigured(
            "DATABASE_URL must start with 'postgres://' or 'postgresql://', "
            f"got '{parts.scheme}://'."
        )
    if not parts.hostname:
        raise ImproperlyConfigured("DATABASE_URL is missing a hostname.")

    name = parts.path.lstrip("/")
    if not name:
        raise ImproperlyConfigured("DATABASE_URL is missing a database name.")

    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": name,
        "USER": unquote(parts.username) if parts.username else "",
        "PASSWORD": unquote(parts.password) if parts.password else "",
        "HOST": parts.hostname,
        "PORT": str(parts.port) if parts.port else "",
    }
