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

## Addendum — layered AI workflow and unified editor (#656–#671)

Owner request: `@` layer/asset targeting, plan then implementation, a
user-configurable self-improvement retry loop with stored code, one editor for
AI and manual work, and edits reflected in every output. Existing new-only rule
still applied.

Audit: structured editors already have a plan-validate-revise run service
(#461) and an `AIRetryPreference` (#266), but `ai_runs.py` ignores the
preference and validates schema only; plans carry no success criteria; targeting
is a checkbox list of shapes; generated art pieces have only whole-piece
regenerate; editors are split (`projects` vs `ai-projects`, `projects3d` vs
`ai-projects3d`); no visitor drawing was found for `c2js-interactive`.

| Order | Issue | Routing |
|---|---|---|
| 1 | #656 plan with success criteria | 2b |
| 2 | #657 evaluate vs plan, honor retry preference | 2b (needs #656) |
| 3 | #658 generated-piece refine backend, stored versions | 2b |
| 4 | #664 / #665 merge 2D / 3D AI+manual editors (Rule 5 redirects need owner confirmation) | 2a |
| 5 | #659 / #660 plan review UI 2D / 3D (need #656, #657) | 2a |
| 6 | #661 / #662 `@` targeting 2D / 3D | 2a |
| 7 | #663 art-piece editor refine UI (needs #658) | 2a |
| 8 | #666 per-engine tool capability matrix | 2a |
| 9 | #667 / #668 manual tools for generated 2D / 3D pieces (need #666) | 2a |
| 10 | #669 real-time preview | 2a |
| 11 | #670 public temporary drawing on C2.js Interactive | 2a |
| 12 | #671 edit-to-output evidence matrix (needs 3, 4, 9) | stage 4 |

Already covered, not re-filed: engine integration into AI editors (#610,
#618–#620), runtime/immersive/download parity for six engines (#607–#609),
collection immersive parity (#639). Verification boundary: reference repos read
as source only; no live provider was run.

## Addendum — owner UI review of the running app (#673–#683)

Owner screenshots (2026-09-21) showed the AI assistant panel, header, and
account settings still unstyled and not mobile-ready. Prior closures (#574
arrow-only reorder, #644 toggle, #645/#648 header/hero) stay closed; the gaps
are new issues. Key finding: Pareto/Celestial are seeded but
`SiteSettings.style` defaults to null, so the reference look never appears
unless an admin selects it (#675).

| Order | Issue | Routing |
|---|---|---|
| 1 | #673 remove Home link; Studio/Public gallery entry | 2a |
| 2 | #674 header chrome: one mode control, responsive toolbar | 2a |
| 3 | #675 default site style resolution | 2b |
| 4 | #676 apply site style to Studio/editors/account (needs #675) | 2a |
| 5 | #677 account-settings drag handle + dashed placeholder | 2a |
| 6 | #678 / #679 2D / 3D AI panel full-width fields, mobile | 2a |
| 7 | #680 account-settings spacing tokens; #681 admin spacing (needs #680) | 2a |
| 8 | #682 profile-settings load error diagnosis | 2b or 2a |
| 9 | #683 vivid-design evidence matrix (needs 1–8) | stage 4 |

Verification boundary: #682's cause is unclassified until reproduced.
