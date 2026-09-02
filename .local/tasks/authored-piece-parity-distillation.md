# Authored-piece parity distillation — 2026-09-02 (re-audit)

Project: `cfornesa/ai-dev-tools-zoomcamp-1`, with `../augment-humankind`
as read-only behavioral reference.

## Authoritative findings

- Live public `/p/7b2ecd2b-0a46-4031-b4a2-bb6b9cd74df2` still renders the
  prior deployed revision: Preview has no stage toolbar and the camera/demo
  controls remain a separate always-visible region. This was re-confirmed
  from the current deployed DOM on 2026-09-02.
- Live private `/projects3d/f3863d2f-d3a5-41ad-9883-7b8441af6217` redirects to
  the anonymous access error, so editor controls and publication state are
  not verified without authentication.
- Local source now contains a shared `PieceStageToolbar` for structured 2D/3D
  surfaces, but the complete capability contract and exact deployed proof are
  still incomplete. This distinction explains why local tests can pass while
  the user’s live URLs still show the old UI: commits have not been published.
- The reference contract in `../augment-humankind/docs/piece-surface-parity.md`
  requires regular, embed, immersive, and downloaded surfaces to share
  capability behavior; Full ZIP preserves permitted controls while
  Non-Camera removes camera rendering/UI/theremin/hand tracking/MediaPipe but
  retains non-camera sound.
- The repository owns `compose.yaml` and Dockerfiles. A running Docker project
  is evidence only when its Compose labels and served identity match this
  repository; the read-only `make compose-preflight` gate enforces that.

## Complete issue manifest

| Issue | Goal / scope | Dependencies / order | Status | Blocker / next action |
| --- | --- | --- | --- | --- |
| [#320](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/320) | Shared authored Project/Project3D stage chrome and capability contract | Parent integration gate; decomposed into #295, #306, #325–#345 | `distillation_required` | Owner re-audit confirms deployed public 2D still has the legacy sibling-panel shell and deployed 3D editor is unavailable anonymously. Re-groom every child against the exact PHP contract, verify the published revision, and do not infer closure from local source/tests |
| [#274](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/274) | Superseded authored-piece parity umbrella | Historical parent; replaced by #320 and closure-sized children | `closed_not_planned` | Historical reference only; do not use as a closure unit |
| [#123](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/123) | Native E2E default port must match Vite’s documented port | Independent workflow item | `closed_completed` | QA PASS posted and issue closed after source/default and browser-runner verification |
| [#321](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/321) | Docker browser verification must select and fingerprint the correct project | Independent workflow item; repository Compose definition now exists | `closed_completed` | `30fcec0` hardens the preflight to fixed repository project/file identity; focused configuration tests pass 8/8, correct-stack preflight passes, unrelated-project override is rejected, QA comment posted, and GitHub issue closed |
| [#323](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/323) | Superseded four-route publication-control implementation umbrella | Historical parent; replaced by #338–#341 | `closed_not_planned` | Do not reopen or use as a closure unit |
| [#325](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/325) | Verify manual 2D editor `/projects/:id` | Child of #320; one route/surface | `local_implementation_verified` | Issue #325's 2D runtime group now has an explicit wrapped flex-row layout. Focused React/type checks pass, and Docker-backed `manual2dStageChrome.spec.ts` passes 1/1 with stage containment, named controls, Add circle → Undo, publication popover, and horizontal geometry. Keep open for exact deployed-route verification |
| [#326](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/326) | Verify AI 2D editor `/ai-projects/:id` | Child of #320; one route/surface | `local_implementation_verified` | Dedicated authenticated Chromium route test passes 1/1 with stage-local publication controls, PHP-relative geometry, reversible Draft → Published → Draft, and no header duplicate. Keep open for exact deployed-route verification |
| [#327](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/327) | Verify manual 3D editor `/projects3d/:id` | Child of #320; one route/surface | `local_implementation_verified` | Dedicated Chromium route test passes 1/1 and verifies stage-contained 3D runtime controls, Save, AI authoring, publication status, rendered geometry, and no legacy standalone-export action. Keep open for exact deployed-route verification |
| [#328](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/328) | Verify AI 3D editor `/ai-projects3d/:id` | Child of #320; one route/surface | `local_implementation_verified` | Dedicated Chromium route test passes 1/1 and verifies stage-contained 3D runtime controls, AI authoring, publication status, rendered geometry, and no legacy standalone-export action. Keep open for exact deployed-route verification |
| [#329](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/329) | Verify public 2D viewer `/p/:id` | Child of #320; one route/surface | `handed_off_verification_boundary` | Public consumer default row layout is implemented in `09047c6` and the full 24/24 public/embed transaction passes locally. Exact production `/p/:id` still serves the legacy sibling-panel shell; authorized publish and exact-route verification remain owned by #320/#321. Continue with independent #331 |
| [#330](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/330) | Verify public 3D viewer `/p3d/:id` | Child of #320; one route/surface | `handed_off_verification_boundary` | Dedicated Docker-backed `project3dLifecycle.spec.ts` passes 4/4, including public 3D controls, reversible publication, and immersive touch travel. Exact published `/p3d/:id` and authenticated owner evidence remain required; continue with independent next route after reconciliation |
| [#331](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/331) | Verify embedded 2D viewer `/embed/p/:id` | Child of #320; one route/surface | `handed_off_verification_boundary` | Dedicated Docker-backed Chromium transaction passes 1/1 for the exact chrome-less embed route, stage-local controls, and downloads. The published revision is still unverified; rerun exact anonymous embed URL after authorized publication |
| [#332](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/332) | Verify embedded 3D viewer `/embed/p3d/:id` | Child of #320; one route/surface | `handed_off_verification_boundary` | Dedicated Docker-backed Chromium transaction passes 1/1 for the exact chrome-less embed entry point, stage-local 3D controls, and Full/Non-Camera download menu. Exact deployed embed revision remains unverified; rerun after authorized publication |
| [#333](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/333) | Verify regular immersive 3D `/immersive/p3d/:id` | Child of #320; one route/surface | `handed_off_verification_boundary` | Dedicated Docker-backed Chromium transaction passes 1/1 for the regular immersive route, compact stage rail, named controls, and arrow-key travel. Exact deployed revision remains unverified; rerun after authorized publication |
| [#334](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/334) | Verify custom immersive 3D `/immersive/p3d/:id?embed=1` | Child of #320; one route/variant | `handed_off_verification_boundary` | Dedicated Chromium route test passes 1/1 against disposable PostgreSQL/Django/Vite; verifies chrome-less custom variant, retained stage controls, fixed geometry, and both 3D ZIP menu entries. Published revision remains stale; keep open for exact post-publish route verification |
| [#335](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/335) | Verify CMS immersive 3D `/immersive/p3d/:id?embed=1&cms=1` | Child of #320; one route/variant | `handed_off_verification_boundary` | Dedicated Chromium route test passes 1/1 against disposable PostgreSQL/Django/Vite; verifies chrome-less CMS variant, retained stage controls, zero embed padding, and both 3D ZIP menu entries. Published revision remains stale; keep open for exact post-publish route verification |
| [#336](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/336) | Verify portable 2D download runtime | Child of #320; one artifact surface | `local_implementation_verified` | Existing isolated Chromium artifact suite passes 17/17 through Docker-backed browser QA, covering extracted HTML, demo/camera modes, permission lifecycle, attribution, content exclusion, exact dependencies, and ZIP output. Keep open for exact post-publish download verification |
| [#337](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/337) | Verify portable 3D Full/Non-Camera downloads | Child of #320; one artifact capability | `local_implementation_verified` | `project3dLifecycle.spec.ts` passes 4/4 against the disposable stack: real Full/Non-Camera ZIP clicks, extracted `file://` execution, functional canvas/controls, camera-surface separation, and reversible publication; deployed artifact remains unverified |
| [#338](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/338) | Manual 2D stage-local publication parity `/projects/:id` | Child of #320; one route and capability | `local_implementation_verified` | Shared stage rail matches PHP reference-relative top-left/0.75rem/2.75rem rounded-square styling; strengthened dedicated Chromium route QA passes 1/1 with stage-local authoring/runtime/publication controls, rendered containment, Add circle → Undo, and no legacy header row. Keep open for post-publish exact-route verification |
| [#339](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/339) | AI 3D stage-local publication parity `/ai-projects3d/:id` | Child of #320; one route and capability | `local_implementation_verified` | Dedicated `ai3dStageChrome.spec.ts` passes 1/1: exact AI editor route, shared 3D controls, AI action, Draft/Published control, no legacy standalone export action, and stage containment. Keep open for post-publish exact-route verification |
| [#340](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/340) | AI 2D stage-local publication parity `/ai-projects/:id` | Child of #320; one route and capability | `reopened_verification_boundary` | GitHub was reopened after the live contradiction audit; local route evidence exists, but the deployed revision is unverified and the owner reports the old bulky editor scheme. Re-run exact authenticated route QA after publish before closure |
| [#341](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/341) | Manual 3D stage-local publication parity `/projects3d/:id` | Child of #320; one route and capability | `local_implementation_verified` | Dedicated `manual3dStageChrome.spec.ts` passes 1/1 with PHP-relative rendered toolbar geometry, named 3D/editor/publication controls, stage containment, and no legacy standalone export action. Keep open for post-publish exact-route verification |
| [#295](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/295) | Live 3D five-slide hand-gesture guide | Shared capability; portable guide remains in #337 | `local_implementation_verified` | `f0b6e13` corrects the guide trigger to a compact PHP-parity icon overlay; focused React tests pass 5/5, rebuilt Compose inspection confirms the rendered class/icon, and disposable browser QA passes 1/1. QA FAIL remains for unavailable published `/p3d/:id` evidence |
| [#306](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/306) | Shared Tone.js 3D audio foundation | Foundation for sound consumers; route evidence remains #327–#337 | `closed_completed_local` | Narrow local foundation closure; exact public/editor/download behavior remains #327–#337 |
| [#342](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/342) | Independent 3D camera-view toggle | Shared capability; consumers verify through #327–#337 | `reopened_verification_boundary` | GitHub was reopened after the live contradiction audit; local capability evidence exists, but no deployed editor/public consumer proves the control is present. Verify through #327–#337 after publish before closure |
| [#343](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/343) | Immersive 3D touch d-pad travel | Immersive capability; route variants decide inclusion in #333–#335 | `ready_for_github_reconciliation` | Focused component suite passes 6/6; exact immersive browser route passes 4/4 with four 40px+ controls and matching ArrowUp/Left/Down/Right keydown/keyup pairs. Post QA evidence and close through authenticated GitHub reconciliation; no duplicate issue |
| [#344](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/344) | Immersive 3D hand gesture move/strafe | Depends on #295; route evidence remains #333–#335 | `blocked_user_judgment` | The PHP reference defines movement/strafe semantics, but the React product contract currently implements orbit/zoom only. Choose whether to ship bounded hand travel/strafe (with gesture thresholds and safe-stop behavior) or explicitly retain the current N/A boundary before engineering |
| [#345](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/345) | 3D per-voice instrument selectors | Depends on #306/#310; route/artifact evidence remains #327–#337 | `handed-off` | Local implementation and QA pass; GitHub API unavailable for required QA comment/closure. Retry authenticated issue reconciliation; do not duplicate the issue |

## Distillation handoff gate (2026-09-02)

## Owner-reported parity re-audit (2026-09-02)

The owner’s current report is treated as authoritative review evidence, not
as a request to reinterpret local test results. Direct inspection of the
supplied deployed public URL still shows the legacy shell: the Preview canvas
has a sibling “Live camera”/“Demo signal controls” region, with no visible
stage-local screenshot, download, fullscreen, or publication controls. The
supplied deployed 3D editor URL is unavailable anonymously, so its editor
controls and Draft/Published transition remain unverified. The checkout’s
React source contains newer stage-local components, but source, localhost,
and disposable-stack evidence cannot prove that the deployed revision contains
them.

Root cause of the prior false closures: local implementation, focused tests,
disposable browser runs, and live/deployed verification were conflated; a
shared toolbar was treated as proof for every consuming surface; and parent or
narrow child issue status was treated as completion without exact-route or
download evidence. This re-audit resets the affected parity work to
`re_audit_required`/local-only evidence and preserves #320 as a roll-up, not a
closure unit.

Required re-groomed closure matrix:

| Surface | Reusable issue | Exact closure proof | Boundary |
| --- | --- | --- | --- |
| Manual 2D editor | #325/#338 | Authenticated published `/projects/:id`; compact stage-local authoring/runtime/publication controls; no duplicate bulky action row; Draft → Published → Draft | Private route and deployed revision |
| AI 2D editor | #326/#340 | Authenticated published `/ai-projects/:id`; same finite stage-local control matrix plus AI action | Private route and deployed revision |
| Manual 3D editor | #327/#341 | Authenticated published `/projects3d/:id`; 3D stage controls, in-stage Save/AI actions, and reversible publication status | Private route and deployed revision |
| AI 3D editor | #328/#339 | Authenticated published `/ai-projects3d/:id`; 3D stage controls, AI action, and reversible publication status | Private route and deployed revision |
| Public 2D | #329 | Anonymous published `/p/:id`; controls visibly overlay the canvas and functional screenshot/download/fullscreen/publication affordances are stage-associated | Exact public URL |
| Public/embed/immersive variants | #330–#335 | One fixture per exact route/variant with named controls and stated not-applicable decisions | Each URL independently |
| Portable 2D/3D | #336/#337 | Trigger the real download, extract it, open it in a browser, and exercise packaged controls/functions; Full vs Non-Camera differences are explicit | Exact archive and extracted runtime |

“All controls” is not accepted as a criterion. Each child must enumerate the
finite named controls it owns, identify controls intentionally absent because
the route is already immersive or chrome-less, and state the exact command and
revision used for verification. No new issue is filed for the stale deployed
revision because #321/#320 already cover the deployment/verification boundary;
GitHub issue creation and closure are pending authenticated access.

### Distillation findings and order

1. Reconcile the deployment/revision boundary first through #321/#320; no
   deployed child can close while the supplied URL serves an older shell.
2. Re-groom and engineer each editor route (#325–#328, #338–#341) as one
   route transaction, including the actual authoring controls rather than
   publication chrome alone.
3. Re-verify public/embed/immersive routes (#329–#335) independently.
4. Verify downloaded artifacts (#336/#337) by behavior, not source markers.
5. Only then reconcile #320 and any historical umbrella records.

The authenticated GitHub connector is now available and has been used to
enumerate the open issue set. The prior CLI failure remains historical:
`gh issue list --repo
cfornesa/ai-dev-tools-zoomcamp-1 --state open --limit 100` failed with
`error connecting to api.github.com`), so no remote issue was modified or
closed. GitHub confirms #295, #320, #321, #325–#339, #341, and #343–#345
remain open; #340 and #342 were incorrectly closed against the live
contradiction and were reopened with state reason `reopened`. Existing issue
numbers are reused; no duplicate issue is created.

This manifest is the source of truth before any further implementation. The
open children above must be groomed and QA-closed independently against their
exact route or artifact. Before engineering starts, the selected issue must
have a fixed fixture and entry URL, finite named controls/states, exact
local/CI/browser commands, a deployment evidence boundary, explicit
not-applicable controls, dependencies, and one next action written in both
the issue and this manifest. Parent #320 is a roll-up only.

The interrupted publishing browser run is captured as evidence, not a fix
authorization. It exposed selector/contract drift after the stage-local
publication relocation and must first be classified against the affected
route issues (#338–#341) during grooming. No product or test change is part
of this distillation increment.

## Fresh owner-evidence distillation re-audit (2026-09-02)

The supplied live public URL was reopened in the approved browser and its
rendered body was inspected. It contains `Preview`, a sibling `Live camera`
disclosure, and a sibling `Demo signal controls` disclosure, but no visible
stage-local screenshot, download, fullscreen, or publication controls. This
directly fails the public 2D contract in #329 and the parent #320 requirement
that controls belong to the piece stage.

The supplied private 3D editor URL was also opened in a fresh anonymous
context. It returned only “This project doesn't exist, or you don't have
access to it.” and theme controls. Therefore editor authoring controls and
Draft/Published reversal are unverified, not absent; owner-authenticated
route evidence is required before any editor issue can close.

The checkout contains newer `PieceStageToolbar`, publication, and authoring
implementations, but the live pages prove that those commits have not reached
the deployed revision. The root process defect was closure based on local
source/disposable-browser evidence without proving the exact deployed revision
and without reconciling closed child issues after the owner’s live rejection.

Re-audit decisions:

- Reuse #320 for the deployment/revision gate and #321 for Compose identity;
  no duplicate deployment issue is needed.
- Keep #325–#339 and #341 open until each exact route is checked on the
  published revision; local route passes are implementation evidence only.
- Reopen #340 and #342 in GitHub; their local criteria may pass, but their
  prior closure was not sufficient to establish the user-requested live
  parity and their consumer/deployment boundary remains unresolved.
- Keep #295 open for the published five-slide guide contract, #343 open for
  authenticated/deployed immersive touch evidence, #344 blocked on the
  explicit movement/strafe product decision, and #345 open until its GitHub
  QA/status reconciliation is posted.

No product source or product-test changes are authorized in this distillation
increment. The next backlog-session handoff is exactly one issue: #321,
because deployment identity and publication are prerequisites for exact live
verification. If #321 is blocked by an environment dependency, run another
distillation reconciliation at its end before selecting the next independent
issue.

## Execution cadence gate (2026-09-02)

Distillation and grooming are intentionally bulk activities: the complete
backlog is decomposed, deduplicated, ordered, and given closure contracts in
one manifest. Engineering and testing are not bulk activities. Backlog-session
must select exactly one groomed issue, implement only that issue, write and
run its focused tests, run its required full/browser checks, perform QA, and
reconcile its evidence and GitHub status before starting the next issue. A QA
failure keeps the same issue current until it is closed, blocked, or handed
off with a classified blocker and exact next action. No later issue may be
used as a parallel implementation queue. If the issue is blocked, reconcile
the handoff immediately and continue with the next independent closure-ready
issue; skip only dependent issues. Stop the goal only when no independent work
remains or every remaining issue requires the same unavailable external state.

## Second distillation re-audit (2026-09-02)

This pass supersedes historical closure prose that described local or
disposable-stack evidence as “verified live.” The supplied production public
2D route still renders the legacy `Preview` plus sibling `Demo and camera
controls` layout, with no compact stage toolbar, screenshot, download,
fullscreen, or publication controls. The supplied `/projects3d/:id` route is
private and returned the anonymous unavailable state, so its editor controls
and Draft/Published toggle cannot be claimed from that URL.

The current checkout does contain local stage-toolbar and publication-control
implementations, but `main` is not the deployed revision. This explains the
user-visible discrepancy: local commits cannot change the live URLs without a
separately authorized push/publish operation. The local public camera-source
visibility defect was corrected in commit `a38dce4`, but that is not deployed
evidence.

Closed-issue reconciliation:

- #274, #300, #323, and #324 are parent/umbrella records and remain historical
  or superseded; they are not implementation closure units.
- #295 is reopened because its own contract requires a published `/p3d/:id`
  fixture and the prior evidence was local-only.
- #306 remains closed only as the narrow Tone.js foundation; it does not prove
  any editor, public, immersive, or downloaded consumer.
- #285–#294, #296–#311, and #340/#342 remain narrow implementation records only
  where their explicit local acceptance is independently covered. Their
  historical “verified live” wording is demoted and cannot close #320 or any
  exact-route child.
- Exact route and artifact proof remains open in #325–#337. No child may close
  on source inspection, stale deployment output, or a local test that does not
  enter its named route/artifact.

Runner triage: `BROWSER_QA_E2E_SPEC=e2e/publishingAndRemix.spec.ts make
browser-qa` reached the repository-owned disposable stack but fixture setup
received HTTP 404 from `POST /api/projects/<id>/publish/`; the focused backend
publish suite passed 18 tests with one expected skip. This is a reproducible
workflow/fixture blocker requiring reconciliation before #329 or any
publication-dependent child can close. No duplicate issue is created yet;
first reconcile the existing runner and #321 workflow scope.

## Duplicate / already-covered report

- #313–#319 are generated `ArtPiece` routes (`/art-pieces/*`) and do not
  cover structured Project/Project3D authored pieces; they are related prior
  work, not duplicates of #320.
- #285–#311 cover isolated screenshot/fullscreen/export/sound/gesture/
  immersive slices, but their closure does not prove shared structured
  regular/embed/download parity; preserve their history and do not reuse their
  closed status as evidence for #320.
- Existing camera, renderer, sandbox, and publication issues are component
  prerequisites or regression coverage, not replacements for #320.

## Cross-surface gap matrix (re-audited 2026-09-02)

| Surface / requirement | Current evidence | Classification | Existing issue / next action |
| --- | --- | --- | --- |
| Manual 2D editor | Local source now places authoring, Camera, and Demo controls in stage-local chrome; exact deployed/editor visual parity remains unverified | `implemented locally / needs browser evidence` | #325/#338; authenticate and verify the exact owner route after publish |
| AI-assisted 2D editor | Local source now uses shared stage-local toolbar and Camera/Demo disclosure with the existing preview lifecycle; exact deployed/editor visual parity remains unverified | `implemented locally / needs browser evidence` | #326/#340; authenticate and verify the exact owner route after publish |
| Public 2D viewer / embed | Deployed route still serves old sibling-panel shell; source audit found the public 2D `PieceStageToolbar` consumer omitted a default inner row layout; the corrected disposable transaction now publishes and verifies public/embed behavior, while live deployment remains stale | `implementation-defect resolved locally + verification-boundary` | #329/#331; reconcile the local fix against the exact published revision, then verify embed independently |
| Manual/AI 3D editors | Shared toolbar and publication control exist locally; editor-specific actions remain a separate authoring toolbar within the stage, which is acceptable only if it does not duplicate runtime chrome | `implemented locally / needs browser evidence` | #327/#328/#339/#341; verify visual hierarchy and all controls with authenticated browser |
| Public/embed/immersive 3D | Shared `Scene3DPreview` toolbar exists locally; immersive route supports Custom/CMS embed query variants and arrow-key fly | `implemented locally / needs deployed evidence` | #330/#332/#333/#334/#335; verify exact routes after publish |
| Full 3D download | Local bundle includes stage controls, hand guide, permission-gated hand tracking, microphone, camera theremin, sound, keyboard, reset, screenshot, fullscreen, and bundled MediaPipe/Wasm/model assets | `implemented locally / needs deployed evidence` | #337; verify the exact deployed download after publish; #295/#306/#342/#345 changes must be reflected before closure |
| Non-Camera downloads | Camera host/module and camera-only mic/theremin code are omitted while non-camera sound/keyboard/view controls remain; disposable-stack browser test downloads and inspects the real ZIP | `implemented locally / needs deployed evidence` | #337; verify the exact deployed download after publish |
| Draft / Published | 2D and 3D owner controls exist locally and API tests cover atomic transitions; supplied private deployed route cannot be inspected anonymously | `verification-boundary` | #320; authenticate in the owner's browser session, then verify both states on exact URLs |
| Deployed examples | Public supplied URL serves the old shell; local `HEAD` is `0c6bc5f` and local `main` is 128 commits ahead of `origin/main` (`14e0133`), whose GitHub commit is Replit's `Published your App` deployment commit | `verification-boundary` | #320/#321; obtain authorization to push/publish the tested revision, then run exact-route post-deploy QA |

## Closed-issue audit (2026-09-02)

Closed issues #285–#311 were re-read against their own hard acceptance criteria
and the current source, not their historical QA labels. Their narrow behavior
may remain valid, but none proves cross-surface parity. Two were materially
false as currently implemented and were reopened: #295 (three-step guide vs
required five-step guide) and #306 (custom Web Audio vs required Tone.js).
Issues #294 and #311 retain their narrower contracts: orbit/zoom gesture
support and arrow-key immersive fly. Their descriptions explicitly left
Move/strafe and touch d-pad behavior out of scope, which is why #343 and #344
are separate. #310's instrument selectors were optional, so #345 makes that
reference capability independently closable. #297 proves only the active
steering overlay, so #342 owns the independent camera-view toggle.

## Criterion-ready definition for #320

The issue is not complete until all of these are proven against the current
implementation and exact routes:

1. Manual and AI 2D/3D editors render one compact stage-local toolbar with
   screenshot, export menu, supported immersive entry, enabled sound/control
   affordances, hand guide, and fullscreen; no duplicate bulky action row
   outside the stage.
2. `/p/:id`, `/p3d/:id`, `/embed/p/:id`, and `/embed/p3d/:id` use the same
   stage component/capability contract; camera/demo settings are stage-local
   disclosures and never auto-activate.
3. Owner editors expose actionable Draft/Published state for 2D and 3D;
   server publication remains atomic and private data is absent from public
   responses.
4. Immersive 3D uses the same permitted controls and downloaded runtime
   behavior without claiming unsupported WebXR.
5. Full and Non-Camera downloads are functionally distinct where camera or
   hand capability exists; both retain the shared runtime overlays/functions,
   and the artifact omits only the download action itself.
6. Screenshot capture preserves the active composition/aspect ratio and
   excludes editor metadata; camera pixels appear only after explicit live
   capture/permission.
7. Canvas2D, SVG, Three.js, and sandboxed generated content degrade safely;
   raw generated source never executes in the parent app.
8. Component, API, artifact, and real-browser tests cover editor/public/embed/
   immersive/downloaded, publication transitions, privacy, fullscreen,
   screenshot, and camera fallback.
9. Authenticated editor and post-publish live-route evidence is attached to
   #320 before closure.

## Verification boundaries and triage

- Anonymous access to private editor URLs is a genuine browser verification
  boundary; next action is to use the owner’s authenticated browser session.
- The deployed public route is stale relative to local commits; post-publish
  verification is a Replit/deployment boundary, not a local test substitute.
- The unrelated Docker Compose stack is a reproducible workflow defect,
  tracked by #321; do not stop or mutate it. Native `scripts/browser-qa.sh`
  remains the repository-owned disposable browser runner.
- Native fullscreen and real camera/microphone prompts require browser/OS
  permission evidence and are not proven by jsdom.
- The previous #274 closure comment incorrectly treated the isolated child
  issue list as the complete product contract. The maintained parity gate is
  now #320's cross-surface matrix above; closed child issues are evidence for
  their narrow behavior only, never for integration across structured editor,
  public, embed, immersive, and downloaded surfaces.

## Re-audit evidence (2026-09-02)

- Exact public URL: the deployed DOM contains `Preview` with only `Scene
  canvas`; the `Demo and camera controls` region is a sibling region outside
  the stage and no screenshot/download/fullscreen toolbar is present.
- Exact private 3D editor URL: after loading, the deployed DOM reports “This
  project doesn't exist, or you don't have access to it.” No editor controls
  can be claimed without the owner’s authenticated browser session.
- Current local source: `PieceStageToolbar` is used by `EditorWorkspace`,
  `PublicProjectViewer`, and `Scene3DPreview`; the portable 2D runtime already
  contains screenshot/fullscreen and camera/demo capability scripts, while the
  portable 3D runtime now contains screenshot/fullscreen, reset/orbit/zoom,
  explicit sound enable/settings, volume, keyboard notes, movement tones, and
  a permission-gated local camera overlay in Full bundles. Non-Camera 3D
  bundles omit that camera surface while retaining non-camera controls.
- The capability policy is explicit in
  `frontend/src/components/pieceStageCapabilities.ts`: 2D exposes only its
  implemented screenshot/HTML-export/fullscreen controls, while 3D exposes
  ZIP export, immersive, sound, piece controls, gesture, guide, and fullscreen.
  The immersive 3D route now keeps gesture steering and its guide enabled.
- Correct-stack verification: `scripts/browser-qa.sh` passed its repository
  identity probes; focused injection passed 33/33 and public lifecycle/camera
  passed 24/24, including the corrected opt-in camera/demo disclosure. The
  publication-status controls are now keyboard-actionable and covered by
  component tests. The first full 137-test run reached 99 passed before the two
  focused regressions were corrected; the corrected focused suites pass, but a
  clean replacement full batch reached 135/137 with one skipped and one
  authentication/fixture timing failure before the target scenario began.
  The exact failed 8-test `projectLifecycle.spec.ts` rerun passed 8/8 in
  isolation. This is recorded as a verification flake, not as a clean full
  batch, until the complete run is repeatably green.
- Focused 3D editor browser coverage now passes 2/2, asserting stage-local
  toolbar controls on both manual and AI-assisted editor routes. Focused 3D
  artifact coverage passes 7/7 and proves Full/Non-Camera camera-surface
  separation. Full 3D scripts now include the shared standalone MediaPipe
  module and expose its active hand signals to the local Three.js orbit/zoom
  loop; Non-Camera scripts omit the tracking module and camera host.
- The corrected public publishing/remix browser run passes 24/24 and now
  asserts screenshot, Full/Non-Camera download menu, fullscreen, and the
  chrome-less `/embed/p/:id` route's shared stage toolbar. The full frontend
  suite passes 188 files / 2,373 tests; lint, typecheck, format, and build
  pass. Moving the editor authoring toolbar into the stage initially exposed
  a Code-tab regression; the toolbar is now still available while the visual
  canvas is hidden, with the focused Code-tab suite passing 11/11.
- GitHub issue enumeration on 2026-09-02 confirms #295 is now reopened because
  its published-route criterion was not proven. #320, #321, and #325–#345
  remain open; #123, #274, #323, #324, and the other narrow implementation
  issues remain closed only for their explicitly bounded local scopes. #306
  remains closed as a foundation issue, not route/deployment evidence. #123,
  #274, #323, and #324 are closed historical records and are not closure
  evidence for the current parent. The current manifest therefore has 24
  open issues: #295, #320, #321, and #325–#345.

## Distillation decisions and uncovered context

- The repository has no `examples/` directory. Existing `attached_assets/`,
  tests, and the sibling PHP contract are the available references. No issue
  was invented for a missing user-provided folder; if examples are required,
  the owner must supply or identify them before route QA.
- Structured 2D currently has no sound, hand-steering, hand-guide, or 2D
  immersive renderer capability. Those controls are explicitly N/A in the
  2D child contracts rather than being silently claimed. A future 2D audio or
  immersive implementation requires a new groomed issue after product scope
  is chosen.
- The stale published revision and anonymous private-editor response are
  deployment/authentication boundaries, not implementation closure evidence.
  No push, publish, credential acquisition, or sibling-container mutation is
  authorized by this task.
- Every open route/artifact issue now names its fixed entry, finite controls,
  exact privacy/fallback behavior, browser/automation evidence, deployment
  boundary, explicit N/A behavior, and one next action. A child with a vague
  “verify parity” statement is not closure-ready.

- Full 3D ZIPs also bundle the MediaPipe vision module, Wasm/JS runtime files,
  and gesture-recognizer model under `runtime/mediapipe/`, so direct `file://`
  downloads do not depend on a CDN. Non-Camera ZIPs omit those assets and
  their camera runtime entirely.

## Re-audit implementation increment (2026-09-01)

- Manual and AI-assisted 3D editors no longer place Save/export as bulky
  header actions. They pass authoring controls into the shared stage toolbar,
  with the visual stage remaining mounted while Code is selected.
- The manual 3D export callback now receives the shared Full/Non-Camera menu
  variant instead of silently exporting Full for both menu choices.
- Full 3D downloads reuse `buildStandaloneCameraScript()` and the existing
  `window.__exportSetActiveInput` contract. The Three.js runtime consumes
  palm deltas for orbit, pinch strength for zoom, and resets the bridge when
  camera tracking stops. Non-Camera generation does not embed that module.
- Focused regression coverage is green: 15/15 across the 3D export and editor
  suites after waiting for the jsdom WebGL fallback before interacting with
  its remounted toolbar.

## Re-audit correction increment (2026-09-01)

- The second source audit found that the prior parity claim was too broad:
  AI-assisted 2D still had a separate screenshot/fullscreen row, manual 2D
  Save still lived in the header, AI-assisted 3D still had its whole-scene
  action outside the stage, and public 3D ignored the selected download
  variant. These were implementation defects, not deployment-only evidence
  gaps.
- AI-assisted 2D now uses `PieceStageToolbar` for screenshot, Full/
  Non-Camera HTML export, and fullscreen, and exposes the same Draft/Published
  control. Manual 2D Save is compact and inside the authoring stage toolbar.
  AI-assisted 3D's whole-scene action is also stage-local. The manual 2D
  stage toolbar remains reachable while Code is selected; only the artwork
  canvas is hidden.
- Public 3D now forwards the toolbar's selected export variant. The 3D
  fallback toolbar preserves immersive/download/fullscreen affordances even
  when WebGL cannot initialize.
- Focused correction coverage passes 65/65. The clean full frontend rerun is
  green at 188 files / 2,373 tests after one asynchronous WebGL-toolbar
  test-readiness failure was fixed. The first corrected publishing/remix
  browser rerun exposed a real selection-HUD hit-testing regression over the
  compact authoring Save control; the editor toolbar is now content-sized and
  layered above the HUD, and the shared stage toolbar remains above editor
  overlays. The complete disposable PostgreSQL/Django/Vite publishing/remix
  suite passes 24/24 after that correction.

## Memory links

## Re-audit implementation increment (2026-09-02)

- The shared 3D preview now keeps sound, keyboard/mic/theremin, gesture-camera,
  and overlay settings inside the stage-local Piece controls disclosure; the
  previous duplicate panels below the canvas were removed. Sound transitions
  reset the disclosure safely.
- Full and Non-Camera 3D exports retain the stage action controls and now make
  keyboard notes an explicit, functional opt-in in the portable runtime.
- Focused verification passes: 3D live controls 37/37, 3D export 7/7, and the
  real disposable PostgreSQL/Django/Vite browser lifecycle suite 2/2 for
  manual and AI-assisted 3D editors. This remains local evidence only; the
  supplied deployed URLs still require a publish before production-readiness
  can be assessed.

## Re-audit implementation increment (2026-09-02, continued)

- A second DOM-level inspection found the manual 2D authoring toolbar was
  still only positioned inside the outer canvas viewport, not inside the
  actual artwork canvas. That preserved the visual failure mode reported by
  the owner even though the earlier test only checked the viewport ancestor.
- Commit `b04b6b6` moves the complete authoring toolbar into
  `[data-testid="scene-canvas"]` and updates the narrow/desktop structural
  assertions. `EditorWorkspace.test.tsx` and
  `EditorWorkspace.toolbarAddShape.test.tsx` pass 37/37.
- This is an implementation-defect correction, not a deployment-only gap.
  Exact deployed verification remains blocked until the current local
  commits are pushed/published by the repository owner.
- The PHP reference contract also anchors shared stage chrome at the top of
  the stage. Commit `cea96ca` aligns the React toolbar and its menus with
  that placement for both 2D and 3D surfaces; focused parity tests remain
  green (82/82), and the production build passes.
- The first real-stack browser rerun after the canvas move exposed event
  bubbling from the nested authoring toolbar into canvas hit-testing, which
  cleared shape selection and hid the inspector. Commit `0f28d67` adds an
  interaction boundary around the overlay. The corrected disposable
  PostgreSQL/Django/Vite publishing/remix run passes 24/24, including public
  rendering, camera fallbacks, unpublishing, and remix.
- A separate corrected real-stack run of `project3dLifecycle.spec.ts` passes
  2/2 for manual and AI-assisted 3D creation, confirming the stage toolbar
  is rendered in the actual browser editor surface. This does not replace
  the still-missing authenticated exact-route check against the deployed
  application.
- Commit `647f0ca` extends that suite with a published 3D project flow. The
  real browser now verifies public screenshot/sound/Piece-controls/steering/
  guide/fullscreen chrome, both ZIP download variants, and the owner’s
  Published → Draft transition; the expanded suite passes 3/3.
- The expanded 3D run initially caught a real hit-testing defect: the shared
  download popover lacked its anchored layout, so the visible Full action could
  invoke Non-Camera. Adding the shared popover CSS fixed the composed behavior;
  the rerun passes 3/3 and inspects both downloaded ZIP manifests/runtime
  scripts. This is local disposable-stack evidence; the supplied deployed
  URLs remain unverified until the current branch is published and an owner
  browser session is available.
- The standalone 2D export audit found the same class of parity miss in a
  different surface: motion/demo/camera controls were still page-level while
  only screenshot/fullscreen were stage-local, and the generated document had
  a duplicate camera-runtime tag. The export now packages one compact,
  stage-local Piece controls disclosure containing the existing functional
  hosts, removes the duplicate tag, and the real Chromium artifact suite
  passes 17/17 across all interaction modes and camera lifecycle/privacy
  scenarios.
- The 3D artifact check was strengthened beyond source inspection: both ZIPs
  are extracted and opened from `file://` in a fresh Chromium page, where the
  canvas, Piece controls, Reset view, and Non-Camera camera-feature omission
  are exercised. The correct-stack suite passes 3/3 with this executable
  artifact coverage.
- The full 138-test browser batch then exposed a composed toolbar regression:
  the new download popover could remain open across editor interactions and
  intercept Layers-panel pointer targets. The shared toolbar now closes the
  popover on outside pointer input and explicitly honors `[hidden]`; the
  targeted Layers suite passes 7/7 and the full batch passes 137/137 with one
  intentional skip.
- The repository-wide check then exposed the related Code-tab boundary: the
  visual-view wrapper hid the stage-mounted authoring toolbar along with the
  artwork, so Add/Undo actions were unavailable while Code was selected. The
  wrapper now remains mounted and CSS hides only artwork/interaction layers;
  the stage controls remain accessible and functional in Code. The focused
  Code-tab suite passes 11/11 and the full frontend suite passes 189 files /
  2,375 tests; typecheck and production build also pass.

## Re-audit implementation increment (2026-09-02, immersive/download)

- The immersive 3D route now implements the reference contract's Custom and
  CMS embed variants as copyable iframe snippets and query-driven chrome-less
  modes.
- The standalone 3D runtime now implements arrow-key camera travel while
  leaving WASD available for keyboard notes. The extracted Full ZIP executes
  this state transition from `file://` in Chromium.
- Focused immersive tests pass 13/13, frontend format/typecheck pass, and the
  corrected disposable PostgreSQL/Django/Vite `project3dLifecycle.spec.ts`
  passes 3/3. Exact deployed immersive/embed/download evidence remains
  pending publication and authenticated owner access.

## Re-audit implementation increment (2026-09-02, publication chrome)

- Draft/Published controls now live in the compact stage-local editor toolbar
  for manual and AI-assisted 2D/3D editors, keeping publication state beside
  the authored piece rather than in a bulky header row.
- The shared publication switch explicitly uses content-sized horizontal
  options, preventing the stage icon-button rule from overlapping Draft and
  Published hitboxes. Focused React coverage passes 46/46 and the disposable
  real-browser 3D lifecycle passes 3/3, including the Published → Draft
  transition.
- This increment is tracked by #323. The former broad #324 verification issue
  was closed as not planned and replaced by #325–#337, one route, variant, or
  downloaded artifact per independently observable closure unit.

- `.agents/memory/authored-piece-surface-parity.md`
- `.agents/memory/generated-art-piece-surface-parity.md`
- `.agents/memory/e2e-wrong-docker-project.md`
- `.agents/memory/full-browser-readiness-gate.md`

## Third distillation re-audit (2026-09-02)

The owner reported that the requested parity is still absent from the
deployed application: editor controls remain bulky and outside the canvas,
the Draft/Published control is not visible, and the public `/p/:id` surface
has no expected stage button overlays. Direct browser inspection corroborated
the public report: the supplied deployed 2D URL rendered the legacy Preview
and sibling Demo/camera-controls layout, with no compact screenshot, download,
fullscreen, or publication toolbar. The supplied private 3D editor URL could
not prove its controls anonymously and returned the unavailable/access-denied
state.

The checkout does contain newer local toolbar/publication implementations, but
`main` is 82 commits ahead of `origin/main`; no push or publish was authorized
in this pass. The root cause is therefore a closure/evidence mismatch: prior
records treated local, localhost, disposable-browser, source-string, and
focused-test evidence as if it proved the current deployed revision. They
also allowed parent-wide parity to be inferred from independently closed
child capabilities. Those claims are demoted to narrow implementation
evidence and must not close #320 or any exact route/artifact issue.

### Closure-sized decomposition

Keep the existing issue numbers and do not create duplicates while the GitHub
API is unavailable. The actionable contract is:

| Issue | One closure unit | Fixed entry/precondition | Required observable proof | Explicit boundary |
| --- | --- | --- | --- | --- |
| #338 | Manual 2D editor publication chrome | Authenticated owner at `/projects/:id` with one editable fixture | Stage-local Draft/Published control is visible and keyboard actionable; both transitions work; no duplicate page-level control | Does not prove AI 2D, 3D, public, or downloads |
| #340/#326 | AI 2D editor publication and surface verification | Authenticated owner at `/ai-projects/:id` with one fixture | Finite toolbar/control checklist passes and save/AI actions remain reachable | Does not prove manual 2D or 3D |
| #341/#327 | Manual 3D editor publication and surface verification | Authenticated owner at `/projects3d/:id` | Named 3D toolbar controls, Draft/Published transitions, and editor actions work | Does not prove AI 3D or runtime consumers |
| #339/#328 | AI 3D editor publication and surface verification | Authenticated owner at `/ai-projects3d/:id` | Same finite 3D checklist and AI action reachability | Does not prove manual 3D or runtime consumers |
| #329 | Public 2D viewer | Published fixed fixture at `/p/:id` | Toolbar overlays artwork; named screenshot/fullscreen/export controls work; Camera/Demo are stage-local opt-in disclosures | Does not prove embed or downloads |
| #330 | Public 3D viewer | Published fixed fixture at `/p3d/:id` | Named 3D toolbar, sound, gesture-guide, camera/view, screenshot, fullscreen, and immersive-entry behavior | Does not prove embeds, variants, or downloads |
| #331 | Embedded 2D viewer | Published fixed fixture at `/embed/p/:id` | Chrome-less stage-local controls and 2D behavior work in the embed entry point | Does not prove regular public 2D |
| #332 | Embedded 3D viewer | Published fixed fixture at `/embed/p3d/:id` | Chrome-less 3D toolbar and named controls work in the embed entry point | Does not prove regular public 3D |
| #333 | Regular immersive 3D | Published fixed fixture at `/immersive/p3d/:id` | Immersive entry, arrow-key travel, guide, sound, view, screenshot, and fullscreen behavior | Does not prove query variants |
| #334 | Custom immersive 3D | Same fixture at `/immersive/p3d/:id?embed=1` | Custom chrome-less variant preserves named permitted controls and safe fallback | Does not prove regular/CMS variant |
| #335 | CMS immersive 3D | Same fixture at `/immersive/p3d/:id?embed=1&cms=1` | CMS chrome-less variant preserves named permitted controls and safe fallback | Does not prove regular/custom variant |
| #336 | Portable 2D runtime | Download from published `/p/:id`, extract, open entry HTML | Screenshot/fullscreen and explicit demo/camera lifecycle work with stage-local controls and no network dependency | Does not prove 3D or source presence alone |
| #337 | Portable 3D Full vs Non-Camera runtime | Download both variants from published 3D fixture, extract, open with `file://` | Full retains named sound/view/gesture/camera/hand-guide controls and assets; Non-Camera omits camera/hand UI/assets while retaining non-camera controls | Does not prove editor/public chrome |
| #295/#306/#342/#345 | Shared capability prerequisites | Local focused fixture/component boundary | Each narrow capability passes its own focused tests and is linked as prerequisite evidence | Never closes a consuming route or parent by itself |

Every row needs exact commands, fixture identifiers, browser assertions or
screenshots, and a post-publish revision marker in its issue before closure.
The broad #274/#324 concepts remain reconciliation containers, not
implementation units. #320 remains open until all applicable rows are
independently terminal and reconciled.

### Blocker and ordering decision

The stale deployment requires an owner-authorized push/publish, so it is a
user-judgment verification boundary and cannot be bypassed by more local
testing. Docker/browser-runner and fixture-publish failures are separate
workflow/infrastructure blockers tracked by #321 and the existing #329
boundary; they must not be silently converted into product closure. A
non-user-judgment dependency or environment blocker now requires a fresh
task-distillation reconciliation at the end of that blocked issue before any
independent issue is selected.

No new GitHub issues were created because the authenticated API was
unavailable (`gh issue view` could not connect to `api.github.com`) and the
existing issue map covers the discovered work. The next handoff is to groom
exactly one existing route slice after deployment access and fixture
availability are resolved; no product engineering begins from this re-audit.

## Fourth distillation re-audit: owner-reported live mismatch (2026-09-02)

The owner explicitly rejected the prior local-only closure posture and
reported that the supplied live editor/public URLs still lack the requested
controls. A fresh direct browser inspection agrees:

- `https://animate.creatrweb.com/p/7b2ecd2b-0a46-4031-b4a2-bb6b9cd74df2`
  exposes `Preview` and a sibling `Demo and camera controls` region. Its DOM
  has no `Piece actions` toolbar, screenshot button, download menu, fullscreen
  button, or visible Draft/Published control.
- `https://animate.creatrweb.com/projects3d/f3863d2f-d3a5-41ad-9883-7b8441af6217`
  is not authenticated in the available browser session and returns no
  inspectable editor DOM. It therefore proves neither the editor toolbar nor
  the reversible publication state.
- The current checkout contains `PieceStageToolbar`, stage-local 2D/3D
  consumers, and publication controls, but the branch is not the deployed
  revision. Local source, unit tests, disposable-stack browser tests, and
  historical issue comments cannot override the live contradiction.

### False-closure cause and reclassification

The prior process conflated four different statements: “the source contains
an implementation,” “a local test passes,” “a disposable stack serves that
source,” and “the exact deployed route has the behavior.” Only the last
statement can satisfy a deployed-route criterion. A second error inferred the
parent’s parity from narrow child checks even though the PHP reference defines
one cross-surface contract for regular, embed, immersive, and downloaded
surfaces. The following children are therefore explicitly `local_evidence_only`
and remain open: #325–#332. They are not ready to close or merely waiting for
a GitHub comment.

The shared implementation must be re-audited against the maintained PHP
reference before route closure. In particular, compare the React toolbar and
downloaded HTML/ZIP runtime with:

- `../augment-humankind/public/app/views/partials/piece-stage.php` for the
  regular stage overlay, screenshot, download choices, immersive entry, and
  Piece controls disclosure;
- `../augment-humankind/public/app/helpers/immersive-chrome.php` for the
  compact icon sizing, overlay anchoring, control ordering, explicit
  capability gating, and fullscreen behavior; and
- `../augment-humankind/public/app/helpers/piece-render.php` plus the
  reference runtime tests for the functional controls that must survive in
  extracted Full/Non-Camera downloads.

### Closure contracts after this re-audit

No parity child may move beyond `local_evidence_only` until its exact route or
artifact is tested from the revision actually served to the owner. Each route
contract must include a finite named checklist and a visual/DOM assertion that
the compact controls are descendants of the stage, not simply present
somewhere on the page. Each downloaded-artifact contract must open the
extracted entry point and exercise the controls, not only grep generated
strings. Publication contracts must show Draft → Published → Draft on the
same owner fixture and verify anonymous visibility changes between states.

The requested deployment is a user-judgment boundary: no push, publish, or
credential entry is authorized by this re-audit. GitHub API access is also
unavailable (`gh` cannot connect to `api.github.com`), so no new issue or
closure comment can be created in this pass. Existing issue numbers are
reused; any genuinely new implementation gap found during the reference
comparison must be recorded as `issue-creation-pending-authorization` with
owner and next action before engineering continues.

### Distillation exit decision

Distillation is complete for this re-audit only after the source/reference
comparison is captured in the matrix above, the local-only child statuses are
reconciled, and exactly one implementation issue is named for the next
backlog-session transaction. The next issue must be a shared capability or
one route—not the broad #320 parent—and must carry its own focused test,
deployment evidence boundary, and explicit out-of-scope surfaces. No product
source or product-test edits are authorized by this section.

## Blocker reconciliation (2026-09-02)

The non-user-judgment #321 environment blocker was re-investigated at the end
of the blocked work as required by the workflow rule. The sibling Compose
project was left untouched. This repository's explicitly named stack built and
started after `docker/backend.Dockerfile` copied the missing root `schema/`
directory; `make compose-preflight` passed, and
`BROWSER_QA_E2E_SPEC=e2e/project3dLifecycle.spec.ts make browser-qa` passed
3/3. Duplicate and dependency review found no new issue: #321 remains the
existing workflow issue, #343 is no longer dependency-blocked, and route/
artifact children remain separate. GitHub reconciliation is still pending
because the authenticated GitHub API was unavailable; local readiness is not
represented as GitHub closure.

## Blocker reconciliation: #325 (2026-09-02)

#325 completed its implementation and QA transaction locally, but authenticated
GitHub issue reconciliation remains unavailable. The fresh distillation check
found no duplicate or new dependency: #325 stays the manual 2D route slice,
#326 remains the independent AI 2D route slice, and #320 remains the parent
roll-up. Local readiness is recorded above; the missing GitHub comment/closure
is the explicit handoff blocker. Because this is not a user-judgment blocker,
the rule requires this reconciliation before selecting the next issue; it does
not make #325 closed.

## Blocker reconciliation: #326 (2026-09-02)

#326 completed its implementation/QA transaction locally with the exact
authenticated AI 2D route test passing 1/1. GitHub issue access remains
unavailable, so the QA comment and closure cannot be posted. Fresh distillation
found no duplicate, new dependency, or follow-up gap: #326 remains the AI 2D
route slice, while #340 remains only its narrow local publication prerequisite.
The issue is ready for authenticated GitHub reconciliation, not closed.

## Blocker reconciliation: #330 (2026-09-02)

#330 completed its public 3D route QA transaction locally. The current
`project3dLifecycle.spec.ts` run passed 4/4 and exercised the exact published
`/p3d/:id` entry point, shared toolbar controls, downloads, publication state,
and the immersive route regression. Fresh distillation found no duplicate or
new dependency: #330 remains separate from #332's embed, #333–#335's
immersive variants, and #337's downloaded runtime. Authenticated GitHub access
is still unavailable, so the issue is ready for reconciliation but not closed;
the deployed revision still requires authorized publish and exact-route QA.

## Blocker reconciliation: #331 (2026-09-02)

#331 completed its dedicated embedded 2D route QA transaction locally. The
new `embed2dStageChrome.spec.ts` passed 1/1 after distillation corrected two
fixture-harness mismatches: the 2D title input is `#editor-title-input` (not
the 3D field), and 2D publication requires a saved non-empty description
before its confirmation dialog appears. Fresh distillation found no duplicate
or new dependency: #331 remains separate from #329's regular public route and
#336's downloaded runtime. Authenticated GitHub access is still unavailable,
so the issue is ready for reconciliation but not closed; the deployed
revision still requires authorized publish and exact-route QA.

## Blocker reconciliation: #332 (2026-09-02)

#332 completed its dedicated embedded 3D route QA transaction locally. The
new `embed3dStageChrome.spec.ts` passed 1/1 against disposable
PostgreSQL/Django/Vite/Chromium and verified the exact `/embed/p3d/:id` entry
point, chrome-less shell boundary, 3D controls, and full/non-camera ZIP menu
entries. Fresh distillation found no duplicate or new dependency: #332 remains
separate from #330's regular public route, #333–#335's immersive variants, and
#337's downloaded runtime. Authenticated GitHub access is still unavailable,
so the issue is ready for reconciliation but not closed; the deployed
revision still requires authorized publish and exact-route QA.

## Blocker reconciliation: #338 (2026-09-02)

#338’s local implementation and QA transaction completed. The shared stage
toolbar styling was corrected to the PHP reference’s relative dimensions and
anchoring (`top/left: 0.75rem`, icon controls `2.75rem`, rounded-square
corners), and `manual2dStageChrome.spec.ts` now asserts the rendered result.
Focused React coverage passed 61/61; the dedicated disposable-stack browser
route passed 1/1. No duplicate or new dependency was found. This remains
local implementation evidence only: the supplied production revision still
serves the legacy shell, and no push/publish or authenticated GitHub
reconciliation is authorized/available. Next action is exact post-publish
`/projects/:id` verification; do not mark #338 closed from this commit.

## Blocker reconciliation: #339 (2026-09-02)

#339’s local implementation and QA transaction completed. The dedicated
`ai3dStageChrome.spec.ts` browser test passed 1/1 against disposable
PostgreSQL/Django/Vite/Chromium and verified the exact AI 3D editor route,
shared stage controls, AI authoring action, publication status control, and
stage containment. No duplicate or new dependency was found. This remains
local implementation evidence only because the supplied production revision
is stale and the private route is not authenticated in the available browser;
no GitHub closure or deployment action is claimed. Next action is exact
post-publish `/ai-projects3d/:id` verification.

## Blocker reconciliation: #340 (2026-09-02)

#340’s local implementation and QA transaction completed. The exact
`ai2dPublication.spec.ts` browser test passed 1/1 against disposable
PostgreSQL/Django/Vite/Chromium and verified the PHP-relative stage rail,
stage-local publication control, reversible Draft/Published transitions, and
absence of the legacy header publication row. No duplicate or new dependency
was found. The prior `closed_completed_local` label was corrected because
local evidence cannot close a deployed route. The supplied production
revision remains stale and no GitHub closure or deployment action is claimed;
next action is authenticated post-publish `/ai-projects/:id` verification.

## Blocker reconciliation: #341 (2026-09-02)

#341’s local implementation and QA transaction completed. The dedicated
`manual3dStageChrome.spec.ts` browser test passed 1/1 against disposable
PostgreSQL/Django/Vite/Chromium and verified the exact `/projects3d/:id` route,
PHP-relative stage rail geometry, 3D stage controls, manual Save and AI
authoring actions, Draft/Published control, stage containment, and removal of
the legacy standalone export action. No duplicate or new dependency was
found. This remains local implementation evidence only because the supplied
production editor is stale/unavailable without authentication; no GitHub
closure or deployment action is claimed. Next action is authenticated
post-publish exact-route verification.

## Blocker reconciliation: #333 (2026-09-02)

#333 completed its implementation and QA transaction locally. The dedicated
`immersive3dStageChrome.spec.ts` browser test passed 1/1 against disposable
PostgreSQL/Django/Vite/Chromium and verified the exact regular
`/immersive/p3d/:id` route, regular-page attribution/embed actions, PHP-relative
stage rail geometry, screenshot/download/sound/Piece controls, gesture guide,
fullscreen, and both Full/Non-Camera 3D ZIP menu entries. Touch d-pad travel
remains independently owned by #343; query variants remain #334/#335; extracted
runtime behavior remains #337. Fresh distillation found no duplicate or new
dependency. This is local implementation evidence only: the supplied
production revision is stale and no push/publish or authenticated GitHub
reconciliation is authorized/available. Next action is authenticated
post-publish verification of the exact regular immersive URL; do not mark #333
closed from this local commit.

## Blocker reconciliation: #334 (2026-09-02)

#334 completed its implementation and QA transaction locally. The dedicated
`immersive3dCustomStageChrome.spec.ts` browser test passed 1/1 against
disposable PostgreSQL/Django/Vite/Chromium and verified the exact
`/immersive/p3d/:id?embed=1` route, custom chrome-less boundary, retained
stage-local screenshot/download/sound/Piece controls, gesture guide,
fullscreen, fixed 360px stage geometry, and both Full/Non-Camera 3D ZIP menu
entries. Fresh distillation found no duplicate or new dependency. This is
local implementation evidence only: the supplied production revision is
stale and no push/publish or authenticated GitHub reconciliation is
authorized/available. Next action is authenticated post-publish verification
of the exact custom immersive URL; do not mark #334 closed from this local
commit.

## Blocker reconciliation: #335 (2026-09-02)

#335 completed its implementation and QA transaction locally. The dedicated
`immersive3dCmsStageChrome.spec.ts` browser test passed 1/1 against disposable
PostgreSQL/Django/Vite/Chromium and verified the exact
`/immersive/p3d/:id?embed=1&cms=1` route, CMS chrome-less boundary, retained
stage-local screenshot/download/sound/Piece controls, gesture guide,
fullscreen, zero embed padding, and both Full/Non-Camera 3D ZIP menu entries.
Fresh distillation found no duplicate or new dependency. This is local
implementation evidence only: the supplied production revision is stale and
no push/publish or authenticated GitHub reconciliation is authorized/available.
Next action is authenticated post-publish verification of the exact CMS
immersive URL; do not mark #335 closed from this local commit.

## Reconciliation: #325/#338 manual 2D editor (2026-09-02)

The manual 2D editor transaction found and fixed a real local defect: the
authoring toolbar’s `max-width` excluded its padding and border, allowing the
overlay to extend 14px beyond the canvas at the browser-QA viewport. Adding
`box-sizing: border-box` keeps the compact authoring controls inside the
canvas. The strengthened `manual2dStageChrome.spec.ts` now verifies every
finite authoring action, Add circle → Undo behavior, stage-local runtime and
publication controls, no header duplicate, and rendered geometric
containment; browser QA passes 1/1, focused React coverage passes 46/46, and
TypeScript/format checks pass. This is local implementation evidence only:
the owner-supplied deployed editor remains unauthenticated/unavailable and
the stale public deployment contradicts the intended revision. #325/#338
remain open for exact published-route inspection and GitHub reconciliation.

## Reconciliation: #327/#341 manual 3D editor (2026-09-02)

The dedicated `manual3dStageChrome.spec.ts` transaction passed 1/1 against the
disposable PostgreSQL/Django/Vite/Chromium stack. It verifies the exact
`/projects3d/:id` route, stage-contained screenshot/download/sound/Piece
controls, gesture guide, fullscreen, manual Save and AI authoring actions,
Draft/Published control, PHP-relative toolbar geometry, rendered containment,
and removal of the legacy standalone-export action. No product defect was
found in this transaction. This is local implementation evidence only: the
owner-supplied deployed editor remains unavailable without authentication and
the deployed public revision is stale. #327/#341 remain open for exact
post-publish route verification and authenticated GitHub reconciliation.

## Reconciliation: #326/#340 AI 2D editor (2026-09-02)

The dedicated `ai2dPublication.spec.ts` transaction passed 1/1 against the
disposable PostgreSQL/Django/Vite/Chromium stack. It verifies the exact
`/ai-projects/:id` route, stage-local publication control, PHP-relative
toolbar geometry, reversible Draft → Published → Draft behavior, and absence
of the legacy header publication row. No additional local product defect was
found in this route transaction. The AI prompt/assistant surface remains its
own authoring panel; it is not counted as runtime stage chrome. This is local
evidence only: the deployed AI editor remains unverified, so #326/#340 stay
open for exact post-publish route inspection and authenticated GitHub
reconciliation.

## Reconciliation: #329 public 2D viewer (2026-09-02)

The complete `publishingAndRemix.spec.ts` transaction passed 24/24 against
the disposable PostgreSQL/Django/Vite/Chromium stack. It covers the published
anonymous `/p/:id` route, visible scene rendering, camera/demo lifecycle and
fallbacks, stage-local screenshot/download/fullscreen controls, publication
and unpublication, remix authorization, and concurrency boundaries. The
owner-supplied production screenshot remains contradictory: it shows the old
Preview plus sibling camera/demo panels and no stage toolbar or controls.
This is therefore local implementation evidence plus a deployment
verification blocker, not closure. No duplicate issue is needed; #320/#321
own the revision/publish boundary. Next action is authorized publication of
the intended revision followed by exact anonymous `/p/:id` inspection and
authenticated GitHub reconciliation.

## Reconciliation: #330 public 3D viewer (2026-09-02)

The complete `project3dLifecycle.spec.ts` transaction passed 4/4 against the
disposable PostgreSQL/Django/Vite/Chromium stack. It verifies the exact
published `/p3d/:id` route, shared 3D screenshot/download/sound/Piece/gesture
guide/fullscreen controls, Full/Non-Camera download menu entries, reversible
publication, and the immersive touch regression. No additional local product
defect was found in this route transaction. This is local evidence only: the
deployed public 3D route remains unverified, so #330 stays open for exact
post-publish anonymous inspection and authenticated GitHub reconciliation.

## Reconciliation: #331 embedded 2D viewer (2026-09-02)

The dedicated `embed2dStageChrome.spec.ts` transaction passed 1/1 against the
disposable PostgreSQL/Django/Vite/Chromium stack. It verifies the exact
`/embed/p/:id` entry point, chrome-less shell, stage-local screenshot,
download, fullscreen, and Camera/Demo disclosure controls, plus functional
download-menu behavior. No local product defect was found in this route
transaction. This is local evidence only: the deployed embed remains
unverified and the public deployment is stale, so #331 stays open for exact
post-publish anonymous inspection and authenticated GitHub reconciliation.

## Reconciliation: #328/#339 AI 3D editor (2026-09-02)

The dedicated `ai3dStageChrome.spec.ts` transaction passed 1/1 against the
disposable PostgreSQL/Django/Vite/Chromium stack. It verifies the exact
`/ai-projects3d/:id` route, stage-contained screenshot/download/sound/Piece
controls, gesture guide, fullscreen, AI authoring action, Draft/Published
control, PHP-relative toolbar geometry, rendered containment, and absence of
the legacy standalone-export action. No local product defect was found in
this route transaction. This is local evidence only: the deployed AI 3D
editor remains unverified, so #328/#339 stay open for exact post-publish route
inspection and authenticated GitHub reconciliation.

## Blocker reconciliation: #336 (2026-09-02)

#336 completed its implementation and QA transaction locally. A direct
macOS Chromium launch first failed before test execution with a Mach-port
permission error; per the dependency-blocker rule, a fresh distillation found
no duplicate or new dependency, and the authorized Docker-backed runner was
used instead. `BROWSER_QA_E2E_SPEC=e2e/exportArtifacts.spec.ts make browser-qa`
then passed 17/17, covering extracted standalone HTML in isolated Chromium,
demo-only/camera/combined controls, camera permission lifecycle, attribution,
content exclusion, pinned dependencies, and the 2D ZIP artifact. This remains
local implementation evidence only: exact deployed download verification and
authenticated GitHub reconciliation are still unavailable; do not mark #336
closed from this local evidence.

## Blocker reconciliation: #329 (2026-09-02)

#329 completed its implementation/QA transaction locally. The public 2D
publishing/remix suite initially exposed stale header selectors and retired
`Public`/`Private` text expectations; the suite was updated to the actual
stage-local publication popover contract, then the full 24-test run passed.
Fresh distillation found no duplicate or new dependency. #329 remains the
single `/p/:id` route slice, separate from #331's embed and #336's downloaded
runtime. Authenticated GitHub access is still unavailable, so the issue is
ready for reconciliation but not closed; production proof still requires the
authorized published revision and exact URL recheck.

## Blocker reconciliation: #328 (2026-09-02)

#328 completed its AI 3D route QA transaction locally. The current
`project3dLifecycle.spec.ts` run passed 4/4, including the AI 3D editor entry
point and its shared toolbar contract. Fresh distillation found no duplicate,
new dependency, or follow-up gap; #328 remains separate from #327, public,
embed, immersive-variant, and downloaded-runtime slices. Authenticated GitHub
access is still unavailable, so the issue is ready for reconciliation but not
closed.

## Blocker reconciliation: #327 (2026-09-02)

#327 completed its manual 3D route QA transaction locally. The current
`project3dLifecycle.spec.ts` run passed 4/4, including the manual editor
entry point and its publication transition. Fresh distillation found no
duplicate or new dependency; #327 remains separate from #328 (AI 3D), public,
embed, immersive-variant, and download slices. Authenticated GitHub access is
still unavailable, so the issue is ready for reconciliation but not closed.

## Reconciliation: #325 manual 2D toolbar geometry (2026-09-02)

Engineering corrected the concrete local defect found during fresh
distillation: `.editor-piece-stage-toolbar` now owns a wrapped flex row,
because the 2D group is a direct child of the shared stage toolbar and does
not inherit the `.editor-toolbar .editor-tool-group` rule. The change keeps
all controls inside the existing `.piece-stage-shell` and does not alter
public, embed, immersive, or download issue boundaries.

Evidence: the focused HandGestureGuideDialog suite passed 5/5, frontend
TypeScript type-check passed, and
`BROWSER_QA_E2E_SPEC=e2e/manual2dStageChrome.spec.ts make browser-qa` passed
1/1 against disposable PostgreSQL/Django/Vite/Chromium. The browser
transaction verified the named authoring/runtime/publication controls,
Add circle → Undo, no legacy header row, PHP-relative 2.75rem button
geometry, stage containment, and a horizontal runtime rail. This is local
implementation evidence only. The deployed public revision remains stale or
unverified, so #325 remains open for exact authenticated published-route
verification and GitHub closure.

## Fresh distillation: manual 2D toolbar geometry (2026-09-02)

The rebuilt repository Compose stack was inspected through an authenticated
Chromium transaction on a newly created manual 2D project. The exact route was
`/projects/cb9e802b-3373-423f-be69-46d77dca8061`. The authoring overlay was
inside the canvas, but the shared runtime `PieceStageToolbar` measured
49.5px wide by 247.5px tall at the default viewport. Its screenshot,
download, camera/manual, publication, and fullscreen controls therefore form
a vertical column instead of the PHP reference's compact horizontal stage
rail.

This is an implementation defect within the existing #325 manual 2D route
slice and its #338 publication-parity capability; it is not a new issue and
does not justify changing the public-route #329 or downloaded-runtime #336
boundaries. The closure-sized engineering transaction is: add the 2D
stage-toolbar row layout without moving it outside the canvas; prove the
finite named controls remain functional, stage-contained, and horizontally
laid out at the documented viewport; run focused tests plus the exact browser
scenario; then reconcile GitHub. No deployed issue can close until the same
fixture behavior is observed on the published revision.

The next single groomed handoff is #325. Its dependency is only the current
checkout and running repository Compose stack, both available. If browser or
Docker execution becomes an environment blocker unrelated to owner judgment,
re-run task distillation at the end of this issue before selecting the next
independent route.

## Reconciliation: #329 public 2D consumer layout (2026-09-02)

Engineering added a default `piece-stage-toolbar-group` flex-row class to the
shared `PieceStageToolbar`, closing the consumer omission found during this
distillation pass without requiring every route to remember an override. The
component regression passed 4/4, the full frontend suite passed 189 files /
2,384 tests, frontend lint/typecheck/build passed, and the complete
`BROWSER_QA_E2E_SPEC=e2e/publishingAndRemix.spec.ts make browser-qa`
transaction passed 24/24. It exercised the exact public `/p/:id` and embed
routes, named screenshot/download/fullscreen/Camera/Demo controls, compact
stage geometry, publication/privacy/remix behavior, and camera fallbacks.

The earlier disposable publish 404 did not reproduce in this complete
transaction, so it is no longer an active runner blocker; historical notes
remain for provenance. The repository-wide format check still reports
pre-existing generated/fixture drift, while the changed files pass direct
Prettier validation. #329 remains open because the supplied production
revision still serves the legacy shell and exact post-publish evidence is
required before GitHub closure.

## Third distillation re-audit: deployed contradiction and public 2D consumer (2026-09-02)

The supplied production URLs were inspected directly again. Anonymous
`/p/7b2ecd2b-0a46-4031-b4a2-bb6b9cd74df2` still renders the legacy `Preview`
with sibling `Live camera` and `Demo signal controls` regions; its DOM has no
stage toolbar, screenshot, download, fullscreen, or publication controls. The
supplied private `/projects3d/f3863d2f-d3a5-41ad-9883-7b8441af6217` returns the
anonymous unavailable state and therefore cannot prove editor controls or
Draft/Published reversal. This is a deployment/authentication verification
boundary owned by #320/#321, not evidence to close any child.

The current source audit found one additional implementation defect before
engineering: `PublicProjectViewer.tsx` renders the shared `PieceStageToolbar`
without the inner control-group layout class used by the 3D consumer. The
outer toolbar alone is insufficient; direct child wrappers can retain block
flow and collapse the public 2D controls. This is already covered by #329's
single `/p/:id` route scope, so no duplicate issue is filed. #329's GitHub
closure contract was updated to require a compact horizontal stage-associated
toolbar and to distinguish this implementation defect from the deployed
revision boundary.

Duplicate/already-covered decisions: #274 and #324 remain historical
reconciliation containers; #320 owns deployment/revision reconciliation;
#321 owns Compose identity; #331 owns the separate embed entry point; #336
owns extracted 2D artifacts. No new issue is warranted for the stale live
revision or the missing public consumer class.

The complete actionable order remains: (1) fix and test #329's public 2D
consumer; (2) complete the independent #331 embed route transaction; (3)
complete #330 and #332–#335 route transactions; (4) complete #336/#337
artifact behavior; (5) perform authorized publish and exact-route/artifact
verification; (6) reconcile #320. The next handoff is exactly one issue,
#329, with fixed entry `/p/:id`, one published fixture, anonymous browser
context, named screenshot/download/fullscreen/Camera/Demo controls, no owner
chrome, compact horizontal stage geometry, and explicit camera fallback.

Blocker triage: the stale production revision and anonymous private editor are
verification boundaries, not new implementation issues. The prior disposable
fixture publish 404 is a reproducible runner/infrastructure blocker already
covered by #321 and must be repaired or explicitly handed off before a child
can close. Any non-user-judgment environment blocker at the end of #329
requires another fresh distillation pass; no product source or test change is
authorized by this distillation increment.

## Deployment revision reconciliation (2026-09-02)

Current repository evidence makes the live discrepancy explainable rather
than ambiguous: local `main` is at `0c6bc5f`, while `origin/main` is at
`14e01334e7ff827189162df5db993d7a0f001a71`, 128 commits behind. GitHub
identifies `14e0133` as Replit's `Published your App` commit with deployment
build id `fd3105fd-8768-4a68-b561-10b4ab5865f1`. The live public URL still
matches that older deployed revision, so local React fixes cannot appear
there until an authorized push/publish operation occurs.

This is covered by #320/#321; no deployment duplicate or workaround is
created. The exact next action is authority to publish the tested revision,
then authenticated editor and anonymous public/embed/artifact checks against
that deployed revision. Until then, all route issues remain open or handed
off and no parent closure is valid.
