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

The standalone 2D HTML export follows the same rule: motion, demo-signal, and
camera hosts belong inside a compact stage-local Piece controls disclosure,
not as page-level sections. A real browser test must open that disclosure
before asserting camera lifecycle controls; otherwise a hidden host can be
mistaken for a missing feature.

Do not close parity work based only on local unit tests or a different route:
the exact deployed target route must be inspected after publish, and private
editor routes require authenticated browser evidence. Camera/microphone and
native fullscreen remain explicit browser/OS verification boundaries.

Linked backlog: #274 and #320.

Re-audit lesson (2026-09-02): isolated child issues can all be locally
implemented while the composed structured surfaces still fail parity. Treat
the editor, public viewer, embed, immersive route, and downloaded runtime as
one acceptance matrix; a stage button in one consumer or a string-level ZIP
assertion does not prove the shared capability contract. In particular, keep
camera/demo disclosures stage-associated in every 2D consumer, and verify the
portable runtime's behavior (not only the presence/absence of script names)
before accepting Full/Non-Camera parity.

The shared stage download menu must explicitly style both its open placement
and its `[hidden]` state, and close on outside pointer input. Otherwise an
overlay can remain hit-testable across unrelated editor interactions and
intercept controls outside the piece surface; the full browser suite caught
this composed failure on 2026-09-02.
