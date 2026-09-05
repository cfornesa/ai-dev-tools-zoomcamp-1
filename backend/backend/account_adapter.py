"""Account policy for the social-only (Google/GitHub) authentication flow."""

from allauth.account.adapter import DefaultAccountAdapter


class SocialOnlySignupAccountAdapter(DefaultAccountAdapter):
    """Disable local password signup while retaining social-account signup."""

    def is_open_for_signup(self, request):
        return False
