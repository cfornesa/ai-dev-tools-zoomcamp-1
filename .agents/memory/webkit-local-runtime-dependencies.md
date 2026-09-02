---
name: WebKit local runtime dependencies
description: Local Playwright WebKit launches can fail when generic Nix libraries do not match the browser build's ABI requirements.
---

Playwright WebKit's downloaded browser can remain unlaunchable on the Replit Nix runtime even after installing similarly named libraries: the browser may require exact Ubuntu ABI versions such as ICU 74, atomic, Opus, and GStreamer codec packages.

**Why:** A local Firefox/Chromium pass does not prove WebKit can launch, and generic Nix packages may expose newer or differently named shared libraries than the WebKit build expects.

**How to apply:** Keep Firefox/WebKit projects enabled and use CI's `npx playwright install --with-deps chromium firefox webkit` on a supported Linux runner as the authoritative cross-browser gate. Treat local WebKit launch failures as host setup failures unless the test itself reports an assertion failure.