---
name: E2E wrong Docker project
description: A healthy Docker stack on the expected port may still be an unrelated Compose project and must be validated through the app health/API probes before browser QA.
metadata:
  type: project
---

The local Docker daemon can have a different Compose project serving the expected
frontend port while its backend paths return the frontend shell. During the 2026-08-26
backlog session, port 5173 served an unrelated `ai-dev-tools-zoomcamp` SPA: `/health/`
and `/api/whoami/` returned HTML rather than this repository's Django responses.

How to apply: before treating browser failures as product evidence, verify the exact
application origin with `GET /health/` and anonymous `GET /api/whoami/`, and confirm
the frontend port matches this repository's documented startup path (`make dev` uses
Vite on port 5000). A healthy container list alone is insufficient.
