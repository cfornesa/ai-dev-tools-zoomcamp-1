# Backlog session 2026-09-24 (this repo only; react-node owned by another agent)

Orchestrator: backlog-session / Claude Sonnet 5 (default profile) / not substituted.
Stage provenance default for this session (flagged per issue as run): scoping = Claude Sonnet 5 (substituted for Codex, at distillation); implementation = Claude Sonnet 5 (substituted for Opencode Go/Ollama Cloud); second-opinion (stage 3) = NOT RUN (no independent family); QA = Claude Sonnet 5 Medium (rostered); readiness gate = Claude (rostered tier) at session end.

## Ledger
| Issue | Status | Commit | Focused/full checks | QA | GitHub | Boundary |
|---|---|---|---|---|---|---|
| #765 | CLOSED | 145fbce | prettier check on doc | PASS (doc criteria; cross-repo posting shifted out of scope) | closed | doc only |
| #761 | CLOSED | a8a9ede | vitest export 192; make frontend-* 2826 tests; playwright exportArtifacts 10 | PASS | closed | local only; deployed under #748 |
| #762 | CLOSED | 43a014f | make check pass | PASS | closed | local; deploy under #748 |
| #763 | CLOSED | e73fb6a | make check; piece2dFill compose | PASS | closed | local; prod data #788 |
| #764 | CLOSED | 26cdf02 | vitest generative; playwright c2ZipCanvas764 | PASS | closed | local |
| #752 | CLOSED | 19e6b9f | vitest 284; playwright embedToolbarOrder, sixEngineEmbed, publicDraw | PASS | closed | local |
| #753 | CLOSED | 4a08d02 | vitest; playwright immersiveArtPieceToolset | PASS | closed | local |
| #754 | CLOSED | ae9769e | playwright immersiveEmbedFraming, embedToolbarOrder, sixEngineImmersive | PASS | closed | local; real-camera under #748 |
| #766 | CLOSED | d98bb13 | vitest 141; playwright regularToolbarMatrix + toolset specs | PASS | closed | local |
| #767 | CLOSED | 511ae34 | vitest 223; playwright regularToolbar3d767, public3dCameraOverlay728 | PASS | closed | local; drift specs to #769 |
| #768 | CLOSED | 65a784a | playwright regularToolbar2d768 | PASS | closed | local |
| #769 | CLOSED | 2758bab | playwright immersive3dToolbar769 | PASS | closed | local; drift #789 |
| #773 | CLOSED | d8faf86 | playwright privatePieceToolbar773 | PASS | closed | local; follow-up #790 |

**Cluster gate (toolbar/ZIP-canvas, #752-#754,#761-#764,#766-#769,#773):** `make check`: backend green; frontend 2826/2828, two load-only timing flakes (App.embedRoute, useDraftAutosave) pass alone (3 files/21 tests); filed as a workflow defect (issue below).
| #755 | CLOSED | 35da890 | vitest 247; playwright zip specs | PASS | closed | local |
| #756 | CLOSED | 35da890 | same | PASS | closed | local |
| #757 | CLOSED | afdc93c | vitest 246; playwright artPieceZipDrawing757 | PASS | closed | local |
| #758 | CLOSED | afdc93c | same | PASS | closed | local |
| #760 | CLOSED | 38829df | vitest 54; playwright c2ZipRuntime760 + zip specs | PASS | closed | local |
| #770 | CLOSED | 38c4ef2 | backend full (1538); vitest 275 | PASS | closed | local; no migration |
| #771 | CLOSED | de85f37 | backend focused 195; vitest 37 | PASS | closed | local |
| #772 | CLOSED | c43029c | vitest 99; playwright aframeStructured772 | PASS | closed | local |
| #778 | CLOSED | 2d635c3 | backend 66; vitest 118 | PASS | closed | local; no migration |
| #779 | CLOSED | 99f07a5 | vitest 170; playwright drawingPlane3d threejs | PASS | closed | local |
| #780 | CLOSED | 5ec915a | vitest 9; playwright drawingPlane3d aframe | PASS | closed | local |
| #783 | CLOSED | afc6636 | vitest; playwright objectAnimation3d 4 | PASS | closed | local; no migration |
| #775 | CLOSED | 5c9b6c0 | vitest 2896 (1 load flake, rerun green); playwright inkLayer2d 2 | PASS | closed | local; no migration |
| #776 | CLOSED | ce0cce4 | backend full 1573; vitest 2903; playwright inkLayerGenerated2d 6 + inkLayer2d 2 | PASS | closed | local; no migration; follow-ups #793 #794 |
| #781 | CLOSED | c5e893f, f336cf4 | vitest 2904; playwright drawingPlaneDraw3d 2 + 3D regression 7 | PASS | closed | local; no migration; follow-up #795 |
| #782 | CLOSED | 6d6e17a | vitest 2922; playwright drawingPlaneTransform782 2 + 3D regression 9 | PASS | closed | local; no migration; follow-up #796 |
| #784 | CLOSED | 4afc213 | backend full 1597; vitest 2922; playwright aiDrawingPlane784 4 + 3D regression 8 | PASS | closed | local; no migration |
| #785 | CLOSED | f6e2e9e | playwright drawingPlaneViewers785 4 (both engines) + drawingPlane3d + objectAnimation3d | PASS | closed | local |
| #786 | CLOSED | f6e2e9e | playwright drawingPlaneViewers785 immersive (both engines) | PASS | closed | local |
