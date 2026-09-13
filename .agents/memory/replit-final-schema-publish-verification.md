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
