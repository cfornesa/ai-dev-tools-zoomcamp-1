"""The one-time signup-time cloud-sync consent field (issue #524), added
to allauth's social-account signup form (`SOCIALACCOUNT_FORMS['signup']`
in `backend/settings.py`) -- shown exactly once, for a brand-new social
account, before it is created.
"""

from __future__ import annotations

from allauth.socialaccount.forms import SignupForm as BaseSocialSignupForm
from django import forms
from django.utils.translation import gettext_lazy as _

from scenes.models import SiteSettings

LOCAL_ONLY = "local_only"
ENABLED = "enabled"


class CloudSyncSignupForm(BaseSocialSignupForm):
    """`self.cleaned_data["cloud_sync_choice"]` is read by
    `LinkedProvidersSocialAccountAdapter.save_user` to create the new
    account's `CloudSyncSignupConsent` row. Local-only is the pre-selected
    default and the only choice offered while the site-wide
    `SiteSettings.cloud_sync_enabled` switch is off -- a disabled switch
    never presents a misleading "enabled" state, and no project content is
    read or uploaded either way.
    """

    cloud_sync_choice = forms.ChoiceField(
        label=_("Cloud sync"),
        choices=[
            (LOCAL_ONLY, _("Keep projects local only")),
            (ENABLED, _("Enable optional cloud sync")),
        ],
        initial=LOCAL_ONLY,
        widget=forms.RadioSelect,
        required=True,
    )

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        if not SiteSettings.get_solo().cloud_sync_enabled:
            self.fields["cloud_sync_choice"].choices = [(LOCAL_ONLY, _("Keep projects local only"))]
            self.fields["cloud_sync_choice"].initial = LOCAL_ONLY
            self.site_cloud_sync_disabled = True
        else:
            self.site_cloud_sync_disabled = False

    def clean_cloud_sync_choice(self) -> str:
        value = self.cleaned_data.get("cloud_sync_choice")
        if not SiteSettings.get_solo().cloud_sync_enabled and value != LOCAL_ONLY:
            raise forms.ValidationError(_("Cloud sync is currently unavailable."))
        return value
