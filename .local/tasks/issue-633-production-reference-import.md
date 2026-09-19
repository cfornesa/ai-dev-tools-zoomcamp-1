# Production-safe owner-scoped reference-piece import (#633)

## Status

`GROOMED → ENGINEERING/QA → DEPENDENCY-BLOCKED` — local implementation and QA evidence are ready; approved Replit publication is blocked by #634's unresolved Security Center findings.

## Transaction ledger

- **Issue:** #633
- **Entry point/fixture:** `import_reference_pieces` against the existing owner/profile represented by `@cfornesa`; six repository-defined sanitized fixtures.
- **Dependencies:** #622 release evidence gate; closed #612/#613/#614/#607/#608/#609/#610/#615/#616 contracts.
- **Stage owners:** scoping `Codex / GPT-5 / current session, substituted: no`; implementation `Ollama Cloud / kimi-k3 / not available, Codex/GPT-5 substitution: yes`; second opinion `not run`; QA pending `Claude / Sonnet 5 Medium, substitution pending`.
- **Evidence boundary:** local/disposable tests and dry-run are automation-verifiable; production import and deployed route evidence remain explicitly manual Replit acceptance.
- **Current next action:** resolve or disposition #634, publish this revision, then execute the production dry-run before any import.

## Goal

Provide an explicit, auditable workflow to import the six sanitized reference fixtures into the already-authenticated production owner represented by `@cfornesa`, without bypassing the application's persistence layer or weakening the existing disposable-database safety guard.

The current command `backend/scenes/management/commands/import_reference_pieces.py` is intentionally restricted to `DEBUG`/disposable databases. Production schema inspection confirms the required tables exist, but the production owner row (`auth_user.id=2`, username `christopher1`, email `cfornesa@outlook.com`) currently has zero non-deleted art pieces and zero collections.

## Entry point

One documented, non-interactive production workflow selected by the owner, with a dry-run/preflight step followed by an explicit import step. It must target the existing owner/profile identity and use the Django model/service layer.

## Acceptance criteria

- [ ] The workflow resolves `@cfornesa` to the existing production user/profile without creating a second account or changing the account's login identity.
- [ ] Production execution is impossible without an explicit, separately named production opt-in; ordinary development/test invocations remain blocked.
- [ ] A dry-run reports the target owner, six fixture identities, slug conflicts, expected row counts, and whether the operation is idempotent, without writing rows.
- [ ] The import creates or reconciles exactly six sanitized reference pieces (SVG, p5.js, C2.js, C2.js interactive, Three.js, and A-Frame), current versions, capability metadata, provenance markers, and thumbnails through application persistence services.
- [ ] Re-running the import does not duplicate pieces, versions, profiles, or collections; cleanup, if provided, can remove only rows carrying the dedicated provenance marker.
- [ ] User-customizable public slugs remain unique and resolve through regular `/users/@cfornesa/pieces/{name}`, immersive `/users/@cfornesa/immersive/{name}`, editor `/edit/{name}`, and embed routes after import.
- [ ] Tests cover the production opt-in guard, dry-run/no-write behavior, existing-owner resolution, idempotency, provenance-scoped cleanup, and slug conflict handling against a disposable PostgreSQL-compatible test setup.
- [ ] The workflow is documented with the exact commands and a rollback/verification checklist; no credentials or production connection strings are committed.
- [ ] After the approved production execution, direct table inspection and authenticated/anonymous browser evidence are attached to #622: six cards with thumbnails, regular/immersive/embed/download behavior, author-only edit controls, and full-screen immersive rendering.

## Verification

- **Production preflight:** `cd backend && uv run --env-file .env python manage.py import_reference_pieces import --handle cfornesa --username christopher1 --email cfornesa@outlook.com --allow-production --dry-run --json` (must report `no_write: true`; review before any import).
- **Production import:** run the same command without `--dry-run` only after the preflight output is accepted; this is the sole production data-writing step and remains an explicit Replit operation.
- **Production cleanup:** `... manage.py import_reference_pieces cleanup --handle cfornesa --username christopher1 --email cfornesa@outlook.com --allow-production --dry-run --json`, then remove `--dry-run` only for an owner-approved rollback of rows carrying the fixture provenance marker.
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
