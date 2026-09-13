"""Social-login policy shared by every configured provider (Google, GitHub)."""

from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialLogin
from django.contrib.auth import get_user_model
from django.http import HttpRequest
from django.shortcuts import render

from backend.social_signup_forms import ENABLED
from scenes.models import CloudSyncSignupConsent


class LinkedProvidersSocialAccountAdapter(DefaultSocialAccountAdapter):
    """Allow verified social identities to create their first local account."""

    def is_open_for_signup(self, request, sociallogin):
        # Local email/password signup is intentionally closed by the account
        # adapter. Google/GitHub are the supported account-creation paths.
        return True

    def is_auto_signup_allowed(self, request, sociallogin):
        # Issue #524: every brand-new social identity must see the
        # explicit local-only/cloud-sync choice before an account is
        # created -- never auto-decided. This hook is only consulted by
        # allauth for a genuinely new account (an existing linked
        # identity signs in through a separate path that never reaches
        # here), so returning False unconditionally is safe and does not
        # affect a returning user.
        return False

    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form=form)
        # `form` is the `CloudSyncSignupForm` instance that finalized this
        # signup -- always present for a real social signup (allauth only
        # calls `save_user` with `form=None` from its own auto-signup
        # path, which #524 disables above). Recorded exactly once, at the
        # moment the account itself is created.
        choice = form.cleaned_data.get("cloud_sync_choice") if form is not None else None
        CloudSyncSignupConsent.objects.get_or_create(
            owner=user, defaults={"sync_enabled": choice == ENABLED}
        )
        return user

    def pre_social_login(self, request: HttpRequest, sociallogin: SocialLogin) -> None:
        # Issue #420: a brand-new provider identity (this exact provider +
        # uid has never signed in before) whose email matches an existing
        # user must never be silently auto-linked -- the email came from a
        # third-party provider and may not actually belong to whoever
        # controls it there. Fail closed with an actionable page instead
        # of letting allauth's default signup-form redirect (or, worse, a
        # duplicate-account integrity error) happen.
        #
        # Issue #426's one exception: a signed-in user explicitly linking
        # a second provider (allauth's real `?process=connect` flow) whose
        # email happens to equal their *own* already-registered email is
        # not a conflict at all -- it is the expected, common case for
        # linking. Only reject when the matching account belongs to
        # someone else, which is exactly what "no email-only silent
        # account merge" and "reject... linking an identity owned by
        # another account" mean in #426's own acceptance criteria.
        if sociallogin.is_existing:
            return
        email = None
        if sociallogin.email_addresses:
            email = sociallogin.email_addresses[0].email
        elif sociallogin.user.email:
            email = sociallogin.user.email
        if not email:
            if sociallogin.account.provider == "linkedin":
                response = render(
                    request,
                    "socialaccount/social_identity_email_required.html",
                    {"provider": "LinkedIn"},
                    status=400,
                )
                raise ImmediateHttpResponse(response)
            return
        matching_user = get_user_model().objects.filter(email__iexact=email).first()
        if matching_user is None:
            return
        if request.user.is_authenticated and matching_user.pk == request.user.pk:
            return
        response = render(
            request,
            "socialaccount/social_identity_conflict.html",
            {"provider": sociallogin.account.provider},
            status=409,
        )
        raise ImmediateHttpResponse(response)
