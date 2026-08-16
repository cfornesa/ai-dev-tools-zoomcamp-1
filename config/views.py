"""Bootstrap-only views.

No product behaviour lives here yet — this exists so a fresh checkout has
something the test suite can exercise end-to-end (settings load, URL
routing works, a request returns 200).
"""

from django.http import JsonResponse


def health(request):
    """Trivial placeholder endpoint. Not a product feature."""
    return JsonResponse({"status": "ok"})
