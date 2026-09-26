# Piece toolbar parity matrix

Issue #765. This is the oracle for every stage-toolbar issue
(#752–#756, #761, #766–#769, #773). It records which buttons each surface
shows, in what order, and the capability that gates each one. It is derived
from the PHP reference (read-only) and the owner's 2026-09-24 decisions.

Sources (line references at the time of writing):
`../augment-humankind/public/app/views/partials/piece-stage.php` (regular
stage; buttons L62-L174, gates L24-L38),
`public/app/helpers/immersive-chrome.php` (`immersive_stage_toolbar_markup`,
L643+), `public/app/helpers/piece-render.php`
(`piece_sound_capability_contract`, L533+), and `docs/piece-surface-parity.md`.

## Owner decisions that shape this matrix

- **Order (PHP order, Fullscreen last):** Screenshot, Download, Immersive/VR,
  Sound, Piece controls, Hand gesture guide, engine-specific tools (for
  example the C2.js Interactive drawing tools), Fullscreen.
- **Style:** icon-only buttons; on hover-capable desktop pointers a
  contextual label appears on hover and keyboard focus; touch shows none;
  every button keeps an `aria-label`.
- **Downloaded ZIPs** omit Download and Immersive/VR (they are already
  downloaded and offline).
- Applies to private (owner) and public regular views alike (#773).
- Layout (#752): Fullscreen is the last button of the icon row; engine tools
  such as the C2.js Interactive drawing controls sit in their own row directly
  beneath the icon row, so the icon row stays one compact line.

## Capability gates (PHP `piece_sound_capability_contract`)

| Gate                                           | Rule                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `sound`                                        | The piece has sonic parameters and they are not disabled. No sonic content means no Sound button. |
| `camera_view`                                  | Defaults ON for every engine (visitor-activated); an explicit per-piece Off removes it.           |
| `hand_control`                                 | Defaults ON; explicit Off (or a camera-free ZIP) removes it.                                      |
| Piece controls panel                           | Present when `sound` or `camera_view` or `hand_control`.                                          |
| Hand guide                                     | Present when `hand_control`.                                                                      |
| Screenshot, Download, Immersive/VR, Fullscreen | Always present on live surfaces (a piece with code).                                              |

Panel contents (all inside the single Piece controls popover, never separate
toolbar buttons): volume, keyboard notes, live mic (`sound`); camera theremin
(hand tracking voice); Steer the piece (`hand_control`); Show camera and
opacity (`camera_view`).

**Divergence (this repo, #766):** the PHP contract defaults camera view and hand
control ON when unset. Here they are explicit per-version author capabilities
(the editor's Camera view and Hand steering checkboxes), so a button appears only
when its capability is enabled. Steer lives inside the Piece controls popover
(never its own toolbar button), and the popover exists whenever sound, microphone,
keyboard, camera view, or hand steering is enabled, and always on immersive surfaces
(it holds Reset view, which a walkable piece must always offer).

## Matrix

Legend: ● present, ○ present only when its gate is on, — never.

| Button (in order)                  | Regular                                                                          | Embed | Immersive             | Immersive embed | Regular ZIP | Immersive ZIP |
| ---------------------------------- | -------------------------------------------------------------------------------- | ----- | --------------------- | --------------- | ----------- | ------------- |
| 1 Screenshot                       | ●                                                                                | ●     | ●                     | ●               | ●           | ●             |
| 2 Download (Full / Non-Camera ZIP) | ●                                                                                | ●     | ●                     | ●               | —           | —             |
| 3 Immersive / VR                   | ●                                                                                | ●     | — (already immersive) | —               | —           | —             |
| 4 Sound                            | ○ sound                                                                          | ○     | ○                     | ○               | ○           | ○             |
| 5 Piece controls                   | ○                                                                                | ○     | ○                     | ○               | ○           | ○             |
| 6 Hand gesture guide               | ○ hand                                                                           | ○     | ○                     | ○               | ○           | ○             |
| 7 Engine tools                     | C2.js Interactive: Draw, Pencil, Brush, Eraser, colours, size, Undo, Redo, Clear | same  | same                  | same            | same (#757) | same (#758)   |
| 8 Fullscreen                       | ●                                                                                | ●     | ●                     | ●               | ●           | ●             |

Notes:

- Non-Camera ZIPs drop the camera and steering rows from Piece controls and
  the hand guide (camera-free export).
- The PHP immersive toolbar groups its controls in a left group (view, VR,
  screenshot, download) and a right group (sound, panel trigger); the owner
  chose one ordered group with Fullscreen last for both repositories.
- Engine differences do not change the button set. Engines differ only in
  panel contents and defaults: Three.js and A-Frame default the camera to a
  background quad; p5.js, C2.js, C2.js Interactive, and SVG default to an
  overlay; steering on flat engines uses the lazy spatial shell, and C2.js
  Interactive keeps authored pointer input while steering.
- Structured pieces (2D and 3D Project rows) follow the same rows.
  Structured 2D has no immersive surface today.
- The `static=1` immersive embed is intentionally bare and exempt.

## Per-engine cells

| Engine            | Camera default | Steer                | Engine tools                                         |
| ----------------- | -------------- | -------------------- | ---------------------------------------------------- |
| Three.js          | background     | ●                    | none                                                 |
| A-Frame           | background     | ●                    | none                                                 |
| p5.js             | overlay        | ● (framed sleep)     | none                                                 |
| C2.js             | overlay        | ● (framed sleep)     | none                                                 |
| C2.js Interactive | overlay        | ● (pointer retained) | Draw toolset                                         |
| SVG               | overlay        | ● (framed sleep)     | none                                                 |
| Canvas2D          | overlay        | ●                    | none                                                 |
| Structured 2D     | per renderer   | ○                    | none                                                 |
| Structured 3D     | background     | ●                    | (drawing plane tools appear only in Draw mode, #781) |

## Change control

Any button-set or order change edits this file in the same change and cites
the issue. Closed issues stay closed; contradictions become new issues.

ZIP exports (#755/#756): Reset view is an icon in the toolbar (engine-tool slot, row 7) because a
downloaded piece has no separate route to recover its view; mic, camera, and Steer sit in the
Piece controls popover; the hand guide appears only when steering is enabled.

Structured 3D pieces on the A-Frame renderer (#772) show Screenshot, Download, Immersive, and
Fullscreen. Sound, Piece controls (camera preview), and Steer are Three.js-only today, so they are
absent rather than shown non-functional.

## 2026-09-26 reference and current-app audit (#908)

This dated audit is the change-controlled evidence layer for issue #908. It does not change the
owner-approved end-state rows above. The reference repositories were inspected read-only at the
working-tree revisions available on 2026-09-26; current-app observations were made in the rebuilt
local Compose stack in Chrome at both 1280x900 and 375x812. The browser evidence is local only and
does not establish production readiness.

### Surface coverage

| Surface | Current-app route(s) inspected or resolved in source | Reference contract | Current observation | Follow-up |
| --- | --- | --- | --- | --- |
| Public regular generated | `/users/:handle/pieces/:slug`, `/art-pieces/:id` | Shared regular toolbar; title/description precede stage | C2.js renders the shared icon toolbar, `By Christopher Fornesa (@cfornesa)`, and no directional pad | #892, #904 |
| Public regular structured 2D/3D | `/p/:id`, `/p3d/:id`, canonical resolver | Same regular toolbar; engine capability gates navigation | Structured routes resolve through `PublicProjectViewer` / `PublicProject3DViewer` and use `PieceStageToolbar` | #892, #899 |
| Owner/private outside edit | `/users/:handle/pieces/:slug` when owner; `/art-pieces/p/:id` | Public stage remains public-shaped; owner-only actions are outside the stage toolbar | No separate owner-only toolbar contract was found; edit-mode actions are in editor routes | #908 finding; #862 validity coverage |
| Regular embed | `/embed/art-pieces/:id`, structured embed routes | Same regular stage controls, including Download and Immersive/VR; `static=1` is bare | `PieceStageToolbar` is reused by public project and art-piece viewers; extracted ZIP/embed parity remains separately unverified | #892, #898, #903 |
| Public immersive generated | `/users/:handle/immersive/:slug`, `/art-pieces/immersive/:id` | Shared immersive toolbar; 2D is a gallery, 3D is a walkable world | C2.js immersive route renders a 2D gallery with Screenshot, Download ZIP, Piece controls, Fullscreen and no 3D directional controls | #893, #907 |
| Structured 2D editor shell | `/users/:handle/edit/:slug` | File, Save, Ask AI, view/zoom controls precede the responsive authoring toolbar; authoring tools are page controls, not canvas overlay controls | #951 keeps the primary actions together, exposes the authoring toolbar inline on desktop, and uses an accessible Editor tools disclosure on narrow layouts | #951 |
| Immersive embed (Custom/CMS) | `/embed/art-pieces/immersive/:id`, `?cms=1` | Shared immersive renderer; page actions are below the stage; `static=1` bare | Separate embed snippet panels are implemented in `ImmersiveArtPieceViewer`; exact reference parity remains open | #898, #907 |
| Immersive structured 3D | `/immersive/p3d/:id`, canonical structured immersive | Walkable freeform 3D world with native navigation and immersive controls | Route uses `ImmersiveProject3DViewer` and `Scene3DPreview`; browser proof and structured toolbar parity remain open | #899 |
| Immersive collection | `/users/:handle/collections/:slug/immersive`, legacy collection route | Gallery/room navigation with shared stage actions | `CollectionImmersiveViewer` and `PublicCollection` provide the route and navigation shell; collection fixture/browser proof is still required | #904 |
| Regular ZIP | generated Full and Non-Camera archives | Extracted regular stage toolbar; no Download or Immersive/VR inside archive | Bundle/runtime sources exist; no closure-grade extracted-archive evidence recorded yet | #903 |
| Immersive ZIP | generated flat and 3D archives | Extracted immersive toolbar; flat gallery vs. 3D world; no Download/VR inside archive | Bundle/runtime sources exist; no closure-grade extracted-archive evidence recorded yet | #902, #901 |

## 3D-only navigation gate

Immersive presentation uses the owner's selected **gallery-by-default** policy:

- Flat engines (p5.js, C2.js, C2.js Interactive, SVG, and Canvas2D) render as
  responsive, letterboxed 2D galleries and do not expose directional arrow-pad
  or spatial-camera controls by default.
- Three.js and A-Frame retain native keyboard, pointer/touch, and immersive
  directional navigation because their authored content is a real 3D world.
- The synthetic spatial shell remains available only when an author explicitly
  enables the `hand_steering` capability through Piece controls. That opt-in is
  separate from the default flat gallery presentation and must be preserved in
  generated downloads.

Decision: #900, owner direction recorded 2026-09-26. Re-check consumers in
#893, #898, #899, #901, #902, and #907 against this gate before closure.

### Reference comparison and discrepancy classification

The PHP reference exposes grouped immersive chrome from `augment-humankind/public/app/helpers/immersive-chrome.php` (`immersive_stage_toolbar_markup`, around L643) and the regular stage from `public/app/views/partials/piece-stage.php`. The React reference exposes the shared `PieceStageControls` in `augment-humankind-react-node/apps/web/src/main.tsx` (around L437-L732), with source assertions in `apps/web/src/piece-surface.test.ts` (toolbar order, immersive device controls, and narrow-stage hiding).

| Discrepancy or decision | Classification |
| --- | --- |
| Reference immersive chrome includes exit, camera, microphone and device-orientation affordances that are not in the owner-approved compact matrix | Owner decision / #908 audit finding; implementation is routed through #900 and the generated immersive children, not silently folded into #892 |
| Reference regular embed is a regular stage; Custom/CMS immersive embed is the immersive renderer; `static=1` is bare | Already represented by #898 and #907; no duplicate issue |
| Flat immersive pieces must be galleries while Three.js/A-Frame pieces remain walkable worlds | Existing #893 and #899; local C2 evidence confirms gallery behavior |
| Collection immersive route needs a real collection fixture and browser evidence | Existing #904; no new issue created |
| Structured routes and private-owner viewing need route-level evidence | Existing #862/#908 scope; no duplicate issue created |
| Downloaded ZIPs need extracted HTTP-served evidence, not live-route evidence | Existing #901/#902/#903 and memory topic `parity-closure-evidence-gap`; no duplicate issue created |
| Public attribution must be `By {display name} (@{handle})`, with handle fallback and no duplicate `@` | Closed #897; #904 remains open for collection/browser evidence |

### Evidence boundary

The dated local browser observations above are intentionally separated from production evidence.
They support implementation/QA routing only. No production URL, Replit database, published revision,
or production download is claimed by this audit.
