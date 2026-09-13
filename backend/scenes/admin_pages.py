"""Transactional CMS page administration (issue #517)."""

from __future__ import annotations

from dataclasses import dataclass

from django.db import IntegrityError, transaction
from django.utils.text import slugify

from scenes.models import Page, PageAuditEvent, PageSlugRedirect

RESERVED_PAGE_SLUGS = frozenset(
    {
        "admin",
        "api",
        "accounts",
        "gallery",
        "projects",
        "projects3d",
        "art-pieces",
        "account",
        "embed",
        "immersive",
    }
)
REQUIRED_SYSTEM_KEYS = frozenset({"home"})


class PageValidationFailed(Exception):
    pass


class PageRevisionConflict(Exception):
    pass


class PageProtected(Exception):
    pass


@dataclass(frozen=True)
class PageView:
    id: int
    title: str
    slug: str
    description: str
    status: str
    nav_label: str
    show_in_nav: bool
    sort_order: int
    system_key: str | None
    author: str | None
    revision: int
    updated_at: str
    updated_by: str | None


def _display_name(user) -> str | None:
    if user is None:
        return None
    return user.get_username() or user.get_full_name() or None


def page_view(page: Page) -> PageView:
    return PageView(
        id=page.pk,
        title=page.title,
        slug=page.slug,
        description=page.description,
        status=page.status,
        nav_label=page.nav_label,
        show_in_nav=page.show_in_nav,
        sort_order=page.sort_order,
        system_key=page.system_key,
        author=_display_name(page.author),
        revision=page.revision,
        updated_at=page.updated_at.isoformat(),
        updated_by=_display_name(page.updated_by),
    )


def _clean_slug(value: object) -> str:
    if not isinstance(value, str) or not value.strip():
        raise PageValidationFailed("slug must be a non-empty string.")
    normalized = slugify(value)[:120]
    if not normalized:
        raise PageValidationFailed("slug must contain letters or numbers.")
    if normalized in RESERVED_PAGE_SLUGS:
        raise PageValidationFailed("that slug is reserved by the application.")
    return normalized


def _clean_fields(data: dict[str, object], *, partial: bool = False) -> dict[str, object]:
    allowed = {
        "title",
        "slug",
        "description",
        "status",
        "nav_label",
        "show_in_nav",
        "sort_order",
        "system_key",
    }
    unknown = set(data) - allowed
    if unknown:
        raise PageValidationFailed(f"unknown fields: {', '.join(sorted(unknown))}.")
    cleaned: dict[str, object] = {}
    if "title" in data or not partial:
        title = data.get("title", "")
        if not isinstance(title, str) or not title.strip() or len(title.strip()) > 200:
            raise PageValidationFailed("title must be 1 to 200 characters.")
        cleaned["title"] = title.strip()
    if "slug" in data or not partial:
        cleaned["slug"] = _clean_slug(data.get("slug", ""))
    if "description" in data:
        description = data["description"]
        if not isinstance(description, str) or len(description) > 5000:
            raise PageValidationFailed("description must be at most 5000 characters.")
        cleaned["description"] = description
    if "status" in data:
        if data["status"] not in {Page.Status.DRAFT, Page.Status.PUBLISHED}:
            raise PageValidationFailed("status must be draft or published.")
        cleaned["status"] = data["status"]
    if "nav_label" in data:
        label = data["nav_label"]
        if not isinstance(label, str) or len(label) > 100:
            raise PageValidationFailed("nav_label must be at most 100 characters.")
        cleaned["nav_label"] = label.strip()
    if "show_in_nav" in data:
        if not isinstance(data["show_in_nav"], bool):
            raise PageValidationFailed("show_in_nav must be a boolean.")
        cleaned["show_in_nav"] = data["show_in_nav"]
    if "sort_order" in data:
        if (
            not isinstance(data["sort_order"], int)
            or isinstance(data["sort_order"], bool)
            or data["sort_order"] < 0
        ):
            raise PageValidationFailed("sort_order must be a non-negative integer.")
        cleaned["sort_order"] = data["sort_order"]
    if "system_key" in data:
        system_key = data["system_key"]
        if system_key is None or system_key == "":
            cleaned["system_key"] = None
        elif (
            not isinstance(system_key, str)
            or len(system_key) > 64
            or not system_key.replace("_", "").isalnum()
        ):
            raise PageValidationFailed(
                "system_key must contain only letters, numbers, and underscores."
            )
        else:
            cleaned["system_key"] = system_key
    return cleaned


def list_admin_pages() -> list[PageView]:
    return [page_view(page) for page in Page.objects.select_related("author", "updated_by")]


@transaction.atomic
def create_page(*, actor, data: dict) -> PageView:
    fields = _clean_fields(data)
    page = Page(author=actor, updated_by=actor, **fields)
    try:
        page.save()
    except IntegrityError as exc:
        raise PageValidationFailed("title, slug, or system_key is already in use.") from exc
    PageAuditEvent.objects.create(page=page, actor=actor, action="created")
    return page_view(page)


@transaction.atomic
def update_page(*, actor, page_id: int, expected_revision: int, data: dict) -> PageView:
    fields = _clean_fields(data, partial=True)
    page = Page.objects.select_for_update().select_related("author", "updated_by").get(pk=page_id)
    if page.revision != expected_revision:
        raise PageRevisionConflict("The page changed since it was loaded.")
    old_slug = page.slug
    if "slug" in fields and fields["slug"] != old_slug:
        if PageSlugRedirect.objects.filter(old_slug=fields["slug"]).exists():
            raise PageValidationFailed("that slug is already reserved by redirect history.")
    for key, value in fields.items():
        setattr(page, key, value)
    page.revision += 1
    page.updated_by = actor
    try:
        page.save()
        if page.slug != old_slug:
            PageSlugRedirect.objects.create(
                page=page, old_slug=old_slug, system_key=page.system_key or ""
            )
    except IntegrityError as exc:
        raise PageValidationFailed("title, slug, or system_key is already in use.") from exc
    PageAuditEvent.objects.create(
        page=page, actor=actor, action="updated", detail=f"revision={page.revision}"
    )
    return page_view(page)


@transaction.atomic
def soft_delete_page(*, actor, page_id: int, expected_revision: int) -> None:
    page = Page.objects.select_for_update().get(pk=page_id)
    if page.system_key in REQUIRED_SYSTEM_KEYS or page.show_in_nav:
        raise PageProtected("required system and navigation pages cannot be deleted.")
    if page.revision != expected_revision:
        raise PageRevisionConflict("The page changed since it was loaded.")
    from django.utils import timezone

    page.deleted_at = timezone.now()
    page.revision += 1
    page.updated_by = actor
    page.save(update_fields=["deleted_at", "revision", "updated_by", "updated_at"])
    PageAuditEvent.objects.create(
        page=page, actor=actor, action="soft_deleted", detail=f"revision={page.revision}"
    )
