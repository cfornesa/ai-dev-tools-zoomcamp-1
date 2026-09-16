"""Tests for the anonymous published AI-agent guidance resources (#585)."""

import copy
import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from scenes.models import (
    ArtPiece,
    ArtPieceVersion,
    Collection,
    Page,
    Project,
    PublicProfile,
    SceneVersion,
    SiteSettings,
)

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures"
        / "valid"
        / "blank.json"
    ).read_text()
)


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


@pytest.mark.django_db
def test_full_document_includes_published_pieces_and_collections_and_excludes_private(client):
    user_model = get_user_model()
    owner = user_model.objects.create_user(username="piece-owner", is_active=True)
    PublicProfile.objects.create(user=owner, handle="piece-owner", is_public=True)

    published_project = Project.objects.create(
        owner=owner, title="Sunset Study", description="A published 2D piece."
    )
    version = SceneVersion.objects.create(
        project=published_project,
        sequence=1,
        scene_json=copy.deepcopy(BLANK_SCENE),
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    published_project.current_version = version
    published_project.visibility = Project.Visibility.PUBLIC
    published_project.published_at = timezone.now()
    published_project.save(update_fields=["current_version", "visibility", "published_at"])

    private_project = Project.objects.create(owner=owner, title="Unpublished Study")

    published_piece = ArtPiece.objects.create(
        owner=owner,
        title="Aurora Field",
        description="A published generated piece.",
        prompt="a test prompt",
        engine=ArtPiece.Engine.SVG,
        status=ArtPiece.Status.PUBLISHED,
        published_at=timezone.now(),
    )
    piece_version = ArtPieceVersion.objects.create(
        piece=published_piece, sequence=1, source="<svg />"
    )
    published_piece.current_version = piece_version
    published_piece.save(update_fields=["current_version"])

    draft_piece = ArtPiece.objects.create(
        owner=owner,
        title="Draft Piece",
        prompt="a test prompt",
        engine=ArtPiece.Engine.SVG,
    )

    Collection.objects.create(
        owner=owner,
        title="Featured Work",
        slug="featured-work",
        visibility=Collection.Visibility.PUBLIC,
        published_at=timezone.now(),
    )

    text = client.get(reverse("llms-full")).content.decode()
    assert "Sunset Study" in text
    assert "Aurora Field" in text
    assert "Featured Work" in text
    assert private_project.title not in text
    assert draft_piece.title not in text


@pytest.mark.django_db
def test_llms_output_has_deterministic_case_insensitive_ordering(client):
    Page.objects.create(
        title="Zebra page", slug="zebra-page", description="", status=Page.Status.PUBLISHED
    )
    Page.objects.create(
        title="apple page", slug="apple-page", description="", status=Page.Status.PUBLISHED
    )

    text = client.get(reverse("llms-full")).content.decode()
    assert text.index("apple page") < text.index("Zebra page")


@pytest.mark.django_db
def test_llms_output_is_bounded_and_cannot_inject_structure():
    SiteSettings.objects.update_or_create(
        pk=1,
        defaults={
            "site_title": "x" * 1000,
            "site_description": "y" * 1000,
            "metadata_tags": ["z" * 1000],
        },
    )
    Page.objects.create(
        title="Injected\n## Fake section\nmalicious content",
        slug="injection-attempt",
        description="",
        status=Page.Status.PUBLISHED,
    )

    from scenes.llms import render_llms

    concise = render_llms(full=False)
    full = render_llms(full=True)
    assert len(concise) <= 200_000
    assert len(full) <= 200_000
    # A newline immediately before "##" would make it a real markdown
    # section header; the sanitizer collapses whitespace (including
    # embedded newlines) so injected content can only ever appear as
    # inline text within one list-item line, never as a new section.
    assert "\n## Fake section" not in full
    assert "\n\n\n" not in full
