# Replit republish and production evidence gate

## Status

`PROPOSED` — release evidence follow-up discovered during production-readiness reconciliation.

## Goal

Republish the reviewed `main` revision only after the current browser gate is resolved, then verify that the deployed Replit artifact, schema, routes, imported `@cfornesa` pieces, embeds, downloads, and immersive surfaces match the accepted repository revision.

## Entry point

Replit Publish for the reviewed `main` revision, followed immediately by `scripts/smoke-published.sh` and direct inspection of the actual production tables/routes.

## Acceptance criteria

- [ ] #621 is closed or explicitly accepted as a documented non-release blocker before publishing.
- [ ] Development and production Replit environments remain isolated; no local or disposable database URL is reused.
- [ ] Publish completes for the reviewed revision and the deployed asset/revision is recorded.
- [ ] `PUBLISHED_APP_URL=<published-url> scripts/smoke-published.sh` passes immediately after publish.
- [ ] Direct production inspection confirms the actual pieces/collections schema tables and required columns exist; `django_migrations` is not used as the sole success signal.
- [ ] Authenticated verification for `@cfornesa` confirms imported pieces render through regular, immersive, embed, editor-owner, and download paths, with edit controls visible only to the author.
- [ ] Anonymous verification confirms public cards use canonical regular links and real thumbnails, immersive routes are full-screen, and non-owner visitors cannot access editor controls.
- [ ] The evidence is attached to the GitHub issue and readiness ledger before recommending further publication.

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

The current checkout has local Docker and CI evidence, but no current-session Replit publication or direct production-table verification for the reviewed revision. This issue remains open until those external deployment facts are captured.

## Routing hint

Production-readiness/release verification: complex deployment and schema boundary. Require owner-authorized production action, direct evidence, and QA/reconciliation before closure.
