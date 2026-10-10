# Dependency and asset licenses

## Django OAuth Toolkit (`django-oauth-toolkit`) (#1206/#1216)

The owner approved this provider in #1206 for per-user OAuth authorization to
the MCP resource. The package runs inside Django and does not send runtime
requests or user data to its publisher. OAuth applications are registered in
advance by an application administrator; public/dynamic client registration
is deliberately disabled. The integration uses authorization code with
PKCE S256, exact redirect URI matching, short-lived resource-audience access
tokens, rotating refresh tokens, and the toolkit's revocation/discovery
endpoints. The package also supplies additive authorization, grant, and token
tables.

- **What breaks if the package is abandoned or changes incompatibly:** MCP
  OAuth discovery, authorization, token issuance/refresh, and revocation stop
  working until the provider integration is updated; anonymous public MCP
  reads and ordinary web-session routes remain separate.
- **Self-hosting/rollback alternative:** maintain a fork of the provider or
  replace its views/validator behind the documented OAuth endpoint contract;
  hand-rolling authorization-code and token security is not an acceptable
  rollback.
- **Section 8 answer / approval:** the owner approved `django-oauth-toolkit`
  including its database tables in #1206 on 2026-10-03, specified
  pre-registered clients only, and directed this issue to add it with
  `uv add django-oauth-toolkit`.
- **Version:** locked by `uv add` to a release compatible with this project's
  Django and Python versions; verify the resolved version in `backend/uv.lock`.

## Official Model Context Protocol Python SDK (`mcp`) (#1205)

The owner approved the official `mcp` Python SDK in issue #1205 for the
public MCP endpoint mounted inside Django's ASGI application. Runtime MCP
requests are handled by this application; the SDK sends no data to an
external service. The intended transport is Streamable HTTP in stateless
JSON-response mode for Replit autoscale compatibility.

- **What breaks if the package is abandoned or changes incompatibly:** MCP
  initialization, tool discovery, and tool calls become unavailable until
  the integration is updated.
- **Self-hosting/rollback alternative:** replace the transport adapter with
  another implementation of the open MCP Streamable HTTP protocol while
  retaining the same service-layer tool functions; REST endpoints remain
  available independently.
- **Section 8 answer / approval:** approved by the owner in #1205; the SDK
  does not transmit runtime data to its publisher or another third party.
- **Version:** declared as `mcp>=2.3.0,<3` and locked at `mcp==2.3.0` in
  `backend/uv.lock`. PR #1311 migrates the integration to `MCPServer` and
  `ToolError`; expected tool failures retain the established
  `Error executing tool <name>: <message>` result with `is_error=true`.
  Streamable HTTP remains stateless and uses JSON responses.

## Self-hosted presentation fonts (#643)

The frontend serves these font files from its own origin; no runtime font CDN
or external font service is used:

- `frontend/public/assets/fonts/pinyon-script-latin.woff2` — Pinyon Script,
  Sorkin Type Co; SIL Open Font License 1.1.
- `frontend/public/assets/fonts/lora-normal-latin.woff2` — Lora,
  Cyreal; SIL Open Font License 1.1.
- `frontend/public/assets/fonts/lora-italic-latin.woff2` — Lora,
  Cyreal; SIL Open Font License 1.1.

These files are the self-hosted assets already used by the authoritative
`augment-humankind-react-node` reference. The font files are bundled with the
application and are not sent to a third-party service at runtime. The SIL OFL
1.1 license permits embedding and redistribution with the application; the
font files retain their original family names and are not sold separately.

## `@radix-ui/react-alert-dialog` (#1006 pilot)

Added 2026-09-28 as an owner-authorized pilot for replacing the native
`window.confirm()` dialog (see `docs/conventions/design-ux.md`'s "Heuristics
#5/#6" and "mixed-system option" sections). It is a client-side, unstyled
interaction-behavior library bundled into the frontend build — it sends no
data to any external service at runtime, so the AGENTS.md §8 question ("what
breaks if the service changes/shuts down") reduces to ordinary
package-maintenance risk, not a live-service dependency:

- **What breaks if abandoned or a breaking release lands:** only the one
  confirm-replacement dialog component; no other surface depends on it yet
  (this pilot is deliberately scoped to that single pattern, not `useMenuButton`
  or `useRovingRadioGroup`).
- **Self-hosting/rollback alternative:** fork/vendor the small primitive's
  source directly, or revert to the existing hand-rolled `useAlertDialogFocus`
  hook, which remains in the codebase and is not being removed by this pilot.
- **Scope:** evaluated and approved per-pattern, not as a general component-
  library adoption. Adopting Radix UI (or React Aria) for the other two
  hand-rolled patterns is a separate future decision.
