---
name: production-data-action-gap-in-self-qa
description: A self-QA'd "terminal-ready locally" batch can pass local/CI checks and still fail its own acceptance criterion in production when the fix depends on existing data state or a one-time management command that was only run in dev, not on the live database.
metadata:
  type: feedback
---

Replit's Publish flow applies schema migrations (via schema-diff, per
[[replit-migrations-ledger-not-updated-by-publish]]) but never runs one-time
management commands or admin-only data actions. A code fix can be entirely
correct and pass every local/CI check while still doing nothing for real
users, because the acceptance criterion actually depends on a database row
(`SiteSettings.style`, imported `ArtPiece` rows, etc.) that only exists in
the developer's local/dev database.

**Why:** In the 2026-09-21 Codex batch (#703-#721), a self-QA pass (Codex
QA'd its own Codex-authored diffs, second opinion `not run`) marked #712
(unset site style → Celestial default) and #716 (reference-piece trusted
thumbnails) "TERMINAL-READY LOCAL" with passing pytest/Playwright evidence.
An independent Claude Sonnet 5 `qa-self-review` re-check on 2026-09-22 found
both issues' own stated acceptance criteria still failing live:
`GET /api/site-theme/` still returned `style_key: "default"` and
`GET /api/public/gallery/` still returned `thumbnail_is_fallback: true` for
every reference piece. The #716 ledger had actually already disclosed the
root cause in its own "Published boundary" note (the owner's production
session "reports no saved art pieces") but the transaction was still marked
terminal-ready rather than flagged as a real gap.

**How to apply:** For any issue whose acceptance criterion is a live API
response or rendered page (not just a passing test), `qa-self-review` must
make the actual production HTTP call or screenshot, not accept the ledger's
account of local test results. When the root cause turns out to be
"correct code, missing one-time production data action," don't reopen the
child issue or re-run engineering — the code doesn't need to change. File a
narrowly scoped production-data follow-up issue instead (see #722, #723),
and if the root cause is ambiguous between "row never existed" and
"row was already explicitly set to something else" without
owner-authenticated access, say so explicitly rather than guessing — do not
attempt production admin actions without the owner's login.
