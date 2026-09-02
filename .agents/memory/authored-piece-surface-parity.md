# Authored piece surface parity

The structured Project/Project3D editor is the authoring surface for the
pieces represented by the deployed `/p/:id`, `/p3d/:id`, and
`/projects3d/:id` examples. The separate generated-art `ArtPiece` domain and
its `/art-pieces/*` routes are not a substitute for those surfaces.

For parity work, use `../augment-humankind/docs/piece-surface-parity.md` and
the sibling PHP stage, immersive chrome, runtime, and export helpers as the
behavioral and visual reference. A piece's editor preview, public page,
embed, immersive page, screenshot, and downloaded artifact must share one
capability contract. Controls belong over the artwork/canvas in a compact,
accessible toolbar; bulky demo/camera panels should be opt-in disclosures
associated with the stage. Downloads must package the runtime functions and
overlays, excluding only the download action itself, with explicit Full and
Non-Camera privacy/capability differences.

Do not close parity work based only on local unit tests or a different route:
the exact deployed target route must be inspected after publish, and private
editor routes require authenticated browser evidence. Camera/microphone and
native fullscreen remain explicit browser/OS verification boundaries.

Linked backlog: #274 and #320.
