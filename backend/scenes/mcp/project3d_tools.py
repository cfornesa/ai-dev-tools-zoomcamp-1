"""Authenticated 3D project/version and AI MCP tools (#1221)."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from asgiref.sync import sync_to_async
from mcp.server.mcpserver import MCPServer

from scenes.ai_api3d import AIAcceptProposal3DView, AICreateScene3DView, AIEditScene3DView
from scenes.api3d import (
    Project3DDetailView,
    Project3DListCreateView,
    Project3DPublishView,
    Project3DUnpublishView,
    SceneVersion3DListCreateView,
)
from scenes.mcp.project_tools import _invoke_rest_view

__all__ = ["register_project3d_tools"]


def register_project3d_tools(  # noqa: C901
    server: MCPServer,
    audited_tool: Callable[..., Callable[..., Any]],
    current_principal: Callable[[tuple[str, ...]], Any],
) -> None:
    """Register only 3D operations backed by existing REST views."""

    async def invoke(
        scopes: tuple[str, ...],
        view_class: type,
        method: str,
        path: str,
        *,
        body: dict[str, Any] | None = None,
        route_args: tuple[Any, ...] = (),
    ) -> Any:
        user = current_principal(scopes).user
        return await sync_to_async(_invoke_rest_view, thread_sensitive=True)(
            view_class,
            method,
            user,
            path,
            body=body,
            route_args=route_args,
        )

    @server.tool(
        name="list_my_3d_projects",
        description="List the authenticated user's 3D projects using the REST serializer.",
    )
    @audited_tool("list_my_3d_projects", required_scopes=("projects:write",))
    async def list_my_3d_projects() -> list[dict[str, Any]]:
        return await invoke(("projects:write",), Project3DListCreateView, "get", "/api/projects3d/")

    @server.tool(
        name="create_3d_project",
        description="Create a private 3D project and first valid scene version through REST.",
    )
    @audited_tool("create_3d_project", required_scopes=("projects:write",))
    async def create_3d_project(renderer: str | None = None) -> dict[str, Any]:
        body = {"renderer": renderer} if renderer is not None else {}
        return await invoke(
            ("projects:write",),
            Project3DListCreateView,
            "post",
            "/api/projects3d/",
            body=body,
        )

    @server.tool(
        name="get_3d_project",
        description="Read a 3D project under the REST owner/public-read authorization policy.",
    )
    @audited_tool("get_3d_project", required_scopes=("projects:write",))
    async def get_3d_project(project_id: str) -> dict[str, Any]:
        return await invoke(
            ("projects:write",),
            Project3DDetailView,
            "get",
            f"/api/projects3d/{project_id}/",
            route_args=(project_id,),
        )

    @server.tool(
        name="update_3d_project_metadata",
        description="Update the 3D project's title using the REST metadata serializer.",
    )
    @audited_tool("update_3d_project_metadata", required_scopes=("projects:write",))
    async def update_3d_project_metadata(project_id: str, title: str) -> dict[str, Any]:
        return await invoke(
            ("projects:write",),
            Project3DDetailView,
            "patch",
            f"/api/projects3d/{project_id}/",
            body={"title": title},
            route_args=(project_id,),
        )

    @server.tool(
        name="publish_3d_project",
        description="Publish the caller's 3D project using REST metadata checks.",
    )
    @audited_tool("publish_3d_project", required_scopes=("projects:write",))
    async def publish_3d_project(project_id: str) -> dict[str, Any]:
        return await invoke(
            ("projects:write",),
            Project3DPublishView,
            "post",
            f"/api/projects3d/{project_id}/publish/",
            route_args=(project_id,),
        )

    @server.tool(
        name="unpublish_3d_project",
        description="Make the caller's 3D project private using REST retention behavior.",
    )
    @audited_tool("unpublish_3d_project", required_scopes=("projects:write",))
    async def unpublish_3d_project(project_id: str) -> dict[str, Any]:
        return await invoke(
            ("projects:write",),
            Project3DUnpublishView,
            "post",
            f"/api/projects3d/{project_id}/unpublish/",
            route_args=(project_id,),
        )

    @server.tool(
        name="list_3d_versions",
        description="List the caller's 3D project versions through the REST serializer.",
    )
    @audited_tool("list_3d_versions", required_scopes=("projects:write",))
    async def list_3d_versions(project_id: str) -> list[dict[str, Any]]:
        return await invoke(
            ("projects:write",),
            SceneVersion3DListCreateView,
            "get",
            f"/api/projects3d/{project_id}/versions/",
            route_args=(project_id,),
        )

    @server.tool(
        name="save_3d_version",
        description=(
            "Save a new validated 3D scene snapshot using REST scene and source validation."
        ),
    )
    @audited_tool("save_3d_version", required_scopes=("projects:write",))
    async def save_3d_version(
        project_id: str,
        scene_json: dict[str, Any],
        html_source: str | None = None,
        css_source: str | None = None,
        js_source: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"scene_json": scene_json}
        if html_source is not None:
            body["html_source"] = html_source
        if css_source is not None:
            body["css_source"] = css_source
        if js_source is not None:
            body["js_source"] = js_source
        return await invoke(
            ("projects:write",),
            SceneVersion3DListCreateView,
            "post",
            f"/api/projects3d/{project_id}/versions/",
            body=body,
            route_args=(project_id,),
        )

    @server.tool(
        name="ai_create_3d_scene",
        description=(
            "Generate an unsaved 3D scene draft using REST provider, validation, quota, "
            "and entitlement checks."
        ),
    )
    @audited_tool("ai_create_3d_scene", required_scopes=("ai:use",))
    async def ai_create_3d_scene(
        project_id: str,
        prompt: str,
        vendor: str = "mistral",
        model: str = "",
        persona_id: int | None = None,
        target_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"prompt": prompt, "vendor": vendor, "model": model}
        if persona_id is not None:
            body["persona_id"] = persona_id
        if target_ids is not None:
            body["target_ids"] = target_ids
        return await invoke(
            ("ai:use",),
            AICreateScene3DView,
            "post",
            f"/api/projects3d/{project_id}/ai/create-scene/",
            body=body,
            route_args=(project_id,),
        )

    @server.tool(
        name="ai_edit_3d_scene",
        description=(
            "Propose an unsaved 3D patch with REST validation, stale-base, quota, "
            "and entitlement checks."
        ),
    )
    @audited_tool("ai_edit_3d_scene", required_scopes=("ai:use",))
    async def ai_edit_3d_scene(
        project_id: str,
        prompt: str,
        current_scene: dict[str, Any],
        base_version_id: int | None,
        vendor: str = "mistral",
        model: str = "",
        persona_id: int | None = None,
        target_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "prompt": prompt,
            "current_scene": current_scene,
            "base_version_id": base_version_id,
            "vendor": vendor,
            "model": model,
        }
        if persona_id is not None:
            body["persona_id"] = persona_id
        if target_ids is not None:
            body["target_ids"] = target_ids
        return await invoke(
            ("ai:use",),
            AIEditScene3DView,
            "post",
            f"/api/projects3d/{project_id}/ai/edit-scene/",
            body=body,
            route_args=(project_id,),
        )

    @server.tool(
        name="ai_accept_3d_proposal",
        description=(
            "Explicitly accept and persist a 3D AI proposal; REST validates scene_json and "
            "checks the required base version."
        ),
    )
    @audited_tool("ai_accept_3d_proposal", required_scopes=("ai:use", "projects:write"))
    async def ai_accept_3d_proposal(
        project_id: str,
        operation: str,
        scene_json: dict[str, Any],
        base_version_id: int | None,
        client_request_id: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "operation": operation,
            "scene_json": scene_json,
            "base_version_id": base_version_id,
        }
        if client_request_id is not None:
            body["client_request_id"] = client_request_id
        return await invoke(
            ("ai:use", "projects:write"),
            AIAcceptProposal3DView,
            "post",
            f"/api/projects3d/{project_id}/ai/accept-proposal/",
            body=body,
            route_args=(project_id,),
        )
