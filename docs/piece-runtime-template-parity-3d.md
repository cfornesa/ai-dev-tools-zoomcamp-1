# Generated 3D runtime-template parity matrix (#800)

This matrix covers generated Three.js and A-Frame pieces on the regular public
viewer and their downloaded Full ZIPs. Structured 3D uses the same toolbar
contract and is covered by the existing structured 3D browser suites.

| Control / surface  | Online regular                                             | Full ZIP                                          | Reason / engine boundary                                      |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| Screenshot         | Present                                                    | Present                                           | Both engines                                                  |
| Download           | Present                                                    | N/A — already downloaded                          | Online Full and Non-Camera ZIP menu                           |
| Immersive / VR     | Present when enabled                                       | N/A — offline artifact                            | ZIP has no route transition                                   |
| Sound              | Present when enabled                                       | Present when enabled                              | User-activated only                                           |
| Piece controls     | Present when camera/steering/sound/mic/keyboard is enabled | Present when camera/steering/sound/mic is enabled | Camera opacity, microphone, steering, and reset live in panel |
| Hand gesture guide | Present when steering is enabled                           | Present when steering is enabled                  | Same accessible name/dialog                                   |
| Camera/steering    | Present in Piece controls                                  | Present in Piece controls for Full ZIP            | A-Frame/Three.js camera registration is runtime-specific      |
| Visitor drawing    | N/A                                                        | N/A                                               | Generated 3D engines do not expose the 2D C2 drawing toolset  |
| Fullscreen         | Present, last in icon row                                  | Present, last in icon row                         | Same fullscreen contract                                      |

The shared `PieceStageToolbar`, `PieceStageControls`,
`buildExportControls`, and `standaloneArtPieceRuntimeSource` paths own these
rows. `pieceTemplateParity3d.spec.ts` asserts the named controls and executes
the extracted artifacts at 1280x900 and 375x812.
