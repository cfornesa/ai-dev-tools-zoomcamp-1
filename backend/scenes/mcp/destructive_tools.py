"""Explicitly confirmed, separately scoped destructive MCP tools (#1219)."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from asgiref.sync import sync_to_async
from mcp.server.fastmcp import FastMCP

from scenes.api import SceneVersionDetailView
from scenes.mcp.project_tools import _invoke_rest_view, _rest_error

DESTRUCTIVE_PROJECT_SCOPES = ("destructive", "projects:write")

__all__ = ["DESTRUCTIVE_PROJECT_SCOPES", "register_destructive_tools"]


def register_destructive_tools(
    server: FastMCP,
    audited_tool: Callable[..., Callable[..., Any]],
    current_principal: Callable[[tuple[str, ...]], Any],
) -> None:
    """Expose only REST-backed destructive operations with a target echo."""

    @server.tool(
        name="delete_version",
        description=(
            "Soft-delete an eligible historical 2D version through REST. Requires both the "
            "separately granted destructive and projects:write scopes. Set confirm to the "
            "exact '<project_id>:<version_id>' pair. Current versions remain protected."
        ),
    )
    @audited_tool("delete_version", required_scopes=DESTRUCTIVE_PROJECT_SCOPES)
    async def delete_version(project_id: str, version_id: int, confirm: str) -> None:
        expected_confirmation = f"{project_id}:{version_id}"
        if confirm != expected_confirmation:
            raise _rest_error(
                400,
                {"detail": "confirm must exactly match '<project_id>:<version_id>'."},
            )
        user = current_principal(DESTRUCTIVE_PROJECT_SCOPES).user
        await sync_to_async(_invoke_rest_view, thread_sensitive=True)(
            SceneVersionDetailView,
            "delete",
            user,
            f"/api/projects/{project_id}/versions/{version_id}/",
            route_args=(project_id, version_id),
        )
        return None
