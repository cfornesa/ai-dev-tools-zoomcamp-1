"""Tests for the anonymous published AI-agent guidance resources (#585)."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from scenes.models import Page, PublicProfile, SiteSettings


@pytest.fixture
def published_page(db):
    return Page.objects.create(
        title="About the studio",
        slug="about-the-studio",
        description="Published creative coding information.",
        seo_config={"description": "A bounded SEO description."},
        status=Page.Status.PUBLISHED,
    )


@pytest.mark.django_db
def test_llms_endpoints_are_anonymous_plain_text_and_published_only(client, published_page):
    Page.objects.create(
        title="Private draft",
        slug="private-draft",
        description="This must never be indexed.",
        status=Page.Status.DRAFT,
    )

    concise = client.get(reverse("llms"))
    expanded = client.get(reverse("llms-full"))

    assert concise.status_code == expanded.status_code == 200
    assert concise["Content-Type"] == "text/plain; charset=utf-8"
    assert expanded["Content-Type"] == "text/plain; charset=utf-8"
    assert "Public gallery" in concise.content.decode()
    assert "About the studio" not in concise.content.decode()
    full_text = expanded.content.decode()
    assert "About the studio" in full_text
    assert "A bounded SEO description." in full_text
    assert "Private draft" not in full_text
    assert "This must never be indexed." not in full_text


@pytest.mark.django_db
def test_full_document_includes_public_profiles_and_excludes_private_profiles(client):
    user_model = get_user_model()
    public_user = user_model.objects.create_user(username="public_artist", is_active=True)
    PublicProfile.objects.create(
        user=public_user,
        handle="public-artist",
        display_name="Public Artist",
        bio="A public profile.",
        is_public=True,
    )
    private_user = user_model.objects.create_user(username="private_artist", is_active=True)
    PublicProfile.objects.create(
        user=private_user,
        handle="private-artist",
        display_name="Private Artist",
        bio="Private profile details.",
        is_public=False,
    )

    text = client.get(reverse("llms-full")).content.decode()
    assert "/users/@public-artist" in text
    assert "Public Artist" in text
    assert "private-artist" not in text
    assert "Private profile details." not in text


@pytest.mark.django_db
def test_llms_output_reflects_global_metadata_changes_without_artifact_write(client):
    SiteSettings.objects.update_or_create(
        pk=1,
        defaults={
            "site_title": "First title",
            "site_description": "First description",
            "metadata_tags": ["first"],
        },
    )
    first = client.get(reverse("llms")).content.decode()

    row = SiteSettings.get_solo()
    row.site_title = "Second title"
    row.site_description = "Second description"
    row.metadata_tags = ["second"]
    row.save(update_fields=["site_title", "site_description", "metadata_tags", "updated_at"])

    second = client.get(reverse("llms")).content.decode()
    assert "First title" in first
    assert "First description" in first
    assert "first" in first
    assert "Second title" in second
    assert "Second description" in second
    assert "second" in second
    assert "First title" not in second
