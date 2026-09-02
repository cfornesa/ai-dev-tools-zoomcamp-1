# Parity closure evidence gap

Structured authored-piece parity spans separate editor, public, embed,
immersive, and downloaded-runtime entry points. A shared component or local
test can establish an implementation prerequisite, but cannot establish the
behavior of every consuming route.

For deployed criteria, the evidence boundary is the exact published revision
and URL (authenticated for private editors). For download criteria, the
evidence boundary is the downloaded archive extracted and opened in a browser;
generated source-string assertions are supplementary only. If the deployed
revision is stale, classify the result as a deployment verification boundary,
not as a product pass.

The 2026-09-02 re-audit found the supplied public route on the legacy shell
while the checkout contained newer stage-local controls. This invalidated any
historical closure wording that used “verified live” for localhost or a
disposable stack. Keep #320 as a roll-up and use #325–#337 for exact route and
artifact slices; use #338–#341 for route-specific publication chrome.

When a dependency or environment blocker unrelated to user judgment ends an
issue, task-distillation must be rerun at that issue's handoff to reconcile
duplicates, dependency order, closure criteria, owner, and follow-up coverage.

Owner-rejection re-audit (2026-09-02): the same live public route was
inspected again and still had no `Piece actions` toolbar, screenshot,
download, fullscreen, or publication controls. Treat any local child marked
`ready_for_github_reconciliation` as local evidence only until the exact
deployed revision is inspected; “ready for a comment” is not a substitute for
passing deployed acceptance criteria. Do not infer a parent’s parity from
child tests that ran against a different revision. The PHP reference’s stage,
immersive, and exported-runtime contracts must be checked on the actual route
or extracted artifact before closure.

Live contradiction re-audit (2026-09-02): the supplied public URL currently
loads `assets/index-CyiyAAR0.js` and renders the legacy `editor-panel`/`p5Canvas`
layout with zero `role="toolbar"` elements, a sibling Live camera disclosure,
and a sibling Demo signal controls disclosure. The checkout is 148 commits
ahead of `origin/main`; local stage-toolbar work is not evidence that the
published app contains it. Backlog status must show local implementation and
deployed verification separately, and closed narrow capability issues (#306,
#343, #345) must not be reused as proof of live route parity.

Current re-audit reinforcement (2026-09-02): at checkout
`5e4204366f1a4b6be149616ba2bfc30e534ac106` the repository is 154 commits ahead
of `origin/main` (`14e01334e7ff827189162df5db993d7a0f001a71`). The public URL
still has the legacy shell and the private 3D URL still resolves to the
anonymous unavailable state. Treat #296–#311/#343/#345 as isolated local
capabilities only; the actual authored-piece parity closure remains the exact
consumer and downloaded-artifact matrix in #325–#337 plus local implementation
#338–#341 and release reconciliation #320/#321. A Docker socket permission
failure is a workflow/infrastructure blocker requiring a fresh distillation at
each blocked handoff, not permission to close or skip evidence.

Post-republish audit (2026-09-02): the published 2D fixture now serves the
stage-local toolbar from `assets/index-CKhsUQOh.js`; #329 and #331 were closed
only after exact anonymous route inspection. The in-app browser security
policy rejects `file://` navigation, so captured production standalone HTML
can be downloaded and statically inspected but cannot satisfy the artifact
execution criterion until an approved Chromium context supports local-file
opening. The published gallery currently exposes no 3D fixture, leaving the
3D route, immersive, and 3D-download issues blocked on a concrete publication
dependency rather than on local implementation evidence.

Owner re-audit correction (2026-09-02): the owner reports absent public
controls and bulky editor actions. The exact public 2D URL was independently
reopened and currently renders a visible stage toolbar, so this is an
unresolved user-visible evidence conflict, not a pass. The private editor URL
returns anonymous access denied and cannot establish editor behavior. Keep
#329/#331 open until the differing asset, cache, viewport, or browser context
is explained; never close from one browser observation. The source audit also
confirmed that structured 2D declares `sound: false` while the PHP reference
uses capability-driven sound, which is tracked as new atomic issue #346.
Shared-foundation completion (2026-09-02): #346's local-only contract is now
implemented and QA-ready. `schema/scene.schema.json` owns optional
`runtimeCapabilities`; enabled/disabled canonical fixtures are validated by
both TypeScript and Django; `structured2dCapabilities.ts` derives the finite
control set; and `Structured2DSoundControls.tsx` activates sound/microphone
only from explicit buttons and reports failures. The focused frontend suite
passed 54 tests, backend scene validation passed 49 tests, and the frontend
typecheck/lint/build passed (lint retains unrelated existing warnings). Do
not use this as evidence for route, artifact, or deployed parity: those remain
separate issue contracts.
Manual 3D live recheck (2026-09-02): the connected owner Chrome session
verified camera activation and safe stop, sound activation, the five-step hand
guide, Full ZIP download, and Draft → Published → Draft on the exact private
editor URL. Docker-backed manual 3D browser QA passed 1/1. That live toolbar
did not include the immersive link because `Project3DWorkspace` omitted the
existing `immersiveHref` prop; local commit `4f912c9` fixes the wiring and the
route assertion. Keep #327 open until that exact commit is pushed and
republished; local QA does not establish deployed parity.
