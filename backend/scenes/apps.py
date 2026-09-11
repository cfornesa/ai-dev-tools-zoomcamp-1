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
        # the instant a real login establishes a Session -- the only
        # place a session_key first exists to key it by.
        # Issue #510: keep Scene.current_version in sync with the
        # Project.current_version mirror for call sites (AI-accept-proposal)
        # that change the latter directly and are out of this issue's scope
        # to modify -- see scene_current_version_sync's own docstring.
        from scenes import (
            account_identity_signals,  # noqa: F401
            account_session_signals,  # noqa: F401
            scene_current_version_sync,  # noqa: F401
        )
