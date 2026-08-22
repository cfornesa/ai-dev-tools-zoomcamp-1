---
name: Browser-facing CSRF origin
description: CSRF behavior when Vite proxies browser forms to Django.
---

The origin that Django must trust for browser form submissions is the
browser-facing Vite server origin, while the backend itself listens on a
separate internal port.

**Why:** A real browser login through Vite sends its `Origin` header for the
Vite port. Trusting only Django's backend port makes the same form fail with a
CSRF origin error even though the proxy and session cookie are otherwise
working.

**How to apply:** Keep local Vite origins in debug-only CSRF defaults and test
the actual browser-facing URL, while production should use its explicit HTTPS
origins.