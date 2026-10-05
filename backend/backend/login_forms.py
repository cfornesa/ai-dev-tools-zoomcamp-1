"""Login form extensions for the password brute-force policy."""

from allauth.account.adapter import get_adapter
from allauth.account.forms import LoginForm as AllauthLoginForm
from allauth.core import ratelimit
from django.core.exceptions import ValidationError


class LoginForm(AllauthLoginForm):
    """Keep allauth's login behavior and count failed password attempts."""

    def _clean_with_password(self, credentials):
        try:
            return super()._clean_with_password(credentials)
        except ValidationError:
            login_key = credentials.get("email") or self.cleaned_data.get("login", "")
            if login_key:
                allowed = ratelimit.consume(
                    self.request,
                    action="login_failed",
                    key=login_key.strip().lower(),
                )
                if not allowed:
                    raise get_adapter(self.request).validation_error(
                        "too_many_login_attempts"
                    ) from None
            raise
