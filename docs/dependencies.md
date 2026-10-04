# Dependency and asset licenses

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
- **Version:** locked at `mcp==1.30.0` with the compatible range `mcp<2`.
  The currently resolved 2.x major has renamed/removed
  `mcp.server.fastmcp.FastMCP`; the installed 1.30.0 API was inspected and
  confirmed to expose `FastMCP`, decorated `tool()`,
  `streamable_http_app()`, `stateless_http`, `json_response`, request-size
  limits, and transport-security settings as required by the owner decision.

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
