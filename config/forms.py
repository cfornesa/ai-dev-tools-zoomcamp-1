from allauth.account.forms import SignupForm
from django import forms
from django.conf import settings

from config.recaptcha import verify_signup_token


class RecaptchaSignupForm(SignupForm):
    recaptcha_token = forms.CharField(required=False, widget=forms.HiddenInput())

    def clean_recaptcha_token(self):
        token = self.cleaned_data.get("recaptcha_token", "")
        if not settings.RECAPTCHA_ENABLED:
            return token
        request = getattr(self, "request", None)
        remote_ip = request.META.get("REMOTE_ADDR") if request else None
        valid, message = verify_signup_token(token, remote_ip)
        if not valid:
            raise forms.ValidationError(message)
        return token