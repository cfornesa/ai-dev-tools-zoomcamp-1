"""Stateless, public MCP server mounted beside Django's ASGI application."""

from __future__ import annotations

import base64
import json
import uuid
from typing import Any

from asgiref.sync import sync_to_async
from django.conf import settings
from django.db.models import Prefetch
from django.http import Http404
from mcp.server.fastmcp import FastMCP, Image
from mcp.server.transport_security import TransportSecuritySettings
from rest_framework.renderers import JSONRenderer

from backend.views import health_status
from scenes.gallery import (
    DEFAULT_PAGE_SIZE,
    GALLERY_KIND_RANK,
    InvalidCursor,
    clamp_page_size,
    decode_gallery_cursor,
    eligible_projects,
    eligible_projects3d,
    encode_gallery_cursor,
    filter_after_gallery_cursor,
)
from scenes.models import PieceIntakeAsset, Project, SceneVersion, Template, Thumbnail
from scenes.serializers import (
    PublicProject3DListItemSerializer,
    PublicProjectListItemSerializer,
    PublicProjectSerializer,
    TemplateSerializer,
)
from scenes.thumbnail_generation import ensure_thumbnail_for_version

MAX_MCP_REQUEST_BODY_SIZE = 256 * 1024


def _mcp_allowed_hosts() -> list[str]:
    """Translate Django's explicit host allowlist to the SDK's host syntax."""
    hosts: list[str] = []
    for configured in settings.ALLOWED_HOSTS:
        host = configured.strip().lower()
        if not host or host == "*":
            continue
        hosts.extend((host, f"{host}:*"))
    return hosts


server = FastMCP(
    "Creatrweb Public MCP",
    instructions="Anonymous read-only MCP tools for the public Creatrweb application.",
    streamable_http_path="/mcp/",
    stateless_http=True,
    json_response=True,
    max_request_body_size=MAX_MCP_REQUEST_BODY_SIZE,
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=_mcp_allowed_hosts(),
        allowed_origins=list(settings.CSRF_TRUSTED_ORIGINS),
    ),
)


@server.tool(
    name="health_check",
    description=(
        "Check whether the application database and cache are available. "
        "Returns status, database, and cache without connection details."
    ),
)
async def health_check() -> dict[str, str]:
    """Return the same connection-safe status as GET /health/."""
    return await sync_to_async(health_status, thread_sensitive=True)()


def _public_gallery_page(cursor: str | None, page_size: int) -> dict[str, Any]:
    """Return the REST project-gallery page using its 2D and 3D selectors."""
    queryset_2d = eligible_projects()
    queryset_3d = eligible_projects3d()
    if cursor:
        try:
            cursor_timestamp, cursor_kind, object_id, _gallery_type = decode_gallery_cursor(cursor)
        except InvalidCursor as exc:
            raise ValueError("Invalid or expired cursor.") from exc
        queryset_2d = filter_after_gallery_cursor(
            queryset_2d, cursor_timestamp, cursor_kind, object_id
        )
        queryset_3d = filter_after_gallery_cursor(
            queryset_3d, cursor_timestamp, cursor_kind, object_id
        )
    candidates = [
        (project.published_at, "2d", project.id, project)
        for project in queryset_2d[: page_size + 1]
    ] + [
        (project.published_at, "3d", project.id, project)
        for project in queryset_3d[: page_size + 1]
    ]
    candidates.sort(key=lambda item: (item[0], -GALLERY_KIND_RANK[item[1]], item[2]), reverse=True)
    has_more = len(candidates) > page_size
    page = candidates[:page_size]
    next_cursor = None
    if has_more and page:
        current_timestamp = page[-1][0]
        assert current_timestamp is not None
        next_cursor = encode_gallery_cursor(current_timestamp, page[-1][1], page[-1][2])
    return {
        "results": [
            json.loads(
                JSONRenderer().render(
                    (
                        PublicProjectListItemSerializer
                        if kind == "2d"
                        else PublicProject3DListItemSerializer
                    )(project).data
                )
            )
            for _, kind, _, project in page
        ],
        "next_cursor": next_cursor,
        "has_more": has_more,
    }


def _public_project(public_id: str) -> dict[str, Any]:
    try:
        project = Project.objects.get(public_id=uuid.UUID(public_id))
    except (Project.DoesNotExist, ValueError, TypeError) as exc:
        raise Http404 from exc
    if project.visibility != Project.Visibility.PUBLIC or project.current_version_id is None:
        raise Http404
    project = Project.objects.prefetch_related(
        Prefetch(
            "versions",
            queryset=SceneVersion.objects.order_by("-sequence", "-id"),
            to_attr="_public_version_summaries",
        )
    ).get(pk=project.pk)
    return json.loads(JSONRenderer().render(PublicProjectSerializer(project).data))


def _built_in_templates() -> list[dict[str, Any]]:
    templates = Template.objects.built_in().select_related("owner")
    return json.loads(JSONRenderer().render(TemplateSerializer(templates, many=True).data))


def _public_thumbnail(public_id: str) -> tuple[bytes, str]:
    try:
        project = Project.objects.get(public_id=uuid.UUID(public_id))
    except (Project.DoesNotExist, ValueError, TypeError) as exc:
        raise Http404 from exc
    if project.visibility != Project.Visibility.PUBLIC or project.current_version_id is None:
        raise Http404
    thumbnail = Thumbnail.objects.filter(scene_version_id=project.current_version_id).first()
    if thumbnail is None:
        thumbnail = ensure_thumbnail_for_version(project.current_version_id)
    if thumbnail is None:
        raise Http404
    return bytes(thumbnail.image_data), thumbnail.content_type


def _published_asset(public_id: str, asset_id: str) -> dict[str, str]:
    try:
        piece_id = uuid.UUID(public_id)
        source_id = uuid.UUID(asset_id)
    except (ValueError, TypeError) as exc:
        raise Http404 from exc
    piece = Project.objects.filter(
        public_id=piece_id,
        visibility=Project.Visibility.PUBLIC,
        is_deleted=False,
    ).exists()
    if not piece:
        raise Http404
    asset = (
        PieceIntakeAsset.objects.filter(
            piece_kind="2d", piece_public_id=piece_id, source_asset_id=source_id
        )
        .order_by("-created_at", "-id")
        .first()
    )
    if asset is None:
        raise Http404
    return {
        "media_type": asset.mime_type,
        "data_base64": base64.b64encode(bytes(asset.data)).decode("ascii"),
        "checksum": asset.checksum,
    }


@server.tool(
    name="list_public_gallery",
    description=(
        "List one bounded, newest-published-first page from the REST public project gallery. "
        "Pass the returned next_cursor to continue; page_size is clamped to 1–60."
    ),
)
async def list_public_gallery(cursor: str | None = None, page_size: int = DEFAULT_PAGE_SIZE):
    return await sync_to_async(_public_gallery_page, thread_sensitive=True)(
        cursor, clamp_page_size(page_size)
    )


@server.tool(
    name="get_public_project",
    description=(
        "Read the full public 2D project payload for a public UUID; "
        "non-public projects return not found."
    ),
)
async def get_public_project(project_id: str) -> dict[str, Any]:
    return await sync_to_async(_public_project, thread_sensitive=True)(project_id)


@server.tool(
    name="get_public_thumbnail",
    description="Read the current thumbnail of a public 2D project as MCP image content.",
)
async def get_public_thumbnail(project_id: str) -> Image:
    data, media_type = await sync_to_async(_public_thumbnail, thread_sensitive=True)(project_id)
    return Image(data=data, format=media_type.removeprefix("image/"))


@server.tool(
    name="list_templates",
    description=(
        "List built-in scene templates visible anonymously; private templates are never included."
    ),
)
async def list_templates() -> list[dict[str, Any]]:
    return await sync_to_async(_built_in_templates, thread_sensitive=True)()


@server.tool(
    name="get_published_asset",
    description=(
        "Read one retained asset from a currently public 2D piece as base64 "
        "with its media type and checksum."
    ),
)
async def get_published_asset(project_id: str, asset_id: str) -> dict[str, str]:
    return await sync_to_async(_published_asset, thread_sensitive=True)(project_id, asset_id)


@server.resource(
    "gallery://public",
    name="public_gallery",
    description="The first bounded page of the public 2D project gallery.",
    mime_type="application/json",
)
async def public_gallery_resource() -> dict[str, Any]:
    return await sync_to_async(_public_gallery_page, thread_sensitive=True)(None, DEFAULT_PAGE_SIZE)


@server.resource(
    "project://{project_id}",
    name="public_project",
    description="A public 2D project by UUID; private and missing projects are not found.",
    mime_type="application/json",
)
async def public_project_resource(project_id: str) -> dict[str, Any]:
    return await sync_to_async(_public_project, thread_sensitive=True)(project_id)


class DjangoMCPApplication:
    """Dispatch MCP transport requests and ASGI lifespan to the SDK app."""

    def __init__(self, django_app: Any, mcp_app: Any) -> None:
        self.django_app = django_app
        self.mcp_app = mcp_app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] == "lifespan":
            await self._lifespan(receive, send)
            return

        if scope["type"] == "http" and scope.get("path") in {"/mcp", "/mcp/"}:
            await self.mcp_app(scope, receive, send)
            return

        await self.django_app(scope, receive, send)

    async def _lifespan(self, receive, send) -> None:
        startup_complete = False
        try:
            async with self.mcp_app.router.lifespan_context(self.mcp_app):
                while True:
                    message = await receive()
                    if message["type"] == "lifespan.startup":
                        await send({"type": "lifespan.startup.complete"})
                        startup_complete = True
                    elif message["type"] == "lifespan.shutdown":
                        await send({"type": "lifespan.shutdown.complete"})
                        return
        except Exception:
            await send(
                {
                    "type": "lifespan.shutdown.failed"
                    if startup_complete
                    else "lifespan.startup.failed",
                    "message": "MCP server lifespan failed",
                }
            )
            raise


def create_mcp_asgi_app(django_app: Any) -> DjangoMCPApplication:
    """Create the production ASGI router for the Django and MCP applications."""
    return DjangoMCPApplication(django_app, server.streamable_http_app())
