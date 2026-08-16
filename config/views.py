"""Bootstrap-only views.

No product behaviour lives here yet — this exists so a fresh checkout has
something the test suite can exercise end-to-end (settings load, URL
routing works, a request returns 200).
"""

import logging

from django.db import connections
from django.db.utils import OperationalError
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def database_is_available(using: str = "default") -> bool:
    """Return whether the given database alias accepts a connection.

    Only a boolean is exposed to callers (and, ultimately, to the `health`
    response) — the underlying exception may include the host, port, or
    other connection details and must never leak into an HTTP response.
    """
    try:
        connections[using].ensure_connection()
    except OperationalError:
        logger.exception("Database '%s' health check failed", using)
        return False
    return True


def health(request):
    """Report application and database availability, without connection details."""
    db_ok = database_is_available()
    return JsonResponse(
        {
            "status": "ok" if db_ok else "error",
            "database": "ok" if db_ok else "unavailable",
        },
        status=200 if db_ok else 503,
    )
