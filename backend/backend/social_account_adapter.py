"""Social-login policy shared by every configured provider (Google, GitHub)."""

from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialLogin
from django.contrib.auth import get_user_model
from django.http import HttpRequest
from django.shortcuts import render


class LinkedProvidersSocialAccountAdapter(DefaultSocialAccountAdapter):
    """Allow verified social identities to create their first local account."""

    def is_open_for_signup(self, request, sociallogin):
        # Local email/password signup is intentionally closed by the account
        # adapter. Google/GitHub are the supported account-creation paths.
        return True

    def pre_social_login(self, request: HttpRequest, sociallogin: SocialLogin) -> None:
        # Issue #420: a brand-new provider identity (this exact provider +
        # uid has never signed in before) whose email matches an existing
        # user must never be silently auto-linked -- the email came from a
        # third-party provider and may not actually belong to whoever
        # controls it there, and explicit, user-initiated account linking
        # is #426's job, not this hook's. Fail closed with an actionable
        # page instead of letting allauth's default signup-form redirect
        # (or, worse, a duplicate-account integrity error) happen.
        if sociallogin.is_existing:
            return
        email = None
        if sociallogin.email_addresses:
            email = sociallogin.email_addresses[0].email
        elif sociallogin.user.email:
            email = sociallogin.user.email
        if email and get_user_model().objects.filter(email__iexact=email).exists():
            response = render(
                request,
                "socialaccount/social_identity_conflict.html",
                {"provider": sociallogin.account.provider},
                status=409,
            )
            raise ImmediateHttpResponse(response)
