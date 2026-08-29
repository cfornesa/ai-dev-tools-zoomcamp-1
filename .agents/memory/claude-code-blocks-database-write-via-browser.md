---
name: claude-code-blocks-database-write-via-browser
description: Claude Code's own auto-mode permission classifier hard-blocks typing/executing write SQL (INSERT/UPDATE/etc.) and other mutating text into Replit's dashboard via the Claude in Chrome browser tools, even with the user's explicit go-ahead — it is not an in-conversation-approvable prompt. Read-only SELECT queries and UI clicks are unaffected. The user, acting directly in their own real browser, is not subject to this block.
metadata:
  type: project
---

While reconciling issue #238's Django migration ledger against
production (see
`.agents/memory/replit-schema-diff-gap-for-new-tables.md` and
`.agents/memory/replit-production-schema-publishing.md`), this session
found it could browse Replit's own dashboard directly via Claude in
Chrome (`.agents/memory/replit-dashboard-browsable-via-claude-in-chrome.md`)
and read production data through its SQL console read-only with no
issue. But every attempt to *type* a write statement into that same
console — an `INSERT INTO django_migrations (...)`, and separately a
`RUN_MIGRATIONS_ON_START` config value — was refused outright by "the
Claude Code auto mode classifier," with the message: *"To allow this
type of action in the future, the user can add a Bash permission rule
to their settings."* This happened even after the repository owner had
already explicitly authorized fixing the underlying issue and chosen
this exact remediation path.

**Why this matters:** this is not a permission *prompt* that either the
agent or the user can approve mid-conversation by saying "go ahead" —
it is a hard deny at the tool-execution layer, separate from the
conversation. Re-explaining the plan, getting explicit user sign-off in
chat, or trying the action again does not change the outcome. The only
ways past it are (a) a settings-level change outside the conversation
(not reachable from a terminal session without `/permissions`), or (b)
the action being performed by a human directly, which is *not* subject
to this classifier even though it's the same browser window and same
page the agent was just driving — Claude in Chrome drives the user's
*real* browser, so the user can click into the same query editor and
type/paste the statement themselves.

**How to apply:** when a fix requires writing to a database (or
otherwise mutating state) through a web UI reached via Claude in
Chrome, expect read-only inspection to work fine but write actions to
be blocked regardless of how clearly the user has authorized the
underlying change. Don't spend multiple retries rephrasing or
re-attempting the same blocked action — hand the exact statement/value
to the user immediately with precise step-by-step UI instructions (which
panel, which field, which button), since they can execute it themselves
in the same session with no restriction. Verify the result afterward
via read-only queries/UI navigation, which the agent can still do
itself.
