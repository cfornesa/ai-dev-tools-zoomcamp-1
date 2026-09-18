# Pieces and collections schema parity plan

This is the #611 audit and migration plan. It compares the current Django
schema with the read-only source schemas in:

- `../augment-humankind/migrations/2026-06-14-platform-assimilation.sql`
- `../augment-humankind-react-node/apps/api/migrations/postgres/0000-application-schema.sql`
- the local models and migrations in `backend/scenes/`

It does not authorize a production write or copy unrelated CMS tables.

## Existing local tables and current coverage

| Contract | Current Django representation | Existing coverage | Remaining decision/action |
|---|---|---|---|
| Piece identity/publication | `ArtPiece`: `public_id`, owner, title, description, prompt, engine, status, current version, soft delete, publication timestamps | `0025`, `0071`, `0077`; #578/#596 | Extend engine registry and canonical route contract in #600/#607; do not replace UUID identity |
| Immutable piece versions | `ArtPieceVersion`: piece FK, sequence, opaque source, capabilities, generation metadata, immutable save guard | `0025`; persistence tests | Add only approved source-provenance/import fields in #613; preserve immutable version semantics |
| Piece thumbnails | `ArtPieceThumbnail`: one-to-one version, PNG bytes, dimensions, fallback marker, timestamps | `0025`; thumbnail endpoints; #438 follow-up is #602 | Capture real artwork and expose stable public URL through #602/#613; fallback remains explicit |
| Owner collections | `Collection`: owner, title, description, SEO, slug, visibility, publication, soft delete, timestamps | `0069`, `0070`; #556/#567/#568 | Keep owner-scoped slug and privacy model; no unrelated platform collection table |
| Ordered collection membership | `CollectionItem`: collection FK, finite kind, UUID item id, position, uniqueness constraints | `0069`; #567/#566 | Preserve polymorphic discriminator; add migration map only if import requires it (#613/#612) |
| Piece slugs/history | `public_slug` on Project, Project3D, ArtPiece; owner-scoped unique constraints; no ArtPiece slug-history model | `0071`, `0077`, #578/#596 | Route/old-slug redirect policy is #600; a history table is only added by #613 if the approved policy needs it |
| Capability contract | Per-version JSON `capabilities` on ArtPieceVersion; engine choices are finite local enum | `0025`; #428 and runtime slices | Define six-engine/capability catalog before schema expansion in #607/#610 |
| Embed identity/public projection | Public UUID endpoints and generated regular/immersive/embed routes; no persisted embed-target row | `urls.py`, `art_piece_persistence.py`, #435/#446/#447 | Prefer derived, version-aware public projections; add a persisted target only if #611/#613 proves it is required |
| Import provenance | No local source-to-target migration map | None | Add an idempotent import mapping only in #613 if #612 requires it; never use title/slug alone as identity |

## Reference comparison

The PHP assimilation schema contains `art_pieces`, `art_piece_versions`,
`platform_collections`, `platform_collection_items`, and a
`platform_migration_map`. Its piece rows include source identity, owner,
thumbnail URL, current-version linkage, engine/status, and timestamps. Its
version rows include version number, multiple source-code representations,
generation metadata, validation state, and provider attribution.

The React/Node PostgreSQL schema additionally models native collections,
piece-version media references, categories/starter templates, platform
collections, and ordered collection items. Its public embed projection is
derived from the active version rather than exposing private source fields.

The Django application intentionally differs in three ways:

1. It stores opaque generated source in one bounded `source` field and validates
   it at the sandbox/runtime boundary; splitting source into PHP-era columns
   would create duplicate authorities.
2. It uses UUID public identities and owner-scoped slugs rather than exposing
   internal integer primary keys.
3. It stores thumbnail bytes with the immutable version and filters collection
   item visibility at read time; a public collection never grants access to a
   private/unpublished/deleted item.

These are deliberate translation choices, not missing parity by themselves.

## Approved migration shape to evaluate in #613

The default recommendation is an **additive bridge**:

1. Add nullable/defaulted fields or tables only after the route/capability
   contract is fixed; do not rename or drop existing public fields.
2. Backfill in a separate idempotent step keyed by stable UUID/source mapping,
   never by title alone. Keep legacy rows readable during the backfill.
3. Add indexes and uniqueness constraints only after collision reports are
   empty. Slug uniqueness remains owner-scoped unless #600 explicitly selects a
   different namespace.
4. Keep public embed data derived from the current published version. Do not
   store raw source, prompt, or owner controls in anonymous embed projections.
5. Tighten nullability only in a later migration after production row counts
   and backfill invariants are directly verified.

Alternative schema shapes were rejected for this plan: replacing the existing
tables would risk the deployed data contract, while a reference-only adapter
would not satisfy the requested persisted six-engine/capability/import
contract. #613 must still show the final migration diff and rollback plan
before applying this recommendation.

## Backfill and rollback sequence

| Phase | Operation | Required invariant | Rollback boundary |
|---|---|---|---|
| 0. Inventory | Count existing pieces, versions, thumbnails, collections, items, null slugs, and collisions | Counts and sample IDs are recorded without exposing secrets | No schema/data mutation |
| 1. Expand | Add nullable/defaulted schema state and indexes that do not reject existing rows | Existing API and tests continue to read old rows | Revert migration before backfill |
| 2. Backfill | Populate deterministic fields/mappings in bounded, repeatable batches | Re-running produces no duplicate mapping or version; collision report is empty | Delete only rows/values created by the mapping, using recorded IDs |
| 3. Validate | Run model/API/privacy/runtime checks against old and backfilled fixtures | Public projections exclude private source and select exactly one published version | Keep expanded schema; fix forward if validation fails |
| 4. Tighten | Add non-null/check/unique constraints only after direct row inspection | All rows satisfy the final contract | Roll back the tightening migration only; never destructive-reset shared DB |
| 5. Publish | Replit Publish schema diff plus direct table/column inspection and smoke | Actual target tables exist and public URLs render | Reject destructive publish options; restore from provider backup if needed |

The agent must not execute phases 1–5 against development or production as part
of #611. #613 owns repository migration/test execution; #612 owns sanitized
`@cfornesa` import and cross-surface rendering verification.

## Embeddability contract

- Regular and immersive embeds resolve a stable public piece identity and the
  current published version only.
- Anonymous responses may include title, owner display handle, engine label,
  thumbnail URL, capability-allowed controls, and public collection links.
- Anonymous responses never include prompt, raw source, draft/archived data,
  owner-only editor links, hidden collection metadata, or credentials.
- Embed routes remain chrome-less projections of the same regular/immersive
  runtime; they do not duplicate controls or create a second version source of
  truth.
- Sandbox/CSP/Permissions Policy remain the security boundary. A persisted
  embed flag cannot grant camera, microphone, network, or arbitrary code
  privileges by itself.
- Every embed projection names the source version/engine internally for
  diagnostics, while external payloads use the public identity and privacy
  contract.

## Verification owned by #611

The plan itself is verified with the repository/reference scan and
`git diff --check`. Migration execution, disposable PostgreSQL schema checks,
and `make check` for the resulting bridge are shifted to #613 so this issue
does not claim unexecuted irreversible work.
