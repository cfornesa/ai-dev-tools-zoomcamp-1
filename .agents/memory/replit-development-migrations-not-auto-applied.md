---
name: replit-development-migrations-not-auto-applied
description: CONFIRMED (#589, 2026-09-17) — Replit's Development database itself can fall behind on migrations, not just Production; the schema-diff between two equally-stale environments then finds nothing to propagate.
metadata:
  type: project
---

Every prior incident in [[replit-migrations-ledger-not-updated-by-publish]] and
[[replit-schema-diff-gap-for-new-tables]] assumed the Development database was
already correctly migrated and the gap was purely in *Production* — Replit's
Publish schema-diff comparing Dev vs Prod and failing to apply some or all of
the difference. Issue #503's own write-up states this explicitly: "The
migration was applied in development... but never replayed against
production."

**#589 (2026-09-17) found the opposite failure mode**: direct read-only
inspection of *both* databases via the Replit Database panel showed
`scenes_project`/`scenes_project3d` missing `seo_config` in **Development
too**, not only Production. Development's `django_migrations` table (browsed
via `My Data` → search `django_migrations` → sort/scroll by `id`) stops at
`0077_non_destructive...` — `0078_project_content_seo_config` (in source
since commit `735e52a`) was never applied to Development at all. Two separate
Replit Republish events (roughly 11 hours and then freshly during this
session) both successfully redeployed application code (confirmed: `/llms.txt`
started serving correctly in production after the second one — the #590 fix
reached production) but neither touched the database schema, because Replit's
Publish schema-diff mechanism only ever compares Development against
Production — when both are equally behind, the diff is empty and there is
nothing to apply, no matter how many times Publish runs.

**Why this matters:** every previous remediation in this repo's memory
(retry the Publish, `manage.py migrate --fake`, a scoped direct-migration via
Replit's Shell) implicitly assumes Development already has the target
migration and only Production needs to catch up. None of those fixes work
when Development itself is the one that's behind — Publish will keep finding
"no diff" indefinitely regardless of how many times it's retried.

**Root cause of *why* Development fell behind is not fully confirmed.**
`scripts/post-merge.sh` (wired via `.replit`'s `[postMerge]` block) runs
`uv run python manage.py migrate --noinput` unconditionally against whatever
`DATABASE_URL` is active in the workspace — in principle this should apply
every new migration automatically whenever Replit's own git-merge/pull event
fires in the workspace. Two explanations are consistent with the evidence and
were not fully distinguished this session (no access to the actual
post-merge run's logs):

1. The hook simply never fired for the commit containing `0078` (matching a
   separately confirmed finding the same session: Replit's own workspace
   `main` branch had gone 3+ hours without fetching from GitHub and had
   diverged with an unrelated, never-pushed empty "Published your App"
   commit — if the workspace's `main` only ever advances through Replit's own
   UI actions rather than a real `git merge`/pull event, the post-merge hook
   may not be the trigger that actually applies new commits' migrations).
2. The hook fired but `manage.py migrate` itself errored specifically on
   `0078` (an exception swallowed or not surfaced anywhere this session could
   read), leaving the ledger exactly at the last successfully-applied
   migration (`0077`) — indistinguishable from "never ran" without the actual
   run's stdout/stderr.

**How to apply:** when a Republish repeatedly fails to fix a schema/data gap
`#589`-style, check **Development's own schema and `django_migrations`
ledger first**, not just Production's — via the Database panel's `My Data` →
table search → `Browse structure` (schema) and sort-by-`id`-descending on
`django_migrations` (data), both read-only, no SQL console needed (the SQL
console's write-shaped keystrokes get hard-blocked by this session's own
classifier regardless of read/write intent — see
[[claude-code-blocks-database-write-via-browser]]). If Development is behind,
the fix is running `manage.py migrate` against **Development** (safe, the
explicitly permitted target per [[replit-production-schema-publishing]] —
only direct Production migration is restricted), which needs either Replit's
own Shell (not available to a browser-only session) or the repository owner,
before a subsequent Republish has any chance of propagating the change to
Production. If Development's schema-diff-able changes (new tables/columns)
still don't propagate to Production after that, fall back to the
already-established owner-supervised pattern from #238/#503/#531: a scoped,
explicit migration or idempotent data script run directly against
Production's `DATABASE_URL` via Replit's Shell, never a blanket
`manage.py migrate` there.

**#597 follow-up (2026-09-17):** Replit Shell now reports Development's
`scenes` ledger fully applied through `0078_project_content_seo_config`.
Searching Replit Production Logs for `0078` surfaced runtime error output but
did not establish whether the historical `postMerge` hook fired for the
commit or whether its `manage.py migrate` command failed. Keep that historical
cause unresolved until the owner correlates the hook/run logs; current ledger
parity is not evidence about the original trigger failure.
