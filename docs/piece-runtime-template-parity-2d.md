# Generated 2D runtime-template parity matrix (#799)

This matrix compares the shared public runtime template with the downloaded
Full ZIP for c2.js, c2.js Interactive, SVG, and p5.js. It is intentionally
limited to the regular viewer and regular ZIP; immersive/embed surfaces are
tracked by #802 and 3D engines by #800.

| Control / surface | Online regular | Full ZIP | Engine notes |
| --- | --- | --- | --- |
| Screenshot | Present | Present | All four engines |
| Download | Present | N/A — already downloaded | Online offers Full and Non-Camera ZIP |
| Immersive / VR | Present when `immersive` capability is enabled | N/A — offline artifact | Route link is not meaningful from `file://` |
| Sound | Present when `sound` capability is enabled | Present when `sound` capability is enabled | Same named toggle; activation remains user-driven |
| Piece controls | Present when sound/microphone/camera/steering/keyboard is enabled | Present when microphone/camera/steering is enabled | Volume, microphone, camera, and steering stay in the panel |
| Hand gesture guide | Present when `hand_steering` is enabled | Present when `hand_steering` is enabled | Same accessible name and dialog copy |
| Visitor drawing | C2.js Interactive only | C2.js Interactive only | Pencil, brush, eraser, colour, size, draw, clear, undo, redo |
| Reset view | Present in the controls panel when opened | Present in the toolbar | ZIP has no route-level navigation, so reset is an icon-row tool |
| Fullscreen | Present, last in icon row | Present, last in icon row | Same fullscreen action contract |

The online and ZIP rows are implemented by the shared `PieceStageToolbar`,
`PieceStageControls`, `buildExportControls`, and
`standaloneArtPieceRuntimeSource` paths. `pieceTemplateParity2d.spec.ts`
asserts the named controls, order, interactions, and rendered screenshots at
1280x900 and 375x812.
