---
name: structured-3d-scene-vs-artpiece-engine-code-models
description: The PHP reference's html_code/css_code/js_code "engine" pattern (p5/canvas2d/svg/three/aframe) belongs to the generative ArtPiece sandbox, not the structured Project3D/Scene3DPreview editor — don't cite it as precedent for a Scene3D Code-tab redesign.
metadata:
  type: project
---

Discovered 2026-09-28 while scoping #1035 (3D editor HTML/CSS/JavaScript Code
sub-tabs). #1035's body cited `augment-humankind`/`augment-humankind-react-node`
as "the reference standard" for a 3D HTML/CSS/JS code view — this is only
half right and points at the wrong feature.

**What the PHP reference actually has:** one unified piece model across every
`engine` value (`p5`, `canvas2d`, `svg`, `three`, `aframe`), each represented
as free-text `html_code`/`css_code`/`js_code` fields edited in three tabs
(`augment-humankind/public/app/config/art-starter-templates.php`,
`.../views/admin/pieces/form.php`). For `three`/`aframe`, the "3D-ness" lives
entirely inside hand-written JS (`window.sketch = (runtime) => {...}`) or,
for `aframe`, declarative `<a-scene>` markup inside the HTML field. There is
no structured, schema-validated 3D scene format in the PHP reference at all
— it's free-form code per engine, same as 2D.

**What this maps to in ai-dev-tools-zoomcamp-1:** the PHP pattern's true
counterpart is the **generative ArtPiece sandbox**
(`ArtPiece`/`ArtPieceVersion`, `frontend/src/pages/ArtPieceEditor.tsx`,
`frontend/src/generative/`), which already supports `threejs`/`aframe` as
engines — but this codebase made a deliberate, already-shipped
simplification: `ArtPieceVersion.source` is one combined `TextField`
(`backend/scenes/models.py:2148`), edited in a single `<textarea>`
(`ArtPieceEditor.tsx:971`), not three separate fields/tabs. See
[[3d-rendering-npm-dependency-vs-cdn-sandbox]] for the related but distinct
npm-vs-CDN-sandbox boundary within this same ArtPiece domain.

**The structured `Project3D`/`Scene3DPreview` editor (schema-validated
camera/lights/objects/materials JSON, `schema/scene3d.schema.json`) has no
PHP-reference equivalent whatsoever.** Its actual intra-repo precedent is
this codebase's own 2D structured editor: `Project`/`Scene`,
`frontend/src/export/codeGrammar.ts`, and `EditorWorkspace.tsx`'s
JSON/HTML/CSS/JS Code tab — which splits a structured 2D scene into
shape-geometry (HTML+CSS) vs. behavior/interactivity (JS: hand-tracking
bindings + a behavior graph). `schema/scene3d.schema.json` has **no
behavior/graph/binding concept at all** — a 3D "JS" tab has no natural
content to mirror 2D's, and needs its own design decision (candidates: an
editable camera/renderer config block, an immutable placeholder reserved for
future interactivity, or dropping the JS tab requirement for 3D). Don't
assume the 2D JS-tab content maps over unchanged.

**How to apply:** when scoping "bring 3D [feature] to parity with 2D" work,
check which of these two 3D systems (structured `Project3D` editor vs.
generative `ArtPiece` `threejs`/`aframe` engine) is actually meant before
citing either the PHP reference or the 2D `codeGrammar.ts` pattern as
precedent — they are not interchangeable, and a screenshot of
`Project3DWorkspace`'s "Scene3D JSON" tab is the structured editor, not the
ArtPiece sandbox.

**Related, already-shipped work that doesn't fulfill this:** #1013's closed
children (#1025/#1026/#1027) built `frontend/src/export/codeGrammar3d.ts`,
which generates one combined editable text blob for the whole 3D scene (not
HTML/CSS/JS-shaped output) and is unwired into any UI. Per this repo's
closed-issues-are-immutable rule, that work was not reopened; #1035 was
instead reworded to build fresh HTML/CSS/JS-shaped generators rather than
adapting `codeGrammar3d.ts`'s single-blob shape.
