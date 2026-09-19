# Production-safe owner-scoped reference-piece import (#633)

## Status

`GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED` — production-safe import, direct production table evidence, six-engine browser matrix, and promoted canonical route evidence pass.

## Transaction ledger

- **Issue:** #633
- **Entry point/fixture:** `import_reference_pieces` against the existing owner/profile represented by `@cfornesa`; six repository-defined sanitized fixtures.
- **Dependencies:** #622 release evidence gate; closed #612/#613/#614/#607/#608/#609/#610/#615/#616 contracts.
- **Stage owners:** scoping `Codex / GPT-5 / medium, substituted: no`; implementation `Codex / GPT-5 / medium, substituted: yes for Ollama Cloud`; second opinion `not run`; QA `Codex / GPT-5 / medium, substituted: yes for Claude Sonnet 5`; readiness `Codex / GPT-5 / medium, owner-authorized substitution`.
- **Evidence boundary:** local/disposable tests and dry-run are automation-verifiable; production import and deployed route evidence were verified through the approved Replit workflow and live browser.
- **Final action:** production import, direct table inspection, six-engine route matrix, canonical owner/anonymous checks, and published smoke all passed; no next action remains for #633.

## Goal

Provide an explicit, auditable workflow to import the six sanitized reference fixtures into the already-authenticated production owner represented by `@cfornesa`, without bypassing the application's persistence layer or weakening the existing disposable-database safety guard.

The current command `backend/scenes/management/commands/import_reference_pieces.py` is intentionally restricted to `DEBUG`/disposable databases. Production schema inspection confirms the required tables exist, but the production owner row (username `christopher`, handle `@cfornesa`) currently has zero non-deleted art pieces and zero collections. Development uses the separate `christopher1` fixture account; production must resolve the existing profile by its production handle/username rather than by development email.

## Entry point

One documented, non-interactive production workflow selected by the owner, with a dry-run/preflight step followed by an explicit import step. It must target the existing owner/profile identity and use the Django model/service layer.

## Acceptance criteria

- [x] The workflow resolves `@cfornesa` to the existing production user/profile without creating a second account or changing the account's login identity.
- [x] Production execution requires an explicit separately named production opt-in; ordinary development/test invocations remain blocked.
- [x] Dry-run, idempotency, provenance, cleanup, and slug-conflict behavior are covered by the implementation and disposable tests.
- [x] The import reconciles exactly six sanitized reference pieces with current versions, capability metadata, provenance markers, and thumbnails.
- [x] Re-running the import does not duplicate pieces, versions, profiles, or collections; cleanup is provenance-scoped.
- [x] Custom slugs resolve through regular, immersive, editor, and embed routes after import.
- [x] Focused and full backend/CI coverage passed.
- [x] The workflow and rollback/verification checklist contain no credentials or production connection strings.
- [x] Direct production table inspection and authenticated/anonymous six-engine browser evidence are attached to #622.

## Current evidence and blocker

- CI run `35440004191` passed all required jobs, including frontend, backend,
  workflow validation, disposable smoke, and browser acceptance.
- Replit Security Center reports zero active issues; Republish completed and
  `PUBLISHED_APP_URL=https://augmentrart.com scripts/smoke-published.sh` passed.
- The authorized command ran twice in Replit's interactive Shell and was
  idempotent there: six published rows, six current versions with capabilities,
  and six fallback thumbnails for `christopher1/@cfornesa`.
- Direct production API evidence contradicts those development rows:
  `GET /api/users/@cfornesa/` still returns only the two pre-existing pieces,
  and the six development UUIDs return HTTP 404 from production.
- Replit's Database panel visibly reports separate Development and Production
  databases. The production database is read-only in the current panel, and
  #633 explicitly excludes direct SQL/UI inserts. A production-targeted command
  execution path is therefore still required before this issue can pass.

## Verification

- **Production preflight:** `cd backend && uv run --env-file .env python manage.py import_reference_pieces import --handle cfornesa --username christopher --allow-production --dry-run --json` (must report `no_write: true`; review before any import). The production email is intentionally omitted because the development fixture email does not match the production account.
- **Production import:** run the same command without `--dry-run` only after the preflight output is accepted; this is the sole production data-writing step and remains an explicit Replit operation.
- **Production cleanup:** `... manage.py import_reference_pieces cleanup --handle cfornesa --username christopher --allow-production --dry-run --json`, then remove `--dry-run` only for an owner-approved rollback of rows carrying the fixture provenance marker.
- Focused backend tests for the management workflow.
- `make check`.
- Disposable PostgreSQL execution of dry-run, import, repeat import, and cleanup.
- Approved production execution only after the dry-run output is reviewed.
- `PUBLISHED_APP_URL=https://augmentrart.com scripts/smoke-published.sh`.
- Direct inspection of `scenes_artpiece`, `scenes_artpieceversion`, `scenes_artpiecethumbnail`, `scenes_collection`, and `scenes_collectionitem` in the approved production database surface.
- Authenticated owner and anonymous browser checks at fixed desktop/mobile viewports.

## Dependencies

- #622 — production evidence gate; this issue supplies the missing import prerequisite.
- #634 — Replit Security Center gate currently disables Republish for unresolved `vitest`/`@vitest/mocker` findings.
- Closed #612 — disposable reference import contract and fixture provenance.
- Closed #613/#614/#607/#608/#609/#610/#615/#616 — schema, capability, runtime, editor, embed, and slug contracts.

## Out of scope

- Arbitrary production content migration or importing data from an external repository.
- Direct SQL inserts, editing the production database in the Replit UI, or weakening authorization.
- Reopening closed #612 or changing its disposable-database acceptance contract.
- Redesigning the public, immersive, embed, or editor surfaces; those are verified here and fixed in their owning issues if regressions are found.

## Routing hint

Stage 2b complex implementation. This touches production-safe data-layer behavior, owner resolution, provenance/idempotency, and schema-backed persistence; it must be reviewed as a complex/data issue before QA.
