"""Authenticated AI proposal and run MCP tools (#1220)."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from asgiref.sync import sync_to_async
from mcp.server.mcpserver import MCPServer

from scenes.ai_api import AIAcceptProposalView, AICreateSceneView, AIEditSceneView
from scenes.ai_runs_api import AIRunDetailView, AIRunListCreateView
from scenes.art_piece_api import ArtPieceGenerateView
from scenes.mcp.project_tools import _invoke_rest_view

__all__ = ["register_ai_tools"]


def register_ai_tools(  # noqa: C901
    server: MCPServer,
    audited_tool: Callable[..., Callable[..., Any]],
    current_principal: Callable[[tuple[str, ...]], Any],
) -> None:
    """Register AI tools that preserve the web API's validation and budgets."""

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
        name="ai_create_scene",
        description=(
            "Generate an unsaved 2D scene draft with the REST endpoint's provider, "
            "validation, quota, and entitlement checks."
        ),
    )
    @audited_tool("ai_create_scene", required_scopes=("ai:use",))
    async def ai_create_scene(
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
            AICreateSceneView,
            "post",
            f"/api/projects/{project_id}/ai/create-scene/",
            body=body,
            route_args=(project_id,),
        )

    @server.tool(
        name="ai_edit_scene",
        description=(
            "Propose a patch as an unsaved 2D scene draft using REST validation, "
            "stale-base, quota, and entitlement checks."
        ),
    )
    @audited_tool("ai_edit_scene", required_scopes=("ai:use",))
    async def ai_edit_scene(
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
            AIEditSceneView,
            "post",
            f"/api/projects/{project_id}/ai/edit-scene/",
            body=body,
            route_args=(project_id,),
        )

    @server.tool(
        name="ai_accept_proposal",
        description=(
            "Explicitly persist an AI proposal as a new immutable version; the base version "
            "is required and REST revalidates the scene."
        ),
    )
    @audited_tool("ai_accept_proposal", required_scopes=("ai:use", "projects:write"))
    async def ai_accept_proposal(
        project_id: str,
        operation: str,
        scene_json: dict[str, Any],
        base_version_id: int | None,
        change_label: str = "",
        client_request_id: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "operation": operation,
            "scene_json": scene_json,
            "base_version_id": base_version_id,
            "change_label": change_label,
        }
        if client_request_id is not None:
            body["client_request_id"] = client_request_id
        return await invoke(
            ("ai:use", "projects:write"),
            AIAcceptProposalView,
            "post",
            f"/api/projects/{project_id}/ai/accept-proposal/",
            body=body,
            route_args=(project_id,),
        )

    @server.tool(
        name="ai_start_run",
        description=(
            "Start a persistent, non-blocking AI run using the REST run model and its "
            "quota and entitlement checks."
        ),
    )
    @audited_tool("ai_start_run", required_scopes=("ai:use",))
    async def ai_start_run(
        target_type: str,
        operation: str,
        prompt: str,
        project_id: str | None = None,
        project3d_id: str | None = None,
        scope: str = "whole_scene",
        selected_target_ids: list[str] | None = None,
        assets: list[dict[str, Any]] | None = None,
        use_intent_notes: bool = True,
        vendor: str = "mistral",
        model: str = "",
        start_request_id: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "target_type": target_type,
            "operation": operation,
            "prompt": prompt,
            "scope": scope,
            "use_intent_notes": use_intent_notes,
            "vendor": vendor,
            "model": model,
        }
        if project_id is not None:
            body["project_id"] = project_id
        if project3d_id is not None:
            body["project3d_id"] = project3d_id
        if selected_target_ids is not None:
            body["selected_target_ids"] = selected_target_ids
        if assets is not None:
            body["assets"] = assets
        if start_request_id is not None:
            body["start_request_id"] = start_request_id
        return await invoke(("ai:use",), AIRunListCreateView, "post", "/api/ai/runs/", body=body)

    @server.tool(
        name="ai_get_run",
        description="Read the caller's AI run state without advancing or accepting the run.",
    )
    @audited_tool("ai_get_run", required_scopes=("ai:use",))
    async def ai_get_run(run_id: int) -> dict[str, Any]:
        return await invoke(
            ("ai:use",),
            AIRunDetailView,
            "get",
            f"/api/ai/runs/{run_id}/",
            route_args=(run_id,),
        )

    @server.tool(
        name="ai_generate_art_piece",
        description=(
            "Generate a standalone art-piece snippet through REST provider, personal-credential, "
            "quota, and entitlement checks; returned code is data and is never executed here."
        ),
    )
    @audited_tool("ai_generate_art_piece", required_scopes=("ai:use",))
    async def ai_generate_art_piece(
        prompt: str,
        library: str,
        vendor: str = "mistral",
        model: str = "",
        persona_id: int | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "prompt": prompt,
            "library": library,
            "vendor": vendor,
            "model": model,
        }
        if persona_id is not None:
            body["persona_id"] = persona_id
        return await invoke(
            ("ai:use",),
            ArtPieceGenerateView,
            "post",
            "/api/ai/art-pieces/generate/",
            body=body,
        )
