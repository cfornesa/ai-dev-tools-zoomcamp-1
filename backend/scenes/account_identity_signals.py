"""Audits a successful account-identity link the instant allauth's real
"connect" OAuth flow completes one (issue #426). Connected in
`scenes.apps.ScenesConfig.ready`.
"""

from allauth.socialaccount.signals import social_account_added
from django.dispatch import receiver

from scenes.models import IdentityLinkEvent


@receiver(social_account_added)
def _record_identity_link(sender, request, sociallogin, **kwargs):
    IdentityLinkEvent.objects.create(
        user=sociallogin.user,
        provider=sociallogin.account.provider,
        action=IdentityLinkEvent.Action.LINK,
    )
