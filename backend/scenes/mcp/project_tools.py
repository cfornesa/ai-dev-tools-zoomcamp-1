"""Authenticated 2D project/version MCP tools (#1218)."""

from __future__ import annotations

import io
import json
from collections.abc import Callable
from typing import Any

from asgiref.sync import sync_to_async
from django.http import Http404, HttpRequest
from mcp.server.fastmcp import FastMCP
from mcp.shared.exceptions import McpError
from mcp.types import ErrorData
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import JSONParser
from rest_framework.renderers import JSONRenderer
from rest_framework.request import Request

from scenes.api import (
    BlankProjectCreateView,
    ProjectDetailView,
    ProjectForkView,
    ProjectListCreateView,
    ProjectPublishView,
    ProjectUnpublishView,
    SaveVersionAsTemplateView,
    SceneVersionDetailView,
    SceneVersionListCreateView,
    SceneVersionRestoreView,
    TemplateCloneView,
)

__all__ = ["register_project_tools"]


def _json_data(value: Any) -> Any:
    return json.loads(JSONRenderer().render(value))


def _rest_error(http_status: int, body: Any) -> McpError:
    serialized_body = json.dumps(_json_data(body), ensure_ascii=False, sort_keys=True)
    if http_status == 404:
        message = f"The REST operation returned HTTP 404 Not Found: {serialized_body}"
        code = -32004
    else:
        message = f"The REST operation failed with HTTP {http_status}: {serialized_body}"
        code = -32000
    return McpError(
        ErrorData(
            code=code,
            message=message,
            data={"http_status": http_status, "body": _json_data(body)},
        )
    )


def _invoke_rest_view(
    view_class: type,
    method: str,
    user: Any,
    path: str,
    *,
    body: dict[str, Any] | None = None,
    route_args: tuple[Any, ...] = (),
) -> Any:
    """Run the existing REST handler with the OAuth user and REST serializers/policies."""
    encoded_body = json.dumps(body or {}).encode("utf-8")
    raw_request = HttpRequest()
    raw_request.method = method.upper()
    raw_request.path = path
    raw_request.path_info = path
    raw_request.META.update(
        {
            "REQUEST_METHOD": method.upper(),
            "PATH_INFO": path,
            "CONTENT_TYPE": "application/json",
            "CONTENT_LENGTH": str(len(encoded_body)),
        }
    )
    raw_request._read_started = False  # type: ignore[attr-defined]
    raw_request._stream = io.BytesIO(encoded_body)
    request = Request(raw_request, parsers=[JSONParser()], authenticators=[])
    request.user = user

    try:
        response = getattr(view_class(), method.lower())(request, *route_args)
    except Http404 as exc:
        raise _rest_error(404, {"detail": "Not found."}) from exc
    except ValidationError as exc:
        raise _rest_error(400, exc.detail) from exc

    if response.status_code >= 400:
        raise _rest_error(response.status_code, response.data)
    return _json_data(response.data)


def register_project_tools(  # noqa: C901
    server: FastMCP,
    audited_tool: Callable[..., Callable[..., Any]],
    current_principal: Callable[[tuple[str, ...]], Any],
) -> None:
    """Register the issue's authenticated 2D project and version operations."""

    async def invoke(
        view_class: type,
        method: str,
        path: str,
        *,
        body: dict[str, Any] | None = None,
        route_args: tuple[Any, ...] = (),
    ) -> Any:
        user = current_principal(("projects:write",)).user
        return await sync_to_async(_invoke_rest_view, thread_sensitive=True)(
            view_class,
            method,
            user,
            path,
            body=body,
            route_args=route_args,
        )

    @server.tool(
        name="list_my_projects",
        description=(
            "List the authenticated user's own 2D projects using the REST project serializer."
        ),
    )
    @audited_tool("list_my_projects", required_scopes=("projects:write",))
    async def list_my_projects() -> list[dict[str, Any]]:
        return await invoke(ProjectListCreateView, "get", "/api/projects/")

    @server.tool(
        name="create_project",
        description="Create a bare private 2D project, matching POST /api/projects/.",
    )
    @audited_tool("create_project", required_scopes=("projects:write",))
    async def create_project() -> dict[str, Any]:
        return await invoke(ProjectListCreateView, "post", "/api/projects/", body={})

    @server.tool(
        name="create_blank_project",
        description=(
            "Create a private 2D project with its first blank version; "
            "supports REST renderer and client_request_id semantics."
        ),
    )
    @audited_tool("create_blank_project", required_scopes=("projects:write",))
    async def create_blank_project(
        renderer: str | None = None, client_request_id: str | None = None
    ) -> dict[str, Any]:
        body: dict[str, Any] = {}
        if renderer is not None:
            body["renderer"] = renderer
        if client_request_id is not None:
            body["client_request_id"] = client_request_id
        return await invoke(BlankProjectCreateView, "post", "/api/projects/blank/", body=body)

    @server.tool(
        name="get_project",
        description=(
            "Read one project through the REST authorization policy; private non-owner "
            "projects are not found."
        ),
    )
    @audited_tool("get_project", required_scopes=("projects:write",))
    async def get_project(project_id: str) -> dict[str, Any]:
        return await invoke(
            ProjectDetailView,
            "get",
            f"/api/projects/{project_id}/",
            route_args=(project_id,),
        )

    @server.tool(
        name="update_project_metadata",
        description=(
            "Update project metadata through the REST serializer; visibility remains "
            "controlled by the publish/unpublish tools."
        ),
    )
    @audited_tool("update_project_metadata", required_scopes=("projects:write",))
    async def update_project_metadata(project_id: str, metadata: dict[str, Any]) -> dict[str, Any]:
        return await invoke(
            ProjectDetailView,
            "patch",
            f"/api/projects/{project_id}/",
            body=metadata,
            route_args=(project_id,),
        )

    @server.tool(
        name="publish_project",
        description="Publish the caller's project using the REST publication checks.",
    )
    @audited_tool("publish_project", required_scopes=("projects:write",))
    async def publish_project(project_id: str) -> dict[str, Any]:
        return await invoke(
            ProjectPublishView,
            "post",
            f"/api/projects/{project_id}/publish/",
            route_args=(project_id,),
        )

    @server.tool(
        name="unpublish_project",
        description="Make the caller's project private using the REST retention behavior.",
    )
    @audited_tool("unpublish_project", required_scopes=("projects:write",))
    async def unpublish_project(project_id: str) -> dict[str, Any]:
        return await invoke(
            ProjectUnpublishView,
            "post",
            f"/api/projects/{project_id}/unpublish/",
            route_args=(project_id,),
        )

    @server.tool(
        name="fork_project",
        description=(
            "Fork a public, remix-enabled project using REST authorization, validation, "
            "provenance and optional client_request_id idempotency."
        ),
    )
    @audited_tool("fork_project", required_scopes=("projects:write",))
    async def fork_project(project_id: str, client_request_id: str | None = None) -> dict[str, Any]:
        body = {"client_request_id": client_request_id} if client_request_id is not None else {}
        return await invoke(
            ProjectForkView,
            "post",
            f"/api/public/projects/{project_id}/fork/",
            body=body,
            route_args=(project_id,),
        )

    @server.tool(
        name="clone_template",
        description="Clone a readable built-in or owned private template using the REST behavior.",
    )
    @audited_tool("clone_template", required_scopes=("projects:write",))
    async def clone_template(template_id: str) -> dict[str, Any]:
        return await invoke(
            TemplateCloneView,
            "post",
            f"/api/templates/{template_id}/clone/",
            route_args=(template_id,),
        )

    @server.tool(
        name="list_versions",
        description="List the caller's non-deleted 2D project version summaries.",
    )
    @audited_tool("list_versions", required_scopes=("projects:write",))
    async def list_versions(project_id: str) -> list[dict[str, Any]]:
        return await invoke(
            SceneVersionListCreateView,
            "get",
            f"/api/projects/{project_id}/versions/",
            route_args=(project_id,),
        )

    @server.tool(
        name="get_version",
        description="Read one full version snapshot under the project owner's REST boundary.",
    )
    @audited_tool("get_version", required_scopes=("projects:write",))
    async def get_version(project_id: str, version_id: int) -> dict[str, Any]:
        return await invoke(
            SceneVersionDetailView,
            "get",
            f"/api/projects/{project_id}/versions/{version_id}/",
            route_args=(project_id, version_id),
        )

    @server.tool(
        name="save_version",
        description="Save an immutable 2D version using REST validation and transaction behavior.",
    )
    @audited_tool("save_version", required_scopes=("projects:write",))
    async def save_version(
        project_id: str,
        scene_json: dict[str, Any],
        origin: str,
        change_label: str = "",
    ) -> dict[str, Any]:
        return await invoke(
            SceneVersionListCreateView,
            "post",
            f"/api/projects/{project_id}/versions/",
            body={"scene_json": scene_json, "origin": origin, "change_label": change_label},
            route_args=(project_id,),
        )

    @server.tool(
        name="restore_version",
        description=(
            "Restore a historical snapshot as a new current version using the REST behavior."
        ),
    )
    @audited_tool("restore_version", required_scopes=("projects:write",))
    async def restore_version(project_id: str, version_id: int) -> dict[str, Any]:
        return await invoke(
            SceneVersionRestoreView,
            "post",
            f"/api/projects/{project_id}/versions/{version_id}/restore/",
            route_args=(project_id, version_id),
        )

    @server.tool(
        name="save_version_as_template",
        description=(
            "Save an owner-only version snapshot as a private template through REST validation."
        ),
    )
    @audited_tool("save_version_as_template", required_scopes=("projects:write",))
    async def save_version_as_template(
        project_id: str,
        version_id: int,
        name: str,
        category: str = "",
        description: str = "",
    ) -> dict[str, Any]:
        return await invoke(
            SaveVersionAsTemplateView,
            "post",
            f"/api/projects/{project_id}/versions/{version_id}/save-as-template/",
            body={"name": name, "category": category, "description": description},
            route_args=(project_id, version_id),
        )
