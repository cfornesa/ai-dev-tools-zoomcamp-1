"""Stateless, public MCP server mounted beside Django's ASGI application."""

from __future__ import annotations

import base64
import contextvars
import functools
import hashlib
import hmac
import ipaddress
import json
import time
import uuid
from typing import Any

from asgiref.sync import sync_to_async
from django.conf import settings
from django.core.cache import cache
from django.db.models import Count, Prefetch, Q, Value
from django.db.models.functions import Coalesce
from django.http import Http404
from mcp.server.fastmcp import FastMCP, Image
from mcp.server.transport_security import TransportSecuritySettings
from mcp.shared.exceptions import McpError
from mcp.types import ErrorData
from rest_framework.renderers import JSONRenderer

from backend.views import health_status
from scenes.art_piece_persistence import _piece_data, _public_piece_or_404, eligible_art_pieces
from scenes.collections import collection_payload, public_collection
from scenes.gallery import (
    DEFAULT_PAGE_SIZE,
    GALLERY_KIND_RANK,
    VALID_GALLERY_TYPES,
    InvalidCursor,
    clamp_page_size,
    decode_gallery_cursor,
    eligible_collections,
    eligible_projects,
    eligible_projects3d,
    encode_gallery_cursor,
    filter_after_gallery_cursor,
)
from scenes.models import (
    ArtPiece,
    Collection,
    CollectionItem,
    MCPToolAuditEvent,
    PieceIntakeAsset,
    Project,
    Project3D,
    PublicProfile,
    SceneVersion,
    SceneVersion3D,
    Template,
    Thumbnail,
)
from scenes.public_identity import public_author_name
from scenes.public_search_api import (
    COLLECTION_SORTS,
    _after_collection_cursor,
    _decode_collection_cursor,
    _encode_collection_cursor,
    _public_collection_index_payloads,
)
from scenes.serializers import (
    PublicGalleryItemSerializer,
    PublicProject3DListItemSerializer,
    PublicProject3DSerializer,
    PublicProjectListItemSerializer,
    PublicProjectSerializer,
    TemplateSerializer,
)
from scenes.thumbnail_generation import ensure_thumbnail_for_version

MAX_MCP_REQUEST_BODY_SIZE = 256 * 1024
MCP_RATE_LIMIT_REQUESTS = 60
MCP_RATE_LIMIT_WINDOW_SECONDS = 60
_mcp_client_ip: contextvars.ContextVar[str] = contextvars.ContextVar(
    "mcp_client_ip", default="unknown"
)


def _trusted_client_ip(scope: dict[str, Any]) -> str:
    """Honor X-Forwarded-For only when the immediate peer is loopback Vite."""
    peer = scope.get("client")
    peer_ip = peer[0] if peer else "unknown"
    try:
        trusted_proxy = ipaddress.ip_address(peer_ip).is_loopback
    except ValueError:
        trusted_proxy = False
    if not trusted_proxy:
        return peer_ip
    forwarded_for = next(
        (
            value.decode("latin-1")
            for name, value in scope.get("headers", [])
            if name == b"x-forwarded-for"
        ),
        "",
    )
    if not forwarded_for:
        return peer_ip
    candidate = forwarded_for.split(",", maxsplit=1)[0].strip()
    try:
        return str(ipaddress.ip_address(candidate))
    except ValueError:
        return peer_ip


def _consume_mcp_rate_limit(client_ip: str, now: float | None = None) -> int | None:
    """Return retry seconds when the per-IP fixed-window cap has been exceeded."""
    current_time = time.time() if now is None else now
    bucket = int(current_time // MCP_RATE_LIMIT_WINDOW_SECONDS)
    digest = _client_ip_fingerprint(client_ip)
    key = f"mcp:anonymous:{digest}:{bucket}"
    if not cache.add(key, 1, timeout=MCP_RATE_LIMIT_WINDOW_SECONDS + 1):
        try:
            count = cache.incr(key)
        except ValueError:
            cache.add(key, 1, timeout=MCP_RATE_LIMIT_WINDOW_SECONDS + 1)
            count = 1
    else:
        count = 1
    if count <= MCP_RATE_LIMIT_REQUESTS:
        return None
    return MCP_RATE_LIMIT_WINDOW_SECONDS - int(current_time % MCP_RATE_LIMIT_WINDOW_SECONDS)


def _client_ip_fingerprint(client_ip: str) -> str:
    """Make a stable keyed client identifier without retaining a raw address."""
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"), client_ip.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def _write_mcp_audit(
    tool_name: str, outcome: str, duration_ms: int, client_ip_fingerprint: str
) -> None:
    MCPToolAuditEvent.objects.create(
        tool_name=tool_name,
        client_id=None,
        client_ip_fingerprint=client_ip_fingerprint,
        user=None,
        outcome=outcome,
        duration_ms=duration_ms,
    )


def _audited_tool(tool_name: str):
    """Rate-limit and record one payload-free audit row for every invocation."""

    def decorate(function):
        @functools.wraps(function)
        async def invoke(*args, **kwargs):
            started = time.monotonic()
            outcome = MCPToolAuditEvent.Outcome.ERROR
            try:
                retry_after = await sync_to_async(_consume_mcp_rate_limit, thread_sensitive=True)(
                    _mcp_client_ip.get()
                )
                if retry_after is not None:
                    outcome = MCPToolAuditEvent.Outcome.RATE_LIMITED
                    raise McpError(
                        ErrorData(
                            code=-32029,
                            message=(
                                f"MCP rate limit exceeded; retry_after_seconds={retry_after}."
                            ),
                            data={"retry_after_seconds": retry_after},
                        )
                    )
                result = await function(*args, **kwargs)
                outcome = MCPToolAuditEvent.Outcome.SUCCESS
                return result
            finally:
                duration_ms = max(0, int((time.monotonic() - started) * 1000))
                await sync_to_async(_write_mcp_audit, thread_sensitive=True)(
                    tool_name,
                    outcome,
                    duration_ms,
                    _client_ip_fingerprint(_mcp_client_ip.get()),
                )

        return invoke

    return decorate


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
@_audited_tool("health_check")
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


def _unified_gallery_page(  # noqa: C901
    gallery_type: str, engine: str | None, cursor: str | None, page_size: int
) -> dict[str, Any]:
    if gallery_type not in VALID_GALLERY_TYPES:
        raise ValueError("type must be all, authored, pieces, collections, or generated.")
    querysets: dict[str, Any] = {}
    queryset_kinds = {
        "all": ("2d", "3d", "collection", "generated"),
        "authored": ("2d", "3d"),
        "pieces": ("2d", "3d", "generated"),
        "collections": ("collection",),
        "generated": ("generated",),
    }[gallery_type]
    if engine is not None and engine not in {value for value, _ in ArtPiece.Engine.choices}:
        raise ValueError("engine must be a supported public gallery engine.")
    for kind in queryset_kinds:
        if kind == "2d":
            querysets[kind] = eligible_projects()
        elif kind == "3d":
            querysets[kind] = eligible_projects3d()
        elif kind == "collection":
            querysets[kind] = eligible_collections()
        else:
            querysets[kind] = eligible_art_pieces().filter(**({"engine": engine} if engine else {}))
    if cursor:
        try:
            cursor_timestamp, cursor_kind, cursor_id, cursor_type = decode_gallery_cursor(cursor)
        except InvalidCursor as exc:
            raise ValueError("Invalid or expired cursor.") from exc
        if cursor_type != gallery_type:
            raise ValueError("Invalid or expired cursor.")
        for kind, queryset in querysets.items():
            querysets[kind] = filter_after_gallery_cursor(
                queryset, cursor_timestamp, cursor_kind, cursor_id
            )
    candidates: list[tuple[Any, int, int, str, Any]] = []
    for kind, queryset in querysets.items():
        for record in queryset[: page_size + 1]:
            candidates.append(
                (record.published_at, -GALLERY_KIND_RANK[kind], record.id, kind, record)
            )
    candidates.sort(key=lambda entry: entry[:3], reverse=True)
    has_more = len(candidates) > page_size
    page = candidates[:page_size]
    next_cursor = None
    if has_more and page:
        timestamp, _, object_id, kind, _ = page[-1]
        next_cursor = encode_gallery_cursor(timestamp, kind, object_id, gallery_type)
    results = json.loads(
        JSONRenderer().render(
            PublicGalleryItemSerializer(
                [(kind, record) for _, _, _, kind, record in page], many=True
            ).data
        )
    )
    engine_catalog = [
        {
            "value": value,
            "label": label,
            "count": eligible_art_pieces().filter(engine=value).count()
            if gallery_type in ("all", "generated")
            else 0,
            "available": bool(
                gallery_type in ("all", "generated")
                and eligible_art_pieces().filter(engine=value).exists()
            ),
        }
        for value, label in ArtPiece.Engine.choices
    ]
    return {
        "results": results,
        "next_cursor": next_cursor,
        "has_more": has_more,
        "engine_catalog": engine_catalog,
    }


def _public_3d_project(public_id: str) -> dict[str, Any]:
    try:
        project = Project3D.objects.get(public_id=uuid.UUID(public_id))
    except (Project3D.DoesNotExist, ValueError, TypeError) as exc:
        raise Http404 from exc
    if project.visibility != Project3D.Visibility.PUBLIC:
        raise Http404
    project = Project3D.objects.prefetch_related(
        Prefetch(
            "versions",
            queryset=SceneVersion3D.objects.order_by("-sequence", "-id"),
            to_attr="_public_version_summaries",
        )
    ).get(pk=project.pk)
    return json.loads(JSONRenderer().render(PublicProject3DSerializer(project).data))


def _public_generated_piece(public_id: str) -> dict[str, Any]:
    piece = _public_piece_or_404(public_id)
    return json.loads(JSONRenderer().render(_piece_data(piece, public=True)))


def _public_collection_page(sort: str, cursor: str | None, page_size: int) -> dict[str, Any]:
    if sort not in COLLECTION_SORTS:
        raise ValueError("sort must be newest, oldest, or item_count.")
    queryset = (
        eligible_collections()
        .filter(status=Collection.Status.ACTIVE)
        .prefetch_related(
            Prefetch(
                "items",
                queryset=CollectionItem.objects.only("collection_id", "kind", "item_id"),
                to_attr="_public_index_items",
            )
        )
    )
    if sort == "item_count":
        public_item_count = sum(
            (
                Coalesce(
                    Count(
                        "items",
                        filter=Q(items__kind=kind, items__item_id__in=eligible.values("public_id")),
                        distinct=True,
                    ),
                    Value(0),
                )
                for kind, eligible in (
                    (CollectionItem.Kind.PROJECT, eligible_projects()),
                    (CollectionItem.Kind.PROJECT3D, eligible_projects3d()),
                    (CollectionItem.Kind.ART_PIECE, eligible_art_pieces()),
                )
            )
        )
        queryset = queryset.annotate(_index_item_count=public_item_count).order_by(
            "-_index_item_count", "-published_at", "-id"
        )
    elif sort == "oldest":
        queryset = queryset.order_by("published_at", "id")
    else:
        queryset = queryset.order_by("-published_at", "-id")
    if cursor:
        try:
            cursor_sort, count, published_at, object_id = _decode_collection_cursor(cursor)
        except ValueError as exc:
            raise ValueError("Invalid or expired cursor.") from exc
        if cursor_sort != sort:
            raise ValueError("Invalid or expired cursor.")
        queryset = _after_collection_cursor(queryset, sort, count, published_at, object_id)
    page = list(queryset[: page_size + 1])
    has_more = len(page) > page_size
    page = page[:page_size]
    next_cursor = _encode_collection_cursor(sort, page[-1]) if has_more and page else None
    return {
        "results": json.loads(JSONRenderer().render(_public_collection_index_payloads(page))),
        "next_cursor": next_cursor,
        "has_more": has_more,
    }


def _public_collection_detail(handle: str, slug: str) -> dict[str, Any]:
    collection = public_collection(handle=handle, slug=slug)
    if collection is None:
        raise Http404
    return collection_payload(collection, public=True)


def _public_search(query: str, scope: str) -> dict[str, Any]:
    query = query.strip()
    if len(query) > 100 or scope not in {"accounts", "content"}:
        raise ValueError("Invalid search query.")
    if not query:
        return {"scope": scope, "results": []}
    if scope == "accounts":
        profiles = (
            PublicProfile.objects.filter(is_public=True)
            .filter(
                Q(handle__icontains=query)
                | Q(display_name__icontains=query)
                | Q(user__username__icontains=query)
            )
            .select_related("user")
            .order_by("handle")[:50]
        )
        results = [
            {
                "id": str(profile.user_id),
                "kind": "account",
                "title": profile.display_name or profile.handle,
                "owner": public_author_name(profile.user),
                "owner_handle": profile.handle,
                "handle": profile.handle,
                "viewer_url": f"/users/@{profile.handle}",
            }
            for profile in profiles
        ]
    else:
        candidates: list[tuple[Any, str, Any]] = []
        for kind, queryset in (
            ("2d", eligible_projects()),
            ("3d", eligible_projects3d()),
            ("generated", eligible_art_pieces()),
        ):
            filtered = (
                queryset.filter(Q(title__icontains=query) | Q(description__icontains=query))
                if kind != "3d"
                else queryset.filter(title__icontains=query)
            )
            candidates.extend((record.published_at, kind, record) for record in filtered[:50])
        candidates.sort(key=lambda item: (item[0], item[2].id), reverse=True)
        results = json.loads(
            JSONRenderer().render(
                PublicGalleryItemSerializer(
                    [(kind, record) for _, kind, record in candidates[:50]], many=True
                ).data
            )
        )
    return {"scope": scope, "results": results}


@server.tool(
    name="list_public_gallery",
    description=(
        "List one bounded, newest-published-first page from the REST public project gallery. "
        "Pass the returned next_cursor to continue; page_size is clamped to 1–60."
    ),
)
@_audited_tool("list_public_gallery")
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
@_audited_tool("get_public_project")
async def get_public_project(project_id: str) -> dict[str, Any]:
    return await sync_to_async(_public_project, thread_sensitive=True)(project_id)


@server.tool(
    name="get_public_thumbnail",
    description="Read the current thumbnail of a public 2D project as MCP image content.",
)
@_audited_tool("get_public_thumbnail")
async def get_public_thumbnail(project_id: str) -> Image:
    data, media_type = await sync_to_async(_public_thumbnail, thread_sensitive=True)(project_id)
    return Image(data=data, format=media_type.removeprefix("image/"))


@server.tool(
    name="list_templates",
    description=(
        "List built-in scene templates visible anonymously; private templates are never included."
    ),
)
@_audited_tool("list_templates")
async def list_templates() -> list[dict[str, Any]]:
    return await sync_to_async(_built_in_templates, thread_sensitive=True)()


@server.tool(
    name="get_published_asset",
    description=(
        "Read one retained asset from a currently public 2D piece as base64 "
        "with its media type and checksum."
    ),
)
@_audited_tool("get_published_asset")
async def get_published_asset(project_id: str, asset_id: str) -> dict[str, str]:
    return await sync_to_async(_published_asset, thread_sensitive=True)(project_id, asset_id)


@server.tool(
    name="list_public_pieces",
    description=(
        "List one bounded page of eligible public 2D, 3D, generated, and collection cards. "
        "Use the returned cursor with the same type filter."
    ),
)
@_audited_tool("list_public_pieces")
async def list_public_pieces(
    gallery_type: str = "all",
    engine: str | None = None,
    cursor: str | None = None,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> dict[str, Any]:
    return await sync_to_async(_unified_gallery_page, thread_sensitive=True)(
        gallery_type, engine, cursor, clamp_page_size(page_size)
    )


@server.tool(
    name="get_public_3d_project",
    description=(
        "Read a public 3D project and its public scene data; "
        "private or missing projects are not found."
    ),
)
@_audited_tool("get_public_3d_project")
async def get_public_3d_project(project_id: str) -> dict[str, Any]:
    return await sync_to_async(_public_3d_project, thread_sensitive=True)(project_id)


@server.tool(
    name="get_public_art_piece",
    description=(
        "Read metadata and the currently public version for one published generated art piece."
    ),
)
@_audited_tool("get_public_art_piece")
async def get_public_art_piece(piece_id: str) -> dict[str, Any]:
    return await sync_to_async(_public_generated_piece, thread_sensitive=True)(piece_id)


@server.tool(
    name="list_public_collections",
    description="List bounded public collection cards; sort may be newest, oldest, or item_count.",
)
@_audited_tool("list_public_collections")
async def list_public_collections(
    sort: str = "newest", cursor: str | None = None, page_size: int = DEFAULT_PAGE_SIZE
) -> dict[str, Any]:
    return await sync_to_async(_public_collection_page, thread_sensitive=True)(
        sort, cursor, clamp_page_size(page_size)
    )


@server.tool(
    name="get_public_collection",
    description="Read one active, published collection through its public handle and slug.",
)
@_audited_tool("get_public_collection")
async def get_public_collection(handle: str, slug: str) -> dict[str, Any]:
    return await sync_to_async(_public_collection_detail, thread_sensitive=True)(handle, slug)


@server.tool(
    name="search_public",
    description="Search eligible public content or public accounts; results are capped at 50.",
)
@_audited_tool("search_public")
async def search_public(query: str, scope: str = "content") -> dict[str, Any]:
    return await sync_to_async(_public_search, thread_sensitive=True)(query, scope)


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
            token = _mcp_client_ip.set(_trusted_client_ip(scope))
            try:
                await self.mcp_app(scope, receive, send)
            finally:
                _mcp_client_ip.reset(token)
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
