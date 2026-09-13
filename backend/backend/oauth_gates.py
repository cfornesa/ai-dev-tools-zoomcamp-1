"""Request-time gate for the optional GitHub OAuth provider (issue #420).

`allauth.socialaccount.providers.github` stays permanently installed (so the
provider registry, adapters, and `{% provider_login_url %}` all work the
moment it is configured, with no Django app-registry reload required), but
its login/callback views must not be reachable while
`settings.GITHUB_OAUTH_ENABLED` is False -- hitting them unconfigured would
otherwise raise `SocialApp.DoesNotExist` as a raw 500. Wrapping the two
views here and registering the wrapped routes ahead of `include("allauth.urls")`
in `backend/urls.py` (first-match-wins in Django's resolver) intercepts both
before allauth's own identically-named routes are ever reached.
"""

from allauth.socialaccount.providers.github.views import (
    oauth2_callback as _github_oauth2_callback,
)
from allauth.socialaccount.providers.github.views import (
    oauth2_login as _github_oauth2_login,
)
from allauth.socialaccount.providers.openid_connect.views import (
    callback as _openid_connect_callback,
)
from allauth.socialaccount.providers.openid_connect.views import (
    login as _openid_connect_login,
)
from django.conf import settings
from django.http import Http404, HttpRequest, HttpResponse


def _require_github_oauth_enabled(view):
    def gated(request: HttpRequest, *args, **kwargs) -> HttpResponse:
        if not settings.GITHUB_OAUTH_ENABLED:
            raise Http404("GitHub sign-in is not configured.")
        return view(request, *args, **kwargs)

    return gated


github_login = _require_github_oauth_enabled(_github_oauth2_login)
github_callback = _require_github_oauth_enabled(_github_oauth2_callback)


def _require_linkedin_oauth_enabled(view):
    def gated(request: HttpRequest, *args, **kwargs) -> HttpResponse:
        if not settings.LINKEDIN_OAUTH_ENABLED:
            raise Http404("LinkedIn sign-in is not configured.")
        return view(request, *args, provider_id="linkedin", **kwargs)

    return gated


linkedin_login = _require_linkedin_oauth_enabled(_openid_connect_login)
linkedin_callback = _require_linkedin_oauth_enabled(_openid_connect_callback)
