import pytest
from django.contrib.auth import get_user_model

from scenes.models import PublicProfile
from scenes.public_identity import (
    public_author_attribution,
    public_author_handle,
    public_author_name,
)


@pytest.mark.django_db
def test_public_identity_resolves_display_name_and_normalizes_handles():
    user = get_user_model().objects.create_user(username="legacy-user")
    profile = PublicProfile.objects.create(
        user=user, handle="@legacy-handle", display_name="  Chosen Name  "
    )

    assert public_author_name(user) == "Chosen Name"
    assert public_author_handle(user) == "legacy-handle"

    profile.display_name = "   "
    profile.save(update_fields=["display_name"])
    assert public_author_name(user) == "legacy-handle"

    profile.handle = None
    profile.save(update_fields=["handle"])
    assert public_author_name(user) == "legacy-user"
    assert public_author_handle(user) is None


@pytest.mark.django_db
def test_public_author_attribution_uses_display_name_and_at_handle():
    user = get_user_model().objects.create_user(username="artist-user")
    PublicProfile.objects.create(user=user, handle="@artist", display_name="Chosen Name")

    assert public_author_attribution(user) == "By Chosen Name (@artist)"
