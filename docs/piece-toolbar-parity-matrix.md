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
