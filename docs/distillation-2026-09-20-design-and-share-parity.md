# Design, profile, theme, and share-thumbnail parity distillation — 2026-09-20

Provenance: Claude Code, Sonnet 5, Medium-equivalent effort (supported
`task-distillation` profile). Owner constraint for this pass: add new issues
only; no existing issue was edited, reopened, or closed.

## Evidence (local main `75666f6`, dev server on :5000)

- No color-mode toggle exists; `frontend/src/index.css` only reacts to
  `prefers-color-scheme`. `backend/scenes/theme.py` has one flat palette and
  no script font, shadow, or backdrop options. Neither "Pareto" nor
  "Celestial" (the reference site's built-in styles) exists here.
- `/` shows a centered title + buttons and the gallery form; no hero, no
  reference-style header.
- `GET /api/public/gallery/`: all generated pieces report
  `thumbnail_is_fallback: true`; the card shows the grey placeholder. Generated
  thumbnails only arrive via client upload (`art_piece_persistence.py`).
- `curl /art-pieces/p/<id>` shows no `og:*`/`twitter:*` tags; tags are set by
  `frontend/src/metadata.ts` in JavaScript, invisible to social crawlers.
- The local DB has no public profile for the visible owner, so the profile
  header layout was not rendered live; the profile issues use a fixture.

## Manifest (dependency order)

| Order | Issue | Class | Routing |
|---|---|---|---|
| 1 | #642 paired light/dark palettes | implementation-defect | 2b |
| 2 | #643 script font / shadow / backdrop tokens | implementation-defect | 2b + 2a |
| 3 | #644 mode toggle | implementation-defect | 2a |
| 4 | #645 reference-style header | implementation-defect | 2a |
| 5 | #646 Pareto preset (needs #642, #643) | implementation-defect | 2b |
| 6 | #647 Celestial preset (needs #642, #643) | implementation-defect | 2b |
| 7 | #648 home hero | implementation-defect | 2a |
| 8 | #649 profile header | implementation-defect | 2a |
| 9 | #650 profile collections/pieces cards | implementation-defect | 2a |
| 10 | #651 generated 2D thumbnails | implementation-defect | 2b |
| 11 | #652 generated 3D thumbnails | implementation-defect | 2b |
| 12 | #653 piece OG/Twitter meta | implementation-defect | 2b |
| 13 | #654 profile/collection/home OG meta (reuses #653 helper) | implementation-defect | 2b |
| 14 | #655 design-scheme evidence matrix (needs #642–#650) | QA only | stage 4 |

## Already covered (not re-filed)

Canonical routes and piece/collection surface parity: #636–#641. Profiles,
style catalog, cascades: closed #520, #521, #552, #576, #577. Shared card
component and structured-scene thumbnails: closed #393, #438, #602–#604. The
Share/Embed control row on piece pages is inside #637/#638, so no separate
share-button issue was filed.

## Blockers and verification boundaries

- No blocker requires a new issue beyond the above. `verification-boundary`:
  live augmenthumankind.com was inspected only through the owner screenshot;
  the sibling repos were read as source-only references, not run.
- #646/#647 add seed migrations: follow
  `.agents/memory/replit-production-schema-publishing.md`.
- #643 adds self-hosted fonts: Rule 8 note in `docs/dependencies.md`.
