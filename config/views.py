"""Bootstrap-only views.

No product behaviour lives here yet — this exists so a fresh checkout has
something the test suite can exercise end-to-end (settings load, URL
routing works, a request returns 200).
"""

import logging

from django.db import connections
from django.db.utils import OperationalError
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie

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


@ensure_csrf_cookie
def whoami(request):
    """Minimal protected JSON route (Task 12/16): who, if anyone, is signed in.

    Returns 401 JSON rather than redirecting: a redirect can't be
    distinguished from a real 200 by `fetch()` without `redirect: 'manual'`
    gymnastics, and the frontend (Task 16) needs a plain status check to
    decide whether to show the gallery or a signed-out state.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required."}, status=401)
    return JsonResponse({"username": request.user.username, "email": request.user.email})
