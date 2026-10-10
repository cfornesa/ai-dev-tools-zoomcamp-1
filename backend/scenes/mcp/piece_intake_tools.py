"""Bounded authenticated package-intake MCP tool (#1222)."""

from __future__ import annotations

import base64
import binascii
import io
import uuid
from collections.abc import Callable
from typing import Any

from asgiref.sync import sync_to_async
from django.http import HttpRequest
from mcp.server.mcpserver import MCPServer
from rest_framework.parsers import MultiPartParser
from rest_framework.request import Request

from scenes.mcp.project_tools import _json_data, _rest_error
from scenes.piece_intake_api import PiecePackageIntakeView

MCP_PACKAGE_MAX_BYTES = 180 * 1024

__all__ = ["MCP_PACKAGE_MAX_BYTES", "register_piece_intake_tools"]


def _multipart_payload(
    package: bytes,
    *,
    idempotency_key: str | None,
    piece_id: str | None,
    expected_revision: int | None,
) -> tuple[bytes, str]:
    boundary = f"mcp-package-{uuid.uuid4().hex}"
    chunks: list[bytes] = []
    for name, value in (
        ("idempotency_key", idempotency_key),
        ("piece_id", piece_id),
        ("expected_revision", str(expected_revision) if expected_revision is not None else None),
    ):
        if value is not None:
            chunks.extend(
                [
                    f"--{boundary}\r\n".encode(),
                    f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
                    value.encode("utf-8"),
                    b"\r\n",
                ]
            )
    chunks.extend(
        [
            f"--{boundary}\r\n".encode(),
            b'Content-Disposition: form-data; name="package"; filename="package.zip"\r\n',
            b"Content-Type: application/zip\r\n\r\n",
            package,
            b"\r\n",
            f"--{boundary}--\r\n".encode(),
        ]
    )
    return b"".join(chunks), boundary


def _invoke_intake_view(
    user: Any,
    package: bytes,
    *,
    idempotency_key: str | None,
    piece_id: str | None,
    expected_revision: int | None,
) -> Any:
    multipart, boundary = _multipart_payload(
        package,
        idempotency_key=idempotency_key,
        piece_id=piece_id,
        expected_revision=expected_revision,
    )
    path = "/api/pieces/intake/"
    raw_request = HttpRequest()
    raw_request.method = "POST"
    raw_request.path = path
    raw_request.path_info = path
    raw_request.META.update(
        {
            "REQUEST_METHOD": "POST",
            "PATH_INFO": path,
            "CONTENT_TYPE": f"multipart/form-data; boundary={boundary}",
            "CONTENT_LENGTH": str(len(multipart)),
        }
    )
    raw_request._read_started = False  # type: ignore[attr-defined]
    raw_request._stream = io.BytesIO(multipart)
    request = Request(raw_request, parsers=[MultiPartParser()], authenticators=[])
    request.user = user
    response = PiecePackageIntakeView().post(request)
    if response.status_code >= 400:
        body = response.data
        if body is None:
            body = {"detail": "Not found." if response.status_code == 404 else "Request failed."}
        raise _rest_error(response.status_code, body)
    return _json_data(response.data)


def register_piece_intake_tools(
    server: MCPServer,
    audited_tool: Callable[..., Callable[..., Any]],
    current_principal: Callable[[tuple[str, ...]], Any],
) -> None:
    """Register bounded ZIP intake through the REST multipart view."""

    @server.tool(
        name="intake_piece_package",
        description=(
            "Import a base64 ZIP package as a private owner record using the REST multipart "
            "parser, validation, quota and idempotency contract. Decoded ZIP size is capped "
            "at 180 KiB for the MCP transport."
        ),
    )
    @audited_tool("intake_piece_package", required_scopes=("projects:write",))
    async def intake_piece_package(
        package_base64: str,
        idempotency_key: str | None = None,
        piece_id: str | None = None,
        expected_revision: int | None = None,
    ) -> dict[str, Any]:
        if len(package_base64) > ((MCP_PACKAGE_MAX_BYTES + 2) // 3) * 4:
            raise _rest_error(
                413,
                {"detail": "Decoded ZIP package exceeds the MCP 180 KiB size limit."},
            )
        try:
            package = base64.b64decode(package_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise _rest_error(400, {"detail": "package_base64 must be valid base64."}) from exc
        if len(package) > MCP_PACKAGE_MAX_BYTES:
            raise _rest_error(
                413,
                {"detail": "Decoded ZIP package exceeds the MCP 180 KiB size limit."},
            )
        user = current_principal(("projects:write",)).user
        return await sync_to_async(_invoke_intake_view, thread_sensitive=True)(
            user,
            package,
            idempotency_key=idempotency_key,
            piece_id=piece_id,
            expected_revision=expected_revision,
        )
