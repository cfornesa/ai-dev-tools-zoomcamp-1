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
| #787 | CLOSED | 71885a5 | vitest 2924 (1 known #791 flake); playwright drawingPlaneZip787 4 + ZIP regression 18 | PASS | closed | local; no migration; follow-up #797 |
| #790 | CLOSED | 9c58b4f | backend canonical/public 22+; vitest CanonicalPublicPiece; playwright privatePieceToolbar773 (#790) | PASS | closed | local; no migration |
| #794 | CLOSED | 87722e0, b2dcdb7 | vitest; playwright inkLayerGenerated2d 6 (thumbnail + SVG ZIP screenshot) + zip regression | PASS | closed | local |
| #795 | CLOSED | 06c6e3a | playwright manual3dStageChrome + manual3dOutlineSelection + cameraPreview3d 3 pass | PASS | closed | test-only |
| #793 | CLOSED | 21a9d2a | playwright artPieceEmbed 3 + artPieceOwnerEditing 5 + artPiece2dEditor 1 + livePreview 1 pass | PASS | closed | test-only |
| #797 | CLOSED | 6ea276f | playwright public3dCameraPlacement742 1 pass (also exercises the generated 3D ZIP variants) | PASS | closed | test-only |
| #792 | CLOSED | 393c728 | playwright artPieceFlatSpatial 4 pass | PASS | closed | test-only |
| #789 | CLOSED | bd8df15 | playwright public3dImmersiveCameraOverlay734 + public3dRouteStageChrome pass; toolbar matrix specs 8 pass | PASS | closed | test repair + 1 CSS fix |
| #791 | CLOSED | 13e44c9 | 3 consecutive full vitest runs green (2958 tests, 179s/172s/190s) | PASS | closed | test hygiene |
| #796 | CLOSED | c23882b | vitest 2963; playwright drawingPlaneAframe796 2 + 3D regression 9 | PASS | closed | local |
| #749 | CLOSED | b39eaa2 | playwright publishingAndRemix 13, responsiveShell 3, drawioPublicSurfaces 1, aiAndRecovery 7 all pass; vitest PublicProjectViewer 44 | PASS | closed | 1 product fix + test repairs |
| #750 | CLOSED | a17724d | backend full 1613; vitest 2965; playwright pieceSlugEdit750 2 | PASS | closed | local; no migration |
| #747 | CLOSED / QA PASS / production verified | d87b711, 16ceca5 | `make check`; published smoke; live view-source metadata | PASS | closed | production release verified at augmentrart.com; metadata backend forwarding confirmed; QA comment 5822183321803 |
| #748 | BLOCKED | — | local checks green; required live Chrome matrix not completed in this handoff | FAIL/INCOMPLETE | open | requires live 1280x900 and 375x812 inspection of toolbar, routes, ZIP, ink, drawing planes, slug, and private-owner view |
| #788 | QA FAIL / production blocked | 652c36ed production release; no source-update commit | rehearsal + one authorized production run + post-run live API/Chrome inspection + cleanup smoke | FAIL | open | production command ran exactly once; source rows stayed version 1 with old fixed-coordinate sources; no second run authorized |
| #798 | BLOCKED / dependent | — | not implemented in this transaction | not run | open | depends on #807; reduced-motion, low-power, and style-token scoping |
| #799 | BLOCKED / dependent | — | not implemented in this transaction | not run | open | 2D runtime template parity |
| #800 | BLOCKED / dependent | — | not implemented in this transaction | not run | open | 3D runtime template parity |
| #801 | BLOCKED / dependent | — | not implemented in this transaction | not run | open | all-engine ready/error runtime template |
| #802 | BLOCKED / dependent | — | not implemented in this transaction | not run | open | 2D regular/immersive/embed presentation identity |
| #803 | IMPLEMENTED / QA FAIL environment boundary | 793f0e8, dcbdeb0 | focused immersive/camera tests 15 passed; frontend 276 files / 2969 tests passed on isolated run; typecheck/lint/format pass; required Playwright Chromium launch blocked by macOS Mach-port permission | FAIL (browser evidence unavailable) | open | live Chrome reproduced immersive metadata-order/padding defect; fix is local and unpublished; QA comment 5822183557807 |
| #804 | BLOCKED / dependent | — | not implemented in this transaction | not run | open | collection parity matrix and presentation gaps |
| #805 | BLOCKED / dependent | — | not implemented in this transaction | not run | open | profile/personalization parity matrix |
| #806 | BLOCKED / dependent | — | not implemented in this transaction | not run | open | production verification depends on #798–#803 and owner-gated live evidence |
| #807 | IMPLEMENTED / QA FAIL environment boundary | d0819d0 | focused Vitest/Layout 20 passed; `make check` backend 1615 passed / frontend 276 files 2969 tests; Compose preflight PASS; Chromium E2E blocked by macOS Mach-port launch permission | FAIL (browser evidence unavailable) | open | first-party CSS/React star field, bounded 90 nodes, cosmic-only rendering, E2E spec added; needs real browser runner screenshots and animation delta |
| #808 | CLOSED / QA PASS | 47d7827 | focused importer 9 passed; `make check` backend 1615 passed / frontend 276 files 2968 tests | PASS | closed | local-only reconciliation fix; production re-import intentionally not run; QA comment 5822184052 |

## Production-readiness — 2026-09-24

- Repository quality: backend 1615 passed / 39 skipped; frontend 276 files / 2969 tests passed on the completed frontend run; lint, format, typecheck, and focused #803 tests pass. Two unrelated editor-workspace timeout tests passed when isolated after a later full-gate run encountered them.
- Published evidence: #747's production release and smoke are verified; #788's single authorized production import is recorded as failed/no-op for the two changed sources and was not repeated; #803's fix is not published.
- Browser evidence: owner Chrome was available and verified the live #748 3D regular/mobile/embed surfaces and reproduced #803's immersive layout gap. Playwright Chromium remains blocked before test execution by the macOS Mach-port launch failure.
- Readiness decision: NO-GO for this batch. #748, #788, #803, #807, and dependent #798–#806 remain open; no production publish is authorized for #803 in this session.

## Session-completion — 2026-09-24

- Distilled open inventory: 14 at start; duplicate audit found no new issue for the reported immersive layout because #803 already owns that contract.
- Terminal outcomes: 2 closed (#747, #808), 1 implemented but QA-failed on browser boundary (#803), 11 open/dependent or production-gated (#748, #788, #798–#802, #804–#807).
- Routing audit: Stage 2b #808 and stage 2a #803 used Codex/GPT-5 substitutions for rostered engineering; stage 4 used Codex/GPT-5 substitutions for rostered Claude QA; no second-opinion service ran. Stage 5 readiness and completion were performed as documented Codex substitutions because the rostered service was unavailable.
- Follow-up audit: #803's user-reported layout gap is linked to the existing issue; no duplicate was created. Remaining open work and evidence boundaries are preserved in the issue list and this ledger.
