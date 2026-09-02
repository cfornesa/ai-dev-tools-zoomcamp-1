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

Linked backlog: #320, #325–#341. #274 and broad #323/#324 are closed as
superseded/not-planned; their replacement issues are deliberately one route,
surface, variant, or downloaded capability each.

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

Backlog atomicity rule (2026-09-02): a parent parity issue is a reconciliation
container, not a closure unit. If acceptance criteria name multiple routes,
editor modes, embeds, immersive variants, or downloaded artifacts, distill
one independently observable issue per surface. Process and close each child
after its own implementation and QA evidence, then use the parent only for
cross-surface reconciliation. This cadence prevents a broad issue from
remaining open for hours while unrelated surfaces accumulate.

Immersive 3D must preserve the reference's Custom and CMS embed entry points
as query-driven, chrome-less variants of the same stage runtime. Downloaded
3D pieces must retain arrow-key camera travel while reserving WASD for the
keyboard-note contract; test this in an extracted `file://` artifact rather
than inferring behavior from generated source strings.

Full 3D downloads must bundle the MediaPipe vision module, its Wasm/JS runtime
files, and the gesture-recognizer model under relative paths so camera and hand
overlays remain functional when opened directly from `file://`. Non-Camera
downloads must omit those camera-only assets and runtime paths while retaining
non-camera sound and view controls.
