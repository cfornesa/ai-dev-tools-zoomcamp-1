# Issue #727 — Production schema-diff outage

Status: `RESOLVED / READY TO CLOSE`

## Evidence (2026-09-22)

- Replit workspace `main` and `origin/main` both resolved to `370c9d1c...`; no revision drift was found.
- A non-destructive Replit Republish completed as release `fc631d4e`, but the endpoints remained broken before and after it:
  - `GET https://augmentrart.com/api/site-theme/` → HTTP 500
  - `GET https://augmentrart.com/api/public/gallery/` → HTTP 500
  - `GET https://augmentrart.com/health/` → HTTP 200, database/cache `ok`
- Read-only Production Database `information_schema` inspection found:
  - `scenes_publicprofile` is missing `palette_key`, `palette_overrides`, and `presentation_overrides` from migration 0086.
  - `scenes_sitesettings` is missing the same 0086 columns.
  - `scenes_themegenerationattempt` from migration 0088 is absent.
  - The 0087 `ProfileStyle` seed is present: 7 rows (`default`, `ocean`, `forest`, `sunset`, `bauhaus`, `minimal`, `celestial`).
- `PUBLISHED_APP_URL=https://augmentrart.com scripts/smoke-published.sh` reached `/health/` but failed the already-tracked share-metadata backend-reachability diagnostic because the theme/gallery endpoints remain unavailable.

## Classification and boundary

Root cause is a missed Replit production schema-diff for 0086/0088, not revision drift, connectivity, or missing 0087 seed data. This matches the documented Replit schema-diff failure pattern in `.agents/memory/replit-final-schema-publish-verification.md` and `.agents/memory/replit-migrations-ledger-not-updated-by-publish.md`.

No direct production SQL was executed, Database editing was not enabled, no destructive conflict resolution was selected, and `.replit` deployment settings were not changed. The supported next action is a Replit schema-diff repair; after it, recheck the exact `information_schema` invariants, both endpoints, and the published smoke script.

Incident evidence was posted to [GitHub issue #727](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/727).

## Resolution (2026-09-22)

- Added database-level defaults for the six non-null shared palette/presentation fields in commit `cb80b47` and pushed it to `origin/main`.
- Replit Development migrations through `0089_database_defaults_for_shared_palettes` applied successfully.
- Replit's non-destructive schema diff for release `14278c04` contained the expected `CREATE TABLE scenes_themegenerationattempt` and six `ADD COLUMN ... DEFAULT` operations; it contained no truncate, drop, or delete-all-data operation.
- Read-only Production Database verification confirmed `scenes_themegenerationattempt` and all six `palette_key`, `palette_overrides`, and `presentation_overrides` columns on `scenes_publicprofile` and `scenes_sitesettings`.
- `GET https://augmentrart.com/api/site-theme/`, `GET https://augmentrart.com/api/public/gallery/`, and `GET https://augmentrart.com/health/` all returned HTTP 200; the health response reported database/cache `ok`.
- Active Chrome verification passed after retrying the stale error state: `/gallery?type=all` rendered the Public gallery with eight cards and the end-of-gallery marker.
- `PUBLISHED_APP_URL=https://augmentrart.com scripts/smoke-published.sh` passed the health check but still reports the already-tracked share-metadata backend-reachability diagnostic (`TypeError: fetch failed`). That diagnostic is outside this outage's theme/gallery acceptance criteria and remains explicitly unresolved rather than being attributed to the schema repair.

Root cause was the documented missed Replit production schema-diff, compounded by Django application defaults not being sufficient for Replit's production `ADD COLUMN ... NOT NULL` planning. No direct production SQL, destructive conflict resolution, deployment-build change, or startup migration was used.
