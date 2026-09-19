# C2 opaque sandbox rendering

The upstream c2.js `Renderer` can expose a global yet still fail inside the
`sandbox="allow-scripts"` opaque `srcdoc` used by generated art pieces. For
the regular/immersive viewer contract, keep the reference-facing
`{ c2, canvas, startFrame }` sketch API but provide a deterministic local
Canvas2D adapter with `Renderer.clear`, `Renderer.fill`, and
`Renderer.circle`. Paint one frame synchronously before the animation loop so
an off-screen or throttled iframe still has visible artwork. Keep the C2
canvas dimensions aligned with the 320x240 reference fixture; a 1280x720
backing canvas can place authored coordinates beneath the stage overlay after
responsive CSS scaling.

This is disposable-browser/runtime evidence, not a claim that the upstream
c2.js library itself is fully compatible with opaque origins. Recheck the
upstream runtime separately before expanding the adapter surface.
