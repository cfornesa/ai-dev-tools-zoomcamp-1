"""Social-login policy for the Google-only V1 signup flow."""

from allauth.socialaccount.adapter import DefaultSocialAccountAdapter


class GoogleSocialAccountAdapter(DefaultSocialAccountAdapter):
    """Allow verified Google identities to create their first local account."""

    def is_open_for_signup(self, request, sociallogin):
        # Local email/password signup is intentionally closed by the account
        # adapter. Google is the supported account-creation path in V1.
        return True
