# Flat-engine immersive presentation

The immersive art-piece route supports the six-engine contract, including SVG,
p5.js, C2.js, and C2.js Interactive. These flat engines use the opaque
sandbox's lazy synthetic spatial shell rather than a native camera. The
immersive sandbox must be built with the `immersive` presentation mode so its
authored canvas/SVG is responsive and letterboxed against the dark full-screen
surface; regular views keep the default authored-size presentation.

The capability registry's `immersive` boolean is independent from `embed`,
`download`, and editor support. Do not infer those surfaces from the immersive
flag. Verify flat-engine immersive rendering at both fixed viewports because
inline canvas dimensions can otherwise leave a blank or white letterbox.
