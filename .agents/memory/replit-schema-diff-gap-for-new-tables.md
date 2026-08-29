---
name: replit-schema-diff-gap-for-new-tables
description: Suspected gap in Replit Publish's dev/production schema-diff step for brand-new tables with foreign keys — POST /api/projects3d/ returned 500 in production right after the first publish following the Project3D/SceneVersion3D migrations, while the identical code succeeded locally against a correctly-migrated PostgreSQL. Not yet confirmed, but reproducible and isolated.
metadata:
  type: project
---

Immediately after the repository owner republished to Replit following
#236/#237's resolution, live testing via Claude in Chrome found
`POST /api/projects3d/` returning a bare `500` for every attempt in
production, while the sibling `POST /api/projects/` (2D) and
`GET /api/templates/` both succeeded in the *same* authenticated
session at the *same* time. Reproducing the identical
`POST /api/projects3d/` call locally via Django's test `Client`
(`force_login`, `SERVER_NAME='localhost'`) against a real local
PostgreSQL database, on the exact same `main`-branch code, succeeded
(`201 Created`) — so the code itself is not the problem when the
database is correctly migrated. See
[#238](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/238)
for the full incident report.

**Leading hypothesis, not confirmed:** `scenes/migrations/0018_project3d_sceneversion3d_project3d_current_version_and_more.py`
and `0019_sceneversion3d_ai_request_id_and_more.py` were both added
within the day before this incident, as part of the 3D editor epic.
This was plausibly the first Replit Publish since those two migrations
existed. Per `AGENTS.md`'s "Deployment tracks and preflight" section,
Django migrations never run in the deployment build or startup —
Replit's Publish flow separately compares development and production
schemas and applies the diff. It's plausible that diff-and-apply step
did not correctly pick up **brand-new tables with foreign keys** (as
opposed to a simple column addition to an existing table), leaving
production's schema out of sync and causing every insert into the new
tables to fail. This session had no production database credentials or
Replit deployment log access to directly confirm the schema state or
read the real traceback (`DEBUG=False` in production suppresses it) —
this remains a hypothesis pending the repository owner's own
investigation via Replit's dashboard/logs.

**Why this matters even if the specific hypothesis turns out wrong:**
regardless of the exact mechanism, this incident demonstrates that
`make e2e`/`pytest` both being fully green locally is **not** sufficient
evidence that a freshly-migrated feature works in production —
neither suite exercises "does Publish's schema diff actually apply
migration X correctly," because neither suite runs against the
production database at all. See
[[ai-feature-daily-quota-exhaustible-by-retesting]] for a related
lesson about production-only behavior a local-only check suite cannot
catch, and [[replit-production-schema-publishing]] for the schema-diff
mechanism itself.

**How to apply:** after any Replit Publish that includes a migration
adding a genuinely new table (not just altering an existing one),
explicitly verify the corresponding create-endpoint works live in
production (via browser or an authenticated request) before considering
that feature launched — do not rely on local `make check`/`make e2e`
passing as sufficient evidence. If this pattern recurs on a future
migration, that would confirm the schema-diff-gap hypothesis and
justify escalating to Replit support or finding an explicit
post-publish schema-verification step to add to the release process.
