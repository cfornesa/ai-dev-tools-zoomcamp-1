# CI failure map — Actions run #1126 (SHA 78ee6c79)

Source: [run 37081997610](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/actions/runs/37081997610), `workflow_dispatch` on the PR branch, 2026-10-03. Workflow validation, backend checks, frontend checks and the disposable published-routing smoke passed. All 16 browser shards failed: **120 failed cases, 395 passed, 22 skipped** (16 in shard 14, 1 in shard 15, 5 in shard 16). Per-shard failed counts: 5, 6, 7, 11, 3, 10, 9, 15, 3, 6, 3, 15, 12, 3, 5, 7.

History: baseline run 36765070532 (208 failed) → 36778653929 (205) → run #1112 / 37036827054 at `41e45142` (126) → this run (120). Compared with #1112, **117 of the 120 cases also failed there**; three are new in this run (marked NEW): `aiAndRecovery.spec.ts:707`, `contentPanelShadow.spec.ts:57`, `layersPanel.spec.ts:350`. The long-standing majority is test and fixture drift; the NEW ones need a regression check first.

Method: the 120 failing-case headers and their first error lines were extracted from the 16 completed job logs and grouped by the first error signature and the surface driven. A first cause is **confirmed** only where the table says so; otherwise each child issue starts with an evidence-capture step. Classification uses `task-distillation`'s triage classes.

## Child issues

| Issue | Cases | Cluster | Priority | Class | First cause |
|---|---|---|---|---|---|
| #1160 | 4 | account settings action count (12) | P2 | test drift | confirmed (12 items rendered) |
| #1161 | 3 | account settings reorder (8 sections) | P2 | test drift | confirmed (8 sections) |
| #1162 | 1 | account styles reduced-motion/:active (re-scoped) | P2 | test drift (timing) | re-scoped: failing assertion is :active offset, not the 0s duration |
| #1163 | 5 | injection audit: extra <script> (security gate) | P0 security gate | test oracle / security | unconfirmed: one more <script> than 5/6 |
| #1164 | 6 | profile PATCH 400 in E2E flows | P1 | unknown (400 body missing) | unconfirmed |
| #1165 | 2 | profile photo removal | P2 | unknown | unconfirmed |
| #1166 | 18 | 'Piece controls' vs sr-only shim; drawio editor | P2 | test drift | confirmed (sr-only shim matches name substring) |
| #1168 | 11 | 3D lifecycle specs: Gallery-click creation | P2 | test drift | confirmed (local-first Gallery creation) |
| #1169 | 3 | public 3D camera/toolbar specs: Gallery-click creation | P2 | test drift | confirmed (local-first Gallery creation) |
| #1170 | 14 | AI panel specs: legacy AI routes / removed AI creation menu | P2 | test drift | confirmed (legacy AI routes redirect; menu items removed) |
| #1171 | 12 | generated-art studio editor specs | P2 | unknown | unconfirmed (label exists in source) |
| #1172 | 10 | shell chrome: header colour mode, reduced motion, skip link | P2 | test drift | confirmed (controls replaced by toggles; skip-link z-index) |
| #1173 | 4 | byline 'By e2e_owner' | P2 | unknown | unconfirmed (attribution format) |
| #1174 | 4 | publish confirmation dialog | P2 | unknown | unconfirmed (button disabled/covered) |
| #1175 | 4 | generated-piece stage specs vs phone layout (≤700px) | P2 | test drift | confirmed from source: per-piece ratio (16:9 fallback) at desktop; deliberate tall phone stage and in-flow toolbar since `64b03f53` |
| #1176 | 1 | HTML export 44px targets | P2 | possible product | unconfirmed (button width 40) |
| #1177 | 1 | content panel shadow height drift (NEW) | P1 possible regression | possible regression (NEW) | unconfirmed; bisect |
| #1178 | 1 | 3D drawing plane pixel coverage | P2 | unknown | unconfirmed |
| #1179 | 2 | auth policy copy/background | P2 | test drift | confirmed (#1127 copy; #1124 background) |
| #1180 | 2 | authoring ownership gate (authorization check) | P0 authorization check | possible product (authz) | unconfirmed; inspect content shown to non-owner |
| #1181 | 1 | local gallery cards | P2 | unknown | unconfirmed |
| #1182 | 2 | public gallery engine filter | P2 | unknown | unconfirmed |
| #1183 | 1 | sound telemetry Key label | P2 | test drift | unconfirmed (two Key labels) |
| #1184 | 4 | site content / theme admin specs | P2 | unknown | unconfirmed |
| #1185 | 3 | long-running specs with protocol/connection errors | P2 | runner / timeout | unconfirmed |
| #1186 | 1 | aiAndRecovery explicit Save ZIP download (NEW) | P2 | unknown (NEW) | unconfirmed (non-ZIP download) |

## Case-to-issue map (all 120)

### #1160 — account settings action count (12) (4)
- `accountSettings.spec.ts:49` [chromium] Account settings grouping (#548) › empty settings fixture stays grouped at 1280x900 
- `accountSettings.spec.ts:49` [chromium] Account settings grouping (#548) › empty settings fixture stays grouped at 375x812 
- `accountSettings.spec.ts:63` [chromium] Account settings grouping (#548) › populated settings fixture stays grouped at 1280x900 
- `accountSettings.spec.ts:63` [chromium] Account settings grouping (#548) › populated settings fixture stays grouped at 375x812 

### #1161 — account settings reorder (8 sections) (3)
- `accountSettingsLayout.spec.ts:20` [chromium] account settings layout persistence (#555) › persists keyboard reorder and recovers malfor ×2
- `accountSettingsReorder.spec.ts:9` [chromium] Account settings reorder controls (#677) › supports keyboard lift, move, drop, and Escape 

### #1162 — account styles reduced-motion/:active (re-scoped) (1)
- `accountComponentStyles.spec.ts:349` [chromium] allauth controls match site components across theme, shadow, font, and zoom settings (#112

### #1163 — injection audit: extra <script> (security gate) (5)
- `injectionArtifacts.spec.ts:251` [chromium] Injection audit: scoped-string fixtures, real Chromium execution › title fixtures are iner
- `injectionArtifacts.spec.ts:267` [chromium] Injection audit: scoped-string fixtures, real Chromium execution › label (layer/group name
- `injectionArtifacts.spec.ts:283` [chromium] Injection audit: scoped-string fixtures, real Chromium execution › structured scene string
- `injectionArtifacts.spec.ts:360` [chromium] Injection audit: combined worst-case payload across attribution on/off and every interacti
- `injectionArtifacts.spec.ts:394` [chromium] Injection audit: URL / closing-tag / quote / Unicode-control fixtures, real Chromium execu

### #1164 — profile PATCH 400 in E2E flows (6)
- `pieceRuntimeErrorTemplate.spec.ts:15` [chromium] Generated runtime error/ready template (#801) › reports a throwing SVG online and in the e
- `pieceTemplateParity2d.spec.ts:58` [chromium] 2D runtime template parity (#799) › asserts online and Full ZIP controls for every 2D engi
- `pieceTemplateParity3d.spec.ts:49` [chromium] 3D runtime template parity (#800) › asserts online and Full ZIP controls for Three.js and 
- `profileHandles.spec.ts:61` [chromium] public handle lifecycle (#551) › generates, changes, validates, and redirects handles at 1
- `profileHandles.spec.ts:61` [chromium] public handle lifecycle (#551) › generates, changes, validates, and redirects handles at 3
- `publicProfiles.spec.ts:10` [chromium] Public profiles (#520) › owner publishes profile metadata and only its public profile rout

### #1165 — profile photo removal (2)
- `profilePhotoUpload.spec.ts:21` [chromium] profile photo upload and removal (#824) › uploads, renders, rejects, and removes a photo a ×2

### #1166 — 'Piece controls' vs sr-only shim; drawio editor (18)
- `artPieceCameraRuntime.spec.ts:119` [chromium] Generated regular viewer: camera composition and capture (#431) › camera starts from its o
- `artPieceCameraRuntime.spec.ts:119` [webkit] Generated regular viewer: camera composition and capture (#431) › camera starts from its o
- `artPieceCameraRuntime.spec.ts:273` [chromium] Generated regular viewer: camera composition and capture (#431) › real unmocked getUserMed
- `artPieceSteeringRuntime.spec.ts:186` [chromium] Generated regular viewer: hand-steering ownership and Reset (#432) › steering is gated on 
- `drawioEditor.spec.ts:75` [chromium] Draw.io editor › mutates objects, renames a layer, and preserves saved draw.io state 
- `drawioEditor.spec.ts:75` [firefox] Draw.io editor › mutates objects, renames a layer, and preserves saved draw.io state 
- `embedToolbarOrder.spec.ts:27` [chromium] Embed toolbar order and placement (#752) › /embed/art-pieces/:id shows the icon row in mat
- `immersiveArtPieceToolset.spec.ts:65` [chromium] generated immersive toolset (#691) › renders labelled canvas2d immersive actions without a
- `immersiveArtPieceToolset.spec.ts:65` [chromium] generated immersive toolset (#691) › renders labelled threejs immersive actions without a 
- `immersiveArtPieceToolset.spec.ts:65` [chromium] generated immersive toolset (#691) › renders labelled aframe immersive actions without a h
- `public3dCameraPlacement742.spec.ts:108` [chromium] public 3D camera placement contract (#742) › owner choice, live camera modes, geometry, la
- `publicArtPieceToolset.spec.ts:65` [chromium] generated art-piece public toolset (#690) › renders labelled canvas2d actions without a ha
- `publicArtPieceToolset.spec.ts:65` [chromium] generated art-piece public toolset (#690) › renders labelled threejs actions without a ham
- `publicArtPieceToolset.spec.ts:65` [chromium] generated art-piece public toolset (#690) › renders labelled aframe actions without a hamb
- `regularToolbarMatrix.spec.ts:132` [chromium] regular generated-piece toolbar matrix (#766) › minimal flat piece: exact set and order 
- `regularToolbarMatrix.spec.ts:132` [chromium] regular generated-piece toolbar matrix (#766) › sound only: exact set and order 
- `regularToolbarMatrix.spec.ts:132` [chromium] regular generated-piece toolbar matrix (#766) › hand steering only: exact set and order 
- `regularToolbarMatrix.spec.ts:132` [chromium] regular generated-piece toolbar matrix (#766) › screenshot and fullscreen explicitly off: 

### #1168 — 3D lifecycle specs: Gallery-click creation (11)
- `manual3dLayoutParity.spec.ts:114` [chromium] manual 3D editor layout parity › Preview, outline, inspector, and publication controls sta
- `manual3dPublicationLifecycle.spec.ts:28` [chromium] manual 3D publication lifecycle › publishes and restores the exact editor fixture at both 
- `project3dLifecycle.spec.ts:92` [chromium] 3D project creation › creating a new 3D project persists it and opens the manual editor 
- `project3dLifecycle.spec.ts:147` [chromium] 3D project creation › published 3D projects expose the shared public stage chrome and can 
- `project3dLifecycle.spec.ts:295` [chromium] 3D project creation › immersive 3D touch d-pad holds and releases the matching travel keys
- `project3dPublicationDiscoverability.spec.ts:18` [chromium] 3D publication discoverability › shows and updates visibility in the editor and owner card
- `project3dServerPackageExport.spec.ts:35` [chromium] server-backed 3D piece package export (#968) › exports complete 3D history at 1280x900 
- `project3dServerPackageExport.spec.ts:35` [chromium] server-backed 3D piece package export (#968) › exports complete 3D history at 375x812 
- `project3dThumbnailCard.spec.ts:115` [chromium] owner 3D project card thumbnails › shows real geometry for a renderable scene and a safe r
- `project3dThumbnailCard.spec.ts:165` [chromium] owner 3D project card thumbnails › regenerates the card thumbnail after the current versio
- `unpublishRetention.spec.ts:9` [chromium] Unpublish retention: restore within the grace window (#944) › unpublishing a project start

### #1169 — public 3D camera/toolbar specs: Gallery-click creation (3)
- `public3dCameraOverlay728.spec.ts:18` [chromium] public 3D camera overlay geometry (#728) › matches the stage at desktop and mobile viewpor
- `public3dImmersiveCameraOverlay734.spec.ts:11` [chromium] canonical immersive 3D camera overlay fills and centers the stage at desktop and mobile 
- `public3dToolbar730.spec.ts:30` [chromium] public 3D stage toolbar placement (#730) › overlays controls without reflow at desktop and

### #1170 — AI panel specs: legacy AI routes / removed AI creation menu (14)
- `ai2dPublication.spec.ts:18` [chromium] AI-assisted 2D publication › publishes and returns to Draft from the stage-local control 
- `ai2dResponsive.spec.ts:17` [chromium] AI-assisted 2D responsive editor › contains the preview canvas without horizontal page ove
- `aiMention3d.spec.ts:21` [chromium] 3D AI @ targeting (#662) › filters and inserts a typed stable-ID chip at 1280px 
- `aiMention3d.spec.ts:21` [chromium] 3D AI @ targeting (#662) › filters and inserts a typed stable-ID chip at 375px 
- `aiPanelLayout2d.spec.ts:17` [chromium] 2D AI panel layout (#678) › keeps fields full width at 375x812 
- `aiPanelLayout2d.spec.ts:17` [chromium] 2D AI panel layout (#678) › keeps fields full width at 768x1024 
- `aiPanelLayout2d.spec.ts:17` [chromium] 2D AI panel layout (#678) › keeps fields full width at 1280x900 
- `aiPanelLayout3d.spec.ts:17` [chromium] 3D AI panel layout (#679) › keeps fields full width at 375x812 
- `aiPanelLayout3d.spec.ts:17` [chromium] 3D AI panel layout (#679) › keeps fields full width at 768x1024 
- `aiPanelLayout3d.spec.ts:17` [chromium] 3D AI panel layout (#679) › keeps fields full width at 1280x900 
- `aiPlanReview2d.spec.ts:36` [chromium] AI 2D editor: plan review (#659) › shows the plan and waits for explicit approval before i
- `aiPlanReview3d.spec.ts:36` [chromium] AI 3D editor: plan review (#660) › shows the plan and waits for explicit approval before i
- `project3dLifecycle.spec.ts:118` [chromium] 3D project creation › creating a new AI-assisted 3D project persists it and opens the AI-a
- `publicGalleryMixedPieces.spec.ts:114` [chromium] mixed public gallery › shows published 2D, 3D, and generated cards to anonymous visitors a

### #1171 — generated-art studio editor specs (12)
- `aiAuthoringSixEngine743.spec.ts:42` [chromium] AI authoring six-engine Persona matrix (#743) › generates, saves, and reopens every engine
- `aiRegionTargetExisting.spec.ts:24` [chromium] existing generated-piece targeting (#921) › targets one existing region at 375px 
- `artPiece2dEditor.spec.ts:18` [chromium] 2D AI editor engine modes (#618) › catalogs all 2D engines and preserves source-only edito
- `artPiece3dEditor.spec.ts:17` [chromium] 3D AI editor engine modes (#620) › preserves authored Three.js and A-Frame editor identity
- `artPieceFakeRefinement.spec.ts:48` [chromium] fake-provider generated-piece refinement (#698) › accepts an observable AI refinement for 
- `artPieceThumbnailCapture.spec.ts:51` [chromium] Generated thumbnail service: capture artwork instead of hash-derived placeholders (#438) ›
- `artPieceThumbnailCapture.spec.ts:183` [chromium] Generated thumbnail service: capture artwork instead of hash-derived placeholders (#438) ›
- `editOutputConsistency.spec.ts:191` [chromium] edit-to-output consistency (#671) › manual and fake-provider AI edits reach regular, immer
- `livePreview.spec.ts:62` [chromium] Generated-piece live preview (#669) › debounces source edits, keeps the latest frame, and 
- `manualEdit3d.spec.ts:19` [chromium] Generated 3D manual editing tools (#668) › adds, outlines, transforms, saves, and publishe
- `piece2dFill.spec.ts:20` [chromium] Generated 2D regular stage fill (#705) › fills, resizes, preserves pointer coordinates, an
- `publicDraw.spec.ts:15` [chromium] C2.js Interactive visitor drawing (#670) › draws temporarily on regular and immersive view

### #1172 — shell chrome: header colour mode, reduced motion, skip link (10)
- `celestialStyle.spec.ts:30` [chromium] Celestial style (#647) › uses script headings, readable serif body, cosmic backdrop, and r
- `cosmicBackdropStars.spec.ts:27` [chromium] Cosmic backdrop star field (#807) › renders a bounded decorative field at 1280x900 
- `cosmicBackdropStars.spec.ts:27` [chromium] Cosmic backdrop star field (#807) › renders a bounded decorative field at 375x812 
- `designSchemeMatrix.spec.ts:45` [chromium] Design-scheme evidence matrix (#655) › captures Celestial/Pareto routes in both modes and 
- `headerChrome.spec.ts:16` [chromium] Header chrome (#674) › fits the toolbar and exposes one mode control at 375x812 
- `headerChrome.spec.ts:16` [chromium] Header chrome (#674) › fits the toolbar and exposes one mode control at 768x1024 
- `headerChrome.spec.ts:16` [chromium] Header chrome (#674) › fits the toolbar and exposes one mode control at 1280x900 
- `profileStyleInheritance.spec.ts:55` [chromium] profile style inheritance (#672) › inherits the active site style on profile and collectio
- `themeToggle.spec.ts:4` [chromium] visitor theme preference (#644) › persists light/dark/system choices across routes and rel
- `vividDesignMatrix.spec.ts:31` [chromium] Vivid design evidence matrix (#683) › captures header, AI panel, and account settings acro

### #1173 — byline 'By e2e_owner' (4)
- `canonicalImmersiveStructuredPiece.spec.ts:9` [chromium] canonical immersive structured route matches the reference chrome 
- `canonicalStructuredPieceSlug.spec.ts:10` [chromium] canonical structured piece routes render at desktop and mobile sizes 
- `immersiveCollection.spec.ts:16` [chromium] immersive collection gallery (#557) › navigates a bounded live collection room at 1280x900
- `immersiveCollection.spec.ts:16` [chromium] immersive collection gallery (#557) › navigates a bounded live collection room at 375x812 

### #1174 — publish confirmation dialog (4)
- `localPieceRoundTripPublish.spec.ts:15` [chromium] Local-only piece publish-as-transfer (#942) › warns, validates, uploads, and publishes a l ×2
- `localPieceRoundTripPublish.spec.ts:81` [chromium] Local-only piece publish-as-transfer (#942) › refuses to upload over quota and leaves the 
- `relatedPublicProjects.spec.ts:41` [chromium] canonical related public 2D pieces (#1142) › shows shared-tag public cards below canonical

### #1175 — generated-piece stage specs vs phone layout (4)
- `artPieceSixEngineEmbed.spec.ts:49` [chromium] Six-engine chrome-less embeds (#615) › renders each engine in the shared embed runtime at 
- `artPieceSixEngineRegular.spec.ts:55` [chromium] Six-engine regular canonical viewer (#607) › renders every engine through the slug route a
- `pieceStageSizing.spec.ts:10` [chromium] Generated regular-piece stage sizing (#703) › keeps the canonical regular stage responsive
- `pieceToolbarPlacement.spec.ts:10` [chromium] regular generated-piece toolbar placement (#706) › keeps controls above the stage, wraps m

### #1176 — HTML export 44px targets (1)
- `exportArtifacts.spec.ts:234` [chromium] HTML export: responsive piece action surface › stacks labeled actions and confines scrolli

### #1177 — content panel shadow height drift (NEW) (1)
- `contentPanelShadow.spec.ts:57` [chromium] SPA content panel follows each site shadow presentation (#1146) › offset · dark · 375x812  **NEW**

### #1178 — 3D drawing plane pixel coverage (1)
- `drawingPlane3d.spec.ts:147` [chromium] drawing plane renders in 3D scenes (#779, #780, #785, #786) › threejs on the immersive rou

### #1179 — auth policy copy/background (2)
- `authPolicy.spec.ts:5` [chromium] Google-only account creation policy › desktop auth pages use the dark shell and preserve p
- `authPolicy.spec.ts:23` [chromium] Google-only account creation policy › mobile auth pages preserve the same policy and remai

### #1180 — authoring ownership gate (authorization check) (2)
- `authoringOwnershipGate.spec.ts:32` [chromium] Authoring workspaces redirect a non-owner away from owner controls (#458) › a published 2D
- `authoringOwnershipGate.spec.ts:90` [chromium] Authoring workspaces redirect a non-owner away from owner controls (#458) › a published 3D

### #1181 — local gallery cards (1)
- `localGalleryCards.spec.ts:9` [chromium] Local project gallery cards (#1087) › renders local metadata, thumbnails/fallbacks, and re

### #1182 — public gallery engine filter (2)
- `publicGalleryEngine.spec.ts:16` [chromium] public gallery engine filter (#564) › derives supported engines and persists the filter at ×2

### #1183 — sound telemetry Key label (1)
- `sonicTelemetry.spec.ts:46` [chromium] Generated public sound telemetry (#918) › captures eight ambient notes and the C4-C5 major

### #1184 — site content / theme admin specs (4)
- `adminThemeGeneration.spec.ts:7` [chromium] admin can generate, inspect, accept, and restore a custom theme draft 
- `homeHero.spec.ts:43` [chromium] home hero (#648) › renders configured hero, CMS content, and keyboard-focusable See More C
- `homeHero.spec.ts:65` [chromium] home hero (#648) › wraps long configured titles without horizontal overflow on mobile 
- `themeCustomization.spec.ts:10` [chromium] Theme customization (#521) › admin and profile token controls are scoped and responsive 

### #1185 — long-running specs with protocol/connection errors (3)
- `authoringWorkflow740.spec.ts:127` [chromium] reference-style authoring workflow (#740) › creates, publishes, views, downloads, and refi
- `layersPanel.spec.ts:350` [chromium] Layers panel › pointer drag-and-drop, keyboard reorder, and a locked-layer drop rejection  **NEW**
- `publicPieceSurfaceContract744.spec.ts:80` [chromium] public generated-piece surface contract matrix (#744) › keeps route consumers aligned with

### #1186 — aiAndRecovery explicit Save ZIP download (NEW) (1)
- `aiAndRecovery.spec.ts:707` [chromium] Local and server draft autosave › explicit Save and its interaction with sync failures, pe **NEW**

## Suggested implementation order (batch rule: one implementer per shared file; one gate)

1. **P0 checks first, no code until classified:** #1163 (injection audit), #1180 (ownership gate). A real finding becomes a security/authorization issue and blocks the batch gate.
2. **Probable shared root:** #1164 (profile PATCH 400) before #1165, #1173, #1174.
3. **Setup migration family:** #1168 and #1169 (Gallery-click creation), then #1170 (AI routes and menus), sharing `project3dLifecycle.spec.ts` and the support helpers.
4. **Selector and contract drift (independent, parallelizable by file):** #1160, #1161, #1162, #1166 (then the shim removal #1187, decided in #1167), #1172, #1175, #1179, #1182, #1183, #1184.
5. **Regression checks with bisect:** #1177 (NEW), #1178, #1176. (#1175 is confirmed test drift; one owner confirmation: phone toolbar below the stage.)
6. **Diagnosis-first:** #1171, #1185, #1186, #1181.
7. **Gate:** one `workflow_dispatch` of the full 16-shard matrix on the final commit; reconcile #1096 from its result.

Shared files to serialize: `frontend/e2e/support/*` (helpers), `frontend/src/index.css` (shell and stage regions), `PieceStageToolbar.tsx` (#1167 decided: remove → #1187), `backend/scenes/profile_api.py` (#1164, #1165), `src/export/generateHtmlExport*.ts` (#1163, #1176).
