import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from scenes.models import ApplicationAdmin, ProfileStyle, PublicProfile, SiteSettings


@pytest.mark.django_db
def test_profile_style_catalog_is_admin_only_and_seeded(client):
    url = reverse("admin-profile-style-list-create")
    assert client.get(url).status_code == 401

    user = get_user_model().objects.create_user(username="ordinary", password="x")
    client.force_login(user)
    assert client.get(url).status_code == 403

    ApplicationAdmin.objects.create(user=user)
    styles = client.get(url)
    assert styles.status_code == 200
    assert {style["key"] for style in styles.json()} >= {
        "default",
        "ocean",
        "forest",
        "sunset",
        "pareto",
    }
    pareto = next(style for style in styles.json() if style["key"] == "pareto")
    assert set(pareto["tokens"]) == {"light", "dark"}
    assert pareto["presentation"] == {
        "font_family": "system",
        "density": "comfortable",
        "radius": "sharp",
        "border_style": "solid",
        "shadow": "offset",
        "backdrop": "plain",
    }


@pytest.mark.django_db
def test_admin_can_create_edit_and_disable_token_style(client):
    admin = get_user_model().objects.create_user(username="style-admin", password="x")
    ApplicationAdmin.objects.create(user=admin)
    client.force_login(admin)
    url = reverse("admin-profile-style-list-create")
    created = client.post(
        url,
        {
            "key": "rose",
            "label": "Rose",
            "description": "A rose preview.",
            "tokens": {"accent": "#fb7185"},
        },
        content_type="application/json",
    )
    assert created.status_code == 201
    style = created.json()
    updated = client.patch(
        reverse("admin-profile-style-detail", kwargs={"style_id": style["id"]}),
        {**style, "enabled": False, "revision": style["revision"]},
        content_type="application/json",
    )
    assert updated.status_code == 200
    assert updated.json()["enabled"] is False


@pytest.mark.django_db
def test_users_can_select_enabled_style_but_disabled_existing_style_stays_readable(client):
    user = get_user_model().objects.create_user(username="style-user", password="x")
    client.force_login(user)
    profile = client.get(reverse("account-profile")).json()
    ocean = ProfileStyle.objects.get(key="ocean")

    selected = client.patch(
        reverse("account-profile"),
        {**profile, "style_key": ocean.key},
        content_type="application/json",
    )
    assert selected.status_code == 200
    assert selected.json()["style_key"] == "ocean"
    assert selected.json()["theme_config"]["accent"] == "#38bdf8"

    ocean.enabled = False
    ocean.save(update_fields=["enabled"])
    current = client.get(reverse("account-profile")).json()
    assert current["style_key"] == "ocean"
    assert current["theme_config"]["accent"] == "#38bdf8"

    rejected = client.patch(
        reverse("account-profile"),
        {**current, "style_key": "default"},
        content_type="application/json",
    )
    assert rejected.status_code == 200
    rejected_new = client.patch(
        reverse("account-profile"),
        {**rejected.json(), "style_key": "ocean"},
        content_type="application/json",
    )
    assert rejected_new.status_code == 400
    assert "style_key" in rejected_new.json()["detail"]
    assert (
        PublicProfile.objects.get(user=user).style_id == ProfileStyle.objects.get(key="default").id
    )


@pytest.mark.django_db
def test_disabled_global_style_falls_back_to_default_site_theme(client):
    pareto = ProfileStyle.objects.get(key="pareto")
    default = ProfileStyle.objects.get(key="default")
    SiteSettings.objects.update_or_create(pk=1, defaults={"style": pareto})
    pareto.enabled = False
    pareto.save(update_fields=["enabled"])

    response = client.get(reverse("site-theme"))

    assert response.status_code == 200
    assert response.json()["theme_palettes"]["dark"]["accent"] == default.tokens["accent"]
    assert response.json()["presentation"]["shadow"] == "none"
