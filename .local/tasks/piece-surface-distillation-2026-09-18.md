# Piece surface, route, parity, and import distillation — 2026-09-18

## Scope and evidence

This is a backlog-definition pass only. The owner supplied a live profile URL,
an immersive URL, and a screenshot. Browser inspection on 2026-09-18 confirmed:

- `/users/@cfornesa` exposes UUID-style piece links and cards with large empty
  image regions and inconsistent title/link placement.
- `/immersive/p3d/f3863d2f-d3a5-41ad-9883-7b8441af6217` eventually renders a
  bounded page-level stage, title, embed buttons, and controls; it does not
  present a true viewport-filling immersive surface.
- The local `ArtPiece` engine contract currently contains Canvas2D, SVG,
  Three.js, and A-Frame. p5.js, C2.js, and C2.js Interactive require an
  explicit schema/runtime decision before implementation.

Reference repositories are read-only sources: `../augment-humankind` and
`../augment-humankind-react-node`. No reference code is copied and no
reference repository is modified.

## Issue manifest and order

| Order | Issue | Scope | Routing | Dependencies | Status |
|---:|---|---|---|---|---|
| 1 | [#599](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/599) | Cross-repository contract inventory | stage 2b complex | none | PROPOSED |
| 2 | [#611](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/611) | Non-destructive schema parity and embeddability plan | stage 2b complex | #599 | PROPOSED |
| 3 | [#600](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/600) | Canonical user-customizable slug routes and redirects | stage 2b complex | #599, #611 | PROPOSED |
| 4 | [#602](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/602) | Shared card and thumbnail contract | stage 2b complex | #599, #600 | PROPOSED |
| 5 | [#601](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/601) | Owner-only `/edit/{name}` route | stage 2b complex | #600 | PROPOSED |
| 6 | [#603](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/603) | Public profile card consumer | stage 2a/2b conditional | #600, #602 | PROPOSED |
| 7 | [#604](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/604) | Public gallery card consumer | stage 2b complex | #564, #565, #600, #602 | PROPOSED |
| 8 | [#605](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/605) | Studio card consumer | stage 2a/2b conditional | #600, #601, #602 | PROPOSED |
| 9 | [#607](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/607) | Regular and regular-embed six-engine runtime | stage 2b complex | #599, #600, #611 | PROPOSED |
| 10 | [#606](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/606) | Canonical full-screen immersive route | stage 2b complex | #599, #600, #611 | PROPOSED |
| 11 | [#608](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/608) | Immersive six-engine runtime parity | stage 2b complex | #606, #607 | PROPOSED |
| 12 | [#609](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/609) | Offline regular and immersive downloads | stage 2b complex | #607, #608 | PROPOSED |
| 13 | [#610](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/610) | 2D/3D AI-editor engine integration | stage 2b complex | #599, #600, #611 | PROPOSED |
| 14 | [#613](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/613) | Apply approved pieces/collections schema bridge and embeddability migration | stage 2b complex | #599, #600, #601, #602, #607, #611 | DEPENDENCY-BLOCKED |
| 15 | [#612](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/612) | Import sanitized reference pieces into `@cfornesa` and verify all surfaces | stage 2b complex | #600, #602, #606–#611, #613 | DEPENDENCY-BLOCKED |

The next issue is exactly **#599**, the contract inventory. No engineering
should start until its matrix exists and each downstream issue has a checked
boundary.

## Duplicate and already-covered work

- Closed #556–#568 cover the first ordered-collection domain and public
  collection routes; they do not cover this request's six-engine piece parity,
  slugged piece route family, or import verification. Preserve their history.
- Closed #564–#566 cover gallery engine/mode/collection-context contracts;
  #604 consumes those contracts and adds the newly reported card/link defect.
- Closed #428–#438 cover the earlier generated-piece capability, owner,
  regular, immersive, embed, ZIP, and thumbnail slices. The current live report
  is follow-up evidence, so #602–#609 are new closure-sized corrections rather
  than reopenings.
- Closed #578 and #596 cover canonical public-slug foundations and a save race;
  #600 must extend them to the requested route family and redirects rather than
  duplicate their implementation.
- Existing cross-repository memory topics already cover generated/authored
  surface parity and Replit schema-publish verification; no new memory topic is
  required for this pass.

## Blockers and verification boundaries

- **Dependency-blocked:** #613 must wait for #599, #600, #601, #602, #607,
  and #611. #612 must wait for #600, #602, #606–#611, and #613. It must
  use sanitized, exportable fixtures and an idempotent cleanup path; it must
  not write to production merely because the owner is logged in there.
- **Irreversible decision:** #600 changes live URL structure and therefore
  requires a redirect/shim plan before implementation.
- **Irreversible decision:** #611 may propose migrations, but any production or
  shared-database write requires the migration diff, rollback plan, backup
  evidence, and direct table verification described in the repository memory.
- **Verification boundary:** physical camera/microphone/hand hardware and the
  exact published Replit revision cannot be claimed from local fake-device or
  disposable-stack evidence.
- **Verification boundary:** the web source URLs were inspected through the
  user's signed-in Chrome session; the web-search connector could not fetch the
  same pages. The browser observation is the authoritative live evidence for
  this manifest.

- **Scope reconciliation:** #611 is retained as the reversible schema
  inventory/backfill/embeddability plan. Actual migration execution is linked
  to newly created [#613](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/613)
  so the route and capability contracts are settled before an irreversible
  schema change.

## Handoff completeness

Every actionable request item has one issue, a fixed entry point or capability
boundary, finite acceptance criteria, exact focused checks, a routing hint, and
an explicit out-of-scope boundary. The import issue is intentionally last so
that rendering verification uses the final schema, slug, capability, runtime,
editor, and card contracts.

## Transaction ledger — #599

- **Phase:** CLOSED
- **Issue owner / current transaction:** #599, cross-repository art-piece contract inventory
- **PM/grooming:** complete; criterion-ready documentation-only contract
- **Implementation owner:** Codex/GPT-5, substituted for rostered Ollama Cloud stage 2b complex
- **Implementation commit:** `1ad99c6`
- **Changed files:** `docs/piece-surface-parity.md`, `docs/tasks.md`, this manifest
- **Focused checks:** reference `rg` scan returned 5,322 matches; `git diff --check` passed
- **Full checks:** not applicable; no product source, tests, API, schema, or runtime changed
- **Second opinion:** not run
- **QA owner:** Codex/GPT-5, substituted for rostered Claude Sonnet 5 Medium; `QA: PASS`
- **GitHub QA evidence:** [issue comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/599#issuecomment-5726528110)
- **Final status:** GitHub issue closed as completed; matrix implemented locally, with downstream runtime/deployment work explicitly owned by #600–#612
- **Next issue:** #611, non-destructive schema parity and embeddability migration plan

## Transaction ledger — #611 (in progress)

- **Phase:** ENGINEERING → QA pending commit
- **Issue owner / current transaction:** #611, schema parity and embeddability plan
- **PM/grooming:** scope reconciled; migration execution shifted to #613 to break the route/schema dependency cycle
- **Implementation owner:** Codex/GPT-5, substituted for rostered Ollama Cloud stage 2b complex
- **Changed files:** `docs/pieces-schema-parity.md`, this manifest, `docs/tasks.md` pending reconciliation
- **Focused checks:** corrected backend command `cd backend && uv run pytest tests/test_scene_migration.py tests/test_art_piece_persistence.py tests/test_collections.py` — 33 passed, 3 skipped
- **Full checks:** `make check` — 1,413 backend passed/39 skipped; 2,718 frontend passed; lint warnings pre-existing
- **Issue-command correction:** the issue cited nonexistent `tests/test_migrations.py`; repository path is `tests/test_scene_migration.py`, recorded as workflow/documentation correction
- **Second opinion:** not run
- **QA:** not yet run; commit required first
- **Dependency/follow-up:** #613 owns approved migration execution; #612 remains last

## Transaction ledger — #611

- **Phase:** CLOSED
- **PM/grooming:** complete; irreversible migration execution shifted to #613
- **Implementation owner:** Codex/GPT-5, substituted for Ollama Cloud stage 2b complex
- **Implementation commit:** `fc5ec5a`
- **Focused checks:** corrected backend suite 33 passed/3 skipped; `make check` 1,413 backend passed/39 skipped and 2,718 frontend passed; `git diff --check` passed
- **QA owner:** Codex/GPT-5, substituted for Claude Sonnet 5 Medium; `QA: PASS`
- **GitHub evidence:** [#611 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/611#issuecomment-5726620072)
- **Final status:** GitHub issue closed as completed; schema plan implemented locally, migration execution shifted to #613
- **Next issue:** #600, canonical slug routes and compatibility redirects

## Transaction ledger — #600

- **Phase:** IMPLEMENTED; pending GitHub QA/reconciliation
- **PM/grooming:** complete; compatibility policy documented as preserving identifier routes while canonicalizing new generated-piece links
- **Implementation owner:** Codex/GPT-5, substituted for Ollama Cloud stage 2b complex
- **Implementation scope:** documented API contract; added persisted `public_slug` to public art-piece payloads; profile, unified gallery, and collection cards now emit canonical generated-piece URLs; canonical slug pages render generated art pieces without replacing the browser URL with a UUID route; legacy viewer fallback remains supported
- **Focused checks:** backend 70 passed; frontend targeted 5 passed; `git diff --check` passed
- **Full checks:** backend `make check` 1,414 passed/39 skipped; frontend 2,718 passed; formatting, lint, and typecheck passed (existing lint warnings only)
- **Browser check:** not run against a local stack in this transaction; live Chrome evidence from the initial audit remains recorded in #599/#600 scope
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; independent second opinion not available
- **Next action:** commit, post QA evidence, then close #600 if accepted; next scoped issue #601
