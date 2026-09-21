"""Public profile feed projections (#686)."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from html import escape
from typing import Any
from urllib.parse import quote
from xml.etree import ElementTree

from django.http import Http404, HttpRequest, HttpResponse
from django.utils.http import http_date, parse_http_date_safe
from django.utils.timezone import is_aware, make_aware, now
from django.views import View

from scenes.art_piece_persistence import eligible_art_pieces
from scenes.gallery import eligible_projects, eligible_projects3d
from scenes.models import PublicProfile
from scenes.public_urls import piece_viewer_path

ATOM_NS = "http://www.w3.org/2005/Atom"
MEDIA_NS = "http://search.yahoo.com/mrss/"
FEED_LIMIT = 50
FEED_CACHE_CONTROL = "public, max-age=300, must-revalidate"

ElementTree.register_namespace("", ATOM_NS)
ElementTree.register_namespace("media", MEDIA_NS)


def _atom(tag: str) -> str:
    return f"{{{ATOM_NS}}}{tag}"


def _absolute(request: HttpRequest, path: str) -> str:
    return request.build_absolute_uri(path)


def _timestamp(value: datetime | None) -> datetime:
    value = value or now()
    if not is_aware(value):
        value = make_aware(value, UTC)
    return value


def _format_timestamp(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _description(record) -> str:
    if hasattr(record, "description"):
        return str(record.description or "")
    seo_config = record.seo_config if isinstance(record.seo_config, dict) else {}
    return str(seo_config.get("description", "") or "")


def _thumbnail_path(record, kind: str) -> str:
    if kind == "2d":
        return f"/api/public/projects/{record.public_id}/thumbnail.png"
    if kind == "3d":
        return f"/api/projects3d/{record.public_id}/thumbnail/"
    return f"/api/public/art-pieces/{record.public_id}/thumbnail.png"


def _feed_records(profile: PublicProfile) -> list[tuple[str, Any]]:
    records: list[tuple[str, Any]] = [
        *(("2d", project) for project in eligible_projects().filter(owner=profile.user)),
        *(("3d", project) for project in eligible_projects3d().filter(owner=profile.user)),
        *(("generated", piece) for piece in eligible_art_pieces().filter(owner=profile.user)),
    ]
    records.sort(
        key=lambda item: (
            _timestamp(getattr(item[1], "published_at", None)),
            str(item[1].public_id),
        ),
        reverse=True,
    )
    return records[:FEED_LIMIT]


def _build_feed(request: HttpRequest, profile: PublicProfile) -> tuple[bytes, datetime]:
    profile_path = f"/users/@{quote(profile.handle or '', safe='@')}"
    feed_url = _absolute(request, f"{profile_path}/feed.xml")
    profile_url = _absolute(request, profile_path)
    records = _feed_records(profile)
    feed_updated = max(
        [_timestamp(profile.updated_at)]
        + [_timestamp(getattr(record, "updated_at", None)) for _, record in records]
    )

    root = ElementTree.Element(_atom("feed"))
    ElementTree.SubElement(root, _atom("id")).text = feed_url
    ElementTree.SubElement(
        root, _atom("title")
    ).text = f"{profile.display_name or profile.handle or 'Public profile'} on AugmentrART"
    author = ElementTree.SubElement(root, _atom("author"))
    ElementTree.SubElement(author, _atom("name")).text = (
        profile.display_name or profile.handle or "Public profile"
    )
    ElementTree.SubElement(root, _atom("link"), {"rel": "self", "href": feed_url})
    ElementTree.SubElement(root, _atom("link"), {"rel": "alternate", "href": profile_url})
    ElementTree.SubElement(root, _atom("updated")).text = _format_timestamp(feed_updated)

    for kind, record in records:
        canonical_path = piece_viewer_path(record, kind)
        canonical_url = _absolute(request, canonical_path)
        thumbnail_url = _absolute(request, _thumbnail_path(record, kind))
        published = _timestamp(getattr(record, "published_at", None))
        updated = _timestamp(getattr(record, "updated_at", None))
        title = str(record.title)
        description = _description(record)
        content_html = (
            f'<p><img src="{escape(thumbnail_url, quote=True)}" alt="" />'
            f"</p><h2>{escape(title)}</h2><p>{escape(description)}</p>"
        )

        entry = ElementTree.SubElement(root, _atom("entry"))
        ElementTree.SubElement(entry, _atom("id")).text = canonical_url
        ElementTree.SubElement(entry, _atom("title")).text = title
        ElementTree.SubElement(entry, _atom("link"), {"rel": "alternate", "href": canonical_url})
        ElementTree.SubElement(entry, _atom("published")).text = _format_timestamp(published)
        ElementTree.SubElement(entry, _atom("updated")).text = _format_timestamp(updated)
        ElementTree.SubElement(entry, _atom("summary")).text = description
        content = ElementTree.SubElement(entry, _atom("content"), {"type": "html"})
        content.text = content_html
        ElementTree.SubElement(
            entry,
            _atom("link"),
            {
                "rel": "enclosure",
                "type": "image/png",
                "href": thumbnail_url,
            },
        )
        ElementTree.SubElement(entry, f"{{{MEDIA_NS}}}thumbnail", {"url": thumbnail_url})

    return ElementTree.tostring(root, encoding="utf-8", xml_declaration=True), feed_updated


class PublicProfileAtomFeedView(View):
    """Serve a privacy-filtered, validator-aware Atom 1.0 profile feed."""

    def get(self, request: HttpRequest, handle: str) -> HttpResponse:
        profile = (
            PublicProfile.objects.filter(
                handle=handle.lower(), is_public=True, user__is_active=True
            )
            .select_related("user")
            .first()
        )
        if profile is None:
            raise Http404

        body, updated = _build_feed(request, profile)
        etag = f'"{hashlib.sha256(body).hexdigest()}"'
        last_modified = int(_timestamp(updated).timestamp())
        if request.headers.get("If-None-Match") == etag:
            response = HttpResponse(status=304)
        else:
            modified_since = parse_http_date_safe(request.headers.get("If-Modified-Since", ""))
            if modified_since is not None and modified_since >= last_modified:
                response = HttpResponse(status=304)
            else:
                response = HttpResponse(body, content_type="application/atom+xml; charset=utf-8")
        response["ETag"] = etag
        response["Last-Modified"] = http_date(last_modified)
        response["Cache-Control"] = FEED_CACHE_CONTROL
        return response
