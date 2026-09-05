"""Account identity link/unlink service (issue #426).

Reauthenticated linking itself is entirely allauth's own real OAuth
"connect" flow (`?process=connect` on the existing `/accounts/<provider>/
login/` routes, including `backend.oauth_gates`' GitHub gate and
`backend.social_account_adapter.LinkedProvidersSocialAccountAdapter`'s
conflict check) -- this module only ever *lists* and *unlinks* already-
connected identities, and records the audit trail for both.
"""

from allauth.socialaccount.models import SocialAccount
from django.conf import settings

from scenes.models import IdentityLinkEvent

# Which providers currently count toward "at least one usable sign-in
# method" -- Google is always enabled; GitHub only when #420's
# GITHUB_OAUTH_ENABLED is True. A provider absent here, or one whose
# check returns False, never counts even if a SocialAccount row for it
# still exists (e.g. an admin disabled GitHub after a user had linked
# it) -- unlinking that row is always safe.
_ENABLED_CHECKS = {
    "google": lambda: True,
    "github": lambda: settings.GITHUB_OAUTH_ENABLED,
}


def is_provider_enabled(provider: str) -> bool:
    check = _ENABLED_CHECKS.get(provider)
    return bool(check and check())


class CannotUnlink(Exception):
    """Raised when there is nothing to unlink, or unlinking would strand
    the account with zero usable sign-in methods. Nothing is mutated."""


def list_identities(user) -> list[dict]:
    return [
        {
            "provider": account.provider,
            "enabled": is_provider_enabled(account.provider),
            "connected_at": account.date_joined.isoformat(),
        }
        for account in SocialAccount.objects.filter(user=user).order_by("provider")
    ]


def _usable_identity_count(user) -> int:
    return sum(
        1
        for account in SocialAccount.objects.filter(user=user)
        if is_provider_enabled(account.provider)
    )


def unlink_identity(*, user, provider: str) -> list[dict]:
    account = SocialAccount.objects.filter(user=user, provider=provider).first()
    if account is None:
        raise CannotUnlink(f"No linked {provider} identity to remove.")
    if is_provider_enabled(provider) and _usable_identity_count(user) <= 1:
        raise CannotUnlink("Cannot remove your only usable sign-in method.")
    account.delete()
    IdentityLinkEvent.objects.create(
        user=user, provider=provider, action=IdentityLinkEvent.Action.UNLINK
    )
    return list_identities(user)
