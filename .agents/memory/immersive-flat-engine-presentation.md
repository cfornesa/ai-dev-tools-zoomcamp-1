# Flat-engine immersive presentation

The immersive art-piece route supports the six-engine contract, including SVG,
p5.js, C2.js, and C2.js Interactive. Flat engines default to a responsive,
letterboxed 2D gallery and do not expose directional or spatial-camera
controls. Three.js and A-Frame retain native 3D navigation and immersive
directional controls. The opaque sandbox's lazy synthetic spatial shell is an
explicit opt-in only when the author enables the `hand_steering` capability.
The immersive sandbox must be built with the `immersive` presentation mode so
its authored canvas/SVG is responsive and letterboxed against the dark
full-screen surface; regular views keep the default authored-size presentation.

The capability registry's `immersive` boolean is independent from `embed`,
`download`, and editor support. Do not infer those surfaces from the immersive
flag. Verify flat-engine immersive rendering at both fixed viewports because
inline canvas dimensions can otherwise leave a blank or white letterbox.

This policy is the owner decision recorded in #900 on 2026-09-26. Consumer
issues must verify both the default gallery path and the explicit steering
opt-in without reintroducing spatial controls for ordinary flat pieces.
