---
name: replit-schema-diff-gap-for-new-tables
description: CONFIRMED — Replit Publish's dev/production schema-diff step skipped the brand-new Project3D/SceneVersion3D tables (with FKs). Production's scenes_project3d/scenes_sceneversion3d tables never existed; django_migrations shows those migrations were never applied there at all. Fix is a Republish through Replit's own UI, not a direct migration.
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

**Confirmed (2026-08-29), after issue #240's logging fix went live:**
the real traceback appeared in Replit's logs —
`psycopg.errors.UndefinedTable: relation "scenes_project3d" does not
exist` on `INSERT INTO "scenes_project3d" ...`. Directly inspected the
production database via Replit's own Database panel (accessible
through the Replit workspace UI at `replit.com/@<owner>/<project>`,
navigable via Claude in Chrome when the user's Chrome session is signed
into Replit): `scenes_project3d`/`scenes_sceneversion3d` are entirely
absent from the production table list, while every other `scenes_*`
table is present. `django_migrations` shows only 50 applied rows in
production, consistent with `scenes/migrations/0018_project3d_sceneversion3d_project3d_current_version_and_more.py`
and `0019_sceneversion3d_ai_request_id_and_more.py` (both added within
the day before this incident, as part of the 3D editor epic) never
having been applied there at all — not a ledger/table mismatch,
genuinely never applied. This was plausibly the first Replit Publish
since those two migrations existed, and Replit's schema-diff-and-apply
step did not pick up these **brand-new tables with foreign keys** (as
opposed to a simple column addition to an existing table).

**Remediation, per `.agents/memory/replit-production-schema-publishing.md`:**
do not run migrations directly against production. The fix is for the
repository owner to trigger a fresh Republish through Replit's own UI
and confirm the schema diff it presents this time includes
`scenes_project3d`/`scenes_sceneversion3d`.

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
