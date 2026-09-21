"""Public profile feed projections (#686)."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from email.utils import format_datetime
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


def _entry_data(request: HttpRequest, kind: str, record: Any) -> dict[str, Any]:
    canonical_url = _absolute(request, piece_viewer_path(record, kind))
    thumbnail_url = _absolute(request, _thumbnail_path(record, kind))
    title = str(record.title)
    description = _description(record)
    engine = getattr(record, "engine", None) or {"2d": "scene-2d", "3d": "threejs"}.get(kind, kind)
    content_html = (
        f'<p><img src="{escape(thumbnail_url, quote=True)}" alt="" />'
        f"</p><h2>{escape(title)}</h2><p>{escape(description)}</p>"
    )
    return {
        "canonical_url": canonical_url,
        "thumbnail_url": thumbnail_url,
        "title": title,
        "description": description,
        "content_html": content_html,
        "engine": str(engine),
        "kind": kind,
        "tags": list(dict.fromkeys((str(engine), kind))),
        "published": _timestamp(getattr(record, "published_at", None)),
        "updated": _timestamp(getattr(record, "updated_at", None)),
    }


def _feed_context(
    request: HttpRequest, profile: PublicProfile, suffix: str
) -> tuple[str, str, str, datetime, list[dict[str, Any]]]:
    profile_path = f"/users/@{quote(profile.handle or '', safe='@')}"
    feed_url = _absolute(request, f"{profile_path}/{suffix}")
    profile_url = _absolute(request, profile_path)
    entries = [_entry_data(request, kind, record) for kind, record in _feed_records(profile)]
    feed_updated = max([_timestamp(profile.updated_at)] + [entry["updated"] for entry in entries])
    feed_title = f"{profile.display_name or profile.handle or 'Public profile'} on AugmentrART"
    return feed_url, profile_url, feed_title, feed_updated, entries


def _build_feed(request: HttpRequest, profile: PublicProfile) -> tuple[bytes, datetime]:
    feed_url, profile_url, feed_title, feed_updated, entries = _feed_context(
        request, profile, "feed.xml"
    )

    root = ElementTree.Element(_atom("feed"))
    ElementTree.SubElement(root, _atom("id")).text = feed_url
    ElementTree.SubElement(root, _atom("title")).text = feed_title
    author = ElementTree.SubElement(root, _atom("author"))
    ElementTree.SubElement(author, _atom("name")).text = (
        profile.display_name or profile.handle or "Public profile"
    )
    ElementTree.SubElement(root, _atom("link"), {"rel": "self", "href": feed_url})
    ElementTree.SubElement(root, _atom("link"), {"rel": "alternate", "href": profile_url})
    ElementTree.SubElement(root, _atom("updated")).text = _format_timestamp(feed_updated)

    for entry_data in entries:
        entry = ElementTree.SubElement(root, _atom("entry"))
        ElementTree.SubElement(entry, _atom("id")).text = entry_data["canonical_url"]
        ElementTree.SubElement(entry, _atom("title")).text = entry_data["title"]
        ElementTree.SubElement(
            entry, _atom("link"), {"rel": "alternate", "href": entry_data["canonical_url"]}
        )
        ElementTree.SubElement(entry, _atom("published")).text = _format_timestamp(
            entry_data["published"]
        )
        ElementTree.SubElement(entry, _atom("updated")).text = _format_timestamp(
            entry_data["updated"]
        )
        ElementTree.SubElement(entry, _atom("summary")).text = entry_data["description"]
        content = ElementTree.SubElement(entry, _atom("content"), {"type": "html"})
        content.text = entry_data["content_html"]
        ElementTree.SubElement(
            entry,
            _atom("link"),
            {
                "rel": "enclosure",
                "type": "image/png",
                "href": entry_data["thumbnail_url"],
            },
        )
        ElementTree.SubElement(
            entry, f"{{{MEDIA_NS}}}thumbnail", {"url": entry_data["thumbnail_url"]}
        )

    return ElementTree.tostring(root, encoding="utf-8", xml_declaration=True), feed_updated


def _build_rss_feed(request: HttpRequest, profile: PublicProfile) -> tuple[bytes, datetime]:
    feed_url, profile_url, feed_title, feed_updated, entries = _feed_context(
        request, profile, "feed.rss"
    )
    channel_description = (
        profile.bio or f"Public pieces by {profile.display_name or profile.handle}"
    )

    def xml(value: str) -> str:
        return escape(value, quote=True)

    def cdata(value: str) -> str:
        return f"<![CDATA[{value.replace(']]>', ']]]]><![CDATA[>')}]]>"

    lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" '
        'xmlns:media="http://search.yahoo.com/mrss/">',
        "<channel>",
        f"<title>{xml(feed_title)}</title>",
        f"<link>{xml(profile_url)}</link>",
        f"<description>{xml(channel_description)}</description>",
        "<lastBuildDate>"
        f"{format_datetime(feed_updated.astimezone(UTC), usegmt=True)}"
        "</lastBuildDate>",
        f'<atom:link href="{xml(feed_url)}" rel="self" type="application/rss+xml" />',
    ]
    for entry in entries:
        lines.extend(
            [
                "<item>",
                f"<title>{xml(entry['title'])}</title>",
                f"<link>{xml(entry['canonical_url'])}</link>",
                f'<guid isPermaLink="true">{xml(entry["canonical_url"])}</guid>',
                "<pubDate>"
                f"{format_datetime(entry['published'].astimezone(UTC), usegmt=True)}"
                "</pubDate>",
                f"<description>{cdata(entry['content_html'])}</description>",
                f'<enclosure url="{xml(entry["thumbnail_url"])}" type="image/png" />',
                f'<media:thumbnail url="{xml(entry["thumbnail_url"])}" />',
                "</item>",
            ]
        )
    lines.extend(["</channel>", "</rss>"])
    return "\n".join(lines).encode("utf-8"), feed_updated


def _build_json_feed(request: HttpRequest, profile: PublicProfile) -> tuple[bytes, datetime]:
    feed_url, profile_url, feed_title, feed_updated, entries = _feed_context(
        request, profile, "feed.json"
    )
    document = {
        "version": "https://jsonfeed.org/version/1.1",
        "title": feed_title,
        "home_page_url": profile_url,
        "feed_url": feed_url,
        "authors": [{"name": profile.display_name or profile.handle or "Public profile"}],
        "items": [
            {
                "id": entry["canonical_url"],
                "url": entry["canonical_url"],
                "title": entry["title"],
                "summary": entry["description"],
                "content_html": entry["content_html"],
                "image": entry["thumbnail_url"],
                "banner_image": entry["thumbnail_url"],
                "date_published": entry["published"].astimezone(UTC).isoformat(),
                "date_modified": entry["updated"].astimezone(UTC).isoformat(),
                "tags": entry["tags"],
            }
            for entry in entries
        ],
    }
    return (
        json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
        feed_updated,
    )


def _public_profile_or_404(handle: str) -> PublicProfile:
    profile = (
        PublicProfile.objects.filter(handle=handle.lower(), is_public=True, user__is_active=True)
        .select_related("user")
        .first()
    )
    if profile is None:
        raise Http404
    return profile


def _conditional_feed_response(
    request: HttpRequest, body: bytes, updated: datetime, content_type: str
) -> HttpResponse:
    etag = f'"{hashlib.sha256(body).hexdigest()}"'
    last_modified = int(_timestamp(updated).timestamp())
    if request.headers.get("If-None-Match") == etag:
        response = HttpResponse(status=304)
    else:
        modified_since = parse_http_date_safe(request.headers.get("If-Modified-Since", ""))
        if modified_since is not None and modified_since >= last_modified:
            response = HttpResponse(status=304)
        else:
            response = HttpResponse(body, content_type=content_type)
    response["ETag"] = etag
    response["Last-Modified"] = http_date(last_modified)
    response["Cache-Control"] = FEED_CACHE_CONTROL
    return response


class PublicProfileAtomFeedView(View):
    """Serve a privacy-filtered, validator-aware Atom 1.0 profile feed."""

    def get(self, request: HttpRequest, handle: str) -> HttpResponse:
        profile = _public_profile_or_404(handle)
        body, updated = _build_feed(request, profile)
        return _conditional_feed_response(
            request, body, updated, "application/atom+xml; charset=utf-8"
        )


class PublicProfileRSSFeedView(View):
    """Serve the shared public profile projection as RSS 2.0."""

    def get(self, request: HttpRequest, handle: str) -> HttpResponse:
        profile = _public_profile_or_404(handle)
        body, updated = _build_rss_feed(request, profile)
        return _conditional_feed_response(request, body, updated, "application/rss+xml")


class PublicProfileJSONFeedView(View):
    """Serve the shared public profile projection as JSON Feed 1.1."""

    def get(self, request: HttpRequest, handle: str) -> HttpResponse:
        profile = _public_profile_or_404(handle)
        body, updated = _build_json_feed(request, profile)
        return _conditional_feed_response(request, body, updated, "application/feed+json")
