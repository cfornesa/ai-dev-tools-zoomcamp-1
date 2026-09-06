---
name: replit-migrations-ledger-not-updated-by-publish
description: CONFIRMED — Replit's Publish-time schema sync applies real DDL directly (new tables now exist) but never inserts rows into django_migrations. That table staying at an old migration is not evidence a publish failed; verify with /health/ and direct table/column checks instead.
metadata:
  type: project
---

On 2026-09-06, after PR #466 (issue #441, account sessions) merged and the
owner republished to Replit, `GET /health/` on the live app
(`https://animate.creatrweb.com/health/`) returned `{"status": "error",
"database": "ok", "cache": "unavailable"}` (HTTP 503). Replit's own runtime
logs (Deployments -> Logs, in the workspace UI) showed the real cause:
`psycopg2.errors.UndefinedTable: relation "django_cache" does not exist`.

Directly inspecting the production database via Replit's Database panel
(`My Data` tab, read-only SQL playground; navigable through Claude in Chrome
when the user's Chrome session is signed into Replit — see
[[replit-dashboard-browsable-via-claude-in-chrome]]) found:

- `django_cache` and `scenes_sessionmetadata` (this session's own new table,
  from migration `0034`) were both completely absent from the live schema.
- `select name, applied from django_migrations where app='scenes' order by
  applied desc` topped out at `0025_artpiece_artpieceversion...` — nine
  migrations (`0026` through `0034`), spanning several days of committed
  work, had never been applied to production at all. This was the first
  Publish attempted since `0026` was added (the prior successful publish was
  2026-09-04 09:28 UTC; migrations `0026`-`0034` were all committed
  2026-09-05), so this was a first-time failure, not a regression.

The owner republished a second time with no code changes in between. That
publish **fixed it**: `/health/` returned `{"status": "ok", "database": "ok",
"cache": "ok"}`, and both `django_cache` and `scenes_sessionmetadata` now
exist. But re-querying `django_migrations` afterward *still* showed `0025` as
the newest applied `scenes` migration — Replit's schema-diff/apply step
creates the actual tables/columns to match the code's current schema, but
does not go through Django's own `migrate` command and never writes to
`django_migrations` at all.

**Why this matters:** `django_migrations` is not a valid signal for whether a
Replit Publish's schema sync succeeded, in either direction — it will look
identically "behind" whether the sync worked or failed. The only reliable
signals are `/health/`'s actual `database`/`cache` round-trip checks (see
`backend/backend/views.py`'s `cache_is_available()`, which does a real
`cache.set`/`cache.get`) and direct `information_schema.tables` checks for
the specific new table(s) a migration introduces.

**Also confirmed:** unlike the assumption in
[[replit-schema-diff-gap-for-new-tables]] that a blind retry might not help
because "nothing changed," a second Publish with truly zero code changes
did resolve this one. Don't treat this class of failure as deterministic —
retrying is cheap and worth trying before escalating to Replit support, but
verify with `/health/` + direct table checks afterward rather than assuming
success from the checkpoint commit existing.

**How to apply:** after any Replit Publish that includes new migrations,
run (or manually reproduce) `scripts/smoke-published.sh`'s `/health/` probe
against the live URL before considering the publish complete — never infer
success from the "Published your App" git checkpoint commit or from
`django_migrations` row counts. If `/health/` reports an error, check
Replit's Deployments -> Logs for the real traceback and the Database panel's
table list directly, rather than guessing.
