---
name: MCP ASGI local verification
description: MCP routes are mounted in Django's ASGI wrapper and are absent from the WSGI development server.
---

The MCP Streamable HTTP routes are dispatched by `backend/asgi.py` through
`create_mcp_asgi_app`. Django's `manage.py runserver` starts the WSGI
application, so `/mcp/` and `/mcp/apps/` fall through to Django's URL resolver
and return 404 even though ordinary health/API routes work. For local MCP
transport checks, start `backend.main:app` with Uvicorn, or set
`BACKEND_SERVE_MODE=asgi` for `scripts/start.sh`. Browser-based MCP hosts also
need their exact origin in `CSRF_TRUSTED_ORIGINS`; the anonymous apps endpoint
adds CORS only for those configured origins.
