---
name: multi-library-generation-architecture-fork
description: Multi-library AI art generation (Canvas2D/Three.js/A-Frame/SVG beyond p5.js) forces a choice between extending the structured scene-JSON model or generating raw sandboxed code; this choice gates issues #199 and #200.
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

**How to apply:** Do not start #199 or #200 until #197's decision is recorded.
If a raw-code path is chosen, treat it as a new trust boundary requiring its
own security review before shipping, not an extension of the existing
schema-validated AI-edit trust model.
