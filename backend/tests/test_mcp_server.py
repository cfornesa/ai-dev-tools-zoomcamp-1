"""MCP Streamable HTTP contract tests for anonymous public operations."""

from __future__ import annotations

import base64
import copy
import hashlib
import json
import uuid
from datetime import timedelta
from pathlib import Path

import anyio
import httpx
import pytest
from asgiref.testing import ApplicationCommunicator
from django.contrib.auth import get_user_model
from django.utils import timezone
from mcp.client.session import ClientSession
from mcp.client.streamable_http import streamable_http_client
from rest_framework.test import APIClient

from backend.asgi import application
from scenes.mcp.server import (
    MAX_MCP_REQUEST_BODY_SIZE,
    _built_in_templates,
    _public_gallery_page,
    _public_project,
    _public_thumbnail,
    _published_asset,
    create_mcp_asgi_app,
)
from scenes.models import PieceIntakeAsset, Project, SceneVersion, Template, Thumbnail

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures"
        / "valid"
        / "blank.json"
    ).read_text()
)


@pytest.mark.django_db(transaction=True)
def test_mcp_conformance_client_initializes_lists_and_calls_health_check():
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
                },
            ) as http_client:
                async with streamable_http_client(
                    "http://localhost:8000/mcp/", http_client=http_client
                ) as (read_stream, write_stream, _):
                    async with ClientSession(read_stream, write_stream) as client:
                        await client.initialize()
                        listing = await client.list_tools()
                        assert {tool.name for tool in listing.tools} == {
                            "health_check",
                            "list_public_gallery",
                            "get_public_project",
                            "get_public_thumbnail",
                            "list_templates",
                            "get_published_asset",
                        }
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
                        gallery_result = await client.call_tool(
                            "list_public_gallery", {"page_size": 0}
                        )
                        assert gallery_result.isError is not True
                        assert json.loads(gallery_result.content[0].text) == {
                            "results": [],
                            "next_cursor": None,
                            "has_more": False,
                        }
                        gallery_resource = await client.read_resource("gallery://public")
                        assert json.loads(gallery_resource.contents[0].text) == {
                            "results": [],
                            "next_cursor": None,
                            "has_more": False,
                        }
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
