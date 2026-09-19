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
| 6 | [#603](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/603) | Public profile card consumer | stage 2a/2b conditional | #600, #602 | CLOSED — local QA PASS |
| 7 | [#604](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/604) | Public gallery card consumer | stage 2b complex | #564, #565, #600, #602 | CLOSED — local QA PASS |
| 8 | [#605](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/605) | Studio card consumer | stage 2a/2b conditional | #600, #601, #602 | CLOSED — local QA PASS |
| 9 | [#607](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/607) | Regular and regular-embed six-engine runtime | stage 2b complex | #599, #600, #611 | PROPOSED |
| 10 | [#606](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/606) | Canonical full-screen immersive route | stage 2b complex | #599, #600, #611 | CLOSED — local QA PASS |
| 11 | [#608](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/608) | Immersive six-engine runtime parity | stage 2b complex | #606, #607 | PROPOSED |
| 12 | [#609](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/609) | Offline regular and immersive downloads | stage 2b complex | #607, #608 | PROPOSED |
| 13 | [#610](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/610) | 2D/3D AI-editor engine integration | stage 2b complex | #599, #600, #611 | PROPOSED |
| 14 | [#613](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/613) | Apply approved pieces/collections schema bridge and embeddability migration | stage 2b complex | #599, #600, #601, #602, #607, #611 | CLOSED — local QA PASS |
| 15 | [#612](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/612) | Import sanitized reference pieces into `@cfornesa` and verify all surfaces | stage 2b complex | #600, #602, #606–#611, #613 | QA FAIL — parity evidence pending |

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

### Transaction ledger — #616

- **Phase:** QA FAILED / verification-boundary; API and persistence implementation is committed, browser route evidence is pending
- **PM/grooming:** criterion-ready child of #600; the issue verification command was corrected during intake to use the existing `CanonicalPublicPiece.test.tsx`
- **Implementation commits:** `5eb5d62` and lint correction `c983d72`
- **Focused checks:** backend `29 passed`; frontend canonical route `2 passed`
- **Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache make check` passed with backend `1,432 passed, 39 skipped`; frontend `2,723 passed`; lint/format/typecheck passed
- **Browser boundary:** Docker unavailable; localhost health unavailable; four relevant Chromium scenarios were listed but not executed
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; Stage 3 independent-family review not run
- **GitHub evidence:** QA comment posted on #616; issue remains open
- **Next action:** run regular route browser evidence at 1280x900 and 375x812 on disposable PostgreSQL/Django/Vite or approved CI runner, then return #616 to QA

### Fresh distillation after #616 QA boundary — 2026-09-18

- #616 is retained open with a host verification boundary; no product defect was established by API/full-suite evidence.
- #601–#610 remain the existing follow-up consumers. #615 remains blocked by #607.
- The next independent engineering candidate is #610 (AI-editor engine integration), but it should be re-groomed against the now-explicit seven-engine capability contract before implementation; no new issue is required because #610 already owns that scope.

### Fresh distillation after #616 — 2026-09-18

- The broad #610 editor item spans two independently observable editor modes, so it was split before engineering.
- [#618](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/618) owns the 2D AI-editor route for p5.js, C2.js, C2.js Interactive, and SVG.
- [#619](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/619) owns the 3D AI-editor route for Three.js and A-Frame.
- #610 remains the parent reconciliation container; neither child begins until its own PM handoff is selected.
- **Next issue:** #618, the 2D AI-editor slice, because it is independent of the unavailable regular-route browser verification boundary.

### Transaction ledger — #618

- **Phase:** QA FAILED / verification-boundary; 2D provider/catalog/sandbox capability increment is committed, browser editor workflow remains pending
- **Implementation commits:** `cc4b10a`, `411ebfc`, and `545b57d`
- **Focused checks:** backend provider/API/contract/persistence/validation `37 passed`; frontend Studio/runtime/registry `18 passed`
- **Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache make check` passed with backend `1,434 passed, 39 skipped`; frontend `2,724 passed`; lint/format/typecheck passed
- **Browser boundary:** Docker unavailable; localhost health unavailable; six relevant Chromium scenarios were listed but not executed
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; Stage 3 independent-family review not run
- **GitHub evidence:** [engineering handoff](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/618#issuecomment-5727965025), [QA verdict](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/618#issuecomment-5727970343)
- **Next action:** keep #618 open; run authenticated editor browser evidence at both fixed viewports on disposable PostgreSQL/Django/Vite or CI, then return to QA

### Fresh distillation after #618 QA boundary — 2026-09-18

- #618 remains open with a host verification boundary; no product defect was established by API/full-suite evidence.
- #619 is the next independent closure-sized issue from the same parent split and owns only the 3D editor route for Three.js/A-Frame.
- #607/#616 retain their own pending browser gates; #615 remains blocked by #607.
- **Next issue:** #619 after PM/grooming re-reads its fixed 3D editor fixture and evidence boundary.

### Fresh distillation after #619 audit — 2026-09-18

- The existing generic `ArtPieceEditor` already revises Three.js/A-Frame source and uses the shared sandbox, but it does not expose a distinct 3D AI-editor mode/fixture. That is an actionable scope gap, not evidence that #619 is complete.
- [#620](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/620) owns the explicit 3D art-piece editor mode and canonical owner-editor evidence; #619 remains the parent 3D reconciliation container.
- **Next issue:** #620, after PM grooming confirms the route/mode boundary.

### Transaction ledger — #620

- **Phase:** QA FAILED / verification-boundary; explicit engine-family mode is committed, route-level Three.js/A-Frame evidence is pending
- **Implementation commit:** `18c9e79`
- **Checks:** frontend full suite `2,724 passed`; typecheck passed; lint warning-only; backend full gate from the same batch `1,434 passed, 39 skipped`
- **Browser boundary:** Docker unavailable; localhost health unavailable; seven owner-editor Chromium scenarios were listed but not executed
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; Stage 3 independent-family review not run
- **GitHub evidence:** [engineering](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/620#issuecomment-5728047323), [QA](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/620#issuecomment-5728047497)
- **Next action:** keep #620 open; execute Three.js/A-Frame owner-editor scenarios at both fixed viewports on disposable PostgreSQL/Django/Vite or CI, then return to QA

### Fresh distillation after #620 QA boundary — 2026-09-18

- #620 remains open with a host verification boundary; #619 remains the parent reconciliation container.
- #606 is the next independent route slice after the already-scoped slug work: canonical full-screen immersive surface, with #608 owning engine/input parity afterward.
- #607/#616/#618 retain their own browser gates; #615 remains blocked by #607.
- **Next issue:** #606 after PM/grooming re-reads its full-screen route fixture and redirect compatibility evidence.

### Transaction ledger — #606 — 2026-09-18

- **Phase:** ENGINEERING complete; QA pending rendered browser evidence
- **PM/scoping owner:** Codex / GPT-5 substitution for rostered GPT-5.6 Luna / Medium; issue contract retained as one canonical immersive route surface, with engine runtime parity deferred to #608
- **Implementation owner:** Codex / GPT-5 substitution for rostered Ollama Cloud / kimi-k3; stage 2b complex because route ownership, fullscreen behavior, and authorization-compatible navigation are coupled
- **Implementation commit:** pending commit for route-owned close/Escape behavior and immersive viewport regression coverage
- **Focused checks:** `cd frontend && npm test -- --run src/pages/ImmersiveArtPieceViewer.test.tsx` (2 passed); `cd frontend && npm run typecheck`
- **Full checks:** `UV_CACHE_DIR=/tmp/codex-uv-cache make check` (backend `1,434 passed, 39 skipped`; frontend `2,726 passed`; lint warning-only; format and typecheck passed)
- **Scope:** canonical immersive viewer owns the viewport, exposes a close control returning to the canonical regular slug, closes on Escape when native fullscreen is not active, and marks the stage as an accessible region; existing native fullscreen/shared controls remain in place
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; Stage 3 independent-family review not run
- **Evidence boundary:** Docker daemon unavailable, no local Django/Vite listener, and route-level Chromium scenarios cannot execute; active production Chrome still shows the stale bounded-stage revision, so it is not evidence for this unrepublished commit
- **Next action:** run the exact canonical immersive route matrix at 1280x900 and 375x812 on a disposable PostgreSQL/Django/Vite or approved CI browser runner, then return #606 to QA; do not close or recommend republish from source/full-suite evidence alone

### Transaction ledger — #605 — 2026-09-18

- **Phase:** ENGINEERING complete; QA pending rendered browser evidence
- **Scope:** authenticated art-piece management cards default to canonical owner editor links, retain published-only regular public links, and use shared thumbnail/title card presentation
- **Implementation commit:** pending commit for focused management-card regression coverage
- **Focused checks:** `cd frontend && npm test -- --run src/pages/ArtPieceManagement.test.tsx` (1 passed); `cd frontend && npm run typecheck`
- **Full checks:** `cd frontend && npm test` (2,727 passed); lint warning-only; format-check and typecheck passed
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; Stage 3 independent-family review not run
- **Evidence boundary:** fixed desktop/mobile Chromium inspection is unavailable because Docker daemon and localhost Django/Vite are unavailable; production evidence is not required by this local issue contract and has not been used
- **Next action:** run authenticated management-card Chromium checks at 1280x900 and 375x812 on disposable PostgreSQL/Django/Vite or approved CI browser runner, then return #605 to QA

### Transaction ledger — #604 — 2026-09-18

- **Phase:** QA FAILED / verification-boundary; existing implementation remains open
- **Focused checks:** backend public-gallery/art-piece API suite `67 passed`; frontend public gallery/profile suite `28 passed`; current batch frontend full suite `2,727 passed`
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; Stage 3 independent-family review not run
- **Evidence boundary:** API/unit and component evidence pass, but rendered gallery screenshots, keyboard flow, immersive secondary-action visibility, and fixed 1280x900/375x812 behavior are not verified because Docker and localhost Django/Vite are unavailable
- **Next action:** run the gallery Chromium matrix on a disposable PostgreSQL/Django/Vite or approved CI browser runner, then return #604 to QA

### Fresh distillation after #604/#605/#606 QA boundaries — 2026-09-18

- #604, #605, and #606 are each evaluated by QA and remain open only for the documented browser-host boundary; no new product defect was established in those passes.
- #613 remains an audited schema bridge with PostgreSQL verification pending; production/development/shared databases remain untouched.
- #612 import remains dependency-blocked until schema/runtime contracts and import verification are complete; no `@cfornesa` pieces have been imported.
- Dependent #607/#608/#609/#615 remain held behind their explicit route/runtime dependencies and the unavailable browser stack.
- **Next action:** continue the independent public-profile/card reconciliation with #603, then reconcile #602/#601 before any production-readiness gate.

### Transaction ledger — #603 — 2026-09-18

- **Phase:** QA FAILED / verification-boundary; existing implementation remains open
- **Focused checks:** canonical/profile and public-gallery backend suite `46 passed`; public gallery/profile frontend suite `28 passed`; current full frontend gate `2,727 passed`
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; Stage 3 independent-family review not run
- **Evidence boundary:** API/unit and component evidence pass, but owner/visitor rendered profile checks and fixed 1280x900/375x812 screenshots are unavailable because Docker and localhost Django/Vite are unavailable
- **Next action:** run the profile Chromium matrix with owner/visitor fixtures on a disposable PostgreSQL/Django/Vite or approved CI browser runner, then return #603 to QA

### Duplicate reconciliation — #617 — 2026-09-18

- #617 exactly duplicates the criterion-ready regular slug/shim child #616.
- Posted the duplicate rationale and closed #617; #616 remains the canonical issue and retains its own QA boundary/evidence.

### Transaction ledger — #613 — 2026-09-18

- **Phase:** QA FAILED / PostgreSQL verification-boundary; existing schema bridge remains open
- **Focused checks:** art-piece persistence/collection suite `38 passed`; `makemigrations --check --dry-run` reported `No changes detected`; `sqlmigrate scenes 0077_non_destructive_schema_bridge` emitted reversible state-preserving SQL
- **Database safety:** no development, production, Replit, or shared database was written
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; Stage 3 independent-family review not run
- **Evidence boundary:** SQLite/repository evidence passes; disposable PostgreSQL upgrade, direct table/column inspection, and public projection verification remain unavailable because Docker/PostgreSQL is unavailable
- **Next action:** execute the migration upgrade/inspection on a disposable PostgreSQL runner, then return #613 to QA; hold #612 import until this gate and runtime contracts are complete

### Transaction ledger — #602 — 2026-09-18

- **Phase:** QA FAILED / verification-boundary; explicit fallback-thumbnail contract increment implemented
- **Implementation commit:** pending commit for explicit `thumbnail_is_fallback` metadata and shared-card behavior
- **Scope:** generated art-piece version, profile, and unified gallery payloads now identify neutral fallback thumbnails; the shared `PieceCard` renders the accessible fallback state without attempting a placeholder image; authored 2D/3D gallery contracts remain unchanged
- **Focused checks:** backend art-piece persistence/public-gallery suite `55 passed`; frontend `PieceCard` regression `1 passed`; frontend full suite `2,728 passed`; frontend typecheck/format-check passed; backend ruff/mypy/format-check passed
- **QA owner:** Codex/GPT-5 substitution for Claude Sonnet 5 Medium; Stage 3 independent-family review not run
- **Evidence boundary:** rendered gallery/profile/studio screenshots and fixed 1280x900/375x812 behavior remain unavailable because Docker and localhost Django/Vite are unavailable; no shared or production database was modified
- **Next action:** run the generated-card fallback/real-thumbnail matrix in Chromium on a disposable PostgreSQL/Django/Vite or approved CI browser runner, then return #602 to QA

### Dependency reconciliation — #615 — 2026-09-18

- **Phase:** dependency-blocked / QA scoping complete
- **Dependencies:** #613 schema bridge, #614 canonical seven-engine capability contract, and #607 regular runtime parity; #612 import remains downstream
- **Evidence:** no six-engine chrome-less embed fixtures or fixed-viewport Chromium run was attempted because Docker/PostgreSQL/Django/Vite are unavailable; no code or database writes were made
- **GitHub evidence:** [dependency/QA gate](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/615#issuecomment-5728509866)
- **Next action:** keep #615 open and return it to implementation after #607 and the schema/capability gates are verified; a self-skipped browser scenario is not a pass

### Browser QA reconciliation — 2026-09-18

- **Disposable stack:** `make compose-preflight` passed; Docker PostgreSQL,
  Django, and Vite were healthy. Playwright used `E2E_DOCKER_COMPOSE=true` so
  fixture users and pieces shared the same database as the app.
- **Matrix:** the scoped Chromium art-piece matrix completed 28/28 after
  correcting viewport-safe controls, canonical route expectations, profile
  load timing, and owner metadata state synchronization. It covered regular,
  embed, immersive, CMS, ZIP, thumbnail, owner, gallery, and profile flows at
  the fixed desktop/mobile viewports used by the issue contracts.
- **Schema gate:** disposable PostgreSQL reported `No changes detected`; direct
  table inspection confirmed `scenes_artpiece`, `scenes_collection`, and
  `scenes_artpieceversion` exist. No development, production, Replit, or
  shared database was modified.
- **Product corrections:** public-gallery filters are available from the
  default view; legacy runtime controls stay inside the viewport; immersive
  back navigation remains clickable above the full-stage layer; profile forms
  open on first visit; metadata edits synchronize controlled state; stale
  TypeScript fixtures now include the explicit thumbnail fallback field.
- **Remaining closure boundary:** the six-engine parity, import, Replit
  publication, physical-device, and exact deployed-asset criteria remain
  open where their issue contracts require evidence beyond this local matrix.

### Backlog-session reconciliation — 2026-09-18 continuation

- **#613 transaction:** `GROOMED → QA → RECONCILIATION → CLOSED`.
  Disposable PostgreSQL was migrated from scenes `0076` through `0079` with
  representative pre-bridge user, piece, version, collection, and collection
  item rows; all survived. Persistence/collection tests passed `38/38`, direct
  table/column inspection passed, canonical public projections omitted private
  fields, anonymous editor access returned `404`, and the embed route returned
  `200`. QA PASS: [comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/613#issuecomment-5737523464).
- **#603 transaction:** `GROOMED → QA → RECONCILIATION → CLOSED`.
  The Docker-backed Chromium matrix completed `28/28` at the fixed desktop and
  mobile viewports, covering profile links, cards, fallback state, ownership,
  and keyboard behavior. QA PASS: [comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/603#issuecomment-5737529556).
- **#604 transaction:** `GROOMED → QA → RECONCILIATION → CLOSED`.
  The same matrix verified mixed gallery links, filters, capability-gated
  immersive actions, shared card geometry, and keyboard behavior. QA PASS:
  [comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/604#issuecomment-5737531400).
- **#605 transaction:** `GROOMED → QA → RECONCILIATION → CLOSED`.
  Owner-management Chromium coverage verified editor-first links, published
  regular links, status gating, deletion/revision flows, non-owner denial, and
  responsive keyboard behavior. QA PASS: [comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/605#issuecomment-5737533127).
- **#606 transaction:** `GROOMED → QA → RECONCILIATION → CLOSED`.
  Canonical immersive Chromium coverage verified viewport ownership, overlays,
  close/Escape navigation, controls, legacy UUID/custom/CMS entry points, and
  responsive no-overflow behavior. QA PASS: [comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/606#issuecomment-5737535118).
- **#612 transaction:** `GROOMED → ENGINEERING → QA → RECONCILIATION`.
  Commit `1e40cc1` adds the disposable, owner-scoped, idempotent six-engine
  importer and a focused E2E spec. Docker import and CUA browser checks passed;
  headless Chromium could not launch on this macOS host due Mach-port
  permissions. The issue remains open because full six-engine immersive,
  download, editor, thumbnail-capture, and deployed evidence is owned by
  #607–#610 and the importer is intentionally local/disposable. QA FAIL:
  [comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/612#issuecomment-5737487118).

### Transaction ledger — #607 C2 runtime increment — 2026-09-19

- **Phase:** `ENGINEERING → QA`; issue remains open pending the complete six-engine fixed-viewport browser gate.
- **Implementation commit:** `7ae5618 Fix regular C2 art piece rendering`.
- **Product correction:** C2 and C2 Interactive now share a deterministic reference-compatible Renderer adapter inside the opaque sandbox, paint one synchronous frame before the RAF loop, and use a 320x240 viewport so authored coordinates remain visible beneath the stage overlays. The new focused E2E spec covers six engines through canonical regular routes at desktop/mobile viewports.
- **Focused checks:** sandbox suite `23 passed`; frontend typecheck passed; Prettier and `git diff --check` passed; Docker CUA visibly rendered the imported C2 cyan shape and C2 Interactive pink shape.
- **Evidence boundary:** this host's headless Chromium still fails at process launch with the documented macOS Mach-port permission error; no complete six-engine fixed-viewport Playwright result is claimed. No shared, development, production, or Replit database was written.
- **GitHub evidence:** [structured QA comment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/607#issuecomment-5737731687) and [reference-contract addendum](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/607#issuecomment-5737740743).
- **Next action:** run the new six-engine spec on the approved CI/browser runner, then reconcile #607 and its dependent #608–#610 criteria; keep production-readiness and session-completion gates closed.

**Current next transaction:** #607 regular six-engine runtime parity. #602,
#608, #609, #610, #612, #615, #616, #618, and #620 remain open; #600/#601
remain parent reconciliation containers for the closed consumer slices. No
production-readiness gate is eligible until the remaining local criteria are
either closed or explicitly terminally handed off for republishing.

### Transaction ledger — #607 regular six-engine runtime parity — 2026-09-19

- **Phase:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`.
- **Implementation:** commits `7ae5618` and `040da37`; C2/C2 Interactive now use a deterministic reference-compatible renderer adapter in the opaque sandbox, with a synchronous first frame and aligned 320x240 stage.
- **Browser evidence:** disposable Docker-backed Chromium ran `e2e/artPieceSixEngineRegular.spec.ts` successfully (`1 passed`, covering 1280x900 and 375x812 across SVG, p5.js, C2.js, C2.js Interactive, Three.js, and A-Frame). CUA also visually confirmed the regular SVG route and the imported C2/C2 Interactive pieces.
- **Repository evidence:** `UV_CACHE_DIR=/tmp/codex-uv-cache make check` passed with backend `1436 passed, 39 skipped` and frontend `2731 passed`; lint, format, and typecheck passed. Focused Docker backend API tests passed `63/63`.
- **QA provenance:** Codex/GPT-5 substitution for the rostered implementation and Claude Sonnet 5 Medium QA stages; Stage 3 independent-family review was unavailable. The Docker image's full-suite collection failure was classified as stale-image infrastructure and was not used as the repository gate.
- **Safety boundary:** no development, production, shared, or Replit database was written; imported `@cfornesa` pieces remain disposable Docker fixtures only.
- **GitHub evidence:** [QA PASS and closure](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/607#issuecomment-5737889877).
- **Next action:** continue with the next dependency-ready surface issue; #607's embed, immersive, offline, editor, import, and deployed-publication follow-ons remain separate.

### Transaction ledger — #608 immersive parity increment — 2026-09-19

- **Phase:** `GROOMED → ENGINEERING → QA-PENDING`.
- **Implementation:** the backend/frontend capability registries now expose immersive support for SVG, p5.js, C2.js, and C2.js Interactive; the immersive viewer and sandbox use the existing lazy synthetic spatial shell for flat engines while preserving separate embed/download/editor gates.
- **Focused checks:** backend contract/validation/persistence `26 passed`; frontend runtime/viewer tests `30 passed`; frontend typecheck and format-check passed.
- **Evidence boundary:** imported Docker p5.js regular view is visible, but the first live immersive p5.js inspection showed a blank white frame under the overlay. This is retained as an active browser defect until the six-engine immersive matrix identifies and fixes the runtime/layout cause; no closure claim is made.
- **GitHub evidence:** [engineering increment](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/608#issuecomment-5737925475).
- **Safety boundary:** no development, production, shared, or Replit database was written.
- **Live correction:** commit `abf626b` adds presentation-specific dark letterboxing and responsive `canvas`/`svg` sizing; CUA recheck rendered the imported p5.js orange circle centered in the full-screen surface.
- **Full repository gate:** `UV_CACHE_DIR=/tmp/codex-uv-cache make check` passed: backend `1436 passed, 39 skipped`; frontend `2732 passed`; action-pin check, lint, format, and typecheck passed.
- **GitHub evidence:** [live correction](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/608#issuecomment-5737948844) and [full repository gate](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/608#issuecomment-5737980256).
- **Next action:** add/run the six-engine immersive fixed-viewport browser matrix and verify authored Three.js/A-Frame transforms/errors before QA closure.

### Transaction ledger — #608 immersive runtime parity — 2026-09-19

- **Phase:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`.
- **Implementation:** commits `4bdd4a9`, `abf626b`, `e74a7e1`, and `0cbec76`; immersive capability is enabled for the six requested engines, flat engines use the lazy synthetic shell with responsive full-screen presentation, and the mobile overlay no longer obscures the title.
- **Browser evidence:** Docker Chromium six-engine immersive matrix passed `1/1` across 1280x900 and 375x812; existing immersive Custom/CMS suites passed 8 scenarios; camera/sound/microphone/steering suites passed 11 scenarios. CUA visibly inspected all six rendered frames and rechecked the corrected mobile p5.js overlay.
- **Repository evidence:** final `UV_CACHE_DIR=/tmp/codex-uv-cache make check` passed with backend `1436 passed, 39 skipped`, frontend `2732 passed`, action-pin check, lint, format, and typecheck. A transient CollectionManagement failure was isolated and the full frontend suite rerun passed.
- **QA provenance:** Codex/GPT-5 substitution for the rostered Ollama Cloud implementation and Claude Sonnet 5 Medium QA stages; Stage 3 independent-family review unavailable; intake `ACCEPTED-WITH-FIXES`.
- **Safety boundary:** no shared, development, production, or Replit database was written.
- **GitHub evidence:** [QA PASS and closure](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/608#issuecomment-5738113835).
- **Next transaction:** #609 offline regular/immersive downloads; #612 remains downstream of the closed runtime contract and still owns importer/profile completion.

### Transaction ledger — #609 offline regular and immersive downloads — 2026-09-19

- **Phase:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`.
- **Implementation:** commit `7b92e57`; downloadable bundles now vendor p5.js, Three.js, and A-Frame runtimes, provide a reference-compatible inline C2.js/C2 Interactive adapter, and carry responsive full-height immersive CSS. All six engines expose the same immersive navigation contract, including flat-engine synthetic poses and standalone A-Frame camera registration.
- **Browser evidence:** Docker Chromium extracted and served every regular and immersive ZIP from temporary HTTP servers with network access blocked after extraction; SVG, p5.js, C2.js, C2.js Interactive, Three.js, and A-Frame all rendered and accepted keyboard navigation (`artPieceSixEngineZip.spec.ts`, `1 passed`). Existing Full, Immersive, Non-Camera, and flat ZIP suites passed `8/8`.
- **Repository evidence:** `UV_CACHE_DIR=/tmp/codex-uv-cache NPM_CONFIG_CACHE=/tmp/codex-npm-cache make check` passed with backend `1436 passed, 39 skipped` and frontend `2734 passed`; lint, format, typecheck, action-pin, focused bundle tests, and `git diff --check` passed.
- **QA provenance:** Codex/GPT-5 substitution for the rostered implementation and Claude Sonnet 5 Medium QA stages; Stage 3 independent-family review unavailable.
- **Safety boundary:** no shared, development, production, or Replit database was written; Docker fixture data and extracted temporary artifacts were disposable.
- **GitHub evidence:** [QA PASS and closure](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/609#issuecomment-5738254516).
- **Next transaction:** continue with the next dependency-ready consumer slice; #612 remains downstream and owns the owner-scoped `@cfornesa` importer/profile completion.

### Transaction ledger — #612 importer/profile reconciliation — 2026-09-19

- **Phase:** `ENGINEERING → QA-PENDING`.
- **Implementation:** commit `fc51004`; the disposable importer now reconciles stale marker-owned rows by creating immutable replacement versions, preserving public IDs/slugs while advancing capabilities and regenerating thumbnails. p5.js, C2.js, and C2.js Interactive now import with `immersive` and `download` enabled.
- **Verification:** focused backend importer tests passed `2/2`; Docker re-imported the six sanitized fixtures into `@cfornesa` and Docker Chromium `referenceImport.spec.ts` passed `1/1` at desktop and mobile viewport sizes.
- **Evidence boundary:** this proves the owner-scoped import/profile increment only. #612 remains open for editor and chrome-less embed acceptance owned by #610/#615, and the imported rows remain disposable Docker evidence; no shared, development, production, or Replit database was written.
- **GitHub evidence:** [importer/profile reconciliation](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/612#issuecomment-5738271058).
- **Next action:** continue with the next dependency-ready editor/embed slice, then rerun #612's complete six-engine acceptance matrix before closing it.

### Transaction ledger — #612 final six-engine importer/profile reconciliation — 2026-09-19

- **Phase:** `QA-PENDING → QA → RECONCILIATION → CLOSED`.
- **Import evidence:** Docker re-imported the sanitized SVG, p5.js, C2.js, C2.js Interactive, Three.js, and A-Frame set into disposable `@cfornesa`, preserving canonical slugs/public IDs and current immersive/download capabilities. `referenceImport.spec.ts` passed `1/1` at desktop and mobile profile sizes with canonical card links and explicit fallback-thumbnail semantics before capture.
- **Dependent surface evidence:** the same closed source/runtime contracts passed the six-engine regular (#607), immersive (#608), offline download (#609), editor (#618/#620), chrome-less embed (#615), and real-thumbnail/profile (#602) matrices.
- **Repository evidence:** focused importer tests passed `2/2`; full repository checks passed backend `1436 passed, 39 skipped`, frontend `2734 passed`, lint, format, typecheck, and action-pin checks.
- **Safety boundary:** imported rows and thumbnails remained disposable Docker evidence; no shared, development, production, or Replit database was written.
- **GitHub evidence:** [final QA reconciliation and closure](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/612#issuecomment-5738425198).
- **Next action:** process the remaining parent route containers and run the required production-readiness gate only after the backlog is reconciled.

### Transaction ledger — #618 2D AI editor modes — 2026-09-19

- **Phase:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`.
- **Implementation:** commits `0aa2aba` and `8d98cc9`; the existing source-preserving editor now exposes explicit 2D engine/family identity and a source-only preview boundary, while the regression contract reflects immersive support for all registered engines.
- **Browser evidence:** Docker Chromium `artPiece2dEditor.spec.ts` passed `1/1` at 1280x900 and 375x812 for SVG and C2.js Interactive, covering canonical owner routing, engine identity, fake-provider revision preview, and immutable version-2 save/current-version state. Clean disposable runs also passed the capability/recovery suite `2/2`, including cross-user denial and crash recovery.
- **Repository evidence:** full `make check` passed with backend `1436 passed, 39 skipped` and frontend `2734 passed`; lint, format, typecheck, and action-pin checks passed.
- **QA provenance:** Codex/GPT-5 substitution for the rostered implementation and Claude Sonnet 5 Medium QA stages; Stage 3 independent-family review unavailable.
- **Safety boundary:** no shared, development, production, or Replit database was written; Docker fixtures were disposable.
- **GitHub evidence:** [QA PASS and closure](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/618#issuecomment-5738345654).
- **Next action:** continue with #620's explicit Three.js/A-Frame 3D editor mode, then reconcile #610 after both editor children are complete.

### Transaction ledger — #620 3D AI editor modes — 2026-09-19

- **Phase:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`.
- **Implementation:** commit `0760010`, building on the explicit family/engine identity hooks in `0aa2aba`; Three.js and A-Frame now have dedicated browser acceptance coverage for the shared 3D AI-editor mode without source coercion.
- **Browser evidence:** Docker Chromium `artPiece3dEditor.spec.ts` passed `1/1` at 1280x900 and 375x812 for both engines, covering canonical owner routing, stable engine identity, authored preview canvas rendering, fake-provider revision generation, and immutable version-2 save/current-version state. Existing immersive runtime evidence covered authored Three.js/A-Frame camera and input behavior; non-owner denial passed in the owner-editing suite.
- **Repository evidence:** the same implementation gate passed backend `1436 passed, 39 skipped`, frontend `2734 passed`, lint, format, typecheck, and action-pin checks.
- **QA provenance:** Codex/GPT-5 substitution for the rostered implementation and Claude Sonnet 5 Medium QA stages; Stage 3 independent-family review unavailable.
- **Safety boundary:** no shared, development, production, or Replit database was written; Docker fixtures were disposable.
- **GitHub evidence:** [QA PASS and closure](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/620#issuecomment-5738356043).
- **Next action:** reconcile the #610 editor parent, then continue with the chrome-less embed/card/slug surfaces (#615, #602, #616, #601/#600) and rerun #612's complete acceptance matrix.

### Transaction ledger — #615 chrome-less embed parity — 2026-09-19

- **Phase:** `GROOMED → ENGINEERING → QA → RECONCILIATION → CLOSED`.
- **Implementation/evidence:** commit `600d793` adds the missing six-engine embed matrix against the shared chrome-less viewer; no duplicate runtime or weakened sandbox path was needed.
- **Browser evidence:** Docker Chromium `artPieceSixEngineEmbed.spec.ts` passed `1/1` at 1280x900 and 375x812 for SVG, p5.js, C2.js, C2.js Interactive, Three.js, and A-Frame. All rendered in the shared sandbox iframe, application chrome was absent, controls remained capability-gated, and C2 Interactive pointer input updated in-frame. Existing regular embed boundary tests passed `3/3`.
- **Repository evidence:** the same surface gate passed backend `1436 passed, 39 skipped`, frontend `2734 passed`, lint, format, typecheck, and action-pin checks.
- **QA provenance:** Codex/GPT-5 substitution for the rostered implementation and Claude Sonnet 5 Medium QA stages; Stage 3 independent-family review unavailable.
- **Safety boundary:** no shared, development, production, or Replit database was written; Docker fixtures were disposable.
- **GitHub evidence:** [QA PASS and closure](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/615#issuecomment-5738380757).
- **Next action:** continue with shared cards/thumbnails (#602), canonical slugs (#616), then reconcile parent containers and rerun #612's complete acceptance matrix.

### Transaction ledger — #610 editor integration parent — 2026-09-19

- **Phase:** `RECONCILIATION → QA → CLOSED`.
- **Parent evidence:** #618 and #620 are closed with their own browser/QA matrices; together they cover all requested generated engines, explicit 2D/3D editor routing, source-only boundaries, immutable revisions, capability/version preservation, provider/crash recovery, and owner authorization.
- **Repository evidence:** the shared full gate passed backend `1436 passed, 39 skipped`, frontend `2734 passed`, lint, format, typecheck, and action-pin checks.
- **Safety boundary:** no shared, development, production, or Replit database was written.
- **GitHub evidence:** [parent QA reconciliation and closure](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/610#issuecomment-5738384428).
- **Next action:** continue with shared cards/thumbnails (#602), canonical slugs (#616), then rerun #612's complete cross-surface acceptance matrix.

### Transaction ledger — #616 canonical generated-piece slugs — 2026-09-19

- **Phase:** `GROOMED → QA → RECONCILIATION → CLOSED`.
- **Browser evidence:** after the prior Docker-unavailable boundary, fresh Docker Chromium `canonicalArtPieceSlug.spec.ts` passed `1/1` at 1280x900 and 375x812. A published SVG rendered at `/users/@<handle>/pieces/<slug>`, and `/art-pieces/p/<public_id>` remained a functional UUID compatibility shim.
- **Repository evidence:** backend canonical slug/race/persistence coverage passed `29/29`; the current full gate passed backend `1436 passed, 39 skipped`, frontend `2734 passed`, lint, format, typecheck, and action-pin checks.
- **Evidence note:** the legacy profile/gallery suites carry stale long-lived Docker fixture assumptions (duplicate titles and profile metadata); the isolated fresh-fixture route gate was used for this issue's browser criterion.
- **Safety boundary:** no shared, development, production, or Replit database was written; Docker fixtures were disposable.
- **GitHub evidence:** [QA PASS and closure](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/616#issuecomment-5738403281).
- **Next action:** continue with shared cards/thumbnails (#602), then reconcile parent route containers and rerun #612's complete cross-surface acceptance matrix.

### Transaction ledger — #602 shared cards and six-engine thumbnails — 2026-09-19

- **Phase:** `GROOMED → QA → RECONCILIATION → CLOSED`.
- **Browser evidence:** Docker Chromium `artPieceSixEngineThumbnails.spec.ts` passed `1/1`; the real editor capture path replaced fallback thumbnails for SVG, p5.js, C2.js, C2.js Interactive, Three.js, and A-Frame, and canonical-slug profile cards rendered the six captured images at 1280x900 and 375x812. Prior focused card/profile/gallery coverage passed `32` cases.
- **Repository evidence:** current full gate passed backend `1436 passed, 39 skipped`, frontend `2734 passed`, lint, format, typecheck, and action-pin checks.
- **QA provenance:** Codex/GPT-5 substitution for the rostered implementation and Claude Sonnet 5 Medium QA stages; Stage 3 independent-family review unavailable.
- **Safety boundary:** no shared, development, production, or Replit database was written; Docker fixture captures were disposable.
- **GitHub evidence:** [QA PASS and closure](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/602#issuecomment-5738418990).
- **Next action:** rerun #612's complete cross-surface acceptance matrix against the now-closed runtime, embed, editor, slug, card, and thumbnail contracts, then reconcile the remaining parent route containers.

### Ledger reconciliation note — 2026-09-19

- The #612 final importer/profile closure was recorded above when its GitHub
  gate completed; the later #618, #620, #615, #610, #616, and #602 entries
  document the remaining dependent closures that supplied that final evidence.
- Current local closure set: #602, #607, #608, #609, #610, #612, #615,
  #616, #618, and #620. Production-readiness and session-completion remain
  intentionally pending until the remaining parent route containers and
  deployment evidence are reconciled.

### Transaction ledger — remaining parent/container reconciliation — 2026-09-19

- **Phase:** `RECONCILIATION → QA → CLOSED` for #600, #601, and #619.
- **Evidence:** #619 reconciles the explicit Three.js/A-Frame parent against
  #620; #601 reconciles owner-only editor routing against #605/#616/#618/#620;
  #600 reconciles canonical custom slugs and UUID compatibility against #616
  and the shared card/profile/gallery surfaces. All inherited browser and full
  repository gates are recorded in their child ledgers above.
- **GitHub evidence:** #619 [reconciliation](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/619#issuecomment-5738432810), #601 [reconciliation](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/601#issuecomment-5738433026), and #600 [reconciliation](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/600#issuecomment-5738433378).
- **Safety boundary:** no shared, development, production, or Replit database was written.
- **Next action:** run task-distillation reconciliation, then production-readiness and session-completion against the now-empty project backlog; deployment/republish remains a separate evidence gate.

### Task-distillation and readiness handoff — 2026-09-19

- **Manifest reconciliation:** GitHub open-issue enumeration returned no
  remaining issues. The manifest's actionable slices are terminal and each has
  a linked implementation/QA/closure record; no duplicate or uncovered
  product issue was discovered in this pass.
- **Durable memory:** `.agents/memory/immersive-flat-engine-presentation.md`
  records the six-engine flat immersive presentation contract and was indexed
  in `.agents/memory/MEMORY.md`.
- **Production-readiness status:** `BLOCKED` as a workflow/model gate, not a
  product defect. The required `production-readiness` stage is restricted to
  Opus 5 or Sonnet 5; neither is available in this session, so no readiness
  verdict or republish recommendation is claimed.
- **Exact next action:** resume this goal on a host exposing the rostered Opus
  5 or Sonnet 5 model, run production-readiness across local/approved-browser/
  CI/Replit publication dimensions, then run session-completion. Do not
  republish before that gate.

### Workflow authorization update — 2026-09-18

- **Owner authorization:** the owner explicitly approved the active Codex/GPT-5
  runtime as a session substitution for the unavailable rostered Claude Opus
  5/Sonnet 5 production-readiness tier.
- **Documentation:** `DISPATCH.md`, the shared handoff contract, both skill
  mirrors for production-readiness/backlog-session/session-completion, and
  `DECISIONS.md` now permit and require explicit recording of this substitution.
- **Next action:** rerun task-distillation reconciliation, then the complete
  backlog-session/readiness/session-completion pass under the newly authorized
  routing. No Replit or shared-database write is implied by this authorization.

### Task-distillation reconciliation — 2026-09-18

- **Manifest/status:** GitHub open-issue enumeration is empty; the processed
  piece-surface issue set remains terminal and no duplicate product issue was
  discovered. The current worktree is clean after the workflow-documentation
  commit.
- **CI classification:** run `35303359231` failed on pushed SHA
  `06283704d3ef06d8c1647045320cac039f556489` with the same
  `unique_project_public_slug_per_owner` collision family previously owned by
  closed #419/#596. The current checkout already contains #596's retry fix
  (`9da07be`); this stale pre-fix run is not evidence of a current defect, and
  no new issue was created or closed history reopened.
- **Local evidence:** `make compose-preflight` passed for the repository-owned
  Docker stack; backend/frontend health and root probes returned healthy/200;
  `UV_CACHE_DIR=/tmp/codex-uv-cache NPM_CONFIG_CACHE=/tmp/codex-npm-cache make check`
  passed with backend `1436 passed, 39 skipped` and frontend `2734 passed`.
- **Next groomed action:** publish the current committed revision to the
  repository remote so CI evaluates the actual fixed checkout, then inspect
  that run before assigning the readiness CI dimension. No Replit or shared
  database write is implied.
