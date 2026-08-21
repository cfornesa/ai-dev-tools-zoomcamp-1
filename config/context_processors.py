from django.conf import settings


def recaptcha(request):
    """Expose only the public signup key and harmless verification metadata."""
    return {
        "recaptcha_site_key": settings.RECAPTCHA_SITE_KEY if settings.RECAPTCHA_ENABLED else "",
        "recaptcha_action": settings.RECAPTCHA_ACTION,
    }