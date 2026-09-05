"""Parsing for the `ADMIN_IDENTITIES` environment variable (issue #421).

Kept free of any Django app-registry dependency (no model imports) so
`backend/backend/settings.py` can call `parse_admin_identities` while
settings are still loading, exactly like every other environment
variable this module validates at import time.
"""

from django.core.exceptions import ImproperlyConfigured

_VALID_PREFIXES = ("email", "username")


def parse_admin_identities(raw: str) -> frozenset[tuple[str, str]]:
    """Parse a comma-separated `prefix:value` list into normalized
    `(kind, value)` pairs, where `kind` is `"email"` or `"username"`.

    Empty entries (a leading/trailing/doubled comma) are ignored. Any
    other malformed shape -- a missing prefix, an unrecognized prefix, or
    an empty value -- is a startup configuration error. The error message
    only ever names the 1-based position of the bad entry, never its
    contents, since a malformed entry may still contain a real email
    address that should not end up in a startup log.
    """
    identities: set[tuple[str, str]] = set()
    entries = [entry.strip() for entry in raw.split(",")]
    entries = [entry for entry in entries if entry]
    for position, entry in enumerate(entries, start=1):
        prefix, sep, value = entry.partition(":")
        value = value.strip()
        if not sep or prefix not in _VALID_PREFIXES or not value:
            raise ImproperlyConfigured(
                f"ADMIN_IDENTITIES entry {position} is malformed. Each entry must "
                "be 'email:<address>' or 'username:<name>', comma-separated."
            )
        identities.add((prefix, value.lower() if prefix == "email" else value))
    return frozenset(identities)
