"""Request-time, privacy-safe llms.txt resources (#585)."""

from __future__ import annotations

import re

from django.http import HttpResponse
from rest_framework.views import APIView

from scenes.art_piece_persistence import eligible_art_pieces
from scenes.gallery import eligible_collections, eligible_projects, eligible_projects3d
from scenes.models import Page, PublicProfile, SiteSettings

MAX_ITEMS = 500
MAX_LINE_LENGTH = 320
MAX_BODY_LENGTH = 200_000
_WHITESPACE = re.compile(r"\s+")


def _safe_text(value: object, *, fallback: str = "") -> str:
    if not isinstance(value, str):
        return fallback
    return _WHITESPACE.sub(" ", value.replace("\x00", "")).strip()[:MAX_LINE_LENGTH]


def _site_metadata() -> tuple[str, str, list[str]]:
    row = SiteSettings.get_solo()
    tags = row.metadata_tags if isinstance(row.metadata_tags, list) else []
    safe_tags = []
    for tag in tags:
        cleaned = _safe_text(tag)
        if cleaned and cleaned not in safe_tags:
            safe_tags.append(cleaned)
    return (
        _safe_text(row.site_title, fallback="AugmentrART"),
        _safe_text(row.site_description),
        safe_tags,
    )


def _seo_description(value: object) -> str:
    if not isinstance(value, dict):
        return ""
    return _safe_text(value.get("description") or value.get("answer_summary"))


def _line(title: object, url: str, description: object = "") -> str:
    safe_title = _safe_text(title, fallback="Untitled")
    safe_description = _safe_text(description)
    return f"- [{safe_title}]({url})" + (f": {safe_description}" if safe_description else "")


def _published_records() -> list[str]:
    lines: list[str] = []
    for page in Page.objects.filter(status=Page.Status.PUBLISHED).order_by(
        "sort_order", "title", "id"
    )[:MAX_ITEMS]:
        description = _seo_description(page.seo_config) or page.description
        lines.append(_line(page.title, f"/pages/{page.slug}", description))

    profiles = (
        PublicProfile.objects.filter(is_public=True, user__is_active=True, handle__isnull=False)
        .select_related("user", "style")
        .order_by("handle", "id")[:MAX_ITEMS]
    )
    handles = {profile.user_id: profile.handle for profile in profiles}
    for profile in profiles:
        lines.append(
            _line(
                profile.display_name or profile.handle,
                f"/users/@{profile.handle}",
                profile.bio,
            )
        )

    for collection in eligible_collections()[:MAX_ITEMS]:
        profile = collection.owner.public_profile
        lines.append(
            _line(
                collection.title,
                f"/users/@{profile.handle}/{collection.slug}",
                _seo_description(collection.seo_config) or collection.description,
            )
        )

    for project in eligible_projects()[:MAX_ITEMS]:
        handle = handles.get(project.owner_id)
        if handle:
            lines.append(
                _line(
                    project.title,
                    f"/users/@{handle}/pieces/{project.public_slug}",
                    project.description,
                )
            )
    for project3d in eligible_projects3d()[:MAX_ITEMS]:
        handle = handles.get(project3d.owner_id)
        if handle:
            lines.append(_line(project3d.title, f"/users/@{handle}/pieces/{project3d.public_slug}"))
    for piece in eligible_art_pieces().select_related("owner", "owner__public_profile")[:MAX_ITEMS]:
        handle = handles.get(piece.owner_id)
        if handle:
            lines.append(
                _line(
                    piece.title,
                    f"/users/@{handle}/pieces/{piece.public_slug}",
                    _seo_description(piece.seo_config) or piece.description,
                )
            )
    return sorted(lines, key=str.casefold)


def render_llms(*, full: bool) -> str:
    title, description, tags = _site_metadata()
    lines = [f"# {title}"]
    if description:
        lines.append(f"> {description}")
    if tags:
        lines.extend(["", f"Topics: {', '.join(tags)}"])
    lines.extend(["", "## Public entry points", "", _line("Public gallery", "/gallery")])
    if full:
        records = _published_records()
        if records:
            lines.extend(["", "## Published site structure and content", "", *records])
    else:
        lines.extend(
            [
                "",
                "## About this document",
                "",
                "This concise index describes the published public site. See /llms-full.txt "
                "for the expanded inventory.",
            ]
        )
    return ("\n".join(lines) + "\n")[:MAX_BODY_LENGTH]


class LLMSTextView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request):
        return HttpResponse(render_llms(full=False), content_type="text/plain; charset=utf-8")


class LLMSFullTextView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request):
        return HttpResponse(render_llms(full=True), content_type="text/plain; charset=utf-8")
