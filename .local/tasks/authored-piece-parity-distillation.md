# Authored-piece parity distillation — 2026-09-02 re-audit

Project: `ai-dev-tools-zoomcamp-1`; behavioral reference:
`../augment-humankind/docs/piece-surface-parity.md`.

## Distillation gate

No product source or product-test changes are authorized during this audit.
Every implementation or verification issue must have one entry point, one
fixture/precondition, finite named controls/states, exact agent-runnable
checks, explicit N/A decisions, and one evidence boundary. Completion means
GitHub closure after QA; local implementation, green tests, or a shared
component never close a deployed route.

## Current authoritative evidence

- The checkout and `origin/main` contain `PieceStageToolbar` consumers in the
  2D and 3D editor/public surfaces. The published Replit commit `050fe8e`
  descends from `d142430`, so the earlier “not pushed” explanation is stale.
- Fresh anonymous inspection of the supplied public fixture
  `https://animate.creatrweb.com/p/7b2ecd2b-0a46-4031-b4a2-bb6b9cd74df2`
  renders a visible `Piece actions` toolbar at non-zero bounds with
  screenshot, download, Piece controls, and fullscreen. Asset:
  `assets/index-CKhsUQOh.js`.
- Fresh inspection of the supplied editor URL
  `https://animate.creatrweb.com/projects3d/f3863d2f-d3a5-41ad-9883-7b8441af6217`
  is anonymous and returns “This project doesn't exist, or you don't have
  access to it.” It proves neither presence nor absence of editor controls.
- The public gallery currently exposes only the 2D fixture. The corresponding
  `/p3d/<id>` and `/embed/p3d/<id>` targets have no published 3D fixture.
- Production Full and Non-Camera 2D downloads were captured as standalone
  HTML, but the approved in-app browser rejects `file://` navigation. Static
  inspection is therefore not artifact execution evidence.
- The PHP reference requires stage-associated compact controls, capability-
  driven sound/camera/hand behavior, privacy-safe permission timing, and
  working downloaded runtimes. The React 2D capability contract currently
  sets `sound: false`; this is a confirmed parity question requiring an
  explicit product decision or implementation task, not an implicit N/A.
- Fresh live screenshots on 2026-09-02 contradict the prior closure evidence:
  the manual 3D editor shows a dense glyph-only authoring/runtime row inside
  the stage, while the closed-state publication control exposes only an icon;
  the public 2D viewer shows glyph-only controls that are easy to miss and do
  not visually communicate their actions. DOM role presence and non-zero
  bounds were insufficient evidence for the requested visual parity.
- The shared editor source still defines a separate `Editor actions` toolbar
  containing Add shape, History, Edit shape, Layer/group actions, color, and
  Save controls. Its current tests assert containment/roles, not the absence
  of the dense competing visual row required by the user's parity request.

## Complete manifest and order

| Issue | Entry/scope | Dependencies | Status | Exact next action |
| --- | --- | --- | --- | --- |
| #320 | Parent authored-piece reconciliation | all children | open roll-up | reconcile only after children pass |
| #346 | Shared structured 2D sound capability | #320; existing audio foundation | open / newly filed | groom and engineer only after this distillation exits |
| #347 | shared stage control discoverability/status affordance | #320 | reopened / re-distill | re-groom closure evidence and verify recognizable rendered controls plus explicit Draft/Published state on a published revision |
| #348 | shared editor authoring overlay layout | #320; #347 ordering decision | reopened / re-distill | re-groom closure evidence and verify one compact rendered authoring surface at fixed viewports on a published revision |
| #325 | authenticated manual 2D `/projects/:id` | #347/#348; owner browser | reopened | reverify visual controls, authoring overlay, and status transitions |
| #326 | authenticated AI 2D `/ai-projects/:id` | #347/#348; owner browser | reopened | reverify visual controls, AI/editor overlay, and status transitions |
| #327 | authenticated manual 3D `/projects3d/:id` | #347/#348; owner browser + 3D fixture | reopened | reverify actual screenshot/layout and status transitions |
| #328 | authenticated AI 3D `/ai-projects3d/:id` | #347/#348; owner browser + 3D fixture | reopened | reverify actual screenshot/layout and status transitions |
| #329 | anonymous public 2D `/p/:id` | published 2D fixture | reopened / disputed | reconcile user-visible conflict at exact URL/viewport/cache |
| #330 | anonymous public 3D `/p3d/:id` | #347; published 3D fixture | reopened | reverify visible/discoverable controls and privacy |
| #331 | anonymous 2D `/embed/p/:id` | published 2D fixture | reopened / disputed | reconcile user-visible conflict independently |
| #332 | anonymous 3D `/embed/p3d/:id` | #347; published 3D fixture | reopened | reverify visible/discoverable chrome-less controls |
| #333 | regular immersive 3D | #347; published 3D fixture | reopened | reverify visible/discoverable controls/privacy |
| #334 | custom immersive `?embed=1` | #347; published 3D fixture | reopened | reverify visible/discoverable query-variant controls |
| #335 | CMS immersive `?embed=1&cms=1` | #347; published 3D fixture | reopened | reverify visible/discoverable CMS controls |
| #336 | extracted standalone 2D artifact | approved file-capable browser | blocked | execute captured Full/Non-Camera files |
| #337 | extracted Full/Non-Camera 3D artifacts | published 3D fixture + file browser | dependency-blocked | download, extract, execute both variants |
| #295 | five-slide 3D hand guide | #347; published 3D fixture | closed / capability only | route consumers must pass refreshed visual affordance checks |
| #342 | independent 3D camera view | #347; published 3D consumer | closed / capability only | route consumers must pass refreshed visual affordance checks |
| #344 | 3D hand Move/strafe | published 3D + physical/manual camera | dependency-blocked | run movement evidence and guide consistency |

Records #338–#341 are reopened because their publication criteria accepted an
icon-only trigger as “named Draft/Published” and did not test the user-visible
affordance. #343 and #345 remain historical narrow prerequisites. Historical
umbrellas #274/#323/#324 remain non-implementation containers. #321 is closed
and is not a duplicate deployment task.

## Confirmed gap definitions

1. Public 2D user-visible discrepancy (#329): one fresh browser sees the
   toolbar while the owner reports no controls. Pass requires exact URL,
   viewport/cache/device evidence, non-zero visible control bounds, and
   functional named actions; fail must identify the differing asset or CSS/
   runtime condition. `publishingAndRemix.spec.ts` is supplementary local
   evidence only.
2. Embedded 2D discrepancy (#331): same finite contract and fixture as the
   chrome-less `/embed/p/:id` entry, independently checked for absent site
   chrome and visible stage controls.
3. Authenticated editor parity (#325–#328): each route gets its own owner
   fixture and browser transaction. The finite checklist includes exact
   stage-local runtime controls, authoring/AI actions, Draft → Published →
   Draft, no duplicate page-level bulky action row, and rendered containment.
4. 3D publication dependency (#330–#335, #337, #295, #342, #344): no local
   or anonymous evidence can close a route without a published 3D fixture.
5. Download execution (#336/#337): static HTML markers and download clicks do
   not prove parity; extracted Full and Non-Camera artifacts must be opened
   and controls exercised in an approved browser.
6. 2D sound capability: PHP parity offers capability-driven sound controls;
   React currently declares 2D sound unavailable. Groom either a finite
   2D sound implementation slice or a documented product decision that the
   structured 2D contract is intentionally silent. Do not silently mark it
   N/A.
7. Shared visible affordance gap (#347): current glyph-only stage buttons and
   icon-only closed publication state are technically accessible but visually
   undiscoverable in the supplied screenshots. This is a shared implementation
   task; route issues must still verify each consumer.
8. Editor authoring density/placement (#348): the shared editor still defines
   a dense authoring toolbar with ten actions competing with the runtime stage
   controls. Preserve each mutation, but prove a compact canvas-associated
   presentation and absence of the old competing row.

## Duplicate and coverage report

- #320 owns roll-up reconciliation; it is not an implementation issue.
- #325–#337 still cover each route/artifact independently, but the user audit
  invalidated their prior closures; their bodies now require fresh visual
  evidence after #347/#348 where applicable.
- #338–#341 remain the existing publication implementation records and were
  reopened rather than duplicated. #347 owns shared stage affordance; #348
  owns shared editor authoring layout. #295/#342/#344 remain distinct 3D
  capabilities.
- #306/#343/#345 are narrow local prerequisites and cannot prove consumer
  parity. #321 covers Compose identity. No duplicate issue is created in this
  distillation pass. #346 is the only newly discovered implementation gap:
  the existing 2D capability declaration explicitly disables sound while the
  PHP contract makes it capability-driven.

## Blocker triage and handoff

- Missing published 3D fixture: `dependency-blocked` / deployment boundary;
  owner is publication environment; next action is to publish one fixture.
- Anonymous editor access: `verification-boundary`; owner is the authenticated
  browser session; next action is an approved owner-authenticated inspection.
- `file://` browser policy: `verification-boundary`; owner/context is the
  approved browser capability; next action is an approved Chromium context.
- User report versus fresh public DOM: unresolved evidence conflict, not a
  product pass or fail. Keep #329/#331 open until reconciled.
- User screenshot versus prior DOM-only closure: `implementation-defect` for
  the shared discoverability/layout contract; linked follow-ups are #347/#348.
  Reopened route issues remain open until those changes are deployed and
  independently inspected.

## Re-audit after authenticated Chrome verification — 2026-09-02

The connected owner Chrome session verified the exact private 3D editor's
stage-local screenshot, download, sound, Piece controls, steering, guide,
fullscreen, camera-view, and Draft → Published → Draft controls. Camera
activation and safe stop were verified after the owner authorized that flow;
the five guide steps were advanced end-to-end.

This is not complete parity evidence: the deployed editor still reports zero
`View immersive piece` links, while the reviewed checkout contains that wiring
in `4f912c9`. The evidence handoff is `28ece99`, and local Docker-backed
`manual3dStageChrome.spec.ts` passes 1/1. #327 remains open as a
deployment/revision handoff. Its exact next action is authorized push,
republish, and recheck of the exact route before closure.

The supplied public 2D route was independently rechecked in the same Chrome
session and showed non-zero stage-local controls and functional screenshot,
Full/Non-Camera downloads, Piece controls, and fullscreen. This route-specific
evidence does not transfer to 3D or extracted artifacts; #336 remains open
because the captured standalone files have not been executed in an approved
file-capable browser.

No new issue or further decomposition is warranted. #327 owns the
authenticated manual 3D route, #329 the public 2D route, and #336 the extracted
2D artifact. The remaining route and artifact issues retain their own
dependencies and closure contracts.

## Independent editor-route handoffs — 2026-09-02

#325's exact authenticated `/projects/:id` route passed live layout/control
inspection, focused `EditorWorkspace` tests 30/30, full `make check`, and
Docker-backed route QA 1/1. It remains open because its already-Published
fixture was not toggled to Draft: the available user authorization covered
only the temporary 3D publication flow.

#326's exact authenticated `/ai-projects/:id` route passed Docker-backed
`ai2dPublication.spec.ts` 1/1 and live inspection of the route-local AI
region plus the compact Piece actions toolbar. It remains open for the same
unperformed live publication transition boundary. These are independent
handoffs; neither is closed from local evidence or from the other route.

## User-audit re-distillation — 2026-09-02

The earlier closure batch is superseded. It used DOM-role/bounding-box checks
as a proxy for visual parity and allowed shared-component evidence to stand in
for consumer evidence. The authoritative manifest now reopens #325–#328,
#330–#335, and #338–#341, creates #347/#348 for the missing shared
implementation slices, and leaves #329/#331/#336/#337/#344 open with their
existing boundaries. No product source or product tests were changed during
this audit. The next phase must begin with exactly one groomed implementation
issue, then process it through engineering, QA, reconciliation, and GitHub
closure before selecting the next issue.

## Distillation exit

The manifest is complete, duplicates are reconciled, every actionable gap is
linked to an existing issue, and no product change is authorized yet. The next
phase may begin only with exactly one groomed issue after the access/fixture
boundary is resolved; engineering and QA must then finish and close that issue
before the next one begins.

## Current owner re-audit after prior shared closures (2026-09-02)

Status: DISTILLATION ACTIVE — PRIOR #347/#348 CLOSURES REOPENED

The exact supplied routes were inspected again in the connected Chrome session:

- `https://animate.creatrweb.com/projects3d/f3863d2f-d3a5-41ad-9883-7b8441af6217`
  serves `assets/index-B8XLvuYD.js`. Its rendered stage contains the expected
  named DOM controls, but no `[role=tooltip]` nodes or visible publication
  label; the screenshot shows a row of cryptic Unicode glyph buttons.
- `https://animate.creatrweb.com/p/7b2ecd2b-0a46-4031-b4a2-bb6b9cd74df2`
  serves the same `assets/index-B8XLvuYD.js`. Its rendered preview contains
  screenshot, download, Piece controls, and fullscreen buttons, but they are
  glyph-only and visually easy to miss. The displayed page is authenticated
  in this Chrome session, so this is not anonymous privacy evidence.
- The checked-out reviewed implementation is newer than that asset:
  `d945de8` adds shared visible affordances, `8f5a963` consolidates editor
  actions, and `9ca8697` records closure. The commits are present on
  `origin/main`, but the deployed asset has not changed.
- The connected Replit `creatrweb` dashboard's Git panel shows branch `main`
  with a recent Replit Agent commit and “There are no changes to commit.” This
  confirms that the Replit workspace/deployment source is a separate revision
  state from the pushed GitHub `origin/main`; the exact Replit commit hash is
  not exposed in the current read-only panel.

The prior #347/#348 closure transactions were invalid. Their disposable
browser checks asserted DOM roles/bounds but did not provide inspected rendered
screenshots for the required fixed viewports, and the exact published consumer
was not verified after `8ff191a`/`ac66427` were pushed. Fresh Chrome inspection
now shows both supplied URLs still serving the old B8 bundle: editor controls
are Unicode glyphs with an icon-only closed publication trigger, and public
controls are likewise glyph-only. The newer local SVG/overlay source is not
live evidence. Reopen both shared issues and require exact published-revision
inspection plus rendered screenshot evidence before closure.

No duplicate issue is warranted. Existing coverage remains sufficient:

- #347 owns the shared control affordance, but must be re-groomed/reverified
  with recognizable visual icons/labels at both fixed viewports, a persistent
  closed Draft/Published label, and exact published-bundle identity.
- #348 owns the single stage-associated editor control surface, but must be
  re-groomed/reverified with inspected rendered evidence that the unified
  visual layout does not obscure the artwork or collapse at either viewport.
- #325–#337 remain independently open route/artifact contracts; their old
  closure evidence is not revived by the stale asset.
- #346 remains a local 2D sound foundation only. It does not close route or
  download sound parity.

The exact live evidence is a deployment/revision verification boundary for all
route children, while the user-visible glyph/layout failure remains an
implementation contract failure once the correct revision is deployed. No new
duplicate issue is warranted: #347/#348 already own the shared contracts and
#325–#337 own each consumer/artifact. Next groomed issue after this audit:
#347, reopened with the requirement to inspect rendered screenshots and the
exact deployed asset before any closure. The deployment handoff's next action
is to synchronize the Replit workspace to reviewed `origin/main` `ba140ff` (or
an explicitly reviewed descendant), publish it, and recheck the exact URLs;
until then all live route/artifact issues remain open.

## Post-publish verification boundary — 2026-09-02

The reviewed revision was subsequently published through Replit. Both supplied
routes now serve `assets/index-DyASLgrd.js`. Live editor inspection found nine
recognizable SVG stage controls, a visible `Publication status: Draft` label,
and an end-to-end Draft → Published → Draft transition on the supplied 3D
fixture. The live public 2D route visibly renders screenshot, download,
controls, and fullscreen controls in the stage overlay; an inspected render
also confirms that the controls sit over the artwork rather than in the old
page-level action row.

This closes the deployment identity gap for the shared visual implementation,
but not the consumer matrix. During the same inspection, opening the public 2D
download control exposed no Full/Non-Camera menu entries, so public 2D
download behavior remains an actionable route/artifact gap under its existing
consumer issue. Do not transfer shared-control evidence to that issue.

## Blocked-issue distillation: anonymous 2D camera permission — 2026-09-02

The user-authorized #329 camera check reached a browser-chrome permission
boundary, not a product failure: the page displayed its explicit waiting
message, preserved the artwork, exposed Stop camera, and attached no video
while permission remained pending. The connected in-app browser can control
the page but cannot click the address-bar permission bubble. The stream was
stopped safely and the temporary viewport was reset.

No duplicate or implementation split is warranted. #329 remains the sole owner
of anonymous public 2D camera compositing and denial/retry behavior. The
blocker is external browser permission state and is independent of the next
3D embed route; continue with #332 while #329 awaits completion of Allow in
the visible browser context. Do not close #329 from the waiting state.

## Blocked-issue distillation: standalone 2D artifact file execution — 2026-09-02

Issue #336 remains `blocked / verification-boundary`, not an implementation
failure. The captured Full and Non-Camera HTML files exist in
`/Users/Fornesus/Downloads`, and local Docker-backed artifact QA passed 17/17,
but both the in-app browser and the approved Chrome control reject the exact
`file://` navigation required by the closure contract. Browser policy also
prohibits workarounds such as indirect execution or raw CDP.

No duplicate or product follow-up issue is warranted: #336 already owns the
standalone 2D artifact, while #337 independently owns extracted 3D artifacts.
The blocker owner/context is the browser-policy-capable Chromium environment.
The concrete next action is to open both captured files in an approved
file-capable Chromium context, exercise screenshot/fullscreen/Piece controls
and camera fallback, then reconcile #336 before closure. Independent route
issues continue; #336 is not a goal stop.

## Fresh exact-route correction after user unblocked — 2026-09-02

The current authenticated 2D editor was inspected at the supplied project
route. Its `Editor actions` toolbar is technically nested under the stage,
but its rendered bounds are approximately `x=55,y=750,w=711,h=44` inside a
`562px` stage viewport. The result is a dense authoring row at the bottom of
the stage, not the compact overlay treatment described by #348. The stage
contains named controls and the mutation handlers remain present, but those
facts do not satisfy the visual compactness criterion.

The current anonymous public 2D route was separately inspected and does show
four stage controls at non-zero bounds (screenshot, download, Piece controls,
fullscreen). They are small/icon-only in the rendered surface. This does not
disprove the owner's report without reconciling browser, viewport, cache, and
published-bundle context; it does establish that the correct acceptance
contract must test visual discoverability, not just DOM presence.

The live routes currently serve `assets/index-C5ipN-ir.js`, which supersedes
the prior stale B8/CK/Dy asset references in older comments and notes. The
closed GitHub states and later closure comments for #347/#348 conflict with
this fresh rendered evidence and with their finite visual requirements. Both
issues are therefore reopened as `false closure / re-groom required`; no
product source or product tests were changed during this distillation pass.

### Distillation exit decision

No new issue is warranted. #347 owns shared visible stage affordances and
publication-state discoverability; #348 owns the authoring-toolbar placement
and density. #325–#337 remain separate consumer/artifact contracts and must
not inherit closure from either shared issue. #336/#337 remain file-execution
boundaries; #344 remains physical-camera-bound. The next and only groomed
engineering candidate is #347. Its closure contract is: exact published
asset identity; inspected screenshots at 1280×900 and 375×812; recognizable
stage controls with persistent state/action naming; finite interactions for
screenshot, download menu, Piece controls, fullscreen, and Draft/Published
state; focused tests, `make check`, production build, and exact-route QA.
If #347 passes, process and close it before grooming or engineering #348.

## Fresh blocker distillation after #347 deployment handoff — 2026-09-02

The Replit workspace initially blocked publication because it was in an
interactive rebase onto `b98eb49`, with the newer distillation manifest in a
delete/modify conflict. The conflict was inspected and resolved in favor of
the newer manifest; Replit now reports a clean `main` containing `b98eb49`
and three subsequent Replit publish commits.

The republish operation is still unresolved: the deployment UI reports
`Publishing`, while the exact supplied 3D editor and public 2D route continue
to serve `assets/index-C5ipN-ir.js` with zero `piece-stage-action-label`
elements. Classify #347 as `dependency-blocked / deployment verification`
with owner/context `Replit publish operation`; the concrete next action is to
obtain a terminal publish result or error, then recheck both exact routes and
their fixed viewport renders. This is an environment/deployment blocker, not
a reason to close #347 or begin #348.

Duplicate/order recheck: no new issue is warranted. #347 remains the current
shared affordance transaction, #348 remains its dependent editor-layout
transaction, and #325–#337 retain independent consumer/artifact boundaries.
The same blocker does not justify parallel engineering; continue only after
#347 has a terminal QA/reconciliation result.

## #347 final reconciliation — 2026-09-02

The deployment blocker cleared. Exact published routes now serve
`assets/index-DVjamtqV.js`. Live 3D verification at desktop and mobile fixed
viewports showed the persistent labeled Screenshot, Download, Immersive,
Sound, Steer, Guide, and Fullscreen actions plus a visible Draft status. The
publication panel exposed Draft and Published, disabled the current state,
and the authorized live transaction completed Published then restored Draft.
The exact public 2D route showed labeled stage controls and its live download
menu exposed both Full and Non-Camera entries.

Focused tests (35/35), fixed-viewport Docker Chromium QA (1/1), full
`make check` (888 backend passed / 22 skipped; 2,396 frontend passed), and
the production build all pass. #347 is `completed` and ready for GitHub
closure. #348 remains the next issue and has not started.

## #347 engineering and QA transaction — 2026-09-02

Implemented locally in `b98eb49`: shared stage actions now render persistent
short labels beside their SVG icons; Piece controls, sound, steering, and the
gesture guide are visibly labeled; the fixed-viewport Chromium acceptance
assertion now targets the persistent publication label specifically. Focused
tests passed 35/35, the issue-specific Docker Chromium scenario passed 1/1 at
1280×900 and 375×812, frontend lint/format/typecheck passed, and the
production build passed.

The issue is not complete or closed. Full `make check` remains blocked by the
host's socket permission and launcher timeout failures plus one unrelated
frontend `useDraftAutosave` failure. The exact published public route still
serves `assets/index-C5ipN-ir.js` and has zero persistent action labels, so
publication/revision verification is also incomplete. #347 stays open with
QA FAIL and the next action is republish `b98eb49`, then recheck the exact
published routes before any closure decision.
