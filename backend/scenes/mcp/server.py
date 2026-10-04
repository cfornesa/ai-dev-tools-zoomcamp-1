"""Stateless, public MCP server mounted beside Django's ASGI application."""

from __future__ import annotations

from typing import Any

from asgiref.sync import sync_to_async
from django.conf import settings
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from backend.views import health_status

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
