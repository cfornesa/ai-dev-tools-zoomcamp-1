---
name: production share-metadata backend forwarding
description: Keep Vite's server-side production share-metadata requests compatible with Django's HTTPS redirect policy.
---

When production Django has `DJANGO_DEBUG=false` and `SECURE_SSL_REDIRECT=true`,
Vite's server-side requests to the local HTTP backend must include
`X-Forwarded-Proto: https` (and the configured public host where required).
Otherwise Django returns a 301 to HTTPS on the plain HTTP backend port; following
that redirect produces `ERR_SSL_PACKET_LENGTH_TOO_LONG`, causing
`/__share-metadata-status` to report `backend_reachable:false`. In production
preview, keep the backend target explicitly on `http://127.0.0.1:8000`, preserve
the QA override only for development, and verify the deployed fix with
`scripts/smoke-published.sh` after Replit Publish. A successful workspace check
is not production evidence.
