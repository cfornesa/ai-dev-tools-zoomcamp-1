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
