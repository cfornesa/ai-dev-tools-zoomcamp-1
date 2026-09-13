# #522 — Admin-configurable cloud-media retention policy

## Goal

Define and expose a bounded admin policy for remote copies of opted-in cloud
media, including quota/retention behavior after deletion or entitlement loss,
without restricting local-first work.

## Entry point / fixture

`backend/scenes/cloud_backup.py`, cloud-sync APIs, Plan quotas, admin console,
and the PostgreSQL media/blob model from #509. Fixture: opted-in owner with
remote copies, free/paid users, disabled sync, deleted local project, expired
entitlement, and provider failure.

## Acceptance criteria

- [x] Owner-approved policy names finite retention states and grace periods for
  active, deleted, cancelled/expired, and disabled-sync remote copies; no
  commercial default is invented in implementation.
- [x] Admins can view/change policy atomically with revision/audit metadata;
  non-admins cannot; invalid durations and destructive retroactive changes are
  rejected or require explicit confirmation.
- [x] A scheduled/manual purge is idempotent, bounded, observable, and never
  deletes local IndexedDB content, active local projects, billing/audit records,
  or another user's remote copy.
- [x] Quota and retention decisions are consistent across free/paid/higher
  plans and provider outages; local-first UI explains retained/deleted remote
  state truthfully.
- [x] PostgreSQL transaction/purge tests, admin/browser evidence at
  1280x900/375x812, and `make check` pass.

## Verification

Owner approved the existing application-owned PostgreSQL/blob lifecycle on
2026-09-13: active copies remain while active; deleted projects,
cancelled/expired entitlements, and disabled-sync copies receive a 30-day
grace period; retroactive destructive purge requires explicit confirmation.
Implemented with focused PostgreSQL transaction/purge tests and responsive
Chromium evidence.

## Out of scope

Core sync transport (#509), entitlement gate (#511), account-deletion policy
(#443), and local media retention.

## Routing / dependency

Stage 2b complex. Completed in the owner-directed Codex session; no new
vendor dependency was introduced.
