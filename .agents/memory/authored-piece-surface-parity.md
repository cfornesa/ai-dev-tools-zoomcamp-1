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

Linked backlog: #320, #325–#349. #274 and broad #324 are reconciliation
containers, not implementation units; they were reopened on 2026-09-03 after
the owner reported that their requested parity was still unmet. Replacement
issues remain deliberately one route, surface, variant, or downloaded
capability each.

Deployment re-audit (2026-09-02): direct inspection of the supplied live URLs
found that the published revision still serves the legacy structured UI. The
public 2D piece `/p/7b2ecd2b-0a46-4031-b4a2-bb6b9cd74df2` has a sibling
“Demo and camera controls” region outside the Preview stage and no screenshot,
download, fullscreen, or stage-local publication controls. The supplied
`/projects3d/f3863d2f-d3a5-41ad-9883-7b8441af6217` URL returns the anonymous
“doesn't exist, or you don't have access” state, so it does not prove an
authenticated editor contract. Local disposable-stack browser passes prove
only the checked-out revision; they are not live evidence until that revision
is intentionally published and the exact URLs are rechecked. Keep #320 open
and use #325–#337 for route/artifact verification.

The local `PublicProjectViewer.tsx` camera-source defect was corrected during
#329 engineering: the active public camera `<video>` is now visible behind the
transparent artwork canvas, while the canvas remains the layer-aware
composite. The focused unit/static checks pass; this does not establish
deployed proof.

The 2026-09-02 disposable Chromium publishing run could not create its public
fixture because `POST /api/projects/<id>/publish/` returned 404 even though
the focused backend publish API suite passed 18/18 plus one skip. Treat this as
a runner/auth-fixture reconciliation blocker for #329, not as evidence that
the public viewer implementation passed.

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

Production closure re-audit (2026-09-02): direct inspection of the supplied
deployed public 2D URL still showed the legacy Preview plus sibling Demo and
camera-controls layout, with no stage-local screenshot, download, fullscreen,
or publication controls. The supplied private 3D editor URL could only show
the anonymous access-denied/unavailable state. The checkout contained newer
local implementations, but `main` was 82 commits ahead of `origin/main` and
had not been intentionally published. Local, localhost, disposable-stack,
source-string, or focused-test evidence cannot close a deployed
route/artifact criterion; each surface needs its own fixed fixture, exact
entry point, finite checklist, and evidence from the revision under test.

Deployment revision reconciliation (2026-09-02): local `main` is at
`0c6bc5f` and 128 commits ahead of `origin/main` at
`14e01334e7ff827189162df5db993d7a0f001a71`, whose GitHub metadata identifies
Replit's `Published your App` commit. The live site therefore cannot contain
the local parity work until an authorized push/publish operation. Treat this
as the current replacement for earlier ahead-count observations.

Owner re-audit reinforcement (2026-09-02): the owner reports that the
deployed editor still exposes the old bulky functional-button layout and does
not expose the expected Draft/Published reversal, while the deployed public
piece still has no visible controls. Treat this as confirmation of the live
contradiction, not as evidence that the newer checkout implementation shipped.
The editor closure matrix must enumerate authoring controls as well as runtime
and publication controls; the shared stage toolbar alone is insufficient.
Re-groom each editor, public, embed, immersive, and downloaded-artifact route
independently before engineering. Do not create a duplicate deployment issue:
#320/#321 own that boundary, and authenticated GitHub updates remain pending
when the API is unavailable.

Closure process rule: when a non-user-judgment dependency or environment
blocker ends an issue, run a fresh task-distillation reconciliation before
selecting the next issue. Recheck duplicates, dependency order, closure
criteria, blocker ownership, and follow-up issue coverage.

Responsive command-surface decision (2026-09-02): the owner prefers a
stage-associated hamburger command surface on narrow authored-piece views over
a dense persistent action rail. The trigger opens a fixed/inset translucent
full-viewport overlay; each subordinate menu has a visible X/Close action,
Escape dismissal, focus entry/restoration, and background scroll/hit-test
isolation. Keep accessible names and keyboard operation even when visual action
labels collapse to icons. Treat this as the shared #347 shell contract, with
#348 owning editor authoring commands and each route/artifact retaining its own
deployed verification boundary.

Consumer-layout lesson (2026-09-02): a shared `PieceStageToolbar` does not
guarantee parity when a consumer omits the inner control-group layout class.
The outer absolute rail can exist while direct child wrappers still collapse
controls into block flow. Every route consumer must be inspected and browser-
asserted for both outer stage placement and inner horizontal compact geometry;
do not infer public/embed parity from the shared component or another
consumer's CSS.

Fresh owner-evidence audit (2026-09-02): the authenticated GitHub connector
confirmed that #340 and #342 had been closed while the supplied deployment
still contradicted the requested parity. Both were reopened with explicit
re-audit comments. The public URL still renders the legacy sibling camera and
demo-control shell; the supplied private 3D editor URL is anonymous and only
returns the unavailable state. This is the canonical example that local
disposable-browser evidence must not close a deployed route or shared
capability. The next required gate is #321/#320 deployment identity and
authorized publication, followed by exact authenticated editor and anonymous
public route QA.

Closure reset lesson (2026-09-02): checked-off issue criteria and passing
disposable-stack tests are not deployed parity evidence. Compare each supplied
live URL with the current checkout and published revision before engineering;
when they differ, reset the issue to open and classify the gap as a
verification boundary. Keep one route or capability per issue and never let a
parent rollout or local browser pass close a deployed surface.

Authenticated Chrome handoff (2026-09-02): the owner-authenticated 3D editor
verified the stage-local runtime controls, camera activation/stop, five-step
guide, and Draft/Published reversal. The deployed revision still lacked the
checkout's `View immersive piece` wiring (`4f912c9`), so #327 remains open until
that reviewed revision is pushed, republished, and rechecked at the exact URL.
The public 2D route independently showed its compact stage toolbar in the same
session; do not transfer that evidence to any 3D route or extracted artifact.

Live revision reconciliation (2026-09-02): after reviewed commit `0721322`
was pushed, authenticated Chrome still received `assets/index-DIraFw-9.js`.
The exact 3D editor had no hamburger trigger and rendered the legacy 851x106px
desktop / 276x290px mobile rail; the public 2D route had direct controls but no
hamburger in that authenticated session. Treat this as proof that the
published bundle and reviewed GitHub revision are different states, not as
successful deployment verification. Reconcile bundle identity before closing
#347/#348 or any dependent route issue, and capture anonymous public evidence
separately from authenticated owner evidence.

Replit source-sync diagnosis (2026-09-02): the authenticated Git panel showed
`Sync Changes 1`, latest visible workspace commit `fix: keep editor overlay
within mobile stage` (`4a9bd38`), and `Not pushed to remote`, while GitHub
`origin/main` was `a130261`. A successful Replit publication can therefore
serve an older workspace snapshot. Require Pull/Sync to the reviewed GitHub
revision before exact-route parity QA; publish status alone is not revision
identity. Pull/Sync is a workspace mutation and requires explicit approval.

Owner re-audit and distillation reset (2026-09-03): current published asset
`index-WKdMIR98.js` contains a partial hamburger implementation and named
controls in a closed overlay, but that is not proof of the requested rendered
parity, fixed-viewport visual treatment, route coverage, or downloaded-runtime
behavior. The owner still reports absent/unusable public controls, a bulky
editor action scheme outside the canvas, and no discoverable Draft/Published
switch. Reopened #274/#324 are historical reconciliation containers. The
complete manifest is `.local/tasks/authored-piece-parity-distillation.md`; the
next implementation handoff is #347 only.
