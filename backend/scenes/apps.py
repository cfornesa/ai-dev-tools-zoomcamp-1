from django.apps import AppConfig


class ScenesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "scenes"

    def ready(self):
        # Issue #426: audit a successful account-identity link the
        # instant allauth's own real "connect" OAuth flow completes one --
        # the only path that ever creates a SocialAccount row in this app
        # (there is no separate "link" API endpoint to hook instead).
        # Issue #441: record session metadata (user agent, created_at)
        # the instant a real login establishes a Django session -- the
        # only place a session_key first exists to key it by.
        from scenes import (
            account_identity_signals,  # noqa: F401
            account_session_signals,  # noqa: F401
        )
