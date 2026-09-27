"""Account-level cloud-sync preference endpoints (#940)."""

from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.admin_settings import get_site_settings
from scenes.cloud_backup import pause_inherited_backups
from scenes.entitlements import resolve_effective_capabilities
from scenes.models import CloudSyncPreference, CloudSyncSignupConsent

CONSENT_VERSION = "cloud-sync-account-v1"
CONSENT_TEXT = (
    "Pieces that currently live only in this browser may be uploaded when you explicitly offer "
    "them for sync. Uploads cross the network over TLS and are not end-to-end encrypted. "
    "Disabling sync pauses inherited sync and retains remote copies read-only for 30 days; "
    "you can revoke this preference from Account settings."
)


def _eligibility(user) -> dict[str, object]:
    if not get_site_settings().cloud_sync_enabled:
        return {"eligible": False, "reason": "site disabled", "source": "global"}
    capability = resolve_effective_capabilities(user)["cloud_project_sync"]
    available = bool(capability["available"])
    source = str(capability["source"])
    if available:
        return {"eligible": True, "reason": None, "source": source}
    reason = {
        "global": "site disabled",
        "plan": "plan lacks sync",
    }.get(source, "not eligible")
    return {"eligible": False, "reason": reason, "source": source}


class AccountCloudSyncView(APIView):
    def get(self, request):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED
            )
        eligibility = _eligibility(request.user)
        preference = CloudSyncPreference.objects.filter(owner=request.user).first()
        signup = CloudSyncSignupConsent.objects.filter(owner=request.user).first()
        return Response(
            {
                **eligibility,
                "enabled": bool(preference and preference.enabled and eligibility["eligible"]),
                "signup_preselected": bool(signup and signup.sync_enabled),
                "consent_version": CONSENT_VERSION,
                "consent_text": CONSENT_TEXT,
                "existing_local_pieces_offered_by": "#943",
                "retention_days_after_disable": 30,
            }
        )

    def put(self, request):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED
            )
        enabled = request.data.get("enabled")
        if not isinstance(enabled, bool):
            return Response(
                {"detail": "enabled must be a boolean."}, status=status.HTTP_400_BAD_REQUEST
            )
        eligibility = _eligibility(request.user)
        if enabled and not eligibility["eligible"]:
            return Response(
                {"detail": f"Cloud sync is unavailable: {eligibility['reason']}.", **eligibility},
                status=status.HTTP_403_FORBIDDEN,
            )
        if enabled:
            if request.data.get("consent_version") != CONSENT_VERSION or not request.data.get(
                "consent_text"
            ):
                return Response(
                    {"detail": "Current cloud-sync consent is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        preference, _ = CloudSyncPreference.objects.get_or_create(owner=request.user)
        preference.enabled = enabled
        if enabled:
            preference.consent_version = CONSENT_VERSION
            preference.consent_text = CONSENT_TEXT
            preference.consented_at = timezone.now()
        preference.save()
        paused_inherited = pause_inherited_backups(request.user) if not enabled else 0
        return Response(
            {
                **eligibility,
                "enabled": enabled,
                "signup_preselected": False,
                "consent_version": CONSENT_VERSION,
                "consent_text": CONSENT_TEXT,
                "existing_local_pieces_offered_by": "#943",
                "retention_days_after_disable": 30,
                "paused_inherited_backups": paused_inherited,
            }
        )
