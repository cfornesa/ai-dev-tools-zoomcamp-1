---
name: manual-admin-qa-fixture-gotchas
description: Running reconcile_admin_identities revokes the e2e_admin fixture's grant, and re-running e2e_fixtures create invalidates any existing browser session.
metadata:
  type: project
---

When doing manual (non-Playwright) live-browser QA against a local dev stack
using the `e2e_admin` fixture user (`manage.py e2e_fixtures create`), two
non-obvious interactions cost a QA pass real time on 2026-09-17:

1. `manage.py reconcile_admin_identities` grants/revokes `ApplicationAdmin`
   strictly from `ADMIN_IDENTITIES` in `backend/.env`. `e2e_admin` is a
   fixture-only user and is never listed there, so running that command
   after `e2e_fixtures create` silently revokes the admin grant
   `e2e_fixtures create` itself set up (`ApplicationAdmin.objects.get_or_create`).
   Re-run `e2e_fixtures create` again to restore it — it is idempotent and
   safe to call more than once.
2. `e2e_fixtures create` calls `user.set_password(...)` on every run, which
   changes Django's session auth hash and invalidates any already-logged-in
   session for that user, including one currently open in a QA browser tab.
   Re-running the fixture command mid-session silently logs the QA browser
   out; expect to sign back in through `/accounts/login/` afterward rather
   than assuming a stale "logged out" screenshot means a real regression.

**Why:** discovered mid-QA-pass while manually verifying #591-#594 in the
built-in browser — an unrelated `reconcile_admin_identities` call (run for
unrelated verification) revoked the fixture's admin grant, and a second
`e2e_fixtures create` call to restore it then logged the browser out.

**How to apply:** when a manual QA session needs the `e2e_admin` fixture's
admin grant restored mid-session, expect a forced re-login immediately after;
don't run `reconcile_admin_identities` against a database also being used for
`e2e_admin`-based manual QA unless prepared to re-run `e2e_fixtures create`
afterward. Always run `e2e_fixtures cleanup` at the end of a manual QA pass
to remove fixture users/data, matching Playwright's own teardown convention.
