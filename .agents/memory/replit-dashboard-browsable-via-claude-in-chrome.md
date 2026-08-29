---
name: replit-dashboard-browsable-via-claude-in-chrome
description: When the user's real Chrome session (via the Claude in Chrome tool) is already signed into Replit, an agent can navigate directly to replit.com/@<owner>/<project> and read the Logs tab and Database panel — actual deployment logs and live table/row-count inspection, not just the published app's own HTTP responses.
metadata:
  type: project
---

While investigating issue #238 (a production 500 on `POST
/api/projects3d/`), earlier assumptions in this session repeatedly
stated "no production database credentials or Replit deployment log
access is available to an agent session" and treated root-cause
confirmation as blocked on the repository owner manually copying log
screenshots. That was wrong for this project: the repository owner's
real Chrome browser (driven via the `mcp__claude-in-chrome__*` tools)
was already signed into their Replit account. Navigating directly to
`https://replit.com/@fornesus/creatrweb` (found via `https://replit.com/~`'s
"Recent projects" list) opened the actual Replit workspace, from which:

- The **Logs** tab (`Build` panel → wrench/tools icon → "Logs") shows
  the same live-tailing deployment log the owner was screenshotting,
  readable via `get_page_text` for the full text (much more efficient
  than parsing multiple screenshots) — including full Python
  tracebacks once the app's own logging actually emits them (see
  `.agents/memory/replit-schema-diff-gap-for-new-tables.md` for what
  this revealed).
- The **Database** panel (`Build` panel → database icon → "All
  Databases" → pick Development or Production) lists every table with
  live row counts, letting an agent directly confirm whether a
  specific table exists in production without needing SQL credentials
  or asking the owner to run a query.

**Why this matters:** this collapses "repository owner must manually
relay logs/schema state via screenshots" into something an agent can
verify directly and immediately, when Claude in Chrome is available
and already authenticated. It does **not** grant permission to take
irreversible actions there (Publish/Republish, schema changes, secret
edits) — those remain the user's own action per
[[stop-goal-loop-when-blocked-on-replit-publish]] — but read-only
investigation (Logs, Database inspection, Overview status) is safe and
valuable to do directly.

**How to apply:** before telling a user "I have no access to
production logs/database, please share a screenshot," check whether
Claude in Chrome is available and signed into Replit first — navigate
to `replit.com/~` to confirm project access, then
`replit.com/@<owner>/<project>` for the workspace, then the `Logs` or
`Database` icon in the tools sidebar. Only fall back to asking the user
for manual screenshots if this path is unavailable (e.g. Claude in
Chrome not connected, or the account not signed into Replit).
