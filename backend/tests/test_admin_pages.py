"""Authorization, publication, slug-history, and concurrency tests for #517."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from scenes.models import ApplicationAdmin, Page, PageAuditEvent, PageSlugRedirect


@pytest.fixture
def admin_a():
    user = get_user_model().objects.create_user(username="page_admin", password="x")
    ApplicationAdmin.objects.create(user=user)
    return user


@pytest.fixture
def user_b():
    return get_user_model().objects.create_user(username="page_user", password="x")


def page_payload(**overrides):
    payload = {
        "title": "About the studio",
        "slug": "about-studio",
        "description": "A public page.",
        "status": "draft",
        "nav_label": "About",
        "show_in_nav": False,
        "sort_order": 1,
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
def test_admin_pages_are_denied_to_anonymous_and_non_admin(client, user_b):
    assert client.get(reverse("admin-page-list-create")).status_code == 401
    client.force_login(user_b)
    assert client.get(reverse("admin-page-list-create")).status_code == 403
    assert client.post(reverse("admin-page-list-create"), page_payload()).status_code == 403


@pytest.mark.django_db
def test_admin_can_create_publish_rename_and_audit_page(client, admin_a):
    client.force_login(admin_a)
    response = client.post(
        reverse("admin-page-list-create"), page_payload(), content_type="application/json"
    )
    assert response.status_code == 201
    page = Page.objects.get(slug="about-studio")
    assert response.json()["author"] == "page_admin"
    assert PageAuditEvent.objects.filter(page=page, action="created").exists()

    response = client.patch(
        reverse("admin-page-detail", args=[page.pk]),
        {"revision": 1, "slug": "about", "status": "published"},
        content_type="application/json",
    )
    assert response.status_code == 200
    page.refresh_from_db()
    assert page.slug == "about"
    assert page.status == Page.Status.PUBLISHED
    assert PageSlugRedirect.objects.get(old_slug="about-studio").page_id == page.pk

    public = client.get(reverse("public-page-detail", args=["about"]))
    assert public.status_code == 200
    assert public.json() == {
        "title": "About the studio",
        "slug": "about",
        "description": "A public page.",
        "nav_label": "About",
        "show_in_nav": False,
        "sort_order": 1,
    }
    old = client.get(reverse("public-page-detail", args=["about-studio"]))
    assert old.status_code == 301
    assert old["Location"] == "/api/pages/about/"


@pytest.mark.django_db
def test_draft_and_deleted_pages_are_not_public(client, admin_a):
    client.force_login(admin_a)
    created = client.post(
        reverse("admin-page-list-create"), page_payload(), content_type="application/json"
    )
    page_id = created.json()["id"]
    assert client.get(reverse("public-page-detail", args=["about-studio"])).status_code == 404
    assert (
        client.delete(
            reverse("admin-page-detail", args=[page_id]),
            {"revision": 1},
            content_type="application/json",
        ).status_code
        == 204
    )
    assert client.get(reverse("public-page-detail", args=["about-studio"])).status_code == 404
    assert Page.all_objects.get(pk=page_id).deleted_at is not None


@pytest.mark.django_db
def test_stale_page_update_is_atomic_and_system_or_navigation_pages_are_protected(client, admin_a):
    client.force_login(admin_a)
    created = client.post(
        reverse("admin-page-list-create"), page_payload(), content_type="application/json"
    )
    page_id = created.json()["id"]
    stale = client.patch(
        reverse("admin-page-detail", args=[page_id]),
        {"revision": 99, "title": "Should not save"},
        content_type="application/json",
    )
    assert stale.status_code == 409
    assert Page.objects.get(pk=page_id).title == "About the studio"

    system = Page.objects.create(title="Home", slug="home-page", system_key="home", author=admin_a)
    assert (
        client.delete(
            reverse("admin-page-detail", args=[system.pk]),
            {"revision": 1},
            content_type="application/json",
        ).status_code
        == 409
    )
    nav = Page.objects.create(
        title="Required", slug="required-page", show_in_nav=True, author=admin_a
    )
    assert (
        client.delete(
            reverse("admin-page-detail", args=[nav.pk]),
            {"revision": 1},
            content_type="application/json",
        ).status_code
        == 409
    )


@pytest.mark.django_db
def test_invalid_and_reserved_slugs_are_rejected(client, admin_a):
    client.force_login(admin_a)
    for slug in ["admin", "api", "!!!"]:
        response = client.post(
            reverse("admin-page-list-create"),
            page_payload(slug=slug),
            content_type="application/json",
        )
        assert response.status_code == 400
