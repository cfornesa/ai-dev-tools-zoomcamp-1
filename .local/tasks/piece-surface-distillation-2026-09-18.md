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
| 14 | [#612](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/612) | Import sanitized reference pieces into `@cfornesa` and verify all surfaces | stage 2b complex | #600, #602, #606–#611 | DEPENDENCY-BLOCKED |

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

- **Dependency-blocked:** #612 must wait for #600, #602, #606–#611. It must
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

## Handoff completeness

Every actionable request item has one issue, a fixed entry point or capability
boundary, finite acceptance criteria, exact focused checks, a routing hint, and
an explicit out-of-scope boundary. The import issue is intentionally last so
that rendering verification uses the final schema, slug, capability, runtime,
editor, and card contracts.
