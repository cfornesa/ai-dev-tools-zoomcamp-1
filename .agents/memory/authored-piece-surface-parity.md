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
next implementation handoff is #348 only.

Deployment identity correction (2026-09-03): authenticated Chrome inspection of
the supplied 3D editor and anonymous inspection of the supplied public 2D URL
both served `assets/index-WKdMIR98.js`, while the reviewed checkout was at
`0f5834b` with the #348 mobile containment fix in `51e27b8`. The live editor
does expose the hamburger, named stage controls, and Draft/Published disclosure
after opening the menu; the public viewer exposes its permitted controls after
the same entry action and correctly omits private authoring/publication actions.
The owner-visible mismatch is therefore partly explained by stale publication
and browser authentication/state, but the requested visual parity is still
unproven. Never close #348 or route children until the exact reviewed asset is
published and fixed-viewport screenshots/interactions are reconciled.
Fresh owner re-audit (2026-09-03): the exact authenticated 3D editor and public
URL both served `assets/index-WKdMIR98.js`, while `origin/main` was at `beab74a`
with #348's mobile containment fix in `52b87c9`. The live editor's opened mobile
command card remained visibly cramped, and the public fixture was `Blank canvas`
(2D), not the expected 3D sphere; its hamburger remained underneath the opened
card at 375px. Treat this as stale deployment/fixture identity plus unresolved
rendered parity, not as closure evidence. The PHP contract still requires
stage-local compact controls, explicit publication state, and functional
capability/privacy parity across regular, embed, immersive, and downloaded
surfaces. Reconcile #347/#348 and deployment identity before route children.

Release identity recheck (2026-09-03): the authenticated Replit `creatrweb`
workspace reported published checkpoint `8d8f70e` from approximately two hours
earlier and still offered `Republish`, while GitHub `origin/main` was `54cbb8d`.
The live `index-WKdMIR98.js` bundle is therefore not the reviewed revision.
Pull/Sync and Republish are external mutations owned by the release operator;
published status alone is not asset identity. #321's separate repository
Compose identity issue was verified closed and should not be reopened for this
deployment mismatch.

Owner-reported parity reset (2026-09-03): the owner subsequently reported
that the supplied editor/public routes still do not provide the requested
usable parity. A fresh read-only audit found the private `/projects3d/:id`
URL unavailable in the current anonymous browser session and the public
`/p/:id` URL rendering the `Blank canvas` 2D fixture with a hamburger that
opens only the permitted public controls. The expected authenticated editor
authoring surface, Draft/Published reversal, expected public 3D fixture, and
downloaded-runtime behavior were not all proven. This does not reopen #347 or
any other closed issue; #347 remains permanently closed. New gaps belong to
criterion-ready #352–#358 or future linked issues. Earlier closure comments
that relied on a local/disposable run,
DOM roles/bounds, or a different fixture/revision are not evidence against
the owner's current report. The complete closure-ready manifest and
dependency order are recorded in the final distillation section of
`docs/tasks.md`.

AI 2D publication capability closure (2026-09-03): issue #340 is permanently
closed for the local stage-local publication implementation. Its real browser
path passed 3/3 across Chromium, Firefox, and WebKit, including the hamburger
dialog, publish confirmation, and Published → Draft transition. The
acceptance test now follows the current stacked dialog contract rather than
obsolete fixed icon geometry. Deployed verification remains the immutable
#326 boundary; later gaps do not reopen #340.

Manual 3D publication QA boundary (2026-09-03): #341 remains open because
`manual3dStageChrome.spec.ts` passed Chromium and WebKit but Firefox timed out
while selecting the hidden Movement instrument control after the shared Piece
controls interaction. This is a cross-browser control-state/test-contract
defect, not an external dependency blocker; do not advance the queue or close
the issue until engineering and QA reconcile it.

AI 2D responsive closure (2026-09-03): issue #326 is permanently closed for
the authenticated `/ai-projects/:id` consumer. Live audit found its direct p5
canvas retained an 800px inline width at 375px, causing horizontal document
overflow. A route-scoped CSS rule scales the rendered canvas proportionally
without changing logical scene dimensions, and `frontend/e2e/ai2dResponsive.spec.ts`
passed at 375x812 in Chromium, Firefox, and WebKit. This is not evidence for
AI 2D publication (#340), other routes, artifacts, or any closed issue; later
parity gaps require new/open linked work and never reopen #326.

Manual 2D publication capability closure (2026-09-03): issue #338 is
permanently closed for the local stage-local publication implementation. Its
browser acceptance passed 6/6 across Chromium, Firefox, and WebKit against the
disposable stack, covering Draft/Published disclosure, keyboard activation,
legacy-header removal, and fullscreen synchronization. Deployed route
verification remains the immutable #325 boundary; later gaps do not reopen
#338.

Deployed parity rejection audit (2026-09-03): authenticated Chrome can load
the exact manual 3D owner route, but it serves stale asset
`index-CecM7AFX.js`, which lacks the checkout's newer 3D authoring submenu;
this is #355's deployment-verification boundary. Anonymous access to the
exact public URL serves the `Blank canvas` fixture from that same asset; its
hamburger exposes public controls, but not the intended non-empty piece; this
is #356's fixture-verification boundary. Do not reopen closed implementation
issues in response to this evidence. Require the reviewed revision to be
published and verify the exact owner/public routes before claiming parity.

Portable 3D artifact closure (2026-09-03): #351 is permanently closed for
the extracted Full/Non-Camera runtime transaction. The generated ZIPs use a
closed hamburger plus accessible stacked action dialog, with opened-only
scrolling for expanded content; Full retains camera/hand and sound behavior,
while Non-Camera excludes camera permission/UI, hand tracking, and MediaPipe.
The local published-fixture browser matrix passed 12/12 across Chromium,
Firefox, and WebKit, including extraction, rendering, controls, keyboard
travel/reset, and capability-boundary checks. A separate publication-panel
viewport failure discovered during that run is new issue #361; it must not
reopen #347 or #351.

Publication panel closure (2026-09-03): #361 is permanently closed. The 3D
publication disclosure opens upward from the stacked stage command card so
Draft/Published stay within the viewport and remain normal pointer actions;
the closed status surface has no ordinary scrollbar. The complete 3D browser
lifecycle matrix passed 12/12 across Chromium, Firefox, and WebKit. Later
publication-placement or deployed-route gaps require new issues and must not
reopen #361 without explicit owner authorization.

Per-voice instrument closure (2026-09-03): #345 is permanently closed. The
React 3D Piece controls expose independent Ambient, Movement, and Melodic
instrument selectors with stable Synth defaults and explicit sound-enable
gating. Focused audio/component tests passed 49/49 and the cross-browser
manual 3D smoke passed 3/3 after changing Movement to FM Synth while the
other voices stayed Synth. Later audio or route gaps require new issues and
must not reopen #345 without explicit owner authorization.

Remaining queue distillation (2026-09-03): after #345 closure, #355 and #356
remain deployment/session blockers, #360 depends on #356, and #344 remains
blocked on physical held-pinch evidence unavailable to the browser harness.
#324/#320 are reconciliation parents, not independent implementation units.
Do not reopen any closed issue or invent a duplicate; resume the FIFO queue
when the owner-authenticated published fixture/session or reliable manual
camera evidence becomes available.

Canonical distillation correction (2026-09-03): the prior audit history used
incorrect language about reopening #274, #324, and #347. Closed issues are
immutable unless the owner explicitly names that exact issue and authorizes
reopening it in the current conversation. No such authorization applies to
this audit; those issues, plus #348, #350–#353, #357–#359, and #361, remain
closed. Later owner rejection, stale deployment, wrong fixture, or broader
pieces-parity evidence must be recorded against a new or already-open
criterion-ready issue. The canonical current manifest is the final
distillation section of `docs/tasks.md`.

Fresh live audit (2026-09-03): authenticated manual 3D
`/projects3d/f3863d2f-d3a5-41ad-9883-7b8441af6217` serves
`assets/index-CecM7AFX.js`; its opened menu has runtime/editor/publication
controls but not the local checkout's newer `3D authoring` submenu. Anonymous
`/p/7b2ecd2b-0a46-4031-b4a2-bb6b9cd74df2` serves the `Blank canvas` fixture;
its hamburger exposes permitted public controls, but it is not the intended
non-empty example. These are #355 and #356's open deployment/fixture
boundaries, respectively. The application remains Django/Python with a
React/TypeScript frontend; the PHP repository is only the pieces parity
reference, not an implementation target. No new duplicate issue was created.

Manual 2D route closure (2026-09-03): #325 was processed as its own route
transaction and closed completed after exact authenticated rendered inspection
at 1280×900 and 375×812 plus 67/67 focused React tests. The stage-local
hamburger surface showed the finite manual 2D authoring/runtime/publication
controls without overlap or an internal scrollbar. This evidence belongs only
to `/projects/:id`; it does not prove AI, 3D, public, embed, immersive, or
downloaded surfaces, and #325 must not be reopened for those gaps.

Portable 2D responsive closure (2026-09-03): #357 is permanently closed for
the extracted artifact's responsive action surface. The artifact now packages
an accessible hamburger menu, fullscreen translucent overlay, stacked labeled
actions, focus/Escape handling, body-scroll locking, and a separately
scrollable Piece controls panel while retaining screenshot, fullscreen,
motion/demo, and gesture-gated camera functions. Closure evidence is 68
focused export/runtime tests, frontend typecheck/build, and 54/54
Chromium/Firefox/WebKit browser-QA scenarios at 1280x900 and 375x812. Later
artifact parity gaps must be new issues; do not reopen #357 without explicit
owner authorization naming #357 in the current conversation.

Manual 3D authoring closure (2026-09-03): #358 is permanently closed for the
local manual 3D editor transaction. The stage menu now exposes a separate
`3D authoring` submenu with Add sphere, Add plane, Delete selected object,
Duplicate selected object, Undo, Redo, Add group, Delete selected group, and
Save scene. Outline selection feeds the commands, working-scene mutations are
undoable, and save uses the existing scene-version endpoint while publication
remains independent. Evidence: 32 focused workspace/popover tests, 2,400
full frontend tests, lint/typecheck/build, and 3/3 manual-route browser QA
across Chromium/Firefox/WebKit. Exact republished owner-session verification
remains #355; later gaps must be new tasks and must not reopen #358 without
explicit owner authorization naming #358 in the current conversation.

Manual 3D responsive closure (2026-09-03): #359 is permanently closed for
the authenticated manual 3D editor route. The preview frame uses a fluid 16:9
aspect-ratio box, and renderer/camera dimensions remain synchronized so uniform
spheres are not deformed by responsive layout; object transforms are not
rewritten. Evidence: 17 focused render tests, full `make check`, and 3/3
Chromium/Firefox/WebKit route QA at 1280x900 and 375x812. Exact republished
owner-route evidence remains #355. Later gaps must be new issues and must not
reopen #359 without explicit owner authorization naming #359.

Route atomicity distillation (2026-09-03): the former #349 contract combined
authenticated manual 3D editor geometry and anonymous public 3D viewer
geometry despite different entry points, fixtures, permissions, and deployed
evidence. Preserve #349 as the parent/reconciliation container; #359 is the
criterion-ready manual-editor child and the next independent transaction, while
#360 is the criterion-ready public-viewer child blocked by #356's intended
published fixture. Closed issues remain immutable, and PHP remains reference
material only.

Closure correction (2026-09-03): the owner explicitly confirmed that closed
issues are immutable unless that exact issue is explicitly authorized for
reopening in the current conversation. The later closure transaction closed
#352 permanently for its repository-backed manual 3D owner-editor integration:
44 focused tests and the disposable PostgreSQL browser gate passed in
Chromium, Firefox, and WebKit at both required viewports. Exact republished
owner-session verification was unavailable, so fresh criterion-ready #355 owns
that deployed boundary. Do not reopen #352 or any other closed issue for later
parity gaps; distill a linked task instead. Product implementation remains
Django/Python plus React/TypeScript; PHP is reference-only.

Shared editor overlay closure (2026-09-03): fresh issue #354 replaced the
previously reopened #348. Its existing Django/React implementation passed
focused editor/component tests 56/56, frontend lint/typecheck/build, and the
Docker-backed manual2dStageChrome browser scenario 6/6 across Chromium,
Firefox, and WebKit at 1280x900 and 375x812. It is closed as completed for
the local shared overlay contract. This does not prove the published manual
3D route; #352 owns that new route-level task. Closed-task immutability and
explicit owner authorization for reopening still apply.

Public 2D closure boundary (2026-09-03): #353 is permanently closed for the
repository-backed public 2D stage-controls integration after 47 focused tests,
lint, typecheck, and build passed. Existing disposable anonymous coverage
confirms the shared viewer contract. Exact republished fixture identity and a
complete two-viewport rendered matrix were unavailable, so fresh #356 owns
that deployed verification. Never reopen #353 for #356 or a later parity gap.

Portable 2D closure boundary (2026-09-03): #350 is permanently closed for the
repository-backed extracted 2D runtime after 105 focused tests and 51
disposable artifact browser tests passed across Chromium, Firefox, and WebKit.
The tests prove standalone execution, capability variants, gesture-gated
camera behavior, privacy exclusions, and ZIP output. Fresh #357 owns the
remaining responsive rendered-geometry evidence; never reopen #350 for it.

Fresh published audit (2026-09-03): the current authenticated 3D editor serves
`assets/index-CecM7AFX.js`, matching the current local production build. Its
hamburger opens the shared runtime/publication surface and shows Draft/Published
status, but the 3D editor has no equivalent authoring command set for adding,
duplicating, deleting, or undoing scene objects; fresh #358 owns that defect.
The 2D editor does expose those authoring actions under Preview hamburger → Edit
scene. The anonymous public URL currently exposes its permitted controls but
serves the wrong `Blank canvas` fixture, so #356 remains a deployment/fixture
blocker. Treat prior broad closures as scope-limited historical transactions;
never reopen them, and never use local DOM/source evidence as exact deployed
visual parity proof.

Scoped completion correction (2026-09-03): the owner clarified that #347 is
functionally complete after its significant shared PieceStageToolbar,
StageControlsPopover, publication-disclosure, and focused-test work. Its
closure is intentionally scoped to that shared implementation contract. Exact
route parity, editor authoring placement, responsive 3D projection, extracted
artifact behavior, and Docker/browser/deployment readiness are shifted to the
linked queue issues (#325–#337, #348–#349, and #320/#324) and must not reopen
#347 merely because they remain incomplete. The durable closure format is
`implemented/verified here` plus `shifted to linked work`; #347 is closed as
completed in GitHub and the FIFO queue may rotate only after this terminal
state is recorded. A linked issue cannot reopen it; reopening would require
the owner to explicitly authorize reopening #347 in the current conversation.

Parity target boundary (2026-09-03): “full CMS parity” means only the PHP
repository's pieces implementation as a behavioral/design reference and this
app's Django/Python backend plus React/TypeScript frontend's eventual ability
to create, render, publish, embed, immerse, and package pieces like the
maintained examples/fixtures. PHP is not implemented in this repository. It
does not mean the entire augment-humankind CMS. Groom each follow-up around
one pieces surface or workflow and do not import blog, collection,
site-administration, or unrelated content-type requirements.

Fresh owner audit and replacement-task rule (2026-09-03): the supplied
published manual 3D editor route currently renders an access/availability
message in the available anonymous session; the supplied public 2D route
initially exposes only its hamburger and reveals its stage controls only after
activation. The owner also reports that the editor still uses the bulky
out-of-canvas action scheme and lacks a visible Draft/Published transition.
These observations are new parity evidence for the pieces subsystem. They
must not reopen #347. New contracts were filed as #352 (manual 3D editor),
#353 (public 2D), #350 (portable 2D), and #351 (portable 3D); legacy
#327/#329/#336/#337 were superseded and closed not-planned. Reopening any
closed task requires the owner's explicit authorization naming that issue in
the current conversation.

Scoped completion correction (2026-09-03): the owner clarified that #347 is
functionally complete for the shared PieceStageToolbar/StageControlsPopover
implementation after its significant engineering and focused-test work.
Unimplemented or unverified route, deployment, artifact, and readiness pieces
are shifted to the linked #325–#337, #348, #349, and #320/#324 contracts.
The #347 closure record must explicitly separate `implemented/verified here`
from `shifted to linked work`; linked work does not reopen #347 unless it
directly contradicts the narrowed shared implementation contract. This is the
required FIFO rotating-queue behavior.

Current transaction blocker (2026-09-03): #347's focused shared-component
tests pass, but the required Docker-backed browser runner could not produce
rendered evidence. The sandbox could not access Docker's socket; an approved
host retry started the disposable PostgreSQL container, which never became
ready, so no browser scenario ran. Classify this as a workflow/infrastructure
verification boundary, keep #347 open, retain the runner logs, and rerun the
same browser gate before closure. Do not convert the focused test result into
visual or deployed parity evidence. A post-blocker distillation found no new
duplicate issue; #320 already owns this release/runner blocker class.
Owner mobile-overlay refinement (2026-09-03): the translucent fullscreen
overlay is the accepted interaction model, but the owner rejects a horizontal
desktop-style action row on phones. At `375x812`, the shared command card must
stack one action per row, remain fully styled and keyboard accessible, avoid
all control overlap, and show no internal scrollbar. This refines #347 rather
than creating a duplicate; desktop compact geometry and per-route evidence
remain separate criteria.
Unified overlay decision (2026-09-03): the owner prefers the command card's
stacked action-list presentation at desktop and mobile, not only at the phone
breakpoint. Use compact icons beside their associated text, keep one action per
row, and require no command-card scrollbar or overlap at both fixed viewports.
Publication disclosure refinement (2026-09-03): the opened Draft/Published
panel must be compact and stage-contained at both fixed viewports. An internal
scrollbar is acceptable only for deliberately expanded disclosure content, not
for the closed command card or an ordinary status toggle.
Closure evidence (2026-09-03): published asset `index-CecM7AFX.js` passed the
authenticated 3D and anonymous public 2D #347 checks; GitHub comment
`5520431795` contains the matrix and issue #347 is closed. The original issue
body retains legacy unchecked boxes because the connector rejected a body
rewrite; do not treat those stale boxes as new work without reconciling them
against the closure comment and this task record.

Owner-reported parity reset (2026-09-03): the owner subsequently reported
that the supplied editor/public routes still do not provide the requested
usable parity. A fresh read-only audit found the private `/projects3d/:id`
URL unavailable in the current anonymous browser session and the public
`/p/:id` URL rendering the `Blank canvas` 2D fixture with a hamburger that
opens only the permitted public controls. The expected authenticated editor
authoring surface, Draft/Published reversal, expected public 3D fixture, and
downloaded-runtime behavior were not all proven. This does not reopen #347 or
any other closed issue; #347 remains permanently closed. New gaps belong to
criterion-ready #352–#358 or future linked issues. Earlier closure comments
that relied on a local/disposable run,
DOM roles/bounds, or a different fixture/revision are not evidence against
the owner's current report. The complete closure-ready manifest and
dependency order are recorded in the final distillation section of
`docs/tasks.md`.
