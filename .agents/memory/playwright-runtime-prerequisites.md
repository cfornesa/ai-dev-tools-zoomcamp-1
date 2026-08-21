---
name: Playwright runtime prerequisites
description: Local browser execution needs system libraries and the project fixture environment.
---

Browser-level E2E runs require both the configured app services and a Chromium runtime with its
system shared libraries available; test discovery and static checks can still run without them.

**Why:** The repository's Playwright setup intentionally self-skips when fixture setup is absent,
while the browser launcher fails separately when the host lacks Chromium libraries.

**How to apply:** Treat discovery, typecheck, lint, and build as the offline validation baseline;
run the full browser suite in an environment provisioned with Chromium dependencies and `.env`.