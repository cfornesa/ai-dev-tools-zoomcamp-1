"""Records SessionMetadata the instant a real login establishes a Django
session (issue #441). Connected in `scenes.apps.ScenesConfig.ready`.
"""

from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver

from scenes.models import SessionMetadata


@receiver(user_logged_in)
def _record_session_metadata(sender, request, user, **kwargs):
    if not hasattr(request, "session") or not request.session.session_key:
        # Django only assigns a session_key once something has been
        # written to the session; force that now so this row can be
        # keyed by the same session_key the cookie will carry.
        request.session.save()
    SessionMetadata.objects.update_or_create(
        session_key=request.session.session_key,
        defaults={
            "user": user,
            "user_agent": request.META.get("HTTP_USER_AGENT", "")[:255],
        },
    )
