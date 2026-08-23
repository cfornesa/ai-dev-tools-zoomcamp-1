---
name: Playwright runtime prerequisites
description: Local browser execution needs system libraries and the project fixture environment.
---

Browser-level E2E runs require both the configured app services and a Chromium runtime with its
system shared libraries available; test discovery and static checks can still run without them.

**Why:** The repository's Playwright setup intentionally self-skips when fixture setup is absent,
while the browser launcher fails separately when the host lacks Chromium libraries.

**How to apply:** Treat discovery, typecheck, lint, and build as the offline validation baseline;
run the full browser suite in an environment provisioned with Chromium dependencies and `.env`.

**Local base URL:** `playwright.config.ts`'s default `baseURL`/global-setup health probe is
`http://localhost:5173`, but `frontend/vite.config.ts` fixes the real dev server at port `5000`
(see AGENTS.md). Running against a locally started `npm run dev` needs
`E2E_BASE_URL=http://localhost:5000` explicitly, or `global-setup.ts`'s health probe fails and
every spec self-skips with an "not reachable" message that looks like a missing prerequisite
rather than a port mismatch.

**Collapsed-by-default editor sections:** issue #95 made every editor `CollapsibleSection`
(Tools/Inspector panels — "Add & edit shapes", "Scene outline", etc.) default closed. Most
existing specs under `frontend/e2e/` were never updated for this and now time out waiting for
elements inside a collapsed section (tracked in issue #113/backlog task 83). A new scenario that
needs one must expand it first — `page.getByRole('button', { name: /^▸ <heading>$/ }).click()`, but
only after the region has actually rendered (`await toggle.waitFor({ state: 'visible' })` —
`createBlankProjectViaUI`'s `waitForURL` alone is not enough, the panel is still fetching).

**`e2e_fixtures cleanup` is currently broken:** `Project.current_version` is `on_delete=PROTECT`
against `SceneVersion`, so deleting fixture users' `ProtectedError`s instead of cascading cleanly —
every local `make e2e` run currently leaves orphaned `e2e_owner`/`e2e_other` rows behind (tracked
in issue #114/backlog task 84). Not a correctness issue for the app itself, just local-DB cruft;
don't assume a clean database between manual e2e runs on the same local Postgres instance.