---
name: Local PostgreSQL browser verification
description: Use the configured local PostgreSQL server and an approved unsandboxed browser process when Docker or sandboxed Chromium cannot run.
---

On managed macOS, `make browser-qa` can be blocked by an unavailable Docker
daemon even when a reachable local PostgreSQL server is available. For a
non-production local database, start Django with `AI_PROVIDER=fake` and Vite
directly, apply migrations, and run the relevant Playwright command against
`E2E_BASE_URL`.

The restricted shell may launch Playwright's Chromium headless shell only to
fail at macOS Mach-port startup (`bootstrap_check_in ... Permission denied`).
Retry the identical browser command through the approved unsandboxed execution
path; this is an environment launch boundary, not application evidence.

For readiness, run the full Chromium suite in addition to the issue-targeted
spec. Preserve unrelated failures with their existing issue mapping rather
than attributing them to the current issue. The repository's global setup and
teardown own deterministic fixture creation and cleanup.

Confirmed 2026-09-12: the local PostgreSQL-backed #513 workflow passed
end-to-end; the full Chromium run produced 174 passes and four failures in
existing #429/#438/#479 boundaries.
