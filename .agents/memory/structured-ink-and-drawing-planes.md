# Ink layers, drawing planes, standalone-runtime hazards (2026-09-24)

- "One ink layer" in structured 2D is one reserved group (`ink-group`), because the scene model enforces one shape per layer (#775, DECISIONS.md). Generated-2D ink is the `drawingDocument` stored in `ArtPieceVersion.generation_metadata["ink"]` (no migration; #776).
- The standalone ZIP runtimes are JS inside TypeScript template literals: a regex literal such as `/<\/svg>\s*$/` silently becomes invalid JS and disables every export button. `standalone*RuntimeSource.test.ts` now parse-check the generated scripts; keep doing so when editing them.
- WebGL screenshots need `preserveDrawingBuffer` (standalone Three.js renderer) or the capture prelude (generated Three.js/A-Frame ZIPs); otherwise the screenshot button yields a blank PNG.
- E2E specs outside the smoke suite drift silently when toolbars/create flows change; create 3D projects via `support/createProject3d.ts`, and expect the canonical `/users/@handle/edit/:slug` URL, not `/projects3d/:id`.
- Full-suite vitest flakes came from lazy route chunks inside 1s `findBy` windows: preload via `src/test/preloadAppRoutes.ts`.
