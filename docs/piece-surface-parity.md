# Art-piece surface parity matrix

This document is the local contract inventory for the generated-art-piece
surfaces requested in #599. It translates the read-only reference contract in
`../augment-humankind/docs/piece-surface-parity.md` and the maintained
`../augment-humankind-react-node` examples into the Django/React application.
The reference repositories remain examples, not code dependencies or sources
for copied implementation.

## Contract boundaries

The target engine set is **Three.js, A-Frame, p5.js, C2.js, C2.js
Interactive, and SVG**. The local persisted `ArtPiece.Engine` currently
contains only `canvas2d`, `svg`, `threejs`, and `aframe`; p5.js, C2.js, and C2
Interactive are therefore schema/runtime gaps, not silently supported values.

The requested canonical user-facing paths are:

| Surface | Target path | Current local/live state | Gap / owner |
|---|---|---|---|
| Regular public piece | `/users/@username/pieces/{name}` | UUID-oriented `/art-pieces/p/{id}`, `/p/{id}`, or engine-specific routes remain in use | URL migration, collision policy, compatibility redirects — [#600](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/600) |
| Immersive public piece | `/users/@username/immersive/{name}` | `/art-pieces/immersive/{id}` and `/immersive/p3d/{id}` exist; live 3D view is page-contained rather than viewport-filling | Full-screen route and redirect contract — [#606](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/606) |
| Owner editor | `/users/@username/edit/{name}` | `/art-pieces/{id}/edit` exists for the generated-piece workflow; studio cards still use public-view destinations | Owner-only route and edit affordance — [#601](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/601) |
| Regular embed | Route-specific chrome-less regular embed | `/embed/art-pieces/{id}` exists for generated pieces, but the canonical slug and six-engine contract are not complete | Regular/embed runtime and URL parity — [#607](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/607) |
| Immersive embed | Custom/CMS wrapper over the immersive runtime | `/embed/art-pieces/immersive/{id}` exists, but it inherits the bounded page-stage contract | Full-screen immersive wrapper and runtime parity — [#608](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/608) |
| Regular download | Portable regular piece | Existing generated/structured export paths cover only the current engine families | Six-engine artifact parity — [#609](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/609) |
| Immersive download | Portable immersive piece | Existing 3D export has an immersive mode, but the six-engine capability/runtime matrix is incomplete | Six-engine artifact parity — [#609](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/609) |

Every URL change must retain a permanent redirect or backward-compatible
resolver for the existing live/public-id routes. The redirect design and
slug-history policy are owned by #600; this matrix does not authorize changing
routes by itself.

## Engine capability matrix

The reference behavior below is a target contract. “Gap” means the local
application has not yet established the behavior for the requested engine and
surface; it is not permission to claim support by string matching or by
coercing the source into another engine.

| Engine | Regular live/embed | Immersive live/embed | Downloaded regular/immersive | Editor target | Local status |
|---|---|---|---|---|---|
| Three.js | Render the authored scene; background camera view; screenshot, sound, microphone, fullscreen, download, and bounded hand steering when capability-enabled | Full-screen camera travel/orbit/zoom/reset; shared overlay controls; explicit visitor permission | Bundled runtime and assets; preserve camera pose/navigation, capture, and capability gating | 3D AI editor with structured preview/revise/accept | Partially implemented; complete surface/runtime parity in [#607](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/607), [#608](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/608), [#609](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/609), [#610](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/610) |
| A-Frame | Render authored A-Frame scene and preserve camera/input ownership | Full-screen spatial view; model loading preserves authored transforms and reports actionable errors | Bundle A-Frame and model runtime; resolve GLB/media from extracted bundle | 3D AI editor without silent coercion to Three.js | Partially implemented; same linked runtime/editor issues as Three.js |
| p5.js | Canvas rendering with overlay camera composition, screenshot, sound, and explicit device activation | Lazy bounded spatial shell/room commands; no false “walk” instructions when unsupported | Bundle pinned p5 runtime and preserve overlay/capture behavior | 2D AI editor | Not in ArtPiece engine union; schema/runtime/editor gap — [#607](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1), [#608](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1), [#609](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1), [#610](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1) |
| C2.js | Canvas rendering with overlay camera composition and authored input preserved | Lazy spatial shell; immersive room commands; no input ownership loss | Bundle C2 runtime and preserve authored interaction | 2D AI editor | Not in ArtPiece engine union; same linked schema/runtime/editor issues |
| C2.js Interactive | Canvas rendering with authored pointer interaction; steering temporarily owns conflicting input and restores it | Immersive pointer/room interaction with explicit ownership rules | Preserve pointer behavior and remove only explicitly excluded device assets | 2D AI editor with an explicit interactive capability boundary | Not in ArtPiece engine union; same linked schema/runtime/editor issues |
| SVG | SVG rendering with overlay camera composition and screenshot of all visible layers | Framed/lazy spatial behavior or explicit N/A; camera overlay remains above artwork | Preserve SVG source and capture without corrupting encoded markup | 2D AI editor with source/layer boundary stated | Partially implemented; capture/runtime parity remains in [#607](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1), [#608](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/608), [#609](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/609) |

## Shared capabilities and safety rules

- Capabilities are persisted per version and are negotiated by the runtime;
  unset or unsupported features are unavailable with a reason.
- Sound, microphone, camera view, and hand steering require an explicit visitor
  gesture and browser permission where applicable. No surface opens a device on
  load.
- Camera overlays never intercept artwork input. Screenshots include every
  visible layer in on-screen stacking order, including an active camera layer.
- C2 Interactive must restore authored pointer input after steering ends.
- Three.js and A-Frame use bounded authored-pose-relative movement. Flat
  p5.js/C2.js/C2 Interactive/SVG surfaces must not show movement instructions
  unless their lazy spatial shell is actually active.
- Owner-only edit controls are separate from public regular/immersive links.
  Anonymous and non-owner responses must not leak prompts, source, drafts, or
  owner actions.
- Regular embed omits page chrome but retains the regular stage contract.
  Immersive Custom/CMS embeds retain the immersive runtime and differ only in
  wrapper/chrome behavior; resize must not remount the artwork.
- Downloaded bundles must use pinned or bundled assets, work from an extracted
  temporary server, and preserve the relevant live surface contract.

The schema, embeddability identifiers, capability fields, ordering constraints,
and production-safe migration sequence are owned by [#611](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/611).

## Surface-to-follow-up map

| Gap discovered by this inventory | Class | Follow-up |
|---|---|---|
| Canonical slug and redirect family | implementation-defect / irreversible URL change | [#600](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/600) |
| Owner editor route and author-only affordance | implementation-defect / authorization | [#601](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/601) |
| Empty/misplaced cards and real thumbnails | implementation-defect / visual contract | [#602](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/602), [#603](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/603), [#604](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/604), [#605](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/605) |
| Regular and embed runtime coverage | implementation-defect / schema + sandbox runtime | [#607](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/607) |
| Full-screen immersive presentation | implementation-defect / route and fullscreen boundary | [#606](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/606) |
| Immersive engine/input/device parity | implementation-defect / runtime lifecycle | [#608](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/608) |
| Regular/immersive offline artifacts | implementation-defect / packaging | [#609](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/609) |
| 2D/3D AI editor integration | dependency-blocked until engine schema is explicit | [#610](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/610) |
| Pieces/collections schema and embeddability | irreversible database/schema change | [#611](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/611) |
| Import and render existing pieces for `@cfornesa` | dependency-blocked verification workflow | [#612](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/612) |

## Verification contract for downstream issues

The local runner is responsible for executing focused tests, `make check`, and
the named Chromium E2E scenarios on a disposable PostgreSQL-backed Django/Vite
stack. Visual issues require rendered screenshots at 1280x900 and 375x812 plus
the named interaction from the user's entry point. Local evidence cannot claim
the exact published Replit revision; migration-bearing work additionally needs
direct production table inspection and the documented publish smoke procedure.

The final import in #612 must be idempotent, owner-scoped to `@cfornesa`,
reversible, sanitized, and verified across profile, regular, immersive, embed,
editor, and extracted download surfaces. It must not write to production merely
because a browser session is authenticated.
