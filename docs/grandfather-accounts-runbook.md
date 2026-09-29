# Grandfathering active accounts: owner runbook (issue #946)

`backend/scenes/management/commands/grandfather_accounts.py` is a one-time,
owner-run command that grandfathers pre-existing production accounts under
the local-first/opt-in-sync model (owner decision #3, 2026-09-26): every
valid piece of every free account becomes public, and admin/paid accounts
get account-level cloud sync enabled.

**This command must never be run by an agent session.** It is written and
tested against disposable fixtures only; running `--apply` against
production is the owner's own action, in the production console, after
reviewing the dry run below. See
`.agents/memory/production-data-action-gap-in-self-qa.md`.

## Order of steps

1. **Read-only storage snapshot first.** `python manage.py
   report_storage_usage --format json` (issue #931) — a baseline of current
   per-piece storage, taken before anything changes.
2. **Dry run.** `python manage.py grandfather_accounts` (no flags — dry run
   is the default). This writes nothing and prints a JSON report: which
   pieces of which free accounts would publish, which are skipped and why,
   and which paid/admin accounts would get sync enabled.
3. **Owner review.** Read the dry-run report. Confirm the skipped-piece
   reasons are expected (placeholder titles, blank drafts, no saved
   version) and that the free/paid/admin account split looks right.
4. **Apply.** `python manage.py grandfather_accounts --apply --yes
   --rollback-file grandfather_rollback_<date>.json`. Requires
   `SiteSettings.cloud_sync_enabled` to already be true — the command
   refuses otherwise. `--yes` is a second, explicit confirmation on top of
   `--apply`, echoing back the exact counts from the dry-run plan.
5. **Verify the publish.**
   `PUBLISHED_APP_URL=<published-url> scripts/smoke-published.sh`, then
   directly inspect the actual production tables (Replit's Database panel,
   or a query against `information_schema.tables`/the relevant rows) per
   `.agents/memory/replit-migrations-ledger-not-updated-by-publish.md` — do
   not infer success from `/health/` or the ledger alone.
6. **Post-run checklist.** Open each newly public piece anonymously in a
   real browser. Browser-only media will not render on a piece grandfathered
   this way — the command never uploads media, only flips visibility/status
   for pieces already fully server-backed — this is expected, not a defect.

## Rollback

`python manage.py grandfather_accounts --rollback
grandfather_rollback_<date>.json` restores exactly the fields the apply run
recorded before it changed them — nothing else. A `CloudSyncPreference` row
that didn't exist before the apply run is deleted on rollback rather than
blanked, matching its actual prior (nonexistent) state.

## What this command never does

- Uploads or moves any browser-only local-first media.
- Changes plan definitions or any already-closed issue's contract.
- Writes anything when run without `--apply`.
- Forces a piece that fails its own existing publish validation — those are
  always skipped and listed with the specific reason.
