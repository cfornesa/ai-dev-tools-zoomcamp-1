# Public MCP server

`POST /mcp/` exposes the read-only public-content Model Context Protocol
surface over Streamable HTTP. Every request requires a valid OAuth bearer
token for the exact `/mcp` resource; session cookies are ignored. All public
content tools and resources require `gallery:read`. `health_check` and
`whoami` require authentication but no additional scope. The MCP tools call
the same public selectors and serializers as the corresponding REST APIs;
private, unlisted, draft, soft-deleted, or otherwise ineligible content is
not made public by MCP.

The request body limit is 256 KiB. The transport validates `Origin` and
`Host`; unsupported methods and paths are rejected. Authenticated tool calls
are limited to 60 calls per OAuth client and per user per 60-second fixed window.
Each request also records a keyed, one-way fingerprint of the trusted caller
IP for audit. A rate-limit failure is an MCP tool error with JSON-RPC code
`-32029` and `retry_after_seconds` in the error data. The preview proxy forwards the
client address, and Django honors `X-Forwarded-For` only when the immediate
peer is loopback. Missing, expired, or wrong-audience tokens receive a
structured `401 invalid_token`; under-scoped calls return a structured
JSON-RPC `insufficient_scope` error. Audit records contain timestamp, tool,
client and user IDs, outcome, duration, and a keyed one-way IP fingerprint; arguments,
results, tokens, secrets, and raw IP addresses are not stored. User audit
records appear in account export and remain attached to the anonymized user
row after deletion. The OAuth token is resolved by its stored SHA-256 checksum
on each request, so revocation takes effect immediately without retaining or
logging the bearer value.

## Connect a client

For Visual Studio Code, copy [`docs/examples/mcp.json`](examples/mcp.json) to
`.vscode/mcp.json`, replace `<application-host>` with the application host,
and replace `<pre-registered-client-id>` with the client ID provided by an
application administrator. VS Code's HTTP `oauth.clientId` setting starts its
built-in OAuth flow. Sign in through the existing browser session and approve
`gallery:read` when prompted. The pre-registered app must include the VS Code
redirect URIs `http://127.0.0.1:33418` and `https://vscode.dev/redirect`.
See [VS Code's MCP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration)
for client configuration details.

```json
{
  "servers": {
    "creatrweb-public": {
      "type": "http",
      "url": "https://<application-host>/mcp/"
    }
  }
}
```

See [VS Code's MCP server configuration guide](https://code.visualstudio.com/docs/agent-customization/mcp-servers)
for where to place this file and how to start the configured server.

## Anonymous public-content apps endpoint (#1223)

`POST /mcp/apps/` is a separate, anonymous MCP Apps surface. It exposes only
`show_public_gallery` and `show_public_project`; both return public REST
content through the same eligibility checks, plus a plain JSON text fallback.
The tools are rate-limited to 60 calls per trusted caller IP per minute and
write payload-free audit rows with no user/client identity. The linked
`ui://creatrweb/public-content` resource is `text/html;profile=mcp-app`; its
CSP declares no network, external resource, or nested-frame origins, and it
requests no browser permissions. The widget renders only the tool result,
never calls MCP tools itself, and sends a validated same-site viewer URL to the
host only when the user selects “Open full project viewer.” The endpoint has
no owner, write, AI, or token-related tools. The existing `/mcp/` endpoint and
its OAuth requirements are unchanged.
Browser CORS preflight is restricted to origins listed in
`CSRF_TRUSTED_ORIGINS`.

For local transport verification, run the Django ASGI entry point (for
example, `cd backend && uv run --with uvicorn uvicorn backend.main:app
--host 127.0.0.1 --port 8000`) and include the reference host's exact origin
in `CSRF_TRUSTED_ORIGINS`. Django's `manage.py runserver` serves the WSGI
application and does not dispatch these MCP routes.

## Register an authenticated client

OAuth clients are pre-registered; there is no public dynamic-registration
endpoint. An application administrator can register a native/public client
with the session-authenticated `POST /api/admin/oauth-applications/` endpoint
(same-origin session cookie and CSRF header). Submit a `name` and one or more
exact `redirect_uris`; HTTPS callbacks are accepted, plus HTTP callbacks on
loopback hosts for native clients. The response contains the client ID and
never returns a client secret. Do not use the toolkit's application
registration or dynamic registration endpoints; they are not mounted.

External clients discover the issuer at
`/.well-known/oauth-authorization-server` and the protected resource at
`/.well-known/oauth-protected-resource/mcp/`. The resource identifier is
`https://<application-host>/mcp`. Authorization uses the existing allauth
browser session and displays a consent page for the requested scopes. Only
authorization code with PKCE `S256` is supported. Request the exact `resource`
indicator above and one or more of `gallery:read`, `projects:write`, `ai:use`,
and `destructive`; request `destructive` separately so the user can make that
approval explicitly. Access tokens last 15 minutes; refresh tokens rotate and
expire after 30 days of inactivity. Tokens are audience-bound to `/mcp` and
stored hashed at rest. `POST /oauth/revoke_token/` revokes a token.

Users can review the app name, approved scopes, and last authorization in the
**Connected MCP apps** section of account settings. Revocation removes that
user's access and refresh tokens for the selected client, effective on the
next MCP request. It does not affect another user's authorization for the same
pre-registered client. AI operations retain the web application's entitlement
and quota rules.

The Vite development and production-preview servers must proxy `/.well-known/`
and `/oauth/` to Django, including `/oauth/authorize/`, `/oauth/token/`, and
`/oauth/revoke_token/`. The proxy preserves the incoming `Host` header and
forwards the client address so Django can build the correct issuer URLs and
apply trusted-proxy IP handling. Without these proxy routes, OAuth clients
receive the frontend's unknown-route 404 instead of Django discovery and
authorization responses.

The following Python example uses the official MCP SDK client. Set
`MCP_ACCESS_TOKEN` to a current access token issued for the exact resource
above. It initializes a session, discovers the tools, and calls `whoami`.
The same SDK client is exercised by
`backend/tests/test_mcp_server.py` against the Django ASGI application.

```python
import asyncio
import os

import httpx
from mcp.client.session import ClientSession
from mcp.client.streamable_http import streamable_http_client


async def main():
    async with httpx.AsyncClient(
        headers={"Authorization": f"Bearer {os.environ['MCP_ACCESS_TOKEN']}"}
    ) as http_client:
        async with streamable_http_client(
            "https://<application-host>/mcp/", http_client=http_client
        ) as (read_stream, write_stream, _):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                tools = await session.list_tools()
                print([tool.name for tool in tools.tools])
                identity = await session.call_tool("whoami")
                print(identity.structuredContent)


asyncio.run(main())
```

The client should retry a rate-limited tool call only after the reported
`retry_after_seconds`. The client must send `Authorization: Bearer` on each
MCP request; a browser session cookie never substitutes for an access token.

## Tools

Every tool is authenticated and declares a scope. Public-content tools use
`gallery:read`; owner 2D project/version tools use `projects:write` (including
reads, so a gallery-only grant cannot read private project data); `health_check`
and `whoami` require a valid token but no additional scope. AI generation,
editing, run creation/read, and standalone art generation require `ai:use`;
accepting a proposal also requires `projects:write`. AI proposals remain
unsaved until `ai_accept_proposal`, and persistent runs are created without
blocking. Authenticated 3D project/version tools use `projects:write`; 3D AI
create/edit use `ai:use`, and 3D proposal acceptance uses both scopes. Public data tools
use the same eligibility rules as their REST counterpart; a missing or
ineligible individual resource returns not found. MCP schemas below list the
SDK input properties; optional properties may be omitted.

| Tool | Required OAuth scope / endpoint |
|---|---|
| `show_public_gallery` | None; anonymous `/mcp/apps/` endpoint. |
| `show_public_project` | None; anonymous `/mcp/apps/` endpoint. |
| `health_check` | None beyond a valid bearer token. |
| `whoami` | None beyond a valid bearer token. |
| `list_public_gallery` | `gallery:read` |
| `get_public_project` | `gallery:read` |
| `get_public_thumbnail` | `gallery:read` |
| `list_templates` | `gallery:read` |
| `get_published_asset` | `gallery:read` |
| `list_public_pieces` | `gallery:read` |
| `get_public_3d_project` | `gallery:read` |
| `get_public_art_piece` | `gallery:read` |
| `list_public_collections` | `gallery:read` |
| `get_public_collection` | `gallery:read` |
| `search_public` | `gallery:read` |
| `list_my_projects` | `projects:write` |
| `create_project` | `projects:write` |
| `create_blank_project` | `projects:write` |
| `get_project` | `projects:write` |
| `update_project_metadata` | `projects:write` |
| `publish_project` | `projects:write` |
| `unpublish_project` | `projects:write` |
| `fork_project` | `projects:write` |
| `clone_template` | `projects:write` |
| `list_versions` | `projects:write` |
| `get_version` | `projects:write` |
| `save_version` | `projects:write` |
| `restore_version` | `projects:write` |
| `save_version_as_template` | `projects:write` |
| `ai_create_scene` | `ai:use` |
| `ai_edit_scene` | `ai:use` |
| `ai_accept_proposal` | `ai:use`, `projects:write` |
| `ai_start_run` | `ai:use` |
| `ai_get_run` | `ai:use` |
| `ai_generate_art_piece` | `ai:use` |
| `list_my_3d_projects` | `projects:write` |
| `create_3d_project` | `projects:write` |
| `get_3d_project` | `projects:write` |
| `update_3d_project_metadata` | `projects:write` |
| `publish_3d_project` | `projects:write` |
| `unpublish_3d_project` | `projects:write` |
| `list_3d_versions` | `projects:write` |
| `save_3d_version` | `projects:write` |
| `ai_create_3d_scene` | `ai:use` |
| `ai_edit_3d_scene` | `ai:use` |
| `ai_accept_3d_proposal` | `ai:use`, `projects:write` |
| `intake_piece_package` | `projects:write` |
| `delete_version` | `destructive`, `projects:write` |

| Tool | Input schema | Example call | Result |
|---|---|---|---|
| `show_public_gallery` | `page_size?: integer` (default 12, clamped 1–60) | `show_public_gallery({"page_size": 8})` | Eligible public 2D/3D/generated/collection cards and viewer origin; also linked to the public content UI. |
| `show_public_project` | `project_id: string` | `show_public_project({"project_id": "<public-uuid>"})` | Published public 2D project detail, scene preview data, and same-site viewer URL; also linked to the public content UI. |
| `health_check` | `{}` | `health_check()` | Safe database/cache status without connection details. |
| `whoami` | `{}` | `whoami()` | Authenticated user ID, username, client ID, and granted scopes. |
| `list_public_gallery` | `cursor?: string \| null`, `page_size?: integer` (default 24, clamped 1–60) | `list_public_gallery({"page_size": 10})` | One newest-first page of the legacy public 2D/3D project gallery, `next_cursor`, and `has_more`. |
| `get_public_project` | `project_id: string` | `get_public_project({"project_id": "<public-uuid>"})` | Full public 2D project payload. |
| `get_public_thumbnail` | `project_id: string` | `get_public_thumbnail({"project_id": "<public-uuid>"})` | Current thumbnail as MCP image content. |
| `list_templates` | `{}` | `list_templates()` | Built-in templates. |
| `get_published_asset` | `project_id: string`, `asset_id: string` | `get_published_asset({"project_id": "<public-uuid>", "asset_id": "<asset-uuid>"})` | Public retained asset as base64, media type, and checksum. |
| `list_public_pieces` | `gallery_type?: string` (default `all`; `all`, `authored`, `pieces`, `collections`, `generated`), `engine?: string \| null`, `cursor?: string \| null`, `page_size?: integer` (default 24, clamped 1–60) | `list_public_pieces({"gallery_type": "generated", "page_size": 12})` | Unified public 2D/3D/generated/collection cards as selected, cursor metadata, and engine catalog. Cursor must be reused with the same gallery type. |
| `get_public_3d_project` | `project_id: string` | `get_public_3d_project({"project_id": "<public-uuid>"})` | Public 3D project and public scene data. |
| `get_public_art_piece` | `piece_id: string` | `get_public_art_piece({"piece_id": "<public-uuid>"})` | Metadata and current public version of a published generated piece. |
| `list_public_collections` | `sort?: string` (default `newest`; `newest`, `oldest`, `item_count`), `cursor?: string \| null`, `page_size?: integer` (default 24, clamped 1–60) | `list_public_collections({"sort": "item_count"})` | One bounded page of active public collections and cursor metadata. Reuse a cursor with the same sort. |
| `get_public_collection` | `handle: string`, `slug: string` | `get_public_collection({"handle": "<public-handle>", "slug": "<collection-slug>"})` | Active published collection detail. |
| `search_public` | `query: string`, `scope?: string` (default `content`; `content` or `accounts`) | `search_public({"query": "landscape", "scope": "content"})` | Up to 50 eligible public content or public-account results. Query is limited to 100 characters. |
| `list_my_projects` | `{}` | `list_my_projects()` | The caller's own 2D project list using `ProjectSerializer`. |
| `create_project` | `{}` | `create_project()` | Bare private project without an initial scene version, matching REST. |
| `create_blank_project` | `renderer?: string`, `client_request_id?: string` | `create_blank_project({"renderer": "svg", "client_request_id": "<uuid>"})` | Private project with an initial blank version; preserves REST renderer defaults and idempotency. |
| `get_project` | `project_id: string` | `get_project({"project_id": "<uuid>"})` | Owner project serializer; private/non-owner or missing projects return not found. |
| `update_project_metadata` | `project_id: string`, `metadata: object` | `update_project_metadata({"project_id": "<uuid>", "metadata": {"title": "New title"}})` | REST metadata validation and response; visibility remains controlled by publish tools. |
| `publish_project` | `project_id: string` | `publish_project({"project_id": "<uuid>"})` | Publishes only after REST meaningful-metadata and saved-version checks. |
| `unpublish_project` | `project_id: string` | `unpublish_project({"project_id": "<uuid>"})` | Makes the caller's project private, retaining its history. |
| `fork_project` | `project_id: string`, `client_request_id?: string` | `fork_project({"project_id": "<public-uuid>", "client_request_id": "<uuid>"})` | REST public/remix eligibility, independent version copy, provenance and idempotency. |
| `clone_template` | `template_id: string` | `clone_template({"template_id": "<template-uuid>"})` | Clones a readable template into a private project using the REST validation/copy behavior. |
| `list_versions` | `project_id: string` | `list_versions({"project_id": "<uuid>"})` | Owner-only, non-deleted version summaries. |
| `get_version` | `project_id: string`, `version_id: integer` | `get_version({"project_id": "<uuid>", "version_id": 1})` | Full version snapshot; a cross-project version ID follows REST not-found behavior. |
| `save_version` | `project_id: string`, `scene_json: object`, `origin: string`, `change_label?: string` | `save_version({"project_id": "<uuid>", "scene_json": {}, "origin": "manual"})` | REST schema validation, immutable version creation and current-version advancement. |
| `restore_version` | `project_id: string`, `version_id: integer` | `restore_version({"project_id": "<uuid>", "version_id": 1})` | Creates a new current version from the historical snapshot, preserving REST rules. |
| `save_version_as_template` | `project_id: string`, `version_id: integer`, `name: string`, `category?: string`, `description?: string` | `save_version_as_template({"project_id": "<uuid>", "version_id": 1, "name": "Snapshot"})` | Creates an owner-private template snapshot through REST validation. |
| `ai_create_scene` | `project_id: string`, `prompt: string`, `vendor?: string`, `model?: string`, `persona_id?: integer`, `target_ids?: string[]` | `ai_create_scene({"project_id": "<uuid>", "prompt": "Add a sun"})` | Unsaved scene proposal; REST owner, validation, rate, quota, and entitlement checks apply. |
| `ai_edit_scene` | `project_id: string`, `prompt: string`, `current_scene: object`, `base_version_id: integer | null`, `vendor?: string`, `model?: string`, `persona_id?: integer`, `target_ids?: string[]` | `ai_edit_scene({...})` | Unsaved patch proposal; REST stale-base, validation, rate, quota, and entitlement checks apply. |
| `ai_accept_proposal` | `project_id: string`, `operation: string`, `scene_json: object`, `base_version_id: integer | null`, `change_label?: string`, `client_request_id?: string` | `ai_accept_proposal({...})` | Explicitly persists one validated immutable version; requires both AI and project-write scopes. |
| `ai_start_run` | `target_type: string`, `operation: string`, `prompt: string`, `project_id?: string`, `project3d_id?: string`, `scope?: string`, `selected_target_ids?: string[]`, `assets?: object[]`, `use_intent_notes?: boolean`, `vendor?: string`, `model?: string`, `start_request_id?: string` | `ai_start_run({...})` | Creates a persistent run and returns immediately; uses REST quota and entitlement checks. |
| `ai_get_run` | `run_id: integer` | `ai_get_run({"run_id": 42})` | Reads only the caller's run state; does not advance or accept it. |
| `ai_generate_art_piece` | `prompt: string`, `library: string`, `vendor?: string`, `model?: string`, `persona_id?: integer` | `ai_generate_art_piece({"prompt": "A star field", "library": "svg"})` | Returns standalone snippet data; REST credential, quota, and entitlement checks apply, and MCP does not execute it. |
| `list_my_3d_projects` | `{}` | `list_my_3d_projects()` | The caller's 3D project list using `Project3DSerializer`. |
| `create_3d_project` | `renderer?: string` | `create_3d_project({"renderer": "threejs"})` | Private 3D project with first blank scene/version; REST validation applies. |
| `get_3d_project` | `project_id: string` | `get_3d_project({"project_id": "<uuid>"})` | Owner or REST-authorized public 3D project payload; foreign private projects are not found. |
| `update_3d_project_metadata` | `project_id: string`, `title: string` | `update_3d_project_metadata({"project_id": "<uuid>", "title": "Scene"})` | REST title serializer and owner check. |
| `publish_3d_project` | `project_id: string` | `publish_3d_project({"project_id": "<uuid>"})` | REST meaningful-title and saved-version publication checks. |
| `unpublish_3d_project` | `project_id: string` | `unpublish_3d_project({"project_id": "<uuid>"})` | Makes the caller's 3D project private using REST retention behavior. |
| `list_3d_versions` | `project_id: string` | `list_3d_versions({"project_id": "<uuid>"})` | Owner's ordered 3D version snapshots. |
| `save_3d_version` | `project_id: string`, `scene_json: object`, `html_source?: string`, `css_source?: string`, `js_source?: string` | `save_3d_version({...})` | REST 3D scene schema and source-byte validation; appends immutable version. |
| `ai_create_3d_scene` | `project_id: string`, `prompt: string`, `vendor?: string`, `model?: string`, `persona_id?: integer`, `target_ids?: string[]` | `ai_create_3d_scene({...})` | Unsaved 3D proposal; REST owner, schema, quota, and entitlement checks apply. |
| `ai_edit_3d_scene` | `project_id: string`, `prompt: string`, `current_scene: object`, `base_version_id: integer or null`, `vendor?: string`, `model?: string`, `persona_id?: integer`, `target_ids?: string[]` | `ai_edit_3d_scene({...})` | Unsaved patch proposal; REST validation and stale-base checks apply. |
| `ai_accept_3d_proposal` | `project_id: string`, `operation: string`, `scene_json: object`, `base_version_id: integer or null`, `client_request_id?: string` | `ai_accept_3d_proposal({...})` | Explicitly persists one scene3d-validated version after owner, base-version, and idempotency checks; requires both scopes. |
| `intake_piece_package` | `package_base64: string`, optional `idempotency_key`, `piece_id`, `expected_revision` | `intake_piece_package({"package_base64": "<base64 ZIP>"})` | Imports through the REST multipart parser; decoded ZIP limit is 180 KiB for the MCP transport. Intake remains private and REST archive/security/quota checks apply. |
| `delete_version` | `project_id: string`, `version_id: integer`, `confirm: string` | `delete_version({"project_id": "…", "version_id": 42, "confirm": "<project_id>:42"})` | Soft-deletes an eligible non-current historical version through REST. `confirm` must exactly match `<project_id>:<version_id>`. The owner must grant both `destructive` and `projects:write`. The existing `restore_version` operation creates a new version from a historical source; it does not undelete that source. The owner deferred `delete_project` from the first MCP release because no owner-facing project restore route exists; a separate recovery feature is tracked in #1240. |

Page sizes are clamped to 1–60. Gallery cursors are opaque, may expire, and
are scoped to their corresponding gallery type or collection sort. Search
returns an empty result for an empty query and rejects a query longer than 100
characters or an unsupported scope.

## Resources

| URI | Content |
|---|---|
| `ui://creatrweb/public-content` | No authentication; `text/html;profile=mcp-app`, resource CSP blocks network, external resources, and nested frames; no browser permissions. |
| `gallery://public` | `gallery:read`; first bounded page of the public legacy 2D project gallery. |
| `project://{project_id}` | `gallery:read`; public 2D project by UUID; private and missing projects are not found. |

## Related contracts

The browser UI also preserves the legacy owner links `/art-pieces/manage` and
`/art-pieces/<id>/edit`: they redirect to the generated-only Studio view and
the canonical profile-nested editor URL, respectively. `/art-pieces` remains
the AI creation route. These frontend redirects do not add or change MCP tools.

- [`docs/api.md`](api.md) records both `/mcp/` and `/mcp/apps/` transport, privacy, throttling,
  audit, and account-lifecycle contract.
- [`openapi.yaml`](../openapi.yaml) documents the HTTP endpoint. MCP tool and
  resource schemas are discovered through the MCP protocol.
