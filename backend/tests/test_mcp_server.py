"""MCP Streamable HTTP contract tests for anonymous public operations."""

from __future__ import annotations

import base64
import copy
import hashlib
import io
import json
import secrets
import uuid
import zipfile
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace

import anyio
import httpx
import pytest
from asgiref.testing import ApplicationCommunicator
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.http import Http404
from django.utils import timezone
from mcp.client.session import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.types import TextContent, TextResourceContents
from oauth2_provider.models import AccessToken, Application
from pydantic import AnyUrl
from rest_framework.test import APIClient

from backend.asgi import application
from scenes.mcp.server import (
    MAX_MCP_REQUEST_BODY_SIZE,
    _built_in_templates,
    _public_3d_project,
    _public_collection_detail,
    _public_collection_page,
    _public_gallery_page,
    _public_generated_piece,
    _public_project,
    _public_search,
    _public_thumbnail,
    _published_asset,
    _trusted_client_ip,
    _unified_gallery_page,
    create_mcp_asgi_app,
    public_apps_server,
    server,
)
from scenes.models import (
    AIProviderModel,
    ArtPiece,
    ArtPieceVersion,
    Collection,
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

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures"
        / "valid"
        / "blank.json"
    ).read_text()
)
MINIMAL_SCENE_3D = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures3d"
        / "valid"
        / "minimal.json"
    ).read_text()
)


def _create_mcp_access_token(
    user,
    *,
    oauth_application=None,
    scopes=("gallery:read",),
    resource="http://localhost:8000/mcp",
    expires=None,
):
    if oauth_application is None:
        oauth_application = Application.objects.create(
            name="MCP test client",
            redirect_uris="https://client.example/callback",
            client_type=Application.CLIENT_PUBLIC,
            authorization_grant_type=Application.GRANT_AUTHORIZATION_CODE,
            skip_authorization=False,
        )
    token_value = secrets.token_urlsafe(32)
    token = AccessToken.objects.create(
        user=user,
        application=oauth_application,
        token="",
        token_checksum=hashlib.sha256(token_value.encode("utf-8")).hexdigest(),
        expires=expires or timezone.now() + timedelta(minutes=10),
        scope=" ".join(scopes),
        resource=[resource],
    )
    return token_value, oauth_application, token


def _call_mcp_tools(token_value, calls, *, client_ip="203.0.113.5"):
    async def exercise():
        # The SDK session managers are single-use after lifespan shutdown.
        # Each helper invocation represents a fresh server process.
        server._session_manager = None
        public_apps_server._session_manager = None
        test_application = create_mcp_asgi_app(application.django_app)
        lifespan = ApplicationCommunicator(test_application, {"type": "lifespan"})
        await lifespan.send_input({"type": "lifespan.startup"})
        assert await lifespan.receive_output() == {"type": "lifespan.startup.complete"}
        try:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=test_application),
                base_url="http://localhost:8000",
                headers={
                    "Authorization": f"Bearer {token_value}",
                    "Origin": "http://localhost:8000",
                    "X-Forwarded-For": client_ip,
                },
            ) as http_client:
                async with streamable_http_client(
                    "http://localhost:8000/mcp/", http_client=http_client
                ) as (read_stream, write_stream, _):
                    async with ClientSession(read_stream, write_stream) as mcp_client:
                        await mcp_client.initialize()
                        return [
                            await mcp_client.call_tool(name, arguments or {})
                            for name, arguments in calls
                        ]
        finally:
            await lifespan.send_input({"type": "lifespan.shutdown"})
            assert await lifespan.receive_output() == {"type": "lifespan.shutdown.complete"}
            await lifespan.wait()

    return anyio.run(exercise)


def _call_mcp_tool(token_value, tool_name, arguments=None, *, client_ip="203.0.113.5"):
    return _call_mcp_tools(token_value, [(tool_name, arguments or {})], client_ip=client_ip)[0]


def _mcp_result_payload(result):
    assert result.isError is not True
    if result.structuredContent is not None:
        structured = result.structuredContent
        return structured["result"] if set(structured) == {"result"} else structured
    text_content = next(block.text for block in result.content if isinstance(block, TextContent))
    return json.loads(text_content)


def _call_public_apps(calls):
    async def exercise():
        server._session_manager = None
        public_apps_server._session_manager = None
        test_application = create_mcp_asgi_app(application.django_app)
        lifespan = ApplicationCommunicator(test_application, {"type": "lifespan"})
        await lifespan.send_input({"type": "lifespan.startup"})
        assert await lifespan.receive_output() == {"type": "lifespan.startup.complete"}
        try:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=test_application),
                base_url="http://localhost:8000",
                headers={"Origin": "http://localhost:8000", "X-Forwarded-For": "203.0.113.5"},
            ) as http_client:
                async with streamable_http_client(
                    "http://localhost:8000/mcp/apps/", http_client=http_client
                ) as (read_stream, write_stream, _):
                    async with ClientSession(read_stream, write_stream) as mcp_client:
                        await mcp_client.initialize()
                        tools = await mcp_client.list_tools()
                        resources = await mcp_client.list_resources()
                        resource = await mcp_client.read_resource(
                            AnyUrl("ui://creatrweb/public-content")
                        )
                        results = [
                            await mcp_client.call_tool(name, arguments or {})
                            for name, arguments in calls
                        ]
                        return tools, resources, resource, results
        finally:
            await lifespan.send_input({"type": "lifespan.shutdown"})
            assert await lifespan.receive_output() == {"type": "lifespan.shutdown.complete"}
            await lifespan.wait()

    return anyio.run(exercise)


def _enable_mistral_agent_model() -> None:
    AIProviderModel.objects.update_or_create(
        vendor="mistral",
        model_slug="mistral-small-latest",
        defaults={
            "display_label": "Mistral Small (test)",
            "task_kinds": ["agent_2d", "art_piece"],
            "agentic_supported": True,
            "active": True,
        },
    )


def _mcp_intake_package() -> bytes:
    record = json.dumps(BLANK_SCENE).encode()
    manifest = {
        "formatVersion": 1,
        "kind": "2d",
        "metadata": {
            "title": "MCP intake fixture",
            "description": "MCP intake fixture",
            "tags": [],
            "visibilityIntent": "private",
            "origin": {"appVersion": "test", "exportedAt": "2026-09-26T00:00:00Z"},
        },
        "records": [{"index": 0, "schemaVersion": 1, "fileIndex": 0}],
        "mediaAssets": [],
        "files": [
            {
                "index": 0,
                "path": "files/0.json",
                "byteSize": len(record),
                "sha256": hashlib.sha256(record).hexdigest(),
            }
        ],
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("manifest.json", json.dumps(manifest))
        archive.writestr("files/0.json", record)
    return output.getvalue()


@pytest.mark.django_db(transaction=True)
def test_mcp_conformance_client_initializes_lists_and_calls_health_check():
    cache.clear()
    repo_root = Path(__file__).resolve().parents[2]
    vscode_config = json.loads((repo_root / "docs/examples/mcp.json").read_text())
    configured_url = vscode_config["servers"]["creatrweb-public"]["url"]
    mcp_docs = (repo_root / "docs/mcp.md").read_text()
    assert vscode_config["servers"]["creatrweb-public"]["type"] == "http"
    user = get_user_model().objects.create_user(username="mcp-authenticated-client")
    bearer_token, oauth_application, _ = _create_mcp_access_token(user)

    async def exercise_client() -> None:
        test_application = create_mcp_asgi_app(application.django_app)
        lifespan = ApplicationCommunicator(test_application, {"type": "lifespan"})
        await lifespan.send_input({"type": "lifespan.startup"})
        assert await lifespan.receive_output() == {"type": "lifespan.startup.complete"}
        try:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=test_application),
                headers={
                    "origin": "http://localhost:8000",
                    "cookie": "sessionid=ignored-session-cookie",
                    "authorization": f"Bearer {bearer_token}",
                    "x-forwarded-for": "203.0.113.5",
                },
            ) as http_client:
                client_url = configured_url.replace(
                    "https://<application-host>", "http://localhost:8000"
                )
                async with streamable_http_client(client_url, http_client=http_client) as (
                    read_stream,
                    write_stream,
                    _,
                ):
                    async with ClientSession(read_stream, write_stream) as client:
                        await client.initialize()
                        listing = await client.list_tools()
                        advertised_tool_names = {tool.name for tool in listing.tools}
                        assert advertised_tool_names == {
                            "health_check",
                            "whoami",
                            "list_public_gallery",
                            "get_public_project",
                            "get_public_thumbnail",
                            "list_templates",
                            "get_published_asset",
                            "list_public_pieces",
                            "get_public_3d_project",
                            "get_public_art_piece",
                            "list_public_collections",
                            "get_public_collection",
                            "search_public",
                            "list_my_projects",
                            "create_project",
                            "create_blank_project",
                            "get_project",
                            "update_project_metadata",
                            "publish_project",
                            "unpublish_project",
                            "fork_project",
                            "clone_template",
                            "list_versions",
                            "get_version",
                            "save_version",
                            "restore_version",
                            "save_version_as_template",
                            "ai_create_scene",
                            "ai_edit_scene",
                            "ai_accept_proposal",
                            "ai_start_run",
                            "ai_get_run",
                            "ai_generate_art_piece",
                            "list_my_3d_projects",
                            "create_3d_project",
                            "get_3d_project",
                            "update_3d_project_metadata",
                            "publish_3d_project",
                            "unpublish_3d_project",
                            "list_3d_versions",
                            "save_3d_version",
                            "ai_create_3d_scene",
                            "ai_edit_3d_scene",
                            "ai_accept_3d_proposal",
                            "intake_piece_package",
                            "delete_version",
                        }
                        assert "delete_project" not in advertised_tool_names
                        for tool in listing.tools:
                            matching_rows = [
                                line
                                for line in mcp_docs.splitlines()
                                if line.startswith(f"| `{tool.name}` |")
                            ]
                            row = matching_rows[-1]
                            assert all(
                                prop in row for prop in tool.inputSchema.get("properties", {})
                            ), (
                                f"{tool.name} schema fields missing from docs: "
                                f"{tool.inputSchema.get('properties', {})}; row={row}"
                            )
                        gallery_tool = next(
                            tool for tool in listing.tools if tool.name == "list_public_gallery"
                        )
                        assert set(gallery_tool.inputSchema["properties"]) == {
                            "cursor",
                            "page_size",
                        }
                        assert (
                            gallery_tool.inputSchema["properties"]["page_size"]["type"] == "integer"
                        )
                        assert gallery_tool.description is not None
                        assert "newest-published-first" in gallery_tool.description
                        assert gallery_tool.inputSchema.get("required", []) == []
                        resources = await client.list_resources()
                        assert {resource.name for resource in resources.resources} == {
                            "public_gallery",
                        }
                        templates = await client.list_resource_templates()
                        assert {template.name for template in templates.resourceTemplates} == {
                            "public_project",
                        }

                        result = await client.call_tool("health_check")
                        assert result.isError is not True
                        assert result.structuredContent == {
                            "status": "ok",
                            "database": "ok",
                            "cache": "ok",
                        }
                        identity = await client.call_tool("whoami")
                        assert identity.isError is not True
                        assert identity.structuredContent == {
                            "user_id": str(user.pk),
                            "username": user.get_username(),
                            "client_id": oauth_application.client_id,
                            "scopes": ["gallery:read"],
                        }
                        gallery_result = await client.call_tool(
                            "list_public_gallery", {"page_size": 0}
                        )
                        assert gallery_result.isError is not True
                        gallery_content = gallery_result.content[0]
                        assert isinstance(gallery_content, TextContent)
                        assert json.loads(gallery_content.text) == {
                            "results": [],
                            "next_cursor": None,
                            "has_more": False,
                        }
                        gallery_resource = await client.read_resource(AnyUrl("gallery://public"))
                        gallery_resource_content = gallery_resource.contents[0]
                        assert isinstance(gallery_resource_content, TextResourceContents)
                        assert json.loads(gallery_resource_content.text) == {
                            "results": [],
                            "next_cursor": None,
                            "has_more": False,
                        }
                        pieces_tool = next(
                            tool for tool in listing.tools if tool.name == "list_public_pieces"
                        )
                        assert set(pieces_tool.inputSchema["properties"]) == {
                            "gallery_type",
                            "engine",
                            "cursor",
                            "page_size",
                        }
                        pieces_result = await client.call_tool(
                            "list_public_pieces", {"page_size": 0}
                        )
                        pieces_content = pieces_result.content[0]
                        assert isinstance(pieces_content, TextContent)
                        pieces_page = json.loads(pieces_content.text)
                        assert pieces_page["results"] == []
                        assert pieces_page["next_cursor"] is None
                        assert pieces_page["has_more"] is False
                        assert isinstance(pieces_page["engine_catalog"], list)
                        for _ in range(56):
                            result = await client.call_tool("health_check")
                            assert result.isError is not True
                        limited = await client.call_tool("health_check")
                        assert limited.isError is True
                        assert "retry_after_seconds" in " ".join(
                            block.text for block in limited.content if block.type == "text"
                        )
                base = "http://localhost:8000"
                payload = {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}
                invalid_origin = await http_client.post(
                    f"{base}/mcp/",
                    json=payload,
                    headers={"Origin": "https://evil.example"},
                )
                assert invalid_origin.status_code == 403

                invalid_host = await http_client.post(
                    "http://evil.example:8000/mcp/",
                    json=payload,
                    headers={"Origin": "http://localhost:8000"},
                )
                assert invalid_host.status_code == 421

                unsupported_content_type = await http_client.post(
                    f"{base}/mcp/",
                    content="not-json",
                    headers={
                        "Content-Type": "text/plain",
                        "Origin": "http://localhost:8000",
                    },
                )
                assert unsupported_content_type.status_code == 400

                unsupported_method = await http_client.put(f"{base}/mcp/")
                assert unsupported_method.status_code == 405

                unknown_route = await http_client.post(
                    f"{base}/mcp/not-a-route/",
                    json=payload,
                    headers={"Origin": "http://localhost:8000"},
                )
                assert unknown_route.status_code == 404

                oversized = await http_client.post(
                    f"{base}/mcp/",
                    content='"' + ("x" * MAX_MCP_REQUEST_BODY_SIZE) + '"',
                    headers={
                        "Content-Type": "application/json",
                        "Origin": "http://localhost:8000",
                    },
                )
                assert oversized.status_code == 413
        finally:
            await lifespan.send_input({"type": "lifespan.shutdown"})
            assert await lifespan.receive_output() == {"type": "lifespan.shutdown.complete"}
            await lifespan.wait()

    anyio.run(exercise_client)
    audits = list(MCPToolAuditEvent.objects.order_by("id"))
    assert len(audits) == 61
    assert sum(event.outcome == MCPToolAuditEvent.Outcome.SUCCESS for event in audits) == 60
    assert sum(event.outcome == MCPToolAuditEvent.Outcome.RATE_LIMITED for event in audits) == 1
    assert all(event.duration_ms >= 0 for event in audits)
    assert all(event.client_id == oauth_application.client_id for event in audits)
    assert all(event.user_id == user.pk for event in audits)
    assert all(len(event.client_ip_fingerprint) == 64 for event in audits)
    assert "203.0.113.5" not in json.dumps([event.client_ip_fingerprint for event in audits])
    assert len({event.client_ip_fingerprint for event in audits}) == 1


@pytest.mark.django_db(transaction=True)
def test_anonymous_mcp_apps_exposes_only_public_content_and_sandboxed_widget():
    cache.clear()
    owner = get_user_model().objects.create_user(username="mcp-app-public-owner")
    public = Project.objects.create(
        owner=owner,
        title="MCP app public project",
        visibility=Project.Visibility.PUBLIC,
        published_at=timezone.now(),
    )
    version = SceneVersion.objects.create(
        project=public,
        sequence=1,
        scene_json=copy.deepcopy(BLANK_SCENE),
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    public.current_version = version
    public.save(update_fields=["current_version"])
    private = Project.objects.create(
        owner=owner,
        title="MCP app private project",
        visibility=Project.Visibility.PRIVATE,
        published_at=None,
    )
    private_version = SceneVersion.objects.create(
        project=private,
        sequence=1,
        scene_json=copy.deepcopy(BLANK_SCENE),
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    private.current_version = private_version
    private.save(update_fields=["current_version"])

    tools, resources, resource, results = _call_public_apps(
        [
            ("show_public_gallery", {"page_size": 12}),
            ("show_public_project", {"project_id": str(public.public_id)}),
            ("show_public_project", {"project_id": str(private.public_id)}),
        ]
    )

    assert {tool.name for tool in tools.tools} == {"show_public_gallery", "show_public_project"}
    assert all(
        tool.meta["ui"]
        == {
            "resourceUri": "ui://creatrweb/public-content",
            "visibility": ["model"],
        }
        for tool in tools.tools
    )
    assert {str(item.uri) for item in resources.resources} == {"ui://creatrweb/public-content"}
    assert resources.resources[0].mimeType == "text/html;profile=mcp-app"
    widget_content = resource.contents[0]
    assert isinstance(widget_content, TextResourceContents)
    assert widget_content.mimeType == "text/html;profile=mcp-app"
    assert widget_content.meta["ui"]["csp"] == {
        "connectDomains": [],
        "resourceDomains": [],
        "frameDomains": [],
        "baseUriDomains": [],
    }
    assert widget_content.meta["ui"]["permissions"] == {}
    assert "window.parent.postMessage" in widget_content.text
    assert "tools/call" not in widget_content.text
    assert "<script src=" not in widget_content.text
    assert "<iframe" not in widget_content.text.lower()

    gallery = _mcp_result_payload(results[0])
    assert [item["id"] for item in gallery["results"]] == [str(public.public_id)]
    assert gallery["site_origin"] == "http://localhost:8000"
    project_result = _mcp_result_payload(results[1])
    assert project_result["project"]["id"] == str(public.public_id)
    assert project_result["site_origin"] == "http://localhost:8000"
    assert project_result["viewer_url"].startswith("http://localhost:8000/")
    assert results[2].isError is True
    audit_rows = MCPToolAuditEvent.objects.filter(
        tool_name__in=("show_public_gallery", "show_public_project")
    )
    assert audit_rows.count() == 3
    assert not audit_rows.filter(user__isnull=False).exists()
    assert not audit_rows.filter(client_id__isnull=False).exists()


@pytest.mark.django_db(transaction=True)
def test_user_token_cannot_read_another_users_private_data_through_any_tool():
    caller = get_user_model().objects.create_user(username="mcp-caller-a")
    owner = get_user_model().objects.create_user(username="mcp-private-owner-b")
    bearer_token, _, _ = _create_mcp_access_token(caller)
    private_title = "MCP cross-user private sentinel"

    private_project = Project.objects.create(
        owner=owner,
        title=private_title,
        visibility=Project.Visibility.PRIVATE,
    )
    private_version = SceneVersion.objects.create(
        project=private_project,
        sequence=1,
        scene_json=copy.deepcopy(BLANK_SCENE),
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    private_project.current_version = private_version
    private_project.save(update_fields=["current_version"])
    asset_id = uuid.uuid4()
    asset_data = b"mcp-private-asset-sentinel"
    PieceIntakeAsset.objects.create(
        owner=owner,
        piece_kind="2d",
        piece_public_id=private_project.public_id,
        source_asset_id=asset_id,
        filename="private.bin",
        mime_type="application/octet-stream",
        byte_size=len(asset_data),
        checksum=hashlib.sha256(asset_data).hexdigest(),
        data=asset_data,
    )

    private_3d = Project3D.objects.create(owner=owner, title=private_title)
    private_3d_version = SceneVersion3D.objects.create(
        project=private_3d,
        sequence=1,
        scene_json=copy.deepcopy(MINIMAL_SCENE_3D),
        created_by=owner,
    )
    private_3d.current_version = private_3d_version
    private_3d.save(update_fields=["current_version"])
    private_art_piece = ArtPiece.objects.create(
        owner=owner,
        title=private_title,
        prompt="private prompt sentinel",
        engine=ArtPiece.Engine.SVG,
        status=ArtPiece.Status.DRAFT,
    )
    private_collection = Collection.objects.create(
        owner=owner,
        title=private_title,
        slug="private-mcp-sentinel",
    )
    Template.objects.create(
        owner=owner,
        source_type=Template.SourceType.PRIVATE,
        name=private_title,
        category="private",
        scene_json=copy.deepcopy(BLANK_SCENE),
    )

    calls = [
        ("health_check", {}),
        ("whoami", {}),
        ("list_public_gallery", {"page_size": 60}),
        ("get_public_project", {"project_id": str(private_project.public_id)}),
        ("get_public_thumbnail", {"project_id": str(private_project.public_id)}),
        (
            "get_published_asset",
            {"project_id": str(private_project.public_id), "asset_id": str(asset_id)},
        ),
        ("list_templates", {"page_size": 60}),
        ("list_public_pieces", {"page_size": 60}),
        ("get_public_3d_project", {"project_id": str(private_3d.public_id)}),
        ("get_public_art_piece", {"piece_id": str(private_art_piece.public_id)}),
        ("list_public_collections", {"page_size": 60}),
        (
            "get_public_collection",
            {"handle": "mcp-private-owner-b", "slug": private_collection.slug},
        ),
        ("search_public", {"query": private_title, "scope": "content"}),
    ]
    results = _call_mcp_tools(bearer_token, calls)

    for (tool_name, _), result in zip(calls, results, strict=True):
        if tool_name in {
            "get_public_project",
            "get_public_thumbnail",
            "get_published_asset",
            "get_public_3d_project",
            "get_public_art_piece",
            "get_public_collection",
        }:
            assert result.isError is True
        else:
            assert result.isError is not True
            serialized = json.dumps(result.model_dump())
            assert private_title not in serialized
            assert "private prompt sentinel" not in serialized
            assert "mcp-private-asset-sentinel" not in serialized
            if tool_name == "whoami":
                assert result.structuredContent["user_id"] == str(caller.pk)
                assert result.structuredContent["username"] == caller.get_username()
                assert owner.get_username() not in serialized


@pytest.mark.django_db(transaction=True)
def test_mcp_rejects_cookie_expired_and_wrong_audience_authentication(client):
    user = get_user_model().objects.create_user(username="mcp-auth-required")
    client.force_login(user)
    session_cookie = client.cookies["sessionid"].value
    expired_token, _, _ = _create_mcp_access_token(
        user, expires=timezone.now() - timedelta(seconds=1)
    )
    wrong_audience_token, _, _ = _create_mcp_access_token(
        user, resource="https://different.example/mcp"
    )
    payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}

    async def exercise_invalid_credentials():
        test_application = create_mcp_asgi_app(application.django_app)
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=test_application),
            base_url="http://localhost:8000",
        ) as http_client:
            cookie_only = await http_client.post(
                "/mcp/", json=payload, headers={"Cookie": f"sessionid={session_cookie}"}
            )
            assert cookie_only.status_code == 401
            assert cookie_only.json()["error"] == "invalid_token"
            assert "resource_metadata" in cookie_only.headers["WWW-Authenticate"]

            expired = await http_client.post(
                "/mcp/", json=payload, headers={"Authorization": f"Bearer {expired_token}"}
            )
            assert expired.status_code == 401
            assert expired.json()["error"] == "invalid_token"
            assert expired_token not in expired.text

            wrong_audience = await http_client.post(
                "/mcp/",
                json=payload,
                headers={"Authorization": f"Bearer {wrong_audience_token}"},
            )
            assert wrong_audience.status_code == 401
            assert wrong_audience.json()["error"] == "invalid_token"

    anyio.run(exercise_invalid_credentials)


@pytest.mark.django_db(transaction=True)
def test_mcp_enforces_tool_scope_and_exposes_identity_only_for_token_user():
    user = get_user_model().objects.create_user(username="mcp-project-writer")
    bearer_token, _, _ = _create_mcp_access_token(user, scopes=("projects:write",))

    results = _call_mcp_tools(
        bearer_token,
        [("list_public_gallery", {"page_size": 1}), ("whoami", {})],
    )
    gallery_result = results[0]
    assert gallery_result.isError is True
    assert "does not grant the required scope" in json.dumps(gallery_result.model_dump())

    identity = results[1]
    assert identity.isError is not True
    assert identity.structuredContent["user_id"] == str(user.pk)
    assert identity.structuredContent["scopes"] == ["projects:write"]


@pytest.mark.django_db(transaction=True)
def test_mcp_piece_intake_matches_rest_and_enforces_transport_limit_and_scope(monkeypatch):
    import scenes.piece_intake as intake
    from scenes.models import SiteSettings

    monkeypatch.setattr(intake, "get_effective_cap", lambda user, feature: 1)
    monkeypatch.setattr(intake, "_plan_quota", lambda user: (1_000_000, 10))
    monkeypatch.setattr(
        SiteSettings,
        "get_solo",
        classmethod(lambda cls: SimpleNamespace(cloud_sync_enabled=True)),
    )

    owner = get_user_model().objects.create_user(username="mcp-piece-intake-owner")
    token, _, _ = _create_mcp_access_token(owner, scopes=("projects:write",))
    rest = APIClient()
    rest.force_authenticate(owner)
    package = _mcp_intake_package()
    key = "mcp-intake-rest-parity"
    rest_response = rest.post(
        "/api/pieces/intake/",
        {"package": io.BytesIO(package), "idempotency_key": key},
        format="multipart",
    )
    assert rest_response.status_code == 201, rest_response.json()

    mcp_response = _call_mcp_tool(
        token,
        "intake_piece_package",
        {"package_base64": base64.b64encode(package).decode(), "idempotency_key": key},
    )
    assert _mcp_result_payload(mcp_response) == rest_response.json()
    assert Project.objects.filter(owner=owner).count() == 1
    assert SceneVersion.objects.filter(project__owner=owner).count() == 1

    invalid = b"not a zip archive"
    rest_invalid = rest.post(
        "/api/pieces/intake/", {"package": io.BytesIO(invalid)}, format="multipart"
    )
    assert rest_invalid.status_code == 400
    mcp_invalid = _call_mcp_tool(
        token,
        "intake_piece_package",
        {"package_base64": base64.b64encode(invalid).decode()},
    )
    assert mcp_invalid.isError is True
    assert rest_invalid.json()["detail"] in json.dumps(mcp_invalid.model_dump())

    malicious_output = io.BytesIO()
    with zipfile.ZipFile(malicious_output, "w") as archive:
        archive.writestr("../escape.txt", "outside package")
    malicious = malicious_output.getvalue()
    rest_malicious = rest.post(
        "/api/pieces/intake/", {"package": io.BytesIO(malicious)}, format="multipart"
    )
    mcp_malicious = _call_mcp_tool(
        token,
        "intake_piece_package",
        {"package_base64": base64.b64encode(malicious).decode()},
    )
    assert rest_malicious.status_code == 400
    assert mcp_malicious.isError is True
    assert rest_malicious.json()["detail"] in json.dumps(mcp_malicious.model_dump())

    from scenes.mcp.piece_intake_tools import MCP_PACKAGE_MAX_BYTES

    too_large = base64.b64encode(b"x" * (MCP_PACKAGE_MAX_BYTES + 1)).decode()
    limited = _call_mcp_tool(token, "intake_piece_package", {"package_base64": too_large})
    assert limited.isError is True
    assert "HTTP 413" in json.dumps(limited.model_dump())
    assert "180 KiB" in json.dumps(limited.model_dump())

    reader = get_user_model().objects.create_user(username="mcp-piece-intake-reader")
    reader_token, _, _ = _create_mcp_access_token(reader, scopes=("projects:write", "gallery:read"))
    foreign_target = _call_mcp_tool(
        reader_token,
        "intake_piece_package",
        {
            "package_base64": base64.b64encode(package).decode(),
            "piece_id": rest_response.json()["public_id"],
        },
    )
    assert foreign_target.isError is True
    assert "HTTP 404" in json.dumps(foreign_target.model_dump())
    assert "MCP intake fixture" not in json.dumps(foreign_target.model_dump())
    gallery_reader = get_user_model().objects.create_user(
        username="mcp-piece-intake-gallery-reader"
    )
    gallery_token, _, _ = _create_mcp_access_token(gallery_reader, scopes=("gallery:read",))
    denied = _call_mcp_tool(
        gallery_token,
        "intake_piece_package",
        {"package_base64": base64.b64encode(package).decode()},
    )
    assert denied.isError is True
    assert "does not grant the required scope" in json.dumps(denied.model_dump())
    assert Project.objects.filter(owner=gallery_reader).count() == 0


@pytest.mark.django_db(transaction=True)
def test_mcp_delete_version_requires_confirmation_scopes_and_owner_and_matches_rest():
    owner = get_user_model().objects.create_user(username="mcp-delete-version-owner")
    rest = APIClient()
    rest.force_authenticate(owner)

    def create_history(title):
        created = rest.post("/api/projects/blank/", {"renderer": "svg"}, format="json")
        assert created.status_code == 201
        project_id = created.json()["id"]
        rest.patch(
            f"/api/projects/{project_id}/",
            {"title": title},
            format="json",
        )
        saved = rest.post(
            f"/api/projects/{project_id}/versions/",
            {"scene_json": copy.deepcopy(BLANK_SCENE), "origin": "manual"},
            format="json",
        )
        assert saved.status_code == 201
        return project_id, created.json()["current_version"], saved.json()["id"]

    rest_project_id, rest_version_id, _ = create_history("REST delete history")
    rest_deleted = rest.delete(f"/api/projects/{rest_project_id}/versions/{rest_version_id}/")
    assert rest_deleted.status_code == 204

    mcp_project_id, historical_id, current_id = create_history("MCP delete history")
    token, _, _ = _create_mcp_access_token(owner, scopes=("projects:write", "destructive"))
    confirmed = f"{mcp_project_id}:{historical_id}"

    mismatch = _call_mcp_tool(
        token,
        "delete_version",
        {"project_id": mcp_project_id, "version_id": historical_id, "confirm": "wrong"},
    )
    assert mismatch.isError is True
    assert "HTTP 400" in json.dumps(mismatch.model_dump())
    assert not SceneVersion.objects.get(pk=historical_id).is_deleted

    deleted = _call_mcp_tool(
        token,
        "delete_version",
        {"project_id": mcp_project_id, "version_id": historical_id, "confirm": confirmed},
    )
    assert deleted.isError is not True
    assert deleted.structuredContent == {"result": None}
    assert SceneVersion.objects.get(pk=historical_id).is_deleted
    assert not SceneVersion.objects.get(pk=current_id).is_deleted
    assert SceneVersion.objects.get(pk=rest_version_id).is_deleted
    current = _call_mcp_tool(
        token,
        "delete_version",
        {
            "project_id": mcp_project_id,
            "version_id": current_id,
            "confirm": f"{mcp_project_id}:{current_id}",
        },
    )
    assert current.isError is True
    assert "cannot be soft-deleted" in json.dumps(current.model_dump())

    restored = _call_mcp_tool(
        token,
        "restore_version",
        {"project_id": mcp_project_id, "version_id": historical_id},
    )
    assert _mcp_result_payload(restored)["origin"] == "restore"
    assert SceneVersion.objects.get(pk=historical_id).is_deleted

    non_owner = get_user_model().objects.create_user(username="mcp-delete-version-non-owner")
    non_owner_token, _, _ = _create_mcp_access_token(
        non_owner, scopes=("projects:write", "destructive")
    )
    foreign = _call_mcp_tool(
        non_owner_token,
        "delete_version",
        {
            "project_id": mcp_project_id,
            "version_id": current_id,
            "confirm": f"{mcp_project_id}:{current_id}",
        },
    )
    assert foreign.isError is True
    assert "HTTP 404" in json.dumps(foreign.model_dump())
    assert "MCP delete history" not in json.dumps(foreign.model_dump())

    writer_without_destructive, _, _ = _create_mcp_access_token(owner, scopes=("projects:write",))
    scope_denied = _call_mcp_tool(
        writer_without_destructive,
        "delete_version",
        {
            "project_id": mcp_project_id,
            "version_id": current_id,
            "confirm": f"{mcp_project_id}:{current_id}",
        },
    )
    assert scope_denied.isError is True
    assert "does not grant the required scope" in json.dumps(scope_denied.model_dump())

    destructive_without_project_write, _, _ = _create_mcp_access_token(
        owner, scopes=("destructive",)
    )
    project_scope_denied = _call_mcp_tool(
        destructive_without_project_write,
        "delete_version",
        {
            "project_id": mcp_project_id,
            "version_id": current_id,
            "confirm": f"{mcp_project_id}:{current_id}",
        },
    )
    assert project_scope_denied.isError is True
    assert "does not grant the required scope" in json.dumps(project_scope_denied.model_dump())

    audit_rows = MCPToolAuditEvent.objects.filter(tool_name="delete_version")
    assert audit_rows.count() == 6
    assert audit_rows.filter(outcome=MCPToolAuditEvent.Outcome.SUCCESS).count() == 1


@pytest.mark.django_db(transaction=True)
def test_mcp_project_tools_match_rest_contract():
    cache.clear()
    user = get_user_model().objects.create_user(username="mcp-project-contract-owner")
    bearer_token, _, _ = _create_mcp_access_token(user, scopes=("projects:write",))
    rest = APIClient()
    rest.force_authenticate(user)

    rest_list = rest.get("/api/projects/")
    assert rest_list.status_code == 200
    assert _mcp_result_payload(_call_mcp_tool(bearer_token, "list_my_projects")) == rest_list.json()

    rest_bare = rest.post("/api/projects/", {}, format="json")
    mcp_bare = _mcp_result_payload(_call_mcp_tool(bearer_token, "create_project"))
    assert rest_bare.status_code == 201
    assert set(mcp_bare) == set(rest_bare.json())
    assert mcp_bare["owner"] == rest_bare.json()["owner"] == user.username
    assert mcp_bare["current_version"] is None

    request_id = str(uuid.uuid4())
    blank_body = {"renderer": "svg", "client_request_id": request_id}
    rest_blank = rest.post("/api/projects/blank/", blank_body, format="json")
    mcp_blank = _mcp_result_payload(
        _call_mcp_tool(bearer_token, "create_blank_project", blank_body)
    )
    assert rest_blank.status_code == 201
    assert mcp_blank == rest_blank.json()
    project_id = rest_blank.json()["id"]

    rest_project = rest.get(f"/api/projects/{project_id}/")
    mcp_project = _mcp_result_payload(
        _call_mcp_tool(bearer_token, "get_project", {"project_id": project_id})
    )
    assert rest_project.status_code == 200
    assert mcp_project == rest_project.json()

    metadata = {
        "title": "MCP contract project",
        "description": "A sufficiently meaningful project description.",
        "brief": "Private project intent",
        "allow_public_remix": True,
    }
    rest_update = rest.patch(f"/api/projects/{project_id}/", metadata, format="json")
    mcp_update = _mcp_result_payload(
        _call_mcp_tool(
            bearer_token,
            "update_project_metadata",
            {"project_id": project_id, "metadata": metadata},
        )
    )
    assert rest_update.status_code == 200
    assert mcp_update["title"] == rest_update.json()["title"] == metadata["title"]
    assert mcp_update["brief"] == rest_update.json()["brief"] == metadata["brief"]
    assert mcp_update["visibility"] == rest_update.json()["visibility"]

    version_id = rest_blank.json()["current_version"]
    rest_version = rest.get(f"/api/projects/{project_id}/versions/{version_id}/")
    mcp_version = _mcp_result_payload(
        _call_mcp_tool(
            bearer_token,
            "get_version",
            {"project_id": project_id, "version_id": version_id},
        )
    )
    assert rest_version.status_code == 200
    assert mcp_version == rest_version.json()

    rest_versions = rest.get(f"/api/projects/{project_id}/versions/")
    mcp_versions = _mcp_result_payload(
        _call_mcp_tool(bearer_token, "list_versions", {"project_id": project_id})
    )
    assert rest_versions.status_code == 200
    assert mcp_versions == rest_versions.json()

    scene_json = copy.deepcopy(BLANK_SCENE)
    scene_json["renderer"] = {"preferred": "svg"}
    save_body = {"scene_json": scene_json, "origin": "manual", "change_label": "MCP save"}
    rest_saved = rest.post(f"/api/projects/{project_id}/versions/", save_body, format="json")
    mcp_saved = _mcp_result_payload(
        _call_mcp_tool(
            bearer_token,
            "save_version",
            {"project_id": project_id, **save_body},
        )
    )
    assert rest_saved.status_code == 201
    assert mcp_saved["scene_json"] == rest_saved.json()["scene_json"] == scene_json
    assert mcp_saved["origin"] == rest_saved.json()["origin"] == "manual"
    assert mcp_saved["change_label"] == rest_saved.json()["change_label"] == "MCP save"

    rest_restored = rest.post(f"/api/projects/{project_id}/versions/{version_id}/restore/")
    mcp_restored = _mcp_result_payload(
        _call_mcp_tool(
            bearer_token,
            "restore_version",
            {"project_id": project_id, "version_id": version_id},
        )
    )
    assert rest_restored.status_code == 201
    assert mcp_restored["scene_json"] == rest_restored.json()["scene_json"]
    assert mcp_restored["origin"] == rest_restored.json()["origin"] == "restore"
    assert mcp_restored["parent"] == rest_restored.json()["parent"] == version_id

    template_body = {"name": "MCP version snapshot", "category": "test"}
    rest_template = rest.post(
        f"/api/projects/{project_id}/versions/{version_id}/save-as-template/",
        template_body,
        format="json",
    )
    mcp_template = _mcp_result_payload(
        _call_mcp_tool(
            bearer_token,
            "save_version_as_template",
            {"project_id": project_id, "version_id": version_id, **template_body},
        )
    )
    assert rest_template.status_code == 201
    assert mcp_template["source_type"] == rest_template.json()["source_type"] == "private"
    assert mcp_template["name"] == rest_template.json()["name"] == template_body["name"]
    assert mcp_template["category"] == rest_template.json()["category"] == template_body["category"]

    rest_publish = rest.post(f"/api/projects/{project_id}/publish/")
    mcp_publish = _mcp_result_payload(
        _call_mcp_tool(bearer_token, "publish_project", {"project_id": project_id})
    )
    assert rest_publish.status_code == 200
    assert mcp_publish["visibility"] == rest_publish.json()["visibility"] == "public"
    assert mcp_publish["id"] == rest_publish.json()["id"] == project_id

    fork_body = {"client_request_id": str(uuid.uuid4())}
    rest_fork = rest.post(f"/api/public/projects/{project_id}/fork/", fork_body, format="json")
    mcp_fork = _mcp_result_payload(
        _call_mcp_tool(
            bearer_token,
            "fork_project",
            {"project_id": project_id, **fork_body},
        )
    )
    assert rest_fork.status_code == 201
    assert mcp_fork == rest_fork.json()

    template_id = rest_template.json()["id"]
    rest_clone = rest.post(f"/api/templates/{template_id}/clone/")
    mcp_clone = _mcp_result_payload(
        _call_mcp_tool(bearer_token, "clone_template", {"template_id": template_id})
    )
    assert rest_clone.status_code == 201
    assert mcp_clone["owner"] == rest_clone.json()["owner"] == user.username
    assert mcp_clone["title"] == rest_clone.json()["title"] == template_body["name"]
    assert mcp_clone["scenes"][0]["name"] == rest_clone.json()["scenes"][0]["name"]

    rest_unpublish = rest.post(f"/api/projects/{project_id}/unpublish/")
    mcp_unpublish = _mcp_result_payload(
        _call_mcp_tool(bearer_token, "unpublish_project", {"project_id": project_id})
    )
    assert rest_unpublish.status_code == 200
    assert mcp_unpublish["visibility"] == rest_unpublish.json()["visibility"] == "private"

    rest_projects = rest.get("/api/projects/")
    mcp_projects = _mcp_result_payload(_call_mcp_tool(bearer_token, "list_my_projects"))
    assert mcp_projects == rest_projects.json()


@pytest.mark.django_db(transaction=True)
def test_mcp_project_tools_block_non_owner_private_access_and_enforce_scope():
    owner = get_user_model().objects.create_user(username="mcp-private-project-owner")
    caller = get_user_model().objects.create_user(username="mcp-private-project-caller")
    owner_rest = APIClient()
    owner_rest.force_authenticate(owner)
    project_response = owner_rest.post("/api/projects/blank/", {}, format="json")
    project_id = project_response.json()["id"]
    private_title = "MCP private project sentinel"
    owner_rest.patch(f"/api/projects/{project_id}/", {"title": private_title}, format="json")
    version_id = project_response.json()["current_version"]
    template = Template.objects.create(
        owner=owner,
        source_type=Template.SourceType.PRIVATE,
        name="MCP private template sentinel",
        category="private",
        scene_json=copy.deepcopy(BLANK_SCENE),
    )
    caller_token, _, _ = _create_mcp_access_token(caller, scopes=("projects:write",))

    private_calls = [
        ("get_project", {"project_id": project_id}),
        (
            "update_project_metadata",
            {"project_id": project_id, "metadata": {"title": "forged update"}},
        ),
        ("publish_project", {"project_id": project_id}),
        ("unpublish_project", {"project_id": project_id}),
        ("fork_project", {"project_id": project_id}),
        ("clone_template", {"template_id": str(template.public_id)}),
        ("list_versions", {"project_id": project_id}),
        ("get_version", {"project_id": project_id, "version_id": version_id}),
        (
            "save_version",
            {
                "project_id": project_id,
                "scene_json": copy.deepcopy(BLANK_SCENE),
                "origin": "manual",
            },
        ),
        ("restore_version", {"project_id": project_id, "version_id": version_id}),
        (
            "save_version_as_template",
            {"project_id": project_id, "version_id": version_id, "name": "forged"},
        ),
    ]
    non_owner_results = _call_mcp_tools(caller_token, private_calls)
    assert all(result.isError is True for result in non_owner_results)
    assert all("HTTP 404" in json.dumps(result.model_dump()) for result in non_owner_results)
    serialized_errors = json.dumps([result.model_dump() for result in non_owner_results])
    assert private_title not in serialized_errors
    assert "MCP private template sentinel" not in serialized_errors

    caller_projects = _mcp_result_payload(_call_mcp_tool(caller_token, "list_my_projects"))
    assert private_title not in json.dumps(caller_projects)
    created = _mcp_result_payload(_call_mcp_tool(caller_token, "create_project"))
    assert created["owner"] == caller.username
    created_blank = _mcp_result_payload(_call_mcp_tool(caller_token, "create_blank_project", {}))
    assert created_blank["owner"] == caller.username

    caller_gallery_token, _, _ = _create_mcp_access_token(caller, scopes=("gallery:read",))
    scope_calls = [
        ("list_my_projects", {}),
        ("create_project", {}),
        ("create_blank_project", {}),
        ("get_project", {"project_id": project_id}),
        (
            "update_project_metadata",
            {"project_id": project_id, "metadata": {"title": "no"}},
        ),
        ("publish_project", {"project_id": project_id}),
        ("unpublish_project", {"project_id": project_id}),
        ("fork_project", {"project_id": project_id}),
        ("clone_template", {"template_id": str(template.public_id)}),
        ("list_versions", {"project_id": project_id}),
        ("get_version", {"project_id": project_id, "version_id": version_id}),
        (
            "save_version",
            {
                "project_id": project_id,
                "scene_json": copy.deepcopy(BLANK_SCENE),
                "origin": "manual",
            },
        ),
        ("restore_version", {"project_id": project_id, "version_id": version_id}),
        (
            "save_version_as_template",
            {"project_id": project_id, "version_id": version_id, "name": "no"},
        ),
    ]
    scope_results = _call_mcp_tools(caller_gallery_token, scope_calls)
    assert all(result.isError is True for result in scope_results)
    assert all("required scope" in json.dumps(result.model_dump()) for result in scope_results)


@pytest.mark.django_db(transaction=True)
def test_mcp_ai_tools_match_rest_contract_and_require_explicit_accept(monkeypatch):
    cache.clear()
    monkeypatch.setenv("AI_PROVIDER", "fake")
    monkeypatch.setattr("scenes.ai_api.get_effective_cap", lambda user, feature: 10)
    monkeypatch.setattr("scenes.ai_runs.get_effective_cap", lambda user, feature: 10)
    monkeypatch.setattr("scenes.art_piece_api.get_effective_cap", lambda user, feature: 10)
    user = get_user_model().objects.create_user(username="mcp-ai-contract-owner")
    token, _, _ = _create_mcp_access_token(user, scopes=("ai:use", "projects:write"))
    rest = APIClient()
    rest.force_authenticate(user)
    project_response = rest.post("/api/projects/blank/", {}, format="json")
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]
    base_version_id = project_response.json()["current_version"]
    _enable_mistral_agent_model()

    create_body = {"prompt": "Create a cheerful sun", "vendor": "mistral"}
    rest_create = rest.post(
        f"/api/projects/{project_id}/ai/create-scene/", create_body, format="json"
    )
    cache.clear()
    mcp_create = _mcp_result_payload(
        _call_mcp_tool(
            token,
            "ai_create_scene",
            {"project_id": project_id, **create_body},
        )
    )
    assert rest_create.status_code == 200
    assert mcp_create == rest_create.json()
    assert mcp_create["draft"] is True
    assert Project.objects.get(public_id=project_id).current_version_id == base_version_id

    edit_body = {
        "prompt": "Recolor the scene",
        "current_scene": copy.deepcopy(BLANK_SCENE),
        "base_version_id": base_version_id,
        "vendor": "mistral",
    }
    rest_edit = rest.post(f"/api/projects/{project_id}/ai/edit-scene/", edit_body, format="json")
    cache.clear()
    mcp_edit = _mcp_result_payload(
        _call_mcp_tool(token, "ai_edit_scene", {"project_id": project_id, **edit_body})
    )
    assert rest_edit.status_code == 200
    assert mcp_edit == rest_edit.json()
    assert mcp_edit["draft"] is True
    assert Project.objects.get(public_id=project_id).current_version_id == base_version_id

    accept_body = {
        "operation": SceneVersion.Origin.AI_CREATE,
        "scene_json": copy.deepcopy(mcp_create["scene"]),
        "base_version_id": base_version_id,
        "change_label": "Accepted MCP proposal",
        "client_request_id": str(uuid.uuid4()),
    }
    rest_accept = rest.post(
        f"/api/projects/{project_id}/ai/accept-proposal/", accept_body, format="json"
    )
    mcp_accept = _mcp_result_payload(
        _call_mcp_tool(
            token,
            "ai_accept_proposal",
            {"project_id": project_id, **accept_body},
        )
    )
    assert rest_accept.status_code == 201
    assert mcp_accept == rest_accept.json()
    assert mcp_accept["origin"] == SceneVersion.Origin.AI_CREATE
    assert Project.objects.get(public_id=project_id).current_version_id == mcp_accept["id"]

    run_body = {
        "target_type": "project",
        "project_id": project_id,
        "operation": "create",
        "prompt": "Create one layer",
        "start_request_id": str(uuid.uuid4()),
    }
    rest_run = rest.post("/api/ai/runs/", run_body, format="json")
    mcp_run = _mcp_result_payload(
        _call_mcp_tool(token, "ai_start_run", {key: value for key, value in run_body.items()})
    )
    assert rest_run.status_code == 201
    assert mcp_run == rest_run.json()
    assert mcp_run["status"] == "running"
    rest_run_read = rest.get(f"/api/ai/runs/{mcp_run['id']}/")
    mcp_run_read = _mcp_result_payload(
        _call_mcp_tool(token, "ai_get_run", {"run_id": mcp_run["id"]})
    )
    assert rest_run_read.status_code == 200
    assert mcp_run_read == rest_run_read.json()

    art_body = {"prompt": "A tiny teal star", "library": "svg", "vendor": "mistral"}
    rest_art = rest.post("/api/ai/art-pieces/generate/", art_body, format="json")
    mcp_art = _mcp_result_payload(_call_mcp_tool(token, "ai_generate_art_piece", art_body))
    assert rest_art.status_code == 200
    assert mcp_art == rest_art.json()
    assert isinstance(mcp_art["code"], str)

    invalid = _call_mcp_tool(token, "ai_create_scene", {"project_id": project_id, "prompt": ""})
    assert invalid.isError is True
    assert "HTTP 400" in json.dumps(invalid.model_dump())

    from ai_provider.e2e_scenario import _current_scenario

    cache.clear()
    scenario_token = _current_scenario.set("timeout")
    try:
        provider_failure = _call_mcp_tool(
            token,
            "ai_create_scene",
            {"project_id": project_id, "prompt": "Create a scene"},
        )
    finally:
        _current_scenario.reset(scenario_token)
    provider_failure_text = json.dumps(provider_failure.model_dump())
    assert provider_failure.isError is True
    assert "HTTP 504" in provider_failure_text
    assert "timeout" in provider_failure_text


@pytest.mark.django_db(transaction=True)
def test_mcp_ai_tools_preserve_private_404_and_scope_boundaries(monkeypatch):
    cache.clear()
    monkeypatch.setenv("AI_PROVIDER", "fake")
    monkeypatch.setattr("scenes.ai_runs.get_effective_cap", lambda user, feature: 10)
    owner = get_user_model().objects.create_user(username="mcp-ai-owner")
    caller = get_user_model().objects.create_user(username="mcp-ai-caller")
    owner_rest = APIClient()
    owner_rest.force_authenticate(owner)
    project_response = owner_rest.post("/api/projects/blank/", {}, format="json")
    project_id = project_response.json()["id"]
    version_id = project_response.json()["current_version"]
    _enable_mistral_agent_model()
    run_response = owner_rest.post(
        "/api/ai/runs/",
        {
            "target_type": "project",
            "project_id": project_id,
            "operation": "create",
            "prompt": "Private owner run",
        },
        format="json",
    )
    assert run_response.status_code == 201, run_response.json()
    caller_token, _, _ = _create_mcp_access_token(caller, scopes=("ai:use", "projects:write"))

    private_calls = [
        (
            "ai_create_scene",
            {"project_id": project_id, "prompt": "Read the owner's scene"},
        ),
        (
            "ai_edit_scene",
            {
                "project_id": project_id,
                "prompt": "Edit it",
                "current_scene": copy.deepcopy(BLANK_SCENE),
                "base_version_id": version_id,
            },
        ),
        (
            "ai_accept_proposal",
            {
                "project_id": project_id,
                "operation": SceneVersion.Origin.AI_CREATE,
                "scene_json": copy.deepcopy(BLANK_SCENE),
                "base_version_id": version_id,
            },
        ),
        (
            "ai_start_run",
            {
                "target_type": "project",
                "project_id": project_id,
                "operation": "create",
                "prompt": "Read the owner's run target",
            },
        ),
        ("ai_get_run", {"run_id": run_response.json()["id"]}),
    ]
    private_results = _call_mcp_tools(caller_token, private_calls)
    assert all(result.isError is True for result in private_results)
    assert all("HTTP 404" in json.dumps(result.model_dump()) for result in private_results)
    assert "Private owner run" not in json.dumps(
        [result.model_dump() for result in private_results]
    )

    gallery_token, _, _ = _create_mcp_access_token(caller, scopes=("gallery:read",))
    ai_scope_calls = [
        (name, args) for name, args in private_calls if name != "ai_accept_proposal"
    ] + [
        (
            "ai_generate_art_piece",
            {"prompt": "A safe test snippet", "library": "svg"},
        )
    ]
    scope_results = _call_mcp_tools(gallery_token, ai_scope_calls)
    assert all(result.isError is True for result in scope_results)
    assert all("required scope" in json.dumps(result.model_dump()) for result in scope_results)

    ai_only_token, _, _ = _create_mcp_access_token(caller, scopes=("ai:use",))
    accept_without_write = _call_mcp_tool(
        ai_only_token,
        "ai_accept_proposal",
        {
            "project_id": project_id,
            "operation": SceneVersion.Origin.AI_CREATE,
            "scene_json": copy.deepcopy(BLANK_SCENE),
            "base_version_id": version_id,
        },
    )
    assert accept_without_write.isError is True
    assert "required scope" in json.dumps(accept_without_write.model_dump())


@pytest.mark.django_db(transaction=True)
def test_mcp_ai_tools_surface_rest_quota_errors(monkeypatch):
    cache.clear()
    monkeypatch.setenv("AI_PROVIDER", "fake")
    monkeypatch.setattr("scenes.ai_api.get_effective_cap", lambda user, feature: 0)
    user = get_user_model().objects.create_user(username="mcp-ai-quota-owner")
    token, _, _ = _create_mcp_access_token(user, scopes=("ai:use",))
    rest = APIClient()
    rest.force_authenticate(user)
    project_response = rest.post("/api/projects/blank/", {}, format="json")
    project_id = project_response.json()["id"]
    body = {"prompt": "Create a scene", "vendor": "mistral"}
    rest_error = rest.post(f"/api/projects/{project_id}/ai/create-scene/", body, format="json")
    mcp_error = _call_mcp_tool(token, "ai_create_scene", {"project_id": project_id, **body})
    assert rest_error.status_code == 429
    assert rest_error.json()["error"] == "quota_exceeded"
    assert mcp_error.isError is True
    assert "HTTP 429" in json.dumps(mcp_error.model_dump())
    assert "quota_exceeded" in json.dumps(mcp_error.model_dump())


@pytest.mark.django_db(transaction=True)
def test_mcp_3d_tools_match_rest_contract_and_validate_scene3d(monkeypatch):
    cache.clear()
    monkeypatch.setenv("AI_PROVIDER", "fake")
    user = get_user_model().objects.create_user(username="mcp-3d-contract-owner")
    token, _, _ = _create_mcp_access_token(user, scopes=("ai:use", "projects:write"))
    rest = APIClient()
    rest.force_authenticate(user)

    rest_list = rest.get("/api/projects3d/")
    mcp_list = _mcp_result_payload(_call_mcp_tool(token, "list_my_3d_projects"))
    assert rest_list.status_code == 200
    assert mcp_list == rest_list.json()

    rest_created = rest.post("/api/projects3d/", {"renderer": "threejs"}, format="json")
    mcp_created = _mcp_result_payload(
        _call_mcp_tool(token, "create_3d_project", {"renderer": "threejs"})
    )
    assert rest_created.status_code == 201
    assert mcp_created["owner"] == rest_created.json()["owner"] == user.username
    assert mcp_created["current_version"]["scene_json"]["renderer"] == {"preferred": "threejs"}
    project_id = rest_created.json()["id"]

    rest_detail = rest.get(f"/api/projects3d/{project_id}/")
    mcp_detail = _mcp_result_payload(
        _call_mcp_tool(token, "get_3d_project", {"project_id": project_id})
    )
    assert rest_detail.status_code == 200
    assert mcp_detail == rest_detail.json()

    update_body = {"title": "MCP 3D contract project"}
    rest_update = rest.patch(f"/api/projects3d/{project_id}/", update_body, format="json")
    mcp_update = _mcp_result_payload(
        _call_mcp_tool(
            token,
            "update_3d_project_metadata",
            {"project_id": project_id, **update_body},
        )
    )
    assert rest_update.status_code == 200
    assert mcp_update["title"] == rest_update.json()["title"] == update_body["title"]

    rest_versions = rest.get(f"/api/projects3d/{project_id}/versions/")
    mcp_versions = _mcp_result_payload(
        _call_mcp_tool(token, "list_3d_versions", {"project_id": project_id})
    )
    assert rest_versions.status_code == 200
    assert mcp_versions == rest_versions.json()

    save_body = {
        "scene_json": copy.deepcopy(MINIMAL_SCENE_3D),
        "html_source": "<main>3D source</main>",
        "css_source": "main { display: block; }",
        "js_source": "window.sceneReady = true;",
    }
    rest_saved = rest.post(f"/api/projects3d/{project_id}/versions/", save_body, format="json")
    mcp_saved = _mcp_result_payload(
        _call_mcp_tool(
            token,
            "save_3d_version",
            {"project_id": project_id, **save_body},
        )
    )
    assert rest_saved.status_code == 201
    assert mcp_saved["scene_json"] == rest_saved.json()["scene_json"]
    assert mcp_saved["html_source"] == rest_saved.json()["html_source"]
    assert mcp_saved["css_source"] == rest_saved.json()["css_source"]
    assert mcp_saved["js_source"] == rest_saved.json()["js_source"]

    rest_publish = rest.post(f"/api/projects3d/{project_id}/publish/")
    mcp_publish = _mcp_result_payload(
        _call_mcp_tool(token, "publish_3d_project", {"project_id": project_id})
    )
    assert rest_publish.status_code == 200
    assert mcp_publish["visibility"] == rest_publish.json()["visibility"] == "public"
    rest_unpublish = rest.post(f"/api/projects3d/{project_id}/unpublish/")
    mcp_unpublish = _mcp_result_payload(
        _call_mcp_tool(token, "unpublish_3d_project", {"project_id": project_id})
    )
    assert rest_unpublish.status_code == 200
    assert mcp_unpublish["visibility"] == rest_unpublish.json()["visibility"] == "private"

    current_project = Project3D.objects.get(public_id=project_id)
    base_version_id = current_project.current_version_id
    ai_create_body = {"prompt": "Create a simple 3D sphere", "vendor": "mistral"}
    rest_ai_create = rest.post(
        f"/api/projects3d/{project_id}/ai/create-scene/",
        ai_create_body,
        format="json",
    )
    cache.clear()
    mcp_ai_create = _mcp_result_payload(
        _call_mcp_tool(
            token,
            "ai_create_3d_scene",
            {"project_id": project_id, **ai_create_body},
        )
    )
    assert rest_ai_create.status_code == 200
    assert mcp_ai_create == rest_ai_create.json()
    assert mcp_ai_create["draft"] is True
    assert Project3D.objects.get(public_id=project_id).current_version_id == base_version_id

    current_scene = current_project.current_version.scene_json
    ai_edit_body = {
        "prompt": "Recolor the main object",
        "current_scene": copy.deepcopy(current_scene),
        "base_version_id": base_version_id,
        "vendor": "mistral",
    }
    rest_ai_edit = rest.post(
        f"/api/projects3d/{project_id}/ai/edit-scene/",
        ai_edit_body,
        format="json",
    )
    cache.clear()
    mcp_ai_edit = _mcp_result_payload(
        _call_mcp_tool(token, "ai_edit_3d_scene", {"project_id": project_id, **ai_edit_body})
    )
    assert rest_ai_edit.status_code == 200
    assert mcp_ai_edit == rest_ai_edit.json()
    assert mcp_ai_edit["draft"] is True
    assert Project3D.objects.get(public_id=project_id).current_version_id == base_version_id

    accept_body = {
        "operation": SceneVersion3D.Origin.AI_CREATE,
        "scene_json": copy.deepcopy(mcp_ai_create["scene"]),
        "base_version_id": base_version_id,
        "client_request_id": str(uuid.uuid4()),
    }
    rest_accept = rest.post(
        f"/api/projects3d/{project_id}/ai/accept-proposal/",
        accept_body,
        format="json",
    )
    mcp_accept = _mcp_result_payload(
        _call_mcp_tool(
            token,
            "ai_accept_3d_proposal",
            {"project_id": project_id, **accept_body},
        )
    )
    assert rest_accept.status_code == 201
    assert mcp_accept == rest_accept.json()
    assert mcp_accept["origin"] == SceneVersion3D.Origin.AI_CREATE
    assert Project3D.objects.get(public_id=project_id).current_version_id == mcp_accept["id"]

    invalid_scene = _call_mcp_tool(
        token,
        "ai_accept_3d_proposal",
        {
            "project_id": project_id,
            "operation": SceneVersion3D.Origin.AI_CREATE,
            "scene_json": {},
            "base_version_id": mcp_accept["id"],
        },
    )
    assert invalid_scene.isError is True
    assert "HTTP 422" in json.dumps(invalid_scene.model_dump())
    assert "invalid_structured_output" in json.dumps(invalid_scene.model_dump())


@pytest.mark.django_db(transaction=True)
def test_mcp_3d_tools_preserve_non_owner_404_and_enforce_scope(monkeypatch):
    cache.clear()
    monkeypatch.setenv("AI_PROVIDER", "fake")
    owner = get_user_model().objects.create_user(username="mcp-3d-private-owner")
    caller = get_user_model().objects.create_user(username="mcp-3d-private-caller")
    owner_rest = APIClient()
    owner_rest.force_authenticate(owner)
    project_response = owner_rest.post("/api/projects3d/", {}, format="json")
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]
    base_version_id = project_response.json()["current_version"]["id"]
    caller_token, _, _ = _create_mcp_access_token(caller, scopes=("ai:use", "projects:write"))

    private_calls = [
        ("get_3d_project", {"project_id": project_id}),
        (
            "update_3d_project_metadata",
            {"project_id": project_id, "title": "Forged title"},
        ),
        ("publish_3d_project", {"project_id": project_id}),
        ("unpublish_3d_project", {"project_id": project_id}),
        ("list_3d_versions", {"project_id": project_id}),
        (
            "save_3d_version",
            {"project_id": project_id, "scene_json": copy.deepcopy(MINIMAL_SCENE_3D)},
        ),
        (
            "ai_create_3d_scene",
            {"project_id": project_id, "prompt": "Inspect the private 3D scene"},
        ),
        (
            "ai_edit_3d_scene",
            {
                "project_id": project_id,
                "prompt": "Edit the private scene",
                "current_scene": copy.deepcopy(MINIMAL_SCENE_3D),
                "base_version_id": base_version_id,
            },
        ),
        (
            "ai_accept_3d_proposal",
            {
                "project_id": project_id,
                "operation": SceneVersion3D.Origin.AI_CREATE,
                "scene_json": copy.deepcopy(MINIMAL_SCENE_3D),
                "base_version_id": base_version_id,
            },
        ),
    ]
    private_results = _call_mcp_tools(caller_token, private_calls)
    assert all(result.isError is True for result in private_results)
    assert all("HTTP 404" in json.dumps(result.model_dump()) for result in private_results)

    gallery_token, _, _ = _create_mcp_access_token(caller, scopes=("gallery:read",))
    all_scope_calls = [
        ("list_my_3d_projects", {}),
        ("create_3d_project", {}),
        *private_calls,
    ]
    scope_results = _call_mcp_tools(gallery_token, all_scope_calls)
    assert all(result.isError is True for result in scope_results)
    assert all("required scope" in json.dumps(result.model_dump()) for result in scope_results)

    ai_only_token, _, _ = _create_mcp_access_token(caller, scopes=("ai:use",))
    accept_without_write = _call_mcp_tool(
        ai_only_token,
        "ai_accept_3d_proposal",
        {
            "project_id": project_id,
            "operation": SceneVersion3D.Origin.AI_CREATE,
            "scene_json": copy.deepcopy(MINIMAL_SCENE_3D),
            "base_version_id": base_version_id,
        },
    )
    assert accept_without_write.isError is True
    assert "required scope" in json.dumps(accept_without_write.model_dump())

    own_projects = _mcp_result_payload(_call_mcp_tool(caller_token, "list_my_3d_projects"))
    assert project_id not in {project["id"] for project in own_projects}
    own_project = _mcp_result_payload(_call_mcp_tool(caller_token, "create_3d_project", {}))
    assert own_project["owner"] == caller.username


@pytest.mark.django_db(transaction=True)
def test_mcp_authenticated_rate_limit_is_per_oauth_client_and_user():
    cache.clear()
    user_a = get_user_model().objects.create_user(username="mcp-rate-user-a")
    user_b = get_user_model().objects.create_user(username="mcp-rate-user-b")
    token_a, client_a, _ = _create_mcp_access_token(user_a)
    token_other_client, _, _ = _create_mcp_access_token(user_a)
    token_other_user, _, _ = _create_mcp_access_token(user_b, oauth_application=client_a)

    first_sixty = _call_mcp_tools(
        token_a,
        [("health_check", {}) for _ in range(60)],
        client_ip="203.0.113.10",
    )
    assert all(result.isError is not True for result in first_sixty)

    same_user_other_client = _call_mcp_tool(
        token_other_client, "health_check", client_ip="203.0.113.11"
    )
    assert same_user_other_client.isError is True
    assert "retry_after_seconds" in json.dumps(same_user_other_client.model_dump())

    same_client_other_user = _call_mcp_tool(
        token_other_user, "health_check", client_ip="203.0.113.12"
    )
    assert same_client_other_user.isError is True
    assert "retry_after_seconds" in json.dumps(same_client_other_user.model_dump())

    audits = list(MCPToolAuditEvent.objects.order_by("id"))
    assert len(audits) == 62
    assert sum(event.outcome == MCPToolAuditEvent.Outcome.SUCCESS for event in audits) == 60
    assert sum(event.outcome == MCPToolAuditEvent.Outcome.RATE_LIMITED for event in audits) == 2
    assert all(event.client_id is not None and event.user_id is not None for event in audits)


@pytest.mark.django_db
def test_public_2d_tools_match_rest_payloads_and_hide_ineligible_projects():
    owner = get_user_model().objects.create_user(username="mcp-public-owner")
    public = Project.objects.create(
        owner=owner,
        title="MCP public project",
        visibility=Project.Visibility.PUBLIC,
        published_at=timezone.now(),
    )
    version = SceneVersion.objects.create(
        project=public,
        sequence=1,
        scene_json=copy.deepcopy(BLANK_SCENE),
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    public.current_version = version
    public.save(update_fields=["current_version"])
    older = Project.objects.create(
        owner=owner,
        title="Older MCP public project",
        visibility=Project.Visibility.PUBLIC,
        published_at=timezone.now() - timedelta(days=1),
    )
    older_version = SceneVersion.objects.create(
        project=older,
        sequence=1,
        scene_json=copy.deepcopy(BLANK_SCENE),
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    older.current_version = older_version
    older.save(update_fields=["current_version"])

    for title, visibility, published_at, deleted, saved_version in [
        ("private", Project.Visibility.PRIVATE, timezone.now(), False, True),
        ("unlisted", Project.Visibility.PUBLIC, None, False, True),
        ("draft", Project.Visibility.PRIVATE, None, False, False),
        ("deleted", Project.Visibility.PUBLIC, timezone.now(), True, True),
    ]:
        project = Project.objects.create(
            owner=owner,
            title=title,
            visibility=visibility,
            published_at=published_at,
            is_deleted=deleted,
        )
        if saved_version:
            draft_version = SceneVersion.objects.create(
                project=project,
                sequence=1,
                scene_json=copy.deepcopy(BLANK_SCENE),
                created_by=owner,
                origin=SceneVersion.Origin.MANUAL,
            )
            project.current_version = draft_version
            project.save(update_fields=["current_version"])

    Template.objects.create(
        owner=None,
        source_type=Template.SourceType.BUILT_IN,
        name="MCP built-in",
        category="basic",
        description="Visible to anonymous users",
        scene_json=copy.deepcopy(BLANK_SCENE),
    )
    Template.objects.create(
        owner=owner,
        source_type=Template.SourceType.PRIVATE,
        name="MCP private",
        category="private",
        scene_json=copy.deepcopy(BLANK_SCENE),
    )
    image_bytes = b"\x89PNG\r\n\x1a\nvalid-test-image"
    Thumbnail.objects.create(
        scene_version=version,
        image_data=image_bytes,
        content_type="image/png",
        width=1,
        height=1,
    )

    rest = APIClient().get(f"/api/public/projects/{public.public_id}/")
    assert rest.status_code == 200
    assert _public_project(str(public.public_id)) == rest.json()

    rest_page = APIClient().get("/api/public/projects/?page_size=1")
    mcp_page = _public_gallery_page(None, 1)
    assert mcp_page["results"] == [
        result for result in rest_page.json()["results"] if result["renderer"] == "2d"
    ]
    assert mcp_page["has_more"] is True
    assert len(mcp_page["results"]) == 1
    next_page = _public_gallery_page(mcp_page["next_cursor"], 1)
    assert [item["id"] for item in next_page["results"]] == [str(older.public_id)]
    assert next_page["has_more"] is False
    assert "private" not in json.dumps(mcp_page)
    assert "unlisted" not in json.dumps(mcp_page)
    assert "draft" not in json.dumps(mcp_page)
    assert "deleted" not in json.dumps(mcp_page)

    rest_templates = APIClient().get("/api/templates/")
    assert _built_in_templates() == [
        template for template in rest_templates.json() if template["source_type"] == "built_in"
    ]
    assert "MCP private" not in json.dumps(_built_in_templates())
    thumbnail_response = APIClient().get(f"/api/public/projects/{public.public_id}/thumbnail.png")
    assert thumbnail_response.status_code == 200
    assert _public_thumbnail(str(public.public_id)) == (
        thumbnail_response.content,
        thumbnail_response["Content-Type"].split(";")[0],
    )
    assert thumbnail_response.content == image_bytes

    asset_id = uuid.uuid4()
    asset_bytes = b"public-2d-asset"
    asset_checksum = hashlib.sha256(asset_bytes).hexdigest()
    PieceIntakeAsset.objects.create(
        owner=owner,
        piece_kind="2d",
        piece_public_id=public.public_id,
        source_asset_id=asset_id,
        filename="asset.bin",
        mime_type="application/octet-stream",
        byte_size=len(asset_bytes),
        checksum=asset_checksum,
        data=asset_bytes,
    )
    asset_response = APIClient().get(f"/api/pieces/2d/{public.public_id}/assets/{asset_id}/")
    assert asset_response.status_code == 200
    assert _published_asset(str(public.public_id), str(asset_id)) == {
        "media_type": asset_response["Content-Type"].split(";")[0],
        "data_base64": base64.b64encode(asset_response.content).decode("ascii"),
        "checksum": asset_checksum,
    }

    mixed_gallery_response = APIClient().get("/api/public/gallery/?page_size=1")
    assert _unified_gallery_page("all", None, None, 1) == mixed_gallery_response.json()

    public_3d = Project3D.objects.create(
        owner=owner,
        title="MCP public 3D",
        visibility=Project3D.Visibility.PUBLIC,
        published_at=timezone.now(),
    )
    public_3d_version = SceneVersion3D.objects.create(
        project=public_3d,
        sequence=1,
        scene_json=copy.deepcopy(MINIMAL_SCENE_3D),
        created_by=owner,
    )
    public_3d.current_version = public_3d_version
    public_3d.save(update_fields=["current_version"])
    mixed_gallery_response = APIClient().get("/api/public/gallery/?page_size=1")
    assert _unified_gallery_page("all", None, None, 1) == mixed_gallery_response.json()
    rest_3d = APIClient().get(f"/api/public/projects3d/{public_3d.public_id}/")
    assert rest_3d.status_code == 200
    assert _public_3d_project(str(public_3d.public_id)) == rest_3d.json()
    private_3d = Project3D.objects.create(owner=owner, title="MCP private 3D")
    with pytest.raises(Http404):
        _public_3d_project(str(private_3d.public_id))

    generated = ArtPiece.objects.create(
        owner=owner,
        title="MCP generated piece",
        description="Public generated metadata",
        prompt="private prompt sentinel",
        engine=ArtPiece.Engine.SVG,
        status=ArtPiece.Status.PUBLISHED,
        published_at=timezone.now(),
    )
    generated_version = ArtPieceVersion.objects.create(
        piece=generated,
        sequence=1,
        source="<svg />",
    )
    generated.current_version = generated_version
    generated.save(update_fields=["current_version"])
    rest_generated = APIClient().get(f"/api/public/art-pieces/{generated.public_id}/")
    assert rest_generated.status_code == 200
    assert _public_generated_piece(str(generated.public_id)) == rest_generated.json()
    assert "private prompt sentinel" not in json.dumps(rest_generated.json())
    draft_piece = ArtPiece.objects.create(
        owner=owner,
        title="MCP generated draft",
        prompt="draft prompt",
        engine=ArtPiece.Engine.SVG,
    )
    with pytest.raises(Http404):
        _public_generated_piece(str(draft_piece.public_id))

    PublicProfile.objects.create(user=owner, handle="mcp-public-owner", is_public=True)
    collection = Collection.objects.create(
        owner=owner,
        title="MCP collection",
        description="Public collection details",
        slug="mcp-collection",
        visibility=Collection.Visibility.PUBLIC,
        published_at=timezone.now(),
    )
    rest_collections = APIClient().get("/api/collections/public/?page_size=1")
    assert _public_collection_page("newest", None, 1) == rest_collections.json()
    rest_collection = APIClient().get(
        f"/api/public/collections/mcp-public-owner/{collection.slug}/"
    )
    assert rest_collection.status_code == 200
    assert _public_collection_detail("mcp-public-owner", collection.slug) == rest_collection.json()
    private_collection = Collection.objects.create(
        owner=owner,
        title="MCP private collection",
        slug="private-collection",
    )
    assert str(private_collection.public_id) not in json.dumps(
        _public_collection_page("newest", None, 60)
    )

    complete_gallery_response = APIClient().get("/api/public/gallery/?page_size=60")
    assert _unified_gallery_page("all", None, None, 60) == complete_gallery_response.json()

    rest_search = APIClient().get("/api/public/gallery/search/?q=MCP&scope=content")
    assert _public_search("MCP", "content") == rest_search.json()


def test_mcp_client_ip_only_trusts_forwarding_from_loopback_proxy():
    headers = [(b"x-forwarded-for", b"198.51.100.24, 127.0.0.1")]
    assert _trusted_client_ip({"client": ("127.0.0.1", 8000), "headers": headers}) == (
        "198.51.100.24"
    )
    assert _trusted_client_ip({"client": ("192.0.2.10", 8000), "headers": headers}) == (
        "192.0.2.10"
    )


@pytest.mark.django_db(transaction=True)
def test_published_piece_kinds_share_gallery_crawler_and_mcp_surfaces():
    """Issue #1278: publish 2D, 3D, and generated pieces through their owner APIs,
    then prove public listings agree and unpublishing retains their versions."""
    from xml.etree import ElementTree as ET

    owner = get_user_model().objects.create_user(username="surface-owner")
    PublicProfile.objects.create(user=owner, handle="surface-owner", is_public=True)
    owner_client = APIClient()
    owner_client.force_authenticate(owner)
    anonymous = APIClient()

    project2d = Project.objects.create(
        owner=owner,
        title="Surface contract 2D",
        description="Published structured 2D piece.",
        public_slug="surface-contract-2d",
    )
    version2d = SceneVersion.objects.create(
        project=project2d,
        sequence=1,
        scene_json=copy.deepcopy(BLANK_SCENE),
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project2d.current_version = version2d
    project2d.save(update_fields=["current_version"])
    assert owner_client.post(f"/api/projects/{project2d.public_id}/publish/").status_code == 200

    project3d = Project3D.objects.create(
        owner=owner,
        title="Surface contract 3D",
        public_slug="surface-contract-3d",
    )
    version3d = SceneVersion3D.objects.create(
        project=project3d,
        sequence=1,
        scene_json=copy.deepcopy(MINIMAL_SCENE_3D),
        created_by=owner,
    )
    project3d.current_version = version3d
    project3d.save(update_fields=["current_version"])
    assert owner_client.post(f"/api/projects3d/{project3d.public_id}/publish/").status_code == 200

    created_generated = owner_client.post(
        "/api/art-pieces/",
        {
            "title": "Surface contract generated",
            "description": "Published generated piece.",
            "prompt": "private generation prompt",
            "engine": "svg",
            "public_slug": "surface-contract-generated",
            "source": '<svg xmlns="http://www.w3.org/2000/svg" />',
        },
        format="json",
    )
    assert created_generated.status_code == 201
    generated_id = created_generated.data["public_id"]
    assert (
        owner_client.patch(
            f"/api/art-pieces/{generated_id}/", {"status": "published"}, format="json"
        ).status_code
        == 200
    )
    generated = ArtPiece.objects.get(public_id=generated_id)

    # A draft sentinel of each kind must stay private while its public sibling is listed.
    private2d = Project.objects.create(owner=owner, title="Private surface 2D")
    private3d = Project3D.objects.create(owner=owner, title="Private surface 3D")
    private_generated_response = owner_client.post(
        "/api/art-pieces/",
        {
            "title": "Private surface generated",
            "description": "Still a draft.",
            "prompt": "private prompt",
            "engine": "svg",
            "source": "<svg />",
        },
        format="json",
    )
    assert private_generated_response.status_code == 201

    deleted2d = Project.objects.create(
        owner=owner,
        title="Deleted surface 2D",
        public_slug="deleted-surface-2d",
        visibility=Project.Visibility.PUBLIC,
        published_at=timezone.now(),
        is_deleted=True,
    )
    deleted2d_version = SceneVersion.objects.create(
        project=deleted2d,
        sequence=1,
        scene_json=copy.deepcopy(BLANK_SCENE),
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    deleted2d.current_version = deleted2d_version
    deleted2d.save(update_fields=["current_version"])
    deleted3d = Project3D.objects.create(
        owner=owner,
        title="Deleted surface 3D",
        public_slug="deleted-surface-3d",
        visibility=Project3D.Visibility.PUBLIC,
        published_at=timezone.now(),
        is_deleted=True,
    )
    deleted3d_version = SceneVersion3D.objects.create(
        project=deleted3d,
        sequence=1,
        scene_json=copy.deepcopy(MINIMAL_SCENE_3D),
        created_by=owner,
    )
    deleted3d.current_version = deleted3d_version
    deleted3d.save(update_fields=["current_version"])
    deleted_generated = ArtPiece.objects.create(
        owner=owner,
        title="Deleted surface generated",
        public_slug="deleted-surface-generated",
        prompt="deleted prompt",
        engine=ArtPiece.Engine.SVG,
        status=ArtPiece.Status.PUBLISHED,
        published_at=timezone.now(),
        is_deleted=True,
    )
    deleted_generated_version = ArtPieceVersion.objects.create(
        piece=deleted_generated, sequence=1, source="<svg />"
    )
    deleted_generated.current_version = deleted_generated_version
    deleted_generated.save(update_fields=["current_version"])

    expected_ids = {str(project2d.public_id), str(project3d.public_id), str(generated.public_id)}
    slugs = {
        "surface-contract-2d",
        "surface-contract-3d",
        "surface-contract-generated",
    }
    oauth_token, _, _ = _create_mcp_access_token(owner, scopes=("gallery:read",))

    def assert_public_everywhere(expected: bool) -> None:
        gallery_response = anonymous.get("/api/public/gallery/?type=all&page_size=60")
        assert gallery_response.status_code == 200
        gallery_results = gallery_response.json()["results"]
        ids = {item["id"] for item in gallery_results}
        assert ids == (expected_ids if expected else set())
        if expected:
            assert {item["kind"] for item in gallery_results} == {"2d", "3d", "generated"}
        else:
            assert all(
                item["title"]
                not in {"Surface contract 2D", "Surface contract 3D", "Surface contract generated"}
                for item in gallery_results
            )
        for hidden_title in (
            private2d.title,
            private3d.title,
            "Private surface generated",
            deleted2d.title,
            deleted3d.title,
            deleted_generated.title,
        ):
            assert hidden_title not in json.dumps(gallery_results)

        sitemap = anonymous.get("/sitemap.xml")
        assert sitemap.status_code == 200
        sitemap_body = sitemap.content.decode()
        sitemap_urls = {
            entry.text
            for entry in ET.fromstring(sitemap.content).findall(
                "{http://www.sitemaps.org/schemas/sitemap/0.9}url/"
                "{http://www.sitemaps.org/schemas/sitemap/0.9}loc"
            )
        }
        visible_sitemap_slugs = {slug for slug in slugs if any(slug in url for url in sitemap_urls)}
        assert visible_sitemap_slugs == (slugs if expected else set())
        for hidden_slug in (
            "deleted-surface-2d",
            "deleted-surface-3d",
            "deleted-surface-generated",
        ):
            assert hidden_slug not in sitemap_body

        llms_response = anonymous.get("/llms-full.txt")
        assert llms_response.status_code == 200
        llms_body = llms_response.content.decode()
        assert {slug for slug in slugs if slug in llms_body} == (slugs if expected else set())
        for hidden_title in (
            private2d.title,
            private3d.title,
            "Private surface generated",
            deleted2d.title,
            deleted3d.title,
            deleted_generated.title,
        ):
            assert hidden_title not in llms_body

        mcp_result = _mcp_result_payload(
            _call_mcp_tool(oauth_token, "list_public_pieces", {"page_size": 60})
        )
        mcp_ids = {item["id"] for item in mcp_result["results"]}
        assert mcp_ids == (expected_ids if expected else set())
        app_tools, _, _, app_results = _call_public_apps(
            [("show_public_gallery", {"page_size": 60})]
        )
        app_payload = _mcp_result_payload(app_results[0])
        app_ids = {item["id"] for item in app_payload["results"]}
        assert app_ids == (expected_ids if expected else set())
        assert any(tool.name == "show_public_gallery" for tool in app_tools.tools)

    assert_public_everywhere(expected=True)

    assert owner_client.post(f"/api/projects/{project2d.public_id}/unpublish/").status_code == 200
    assert owner_client.post(f"/api/projects3d/{project3d.public_id}/unpublish/").status_code == 200
    assert (
        owner_client.patch(
            f"/api/art-pieces/{generated.public_id}/", {"status": "draft"}, format="json"
        ).status_code
        == 200
    )
    assert SceneVersion.objects.filter(project=project2d, is_deleted=False).count() == 1
    assert SceneVersion3D.objects.filter(project=project3d).count() == 1
    assert ArtPieceVersion.objects.filter(piece=generated).count() == 1
    assert_public_everywhere(expected=False)
