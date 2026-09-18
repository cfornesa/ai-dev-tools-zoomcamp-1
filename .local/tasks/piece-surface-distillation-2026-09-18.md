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

- **Phase:** QA-PASSED FOR INCREMENT; issue remains open pending dependent surface criteria
- **PM/grooming:** complete; compatibility policy documented as preserving identifier routes while canonicalizing new generated-piece links
- **Implementation owner:** Codex/GPT-5, substituted for Ollama Cloud stage 2b complex
- **Implementation scope:** documented API contract; added persisted `public_slug` to public art-piece payloads; profile, unified gallery, and collection cards now emit canonical generated-piece URLs; canonical slug pages render generated art pieces without replacing the browser URL with a UUID route; legacy viewer fallback remains supported
- **Focused checks:** backend 70 passed; frontend targeted 5 passed; `git diff --check` passed
- **Full checks:** backend `make check` 1,414 passed/39 skipped; frontend 2,718 passed; formatting, lint, and typecheck passed (existing lint warnings only)
- **Browser check:** not run against a local stack in this transaction; live Chrome evidence from the initial audit remains recorded in #599/#600 scope
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; independent second opinion not available
- **GitHub evidence:** [#600 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/600#issuecomment-5726777360)
- **Outstanding criteria:** #601 owner editor route, #605 studio card routing, #606 immersive route, #607/#608 runtime/embed parity
- **Next action:** continue with #601 while retaining #600 open for dependent reconciliation

## Transaction ledger — #601

- **Phase:** QA-PASSED FOR INCREMENT; issue remains open pending studio-card reconciliation
- **PM/grooming:** complete; anonymous/non-owner/missing/deleted access is a uniform 404 contract
- **Implementation owner:** Codex/GPT-5, substituted for Ollama Cloud stage 2b complex
- **Implementation scope:** owner-only slug resolver, canonical editor route, existing editor mounted with resolved owner payload, UUID editor API compatibility retained
- **Focused checks:** canonical route suite 6 passed; backend lint/format passed; frontend format/lint/typecheck passed; canonical frontend test 2 passed
- **Browser check:** pending local stack availability
- **Full checks:** backend `make check` 1,415 passed/39 skipped; frontend 2,718 passed; formatting, lint, and typecheck passed (existing lint warnings only)
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; independent second opinion not available
- **GitHub evidence:** [#601 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/601#issuecomment-5726859541)
- **Outstanding criterion:** #605 owns switching studio/manage cards to this route
- **Next action:** continue with #602 card presentation/thumbnail contract and retain #601 open for #605 reconciliation

## Transaction ledger — #602

- **Phase:** QA-PASSED FOR INCREMENT; issue remains open pending six-engine thumbnail/runtime criteria
- **PM/grooming:** complete; shared profile/gallery presentation separated from studio actions
- **Implementation owner:** Codex/GPT-5, substituted for Ollama Cloud stage 2b complex
- **Implementation scope:** reusable `PieceCard` for public profile and unified gallery, consistent thumbnail fallback/error behavior, fixed metadata/title order, consumer-supplied href, visible keyboard focus, collection/generated badges
- **Focused checks:** public gallery/profile/a11y suite 32 passed; frontend typecheck passed
- **Full checks:** frontend 2,718 passed; lint and format passed (existing lint warnings only)
- **Browser check:** pending local stack availability; live Chrome evidence remains the initial source for the empty-card defect
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; independent second opinion unavailable
- **GitHub evidence:** [#602 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/602#issuecomment-5726912446)
- **Outstanding criteria:** real captured thumbnails and six-engine fixture evidence remain with #607/#608/#609
- **Next action:** continue with #603 profile-card routing/content reconciliation while retaining #602 open

## Transaction ledger — #603

- **Phase:** QA-PASSED FOR INCREMENT; issue remains open pending browser evidence and owner affordance reconciliation
- **PM/grooming:** complete; profile payload now supplies canonical links for all published piece families
- **Implementation owner:** Codex/GPT-5, substituted for Opencode Go stage 2a mechanical
- **Implementation scope:** public profile 2D/3D/generated cards expose persisted slug and `regular_url`; shared `PieceCard` supplies image/fallback/title/attribution geometry
- **Focused checks:** backend canonical/profile suite 7 passed; frontend profile/gallery/a11y suite 32 passed; typecheck and format passed
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; independent second opinion unavailable
- **Browser check:** pending local stack availability
- **Outstanding criteria:** 1280x900/375x812 browser evidence and owner-only edit affordance remain with #605/#601
- **Next action:** continue with #604 public gallery canonical routing

## Transaction ledger — #605

- **Phase:** QA-PASSED; browser screenshots pending local stack
- **PM/grooming:** complete; primary studio/manage destination is owner editor, published public-view action remains separate
- **Implementation owner:** Codex/GPT-5, substituted for Opencode Go stage 2a mechanical
- **Implementation scope:** management cards resolve the current profile handle, use `/users/@handle/edit/{public_slug}` as the primary action, and use the canonical regular public route for published pieces; UUID fallbacks remain for profile/API migration gaps
- **Focused checks:** frontend format, typecheck, lint, and 40 targeted tests passed
- **Browser check:** pending local stack availability
- **Full checks:** frontend 2,717 passed in full run; one unrelated CollectionManagement test failed once and passed 2/2 in isolated rerun; format, lint, and typecheck passed
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; independent second opinion unavailable
- **GitHub evidence:** [#605 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/605#issuecomment-5726988478)
- **Next action:** continue with #606 full-screen immersive route contract

## Transaction ledger — #606

- **Phase:** QA-PASSED FOR INCREMENT; issue remains open pending browser/device and engine criteria
- **PM/grooming:** complete; canonical generated-piece immersive route and viewport ownership scoped separately from offline/collection work
- **Implementation owner:** Codex/GPT-5, substituted for Ollama Cloud stage 2b complex
- **Implementation scope:** `/users/@handle/immersive/{slug}` wrapper, same-version immersive viewer handoff, viewport-fixed stage/overlay layout, full-height iframe, canonical regular-view back link, legacy UUID routes retained
- **Focused checks:** frontend format, lint, typecheck passed; available route regression 2 passed
- **Browser check:** pending local stack availability; live Chrome bounded-stage evidence remains the original defect record
- **Outstanding criteria:** owner-only edit affordance, six-engine immersive behavior, legacy redirect verification, and 1280x900/375x812 screenshots remain
- **Full checks:** frontend 2,718 passed; format, lint, and typecheck passed
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; independent second opinion unavailable
- **GitHub evidence:** [#606 QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/606#issuecomment-5727039832)
- **Next action:** continue with #607 regular/embed runtime parity

## Transaction ledger — #608

- **Phase:** AUDITED; implementation deferred pending six-engine prerequisite contract work
- **PM/grooming:** blocker confirmed; current immersive controls/runtime cover only the existing four-engine union
- **Evidence:** p5.js/C2.js/C2.js Interactive adapters, authored asset-error handling, and fixture evidence require #607/#610/#613; #606 supplies only the viewport shell
- **Owner:** no implementation commit; current Codex audit substitution for stage 2b review
- **GitHub evidence:** [#608 boundary comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/608#issuecomment-5727051635)
- **Next action:** continue with #609 offline downloads

## Transaction ledger — #609

- **Phase:** AUDITED; implementation deferred pending six-engine runtime/package contract
- **PM/grooming:** blocker confirmed; current ZIP path covers four engines and fixed-height immersive export
- **Evidence:** p5.js/C2.js/C2.js Interactive packaging and extracted-browser fixtures depend on #607/#610/#613; no safe identifier-only extension
- **Owner:** no implementation commit; current Codex audit substitution for stage 2b review
- **GitHub evidence:** [#609 boundary comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/609#issuecomment-5727058839)
- **Next action:** continue with #610 editor integration

## Transaction ledger — #610

- **Phase:** AUDITED; implementation deferred pending canonical engine/schema contract
- **PM/grooming:** blocker confirmed; existing editor is source-only and model/provider union has four engines
- **Evidence:** p5.js/C2.js/C2.js Interactive editor integration and Three/A-Frame editor routing require #613 before safe persistence, then #607/#608/#609 runtime/export parity
- **Owner:** no implementation commit; current Codex audit substitution for stage 2b review
- **GitHub evidence:** [#610 boundary comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/610#issuecomment-5727064069)
- **Next action:** continue with #611/#613 schema bridge reconciliation

## Transaction ledger — #613

- **Phase:** AUDITED; migration code already present, PostgreSQL verification pending
- **PM/grooming:** complete; no new model delta is authorized by the checked-in #611 matrix without the six-engine contract decisions
- **Evidence:** existing migrations 0077/0078; safe `makemigrations --check --dry-run` reports no changes; focused suite 33 passed/3 PostgreSQL-gated skipped
- **Database safety:** no development, production, Replit, or shared database was written
- **Owner:** no implementation commit; current Codex audit substitution for stage 2b complex review
- **GitHub evidence:** [#613 audit comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/613#issuecomment-5727081694)
- **Next action:** retain #613 open until disposable PostgreSQL upgrade/schema inspection is available; proceed to #612 import only after the schema gate

## Transaction ledger — #612

- **Phase:** DEPENDENCY-BLOCKED; no import performed
- **PM/grooming:** complete; import requires idempotent mapping, reversible cleanup, schema verification, and all six engine/runtime contracts
- **Evidence:** no repository import command currently exists; requested p5.js/C2.js/C2.js Interactive engines are not persisted/provider/sandbox-supported
- **Database safety:** `@cfornesa`, development, production, Replit, and shared databases untouched
- **Owner:** no implementation commit; current Codex dependency audit substitution for stage 2b complex
- **GitHub evidence:** [#612 dependency note](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/612#issuecomment-5727091282)
- **Next action:** defer import until #613 and #607–#610 are genuinely complete

## Transaction ledger — #607

- **Phase:** AUDITED; implementation deferred pending prerequisite schema/provider/editor contract work
- **PM/grooming:** blocker confirmed; current engine union is canvas2d/svg/threejs/aframe only
- **Evidence:** requested p5.js, C2.js, and C2.js Interactive support crosses #610 editor integration and #613 schema bridge; widening the runtime union alone would create an unvalidated/security-sensitive partial contract
- **Owner:** no implementation commit; current Codex audit substitution for stage 2b review
- **GitHub evidence:** [#607 boundary comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/607#issuecomment-5727046271)
- **Next action:** continue with #608 immersive runtime parity while retaining #607 open

## Transaction ledger — #604

- **Phase:** QA-PASSED FOR INCREMENT; issue remains open pending browser evidence and immersive secondary-action criteria
- **PM/grooming:** complete; unified gallery preserves filters, cursors, ordering, and collection links
- **Implementation owner:** Codex/GPT-5, substituted for Ollama Cloud stage 2b complex
- **Implementation scope:** gallery serializer emits owner-slug regular links for published 2D/3D/generated pieces; collection canonical links unchanged; shared `PieceCard` consumes the returned href
- **Focused checks:** gallery/canonical backend suite 45 passed; frontend full suite 2,718 passed previously after shared-card changes; typecheck/format passed
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; independent second opinion unavailable
- **Browser check:** pending local stack availability
- **Outstanding criteria:** 1280x900/375x812 browser evidence and immersive secondary action remain with #606/#608
- **Next action:** continue with #605 studio cards/editor destinations

## Transaction ledger — #614

- **Phase:** GROOMED; criterion-ready handoff to stage 2b
- **PM/distillation:** duplicate search found no existing six-engine capability-contract issue; issue definition is recorded in `.local/tasks/issue-614-six-engine-contract.md`
- **Issue-scoping owner:** Codex/GPT-5, rostered Codex GPT-5.6 Luna at Medium; current run is the authorized Codex implementation of stage 1
- **Implementation routing:** stage 2b complex, because the contract crosses persisted engine choices, API/provider validation, frontend types, and migration safety
- **Scope:** additive seven-ID registry (`canvas2d`, `svg`, `p5js`, `c2js`, `c2js-interactive`, `threejs`, `aframe`) with separate display labels and explicit capabilities
- **Dependencies:** #599 and #611; unlocks #607–#610 and the safe import prerequisite for #612
- **Evidence boundary:** local contract/migration tests only; no live rendering, Replit publication, or shared database write
- **Implementation commits:** `9210872`, QA correction `d767409`, and verification-record correction `fa3e0f6`; focused and full checks rerun after the product correction
- **Focused checks:** backend `46 passed`; frontend `14 passed`; migration drift `No changes detected`; `sqlmigrate scenes 0079_art_piece_engine_contract` is reversible state-only `(no-op)`
- **Full checks:** `make check` after the correction: backend `1418 passed, 39 skipped`; frontend `2720 passed`; lint, format, and mypy passed
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; independent Stage 3 review not run
- **QA result:** PASS with fixes; canonical model labels now consume the registry directly, and the focused frontend command was corrected to an existing test file
- **Evidence boundary:** local automated contract/migration evidence only; no live rendering, Replit publication, or shared database write
- **Next action:** post QA matrix, close #614, and resume the next dependency-ready issue (#607/#610 after this prerequisite)

GitHub issue: https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/614

### #614 QA reconciliation — 2026-09-18

The corrected issue contract was re-read from GitHub. The initial QA intake
found a duplicated model-label source and a nonexistent frontend focused test
path; both were corrected before the final verdict. No product test was
weakened, skipped, deleted, or retargeted in the #614 diff.

### Fresh distillation after #614 — 2026-09-18

Issue #614 is closed and unblocks the engine-contract dependency. The former
#607 bundle was split before engineering because regular and chrome-less embed
routes require separate entry-point fixtures and rendered evidence:

- #607 is narrowed to regular-view runtime parity and is the next issue.
- [#615](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/615) owns
  the chrome-less embed consumer and depends on #607.
- #608, #609, #610, #613, and #612 remain ordered behind their explicit
  runtime/schema/editor dependencies.

### Transaction ledger — #607 after split

- **Phase:** GROOMED; next engineering transaction
- **Scope:** regular public generated-piece viewer only, with six-engine
  fixtures and fixed desktop/mobile browser evidence
- **Dependencies:** #599, #600, #611, and closed #614
- **Shifted scope:** chrome-less embed route is criterion-ready in #615 and is
  dependency-blocked until #607 closes; immersive, downloads, editor,
  schema publication, and import remain #608–#610, #613, and #612
- **Routing:** stage 2b complex; sandbox/runtime security, version selection,
  capabilities, and device interaction are coupled
- **Next action:** run PM grooming, then implement #607 only

### Transaction ledger — #615

- **Phase:** GROOMED; dependency-blocked by #607
- **Scope:** chrome-less embed consumer for six engines, separate from the
  regular viewer's route-level evidence
- **Dependencies:** #607 and closed #614
- **Next action:** hold until #607 reaches a terminal status, then begin its
  own engineering/QA transaction

### QA reconciliation — #607 — 2026-09-18

- **Phase:** QA FAILED / verification-boundary; implementation increment is committed but the issue remains open
- **Implementation commit:** `5d4ab4d`
- **QA evidence:** full `UV_CACHE_DIR=/tmp/codex-uv-cache make check` passed with backend `1,429 passed, 39 skipped` and frontend `2,723 passed`; focused backend `24 passed`; focused frontend `28 passed`; frontend build passed
- **Unverified criteria:** six-engine published regular route, fixed desktop/mobile rendered frames, control visibility/permission behavior, C2 Interactive input restoration, CDN failure states, and owner/non-owner route affordances
- **Boundary:** `make compose-preflight` failed because Docker daemon is unavailable; localhost health check found no Django/Vite listener; Playwright scenarios were listable but not executable
- **Disposition:** `verification-boundary`, not a product failure; no new follow-up issue because the existing documented disposable-stack/CI browser workflow is the next action
- **GitHub evidence:** [engineering handoff](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/607#issuecomment-5727581894), [QA verdict](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/607#issuecomment-5727640133)
- **Next action:** keep #607 open; run the exact browser matrix on a disposable PostgreSQL/Django/Vite stack or CI browser runner before revisiting QA. Hold dependent #615.

### Fresh distillation after #607 QA boundary — 2026-09-18

- #607 is not terminally complete; it is retained open with a host verification boundary.
- #615 remains dependency-blocked on #607 and must not begin.
- The next independent closure-ready issue is #600, canonical user-customizable slugs and compatibility redirects, after closed prerequisites #599 and #611. Its route changes remain a public-interface/irreversible-decision boundary and require compatibility evidence before implementation.
- #606 depends on #600; #608/#609 depend on #607/#606; #610 is independent of the browser boundary but remains downstream of the canonical engine contract and should follow the route contract ordering.
- #616 is the newly created closure-sized regular-route child of #600. It owns slug normalization/collision/privacy and the legacy regular-route shim only; #600 remains the parent reconciliation container and #601–#605 own other consumers.
- **Next issue:** [#616](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/616), after PM grooming confirms the URL compatibility/rollback contract.
