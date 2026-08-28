---
name: multi-library-generation-architecture-fork
description: DECIDED (issue #197) — non-p5.js libraries (Canvas2D/Three.js/A-Frame/SVG) generate raw sandboxed code via a separate, simpler creation flow; p5.js's structured editor is unchanged. Gates issues #199 and #200.
metadata:
  type: project
---

This app's entire editor/render/export/AI pipeline is built around exactly one
renderer (p5.js) and one structured scene JSON schema (shapes/layers/groups/
behaviors, `schema/`, `scenes/validation.py`) —
`frontend/src/export/exportCompatibility.ts` documents this as "intentionally
narrow rather than aspirational." Extending AI-driven generation to Canvas2D,
Three.js, A-Frame, and SVG (epic [#196](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/196))
forces an explicit architecture decision, tracked in
[#197](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/197):

- Extend the structured scene model with a per-library schema and adapter
  (keeps existing validation/undo/injection-safety guarantees, but is heavy
  per-library engineering and may cap how creative AI output can be), or
- Generate raw code per library (far more flexible, but this app's existing
  injection-audit safety model, `frontend/e2e/injectionArtifacts.spec.ts`,
  assumes output is schema-constrained, not arbitrary AI-generated code — a
  raw-code path needs its own sandboxing story, e.g. a restrictive-CSP
  sandboxed iframe with no access to this app's own session/API surface).

**Why:** Every downstream issue (#199's generation/validation pipeline, #200's
downloadable bundle format) depends entirely on which path is chosen — the
validation and security work for a schema-constrained path and a raw-code
path are not interchangeable.

**Decision (2026-08-28, issue #197):** Hybrid. p5.js keeps its existing
structured scene-JSON model, editor UX (Layers, undo/redo, direct
manipulation, AI edit-patch), and injection-safety model exactly as today —
no regression risk. Canvas2D (native browser API, not a third-party
library — this resolves the original request's ambiguous "C2.js" wording),
Three.js, A-Frame, and SVG are raw AI-generated code with **no** structured
scene-JSON backing, reached through a new, separate, deliberately
non-parity creation flow (pick library + Mistral model, prompt, sandboxed
preview, download) — not an attempt to extend the existing editor to those
libraries.

**How to apply:** #199's generation/validation pipeline and #200's export
bundle must treat every non-p5.js generated piece as a new, fully untrusted
trust boundary: render it only inside a sandboxed iframe with a
restrictive CSP, with no access to this app's own cookies/session/`/api`
surface, both in the live preview and in the final downloaded bundle. Do
not reuse or extend `frontend/e2e/injectionArtifacts.spec.ts`'s
schema-constrained-output assumptions for this path — write a new,
sandboxing-focused threat model instead. Do not add Layers-panel/undo-redo/
direct-manipulation/AI-edit-patch scope to the new creation flow without a
separate issue; it is intentionally simpler than the p5.js editor.
