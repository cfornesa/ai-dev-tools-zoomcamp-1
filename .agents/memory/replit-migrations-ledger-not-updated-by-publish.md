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

**2026-09-08 refinement — a pure-data migration in the same "fixed" batch
stayed silently broken:** `0031_seed_default_plans.py` (in the exact
`0026`-`0034` range this topic already documents as missing on 2026-09-06)
was still never applied, discovered when a production account's daily AI
art-generation quota resolved to 0 with no error anywhere — `Plan` rows
simply didn't exist, and `scenes.entitlements.get_effective_cap()` fails
closed to 0 by design for a missing plan, so there was no crash or 503 to
notice. Root cause, confirmed by reading the migration files directly:
`0031` is **pure `RunPython` with no accompanying schema change** — the
`Plan` *table* was created by a separate migration (`0030`, `CreateModel`).
Every other migration in the `0026`-`0034` range either creates a model or
runs `RunSQL` DDL, and all of those landed correctly (confirmed via direct
table inspection) once the 2026-09-06 second-republish "fix" ran. Only the
one migration with **zero structural diff for Replit's schema-diff to
detect** was skipped — silently, since a data-only migration produces no
symptom the standard `/health/` + table-existence check would catch.

Two earlier pure-data `RunPython` migrations (`0002`, `0005` — Postgres
trigger functions; `0010` — built-in template seeding) all applied
successfully in production, so this is **not** "data migrations never run
in production" as a blanket rule — those three predate the `0026`-`0034`
incident entirely and were seeded through whatever process was current at
that point in the project's history. The specific, narrower, and now
confirmed risk is: **within a migration range already found missing by the
`django_cache`-style symptom check, a pure-data migration with no schema
component can remain unapplied even after the schema portions are
confirmed fixed**, because nothing about checking `/health/` or the
tables that *did* throw errors would ever surface it.

**How to apply, updated:** when reconciling a previously-identified
"missing migrations" range (per this topic's original incident), don't
stop at confirming the tables that caused a visible error now exist —
walk every migration file in that exact numeric range and separately
confirm each one that is `RunPython`-only (no `CreateModel`/schema
operation) actually produced its expected data (row counts, specific
values), since Replit's schema-diff has no way to detect that this class
of migration needs re-running once the underlying tables already exist.
Fixed this occurrence via a direct, idempotent data-only command run
against production with `DATABASE_URL` borrowed for one shell command
(mirroring the migration's own `get_or_create` logic) — not a blanket
`manage.py migrate`, which risks erroring on DDL operations elsewhere in
the same unsynced `django_migrations` ledger.
