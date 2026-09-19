---
name: Replit development Shell versus production import
description: Replit's interactive workspace Shell uses the Development Database; published augmentrart.com reads the separate Production Database.
metadata:
  type: project
---

The Replit workspace Shell is attached to the development environment even when
the management command is invoked with an explicit production opt-in. A
successful `import_reference_pieces` run there proves only development rows.
For production fixture imports, execute the owner-scoped command from a
confirmed production runtime/database context, then verify the published API
and browser surfaces. The Replit Database panel can read production directly,
but the current production panel is read-only and #633 excludes direct SQL/UI
inserts; do not infer production state from Shell output.

Confirmed on 2026-09-19 during #633: the Shell contained six imported rows for
`christopher1/@cfornesa`, while `GET /api/users/@cfornesa/` on
`augmentrart.com` still returned only the two pre-existing pieces.

The approved production path is a temporary, gated invocation from
`scripts/start-production.sh`, enabled only for one publish through
`[userenv.production]`. Resolve the production profile by its handle and
production username; do not pass the development fixture email. After the
publish, verify the live profile contains the six reference engines and that
each detail and fallback-thumbnail endpoint returns successfully, then remove
the production trigger before the cleanup publish. The gate remains disabled
by default in the launcher so it cannot run during ordinary restarts.
