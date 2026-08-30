This repo has two genuinely different 3D-rendering surfaces that look
similar but need opposite dependency strategies. Don't reuse one
pattern for the other.

**Untrusted, AI-generated code** (`frontend/src/generative/artPieceSandbox.ts`,
the AI art-piece feature): loads Three.js/A-Frame from a pinned CDN
`<script>` inside a sandboxed `<iframe sandbox="allow-scripts">`, never
as an npm dependency. This is deliberate — the rendering code itself is
untrusted model output, so it must run isolated with no access to the
app's own bundle/state. See `.agents/memory/aframe-default-camera-facing-convention.md`,
`.agents/memory/pinned-cdn-version-can-silently-404.md`, and
`.agents/memory/csp-blocked-eval-masquerades-as-library-bug.md` for the
lessons from getting that sandbox's A-Frame setup working (#236).

**First-party, schema-validated documents** (`Scene3DPreview.tsx`, the
3D editor's own live preview, issue #244): renders a `scene3d` document
the app itself produced and validated — not untrusted code. This uses
Three.js as a normal npm dependency (`frontend/src/render/threeSceneBuilder.ts`),
exactly like `p5` is already a real dependency for the 2D editor's own
preview (`p5Adapter.ts`). No CDN, no iframe sandbox, no CSP tuning
needed — those exist specifically to contain untrusted code, which
doesn't apply here.

**How to apply:** before adding a new 3D/2D-canvas rendering feature,
ask whether the content being rendered is arbitrary/AI-generated code
(→ CDN + sandboxed iframe, follow the #236 lessons above) or a
schema-validated document the app itself controls (→ real npm
dependency, follow `p5Adapter.ts`/`threeSceneBuilder.ts`'s pattern:
build a pure, canvas-free scene-graph/draw-plan module first so it's
unit-testable without a WebGL/canvas context, which jsdom — this repo's
frontend test environment — never provides for WebGL).
