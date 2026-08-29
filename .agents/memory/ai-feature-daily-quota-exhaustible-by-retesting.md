---
name: ai-feature-daily-quota-exhaustible-by-retesting
description: Live-retesting an AI-backed feature (e.g. art-piece generation) repeatedly against production can itself exhaust the account's daily generation quota, blocking further verification independent of whether the underlying fix has been deployed.
metadata:
  type: project
---

While repeatedly live-retesting issue #236's A-Frame fix against
`https://animate.creatrweb.com/art-pieces` (re-checking after each of
several automated stop-hook notifications reporting the Replit
deployment still wasn't synced with the latest fix commit), each check
generated a new art piece to inspect its `srcdoc`. After roughly 20
such generations in one session, the account hit: "The daily limit of
20 generated art pieces has been reached for this account. Try again
tomorrow (UTC)." — the app's own per-account rate limit on AI
generation endpoints.

**Why this matters:** this quota is shared with the actual user and
resets only at UTC midnight. Once exhausted, no further live
verification of *any* AI generation feature (not just A-Frame) is
possible for the rest of the day, even after a fix is correctly
published — the retest itself becomes the blocker, independent of
deployment sync status.

**How to apply:** when repeatedly polling a live production check that
calls a rate-limited AI endpoint (art-piece generation, scene AI
create/edit, etc.), do not re-run the full generate-and-inspect cycle
on every notification/poll tick, especially when the check has already
established the same negative result multiple times in a row (e.g.
"deployment still not synced" from inspecting the CSP/version string).
Prefer: (a) checking a cheaper signal first if one exists (e.g. a
static asset hash, a `/health/`-style version endpoint, or reusing the
DOM state from a still-open tab rather than triggering a fresh
generation) before spending a quota-consuming call, and (b) spacing
consecutive live-generation checks out significantly (many minutes to
tens of minutes apart) rather than on every poll tick, so a long
back-and-forth loop doesn't silently consume the account's entire daily
budget before the actual fix has even been deployed.
