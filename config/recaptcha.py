"""Server-side reCAPTCHA v3 verification for local account signup."""

import requests
from django.conf import settings


def verify_signup_token(token: str, remote_ip: str | None = None) -> tuple[bool, str]:
    """Verify a token without logging its value or Google's response."""
    if not token:
        return False, "Please complete the security check and try again."
    try:
        payload = {"secret": settings.RECAPTCHA_SECRET_KEY, "response": token}
        if remote_ip:
            payload["remoteip"] = remote_ip
        response = requests.post(
            settings.RECAPTCHA_VERIFY_URL,
            data=payload,
            timeout=settings.RECAPTCHA_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        result = response.json()
    except (requests.RequestException, ValueError):
        return False, "The security check is temporarily unavailable. Please try again."

    if not isinstance(result, dict):
        return False, "The security check is temporarily unavailable. Please try again."
    if not result.get("success"):
        return False, "The security check did not pass. Please try again."
    if result.get("action") != settings.RECAPTCHA_ACTION:
        return False, "The security check was not valid for this form."
    try:
        score = float(result.get("score", 0))
    except (TypeError, ValueError):
        return False, "The security check did not pass. Please try again."
    if score < settings.RECAPTCHA_MIN_SCORE:
        return False, "The security check did not pass. Please try again."
    hostname = result.get("hostname")
    if hostname not in settings.RECAPTCHA_ALLOWED_HOSTNAMES:
        return False, "The security check was not valid for this site."
    return True, ""
