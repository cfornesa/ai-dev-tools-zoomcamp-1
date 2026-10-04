"""MCP Streamable HTTP contract tests for the public health tool."""

from __future__ import annotations

import anyio
import httpx
import pytest
from asgiref.testing import ApplicationCommunicator
from mcp.client.session import ClientSession
from mcp.client.streamable_http import streamable_http_client

from backend.asgi import application
from scenes.mcp.server import MAX_MCP_REQUEST_BODY_SIZE, create_mcp_asgi_app


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
                        assert [tool.name for tool in listing.tools] == ["health_check"]

                        result = await client.call_tool("health_check")
                        assert result.isError is not True
                        assert result.structuredContent == {
                            "status": "ok",
                            "database": "ok",
                            "cache": "ok",
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
