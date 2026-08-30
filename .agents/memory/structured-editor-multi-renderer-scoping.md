---
name: structured-editor-multi-renderer-scoping
description: Scoping investigation (issue #205) for extending the structured scene editor itself to Canvas2D/SVG renderers, distinct from the separate raw-code AI art-piece flow #197 decided on.
metadata:
  type: project
---

The repository owner asked for the *main structured scene editor* (Layers,
shapes, bindings, graph, camera tracking — not the separate AI
art-piece-studio flow) to become library-specific, i.e. support more than
one rendering library for the same canonical scene-JSON model. This is
distinct from [[multi-library-generation-architecture-fork]] (issue #197),
which explicitly kept the structured editor p5.js-only and put multi-library
support only in a separate, simpler, raw-code generation flow (tasks
165-169) — this new epic (issue #205) takes on the harder option #197
declined, deliberately, for the core editor.

**Why this is legitimate planned scope, not invented:** `docs/plan.md`'s
"Renderer selection" section and "V2 roadmap candidates" have always
documented "SVG and C2.js parity/expanded renderer support" as the plan.
`frontend/src/export/exportCompatibility.ts`'s `RENDERER_CAPABILITIES`/
`checkRendererCompatibility` were deliberately built data-driven rather than
hardcoded, specifically anticipating this — see that file's own doc
comment, which says adding a new renderer entry is "all a future task
needs to do to make this check meaningful."

**Key investigation findings (2026-08-28, issue #205):**

- `behaviorRuntime.ts`/`particleSystem.ts`/`trailSystem.ts` are already
  renderer-agnostic (plain-data computation). `scenes/thumbnails.py`
  (backend PNG thumbnails) already renders via Pillow directly, independent
  of the live-editor renderer — **no backend work needed for this epic.**
- The live-render interface (`P5ScenePreview`) is narrow enough
  (`render`/`destroy`/`getCanvasElement`) that a per-renderer adapter swap
  shouldn't require rewriting `EditorWorkspace.tsx`/`PublicProjectViewer.tsx`.
- **Native Canvas2D is the cheapest second renderer**: p5's own camera-overlay
  code already calls `context.drawImage` directly on the underlying native
  `CanvasRenderingContext2D` — near-direct reuse. No external CDN
  dependency needed either (unlike p5.js).
- **SVG is harder**: no native `drawImage`-equivalent compositing primitive
  for the camera overlay — needs a `<foreignObject>` hosting the real
  `<video>` element inline in the SVG DOM. Also needs a new
  thumbnail-capture mechanism, since `captureSocialThumbnail.ts` currently
  takes a raw `HTMLCanvasElement` from `getCanvasElement()` directly.
- **Three.js/A-Frame are a materially different, harder question**: the
  canonical schema's shape model is fundamentally 2D (no Z-depth, no 3D
  transforms/camera/lighting). Not a natural extension of the Canvas2D/SVG
  work — filed as its own decision issue (#208) rather than silently
  included or silently dropped.

**How to apply:** issues #206 (Canvas2D), #207 (SVG, depends on #206), and
#208 (3D-library decision) are filed under epic #205, phased in that
dependency order. None are implementation-ready yet — each needs its own PM
grooming pass before an engineer starts. Do not conflate this epic with
#197/tasks 165-169's raw-code art-piece flow; they are independent
features with independent architecture decisions, even though both involve
"which library" ideas.
