# Replit republish and production evidence gate

## Status

`OPEN FOLLOW-UP` — publish/schema evidence captured; production owner import is dependency-blocked by #633.

## Goal

Republish the reviewed `main` revision only after the current browser gate is resolved, then verify that the deployed Replit artifact, schema, routes, imported `@cfornesa` pieces, embeds, downloads, and immersive surfaces match the accepted repository revision.

## Entry point

Replit Publish for the reviewed `main` revision, followed immediately by `scripts/smoke-published.sh` and direct inspection of the actual production tables/routes.

## Acceptance criteria

- [x] #621 is closed before the production publish.
- [x] Development and production Replit environments remained isolated; no local or disposable database URL was reused.
- [x] Publish completes for the reviewed revision; Replit's deployment log reached `Deployment successful` for the pulled `main` revision (latest reviewed repository commit `af24cf8`, with the current CI commits in its history).
- [x] `PUBLISHED_APP_URL=https://augmentrart.com scripts/smoke-published.sh` passes immediately after publish: `/health/`, `/`, anonymous `/api/whoami/`, and `/accounts/login/` all passed.
- [x] Direct production inspection confirms the actual pieces/collections schema tables and required columns exist; the approved Replit SQL surface returned 50 expected columns across `scenes_artpiece`, `scenes_artpieceversion`, `scenes_artpiecethumbnail`, `scenes_collection`, and `scenes_collectionitem`. `django_migrations` was not used as the success signal.
- [ ] Authenticated verification for `@cfornesa` confirms imported pieces render through regular, immersive, embed, editor-owner, and download paths, with edit controls visible only to the author. Production inspection found the existing owner (`auth_user.id=2`, username `christopher1`, email `cfornesa@outlook.com`) has `0` non-deleted art pieces and `0` collections.
- [ ] Anonymous verification confirms public cards use canonical regular links and real thumbnails, immersive routes are full-screen, and non-owner visitors cannot access editor controls.
- [x] Publish, smoke, and production-schema evidence is attached to this GitHub issue and the readiness ledger; the remaining import/surface evidence is linked to #633.

## Verification

- `make compose-preflight`
- `PUBLISHED_APP_URL=<published-url> scripts/smoke-published.sh`
- direct `information_schema.tables`/column inspection against the Replit production database through the approved Replit database surface
- authenticated browser checks for the `@cfornesa` fixture after publish

## Out of scope

- Writing to shared, development, or production databases before the publish gate is approved.
- Treating a Replit git checkpoint or `django_migrations` row as proof that the deployed schema is present.
- Reopening closed #445, #467, #597, or #613.

## Evidence boundary

The publish, anonymous smoke, and direct production-schema portions are verified. The imported-piece and authenticated surface criteria remain open because the disposable-only importer refuses production. #633 owns the production-safe, owner-scoped import workflow; after it is QA-verified, rerun the authenticated/anonymous surface matrix here.

## Routing hint

Production-readiness/release verification: complex deployment and schema boundary. Require owner-authorized production action, direct evidence, and QA/reconciliation before closure.
