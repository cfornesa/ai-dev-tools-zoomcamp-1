# Downloaded 3D pieces parity gaps

The structured 3D export includes a MediaPipe asset pipeline, but asset
presence is not behavioral parity. The extracted Full artifact must expose
and execute the user-facing `Steer the piece` lifecycle and camera-view
composition controls with local permission/error handling; Non-Camera must
omit that capability while retaining non-camera controls. The immersive
viewer currently calls the regular 3D generator, so an immersive download
needs an explicit mode to retain arrow-key travel and bounded navigation.

These are new follow-ups #369 and #368 to permanently closed #364. Do not
reopen #364. Verify extracted artifacts in a browser at fixed desktop/mobile
viewports; source strings and ZIP manifests are supporting evidence only.

Scope remains the reference pieces implementation translated into this
repository's React/TypeScript frontend and Django/Python backend. Never add
PHP implementation here.
