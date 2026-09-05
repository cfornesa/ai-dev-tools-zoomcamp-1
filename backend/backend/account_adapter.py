"""Account policy for the V1 Google-only authentication flow."""

from allauth.account.adapter import DefaultAccountAdapter


class GoogleOnlyAccountAdapter(DefaultAccountAdapter):
    """Disable local password signup while retaining social-account signup."""

    def is_open_for_signup(self, request):
        return False
