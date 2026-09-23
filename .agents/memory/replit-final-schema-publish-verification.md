---
name: Replit final schema publish verification
description: Verify a migration-bearing Replit publish through direct production invariants, not the Django migration ledger.
---

When Replit detects a potential conflict while publishing a migration-bearing
schema diff, review the generated operation and choose the non-destructive
constraint/schema option; never choose a delete-all-data alternative merely
to make the publish proceed. Stage nullable table/foreign-key creation and a
guarded data backfill before final NOT NULL, uniqueness, or trigger tightening
when legacy rows need linking.

After publish, leave the production database editor read-only and verify the
actual tables and relationships directly. `django_migrations` is not a valid
success signal because Replit's schema-diff mechanism can create production
tables and columns without writing that ledger. Also rerun
`scripts/smoke-published.sh` against the published URL and check authenticated
project/editor behavior separately.

Confirmed 2026-09-12: the staged repair and final publish preserved 14 legacy
scene-version rows and the direct production invariant query returned
7 projects, 7 scenes, 14 versions, zero missing links, and zero duplicate
scene sequences; published smoke and authenticated baseline checks passed.

Confirmed 2026-09-12 for the billing-pricing publish: after the owner-approved
Publish operation, direct `information_schema.columns` inspection showed
`scenes_plan.price` as `numeric(10,2)` plus `currency` and `billing_interval`,
and `scripts/smoke-published.sh` passed against the custom domain. The Publish
warning also reported truncation of `scenes_plan` and `scenes_sitesettings`;
that consequence must be surfaced explicitly when the owner approves the
operation, never hidden behind a generic “schema sync succeeded” statement.

Confirmed 2026-09-13: the same publish path can leave `scenes_plan` empty even
when its schema columns exist, because historical `RunPython` seed operations
are not replayed by Replit's schema sync. Verify the actual production plan
rows, not only columns or `/health/`; if the owner approves a narrowly scoped
backfill, include every non-null model field, verify the rows in the table UI,
and rerun the published smoke check afterward. Do not treat this as evidence
that arbitrary production data migrations should be run from the deployment
build or startup command.

Confirmed 2026-09-15 for #544: a successful local migration is not production
schema evidence. A migration-bearing Replit release still requires Publish,
`/health/`, direct inspection of the affected production table/column,
`scripts/smoke-published.sh`, and deployed-browser verification. Do not infer
production readiness from a clean local disposable PostgreSQL run, the Django
migration ledger, or a GitHub closure alone.

Post-publish verification on 2026-09-15 found a concrete failure after the
#544 republish: `/health/` and the anonymous published smoke passed, but direct
`information_schema.columns` inspection showed `scenes_sceneversion` while
`scenes_syncmutationreceipt` and `scenes_cloudbackupblobtransfer` were absent.
Treat the release as schema-unverified even when Replit reports “Published your
app” and “Database migrations validated successfully.” Do not compensate with
manual production SQL; inspect deployment logs and use the repository's
non-destructive Replit publish/retry path under #467.

The non-destructive retry was performed on 2026-09-15 and produced a second
successful “Published your app” event. The published smoke check passed again,
but the same read-only schema query still returned no
`scenes_syncmutationreceipt` or `scenes_cloudbackupblobtransfer` table. This
is not a transient publish lag; stop further retries and escalate with the
deployment release identity and the exact missing-table evidence.

Resolved 2026-09-15: the missing-table evidence was traced to revision drift,
not a production SQL defect. Replit's workspace was still on an older `main`
revision whose checkout stopped at migration `0062`; the local repository held
`0063`–`0065` but GitHub `main` had not yet received them. After owner approval
of the fast-forward, Replit's Git tab fetched and pulled the revision, the
Development Database migration ran successfully for all three migrations, and
the supported Republish flow produced release `f65b4223`. The required
production tables and `applied_scene_version_id` were verified directly through
`information_schema.columns`, and `scripts/smoke-published.sh` passed. The safe
recovery sequence is: synchronize the exact migration revision into Replit,
migrate Development only, Publish, smoke-test, and inspect actual Production
tables. Do not enable production startup migrations or repair this class of
drift with manual production SQL.

Confirmed 2026-09-22 for #727: after a current-revision publish left the
0086/0088 schema absent, adding Django `db_default` values for the six new
non-null palette/presentation fields produced a safe Replit schema diff. The
approved diff created `scenes_themegenerationattempt` and added the six
columns with database defaults, without a truncate/drop/delete-all-data
operation. Release `14278c04` restored the affected endpoints, and direct
read-only `information_schema.columns` inspection confirmed the table and
columns. Django model/application defaults alone are not sufficient evidence
that Replit can safely plan a production `ADD COLUMN ... NOT NULL`; review
the generated diff and add database defaults when that is the intended
compatibility behavior.
