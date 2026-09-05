# Production-readiness assessment — 2026-09-04

Project: `cfornesa/ai-dev-tools-zoomcamp-1`

This is the post-transaction assessment for the 13-issue backlog manifest in
`backlog-session-2026-09-04.md`. It is read-only with respect to product code.
The active Chrome session was used for the production check at
`https://animate.creatrweb.com/`.

## Results by dimension

| Dimension | Result | Evidence / limitation |
| --- | --- | --- |
| Local web-app deployment | BLOCKED | Frontend checks pass; backend lint/format/mypy pass. Backend full suite is 915 passed, 24 skipped, 4 startup failures, 1 socket-test error under the managed sandbox. The documented disposable browser stack was not available in this run, and aggregate `make check` is blocked by the unavailable `python` executable plus the default uv-cache permission boundary. |
| Approved-browser and CI verification | BLOCKED | The production Chrome session rendered the authenticated shell, but no current full disposable-stack Playwright/browser-readiness run or current CI run was executed. DOM/AX production evidence is supporting evidence only. |
| Intended functionality against backlog | BLOCKED | All 13 discovered issues remain open: #404/#409/#414/#415/#416 blocked; #405–#408/#410–#413 dependency-blocked. No acceptance criterion was silently omitted or treated as complete. |
| Replit publication | OPEN FOLLOW-UP | `animate.creatrweb.com` is reachable and renders the current authenticated home/gallery shell with 2D/3D projects, account settings, logout, and create controls. Exact published revision parity for the open queues is not established; follow-up is owned by the existing issue queue, not by reopening closed children. |
| Production readiness | BLOCKED | Required backlog issues, full-suite gates, and deployment/server/policy decisions remain unresolved. |

## Evidence separation

Local: `python3 scripts/check-github-action-pins.py` and
`python3 scripts/check-live-provider-alert.py` passed. Frontend lint (with
existing warnings), format, typecheck, and 2,417 tests passed. Backend ruff,
format, and mypy passed; the full backend run had 915 passed, 24 skipped, 4
startup failures, and 1 socket-test error. The failures are classified as the
managed macOS subprocess/socket verification boundary, not as product fixes
for this session.

Approved-browser/CI: no new full browser gate was available in this run. The
active Chrome session visibly rendered the production app at the exact URL
`https://animate.creatrweb.com/`; this does not establish CI or deployed
revision parity for unimplemented features.

Production: the published shell is reachable and authenticated in Chrome.
No live provider calls, credential changes, database writes, or deployment
mutations were performed. The deployed revision was not identified, so route,
artifact, and parity claims for the open issues remain an evidence boundary.

## Remaining issues and exact next actions

- #404: blocked by missing vendor-neutral implementation. Engineer foundation,
  then rerun focused/full checks.
- #405/#406: dependency-blocked by #404. Implement each provider after the
  foundation is reconciled.
- #407: dependency-blocked by #404–#406. Implement settings/model selection
  after both adapters are stable.
- #408: dependency-blocked by #405–#407. Add the cross-vendor matrix last.
- #409: blocked by missing draw.io representation/implementation. Decide the
  supported safe format and engineer persistence/validation.
- #410/#411: dependency-blocked by #409 and each prior draw.io contract.
- #412: dependency-blocked by #409–#411. Implement shared viewer/export
  semantics and verify exact deployed surfaces.
- #413: dependency-blocked by #409–#412. Run the integrated accessibility and
  regression gate.
- #414: blocked until the owner/operator chooses supported shared production
  quota state (shared cache or transactional DB-backed strategy).
- #415: blocked until the owner/operator confirms the production WSGI/ASGI
  server, worker model, and Replit signal contract.
- #416: blocked until the owner selects Google-only or verified-password
  signup, then the policy can be implemented and tested.

## Reconciliation and omission audit

GitHub open-issue search and `docs/tasks.md` agree on exactly #404–#416. No
duplicate or silently omitted issue was found. All 13 issues have a terminal
backlog-session status and a QA comment beginning `## QA: FAIL`; none was
closed, reopened, or re-engineered during readiness. Newly discovered
actionable follow-ups: zero; created/reused/pending authorization: 0/0/0.
No failed full-suite gate remains unclassified.

## Repository handoff boundary

The documentation changes are in the worktree but could not be committed in
this managed run: `git commit` failed because the environment denied creation
of `.git/index.lock`. No product code or tests were modified. The pre-existing
`test-results/.last-run.json` change remains un-staged and untouched.

## Rerun evidence — 2026-09-04

The second assessment found no state change: GitHub still lists exactly
#404–#416 open, the remote reconciliation branch remains 3 commits ahead of
`main`, and the production Chrome shell at `https://animate.creatrweb.com/`
still renders successfully. Fresh pins/live-provider checks passed; scene
validation passed 48/48; the focused backend set passed 132/136 with the same
four sandbox launcher timeouts; and `make check` still fails immediately on
the unavailable `python` executable. The readiness classifications above
therefore remain authoritative: local deployment, approved-browser/CI,
intended functionality, and overall production readiness are blocked, while
the reachable production shell remains an open follow-up for exact revision
parity. No new issue or memory topic was needed.

## Implementation continuation — 2026-09-05

The prior readiness snapshot is historical. Implementation has since landed
in the working tree for the five previously blocked foundations: shared
production quota storage (#414), production ASGI launch (#415), explicit
Google-only signup (#416), vendor-neutral encrypted credentials (#404), and a
bounded versioned draw.io document subset (#409). Focused backend tests,
draw.io validation (52 tests), frontend scene validation (48 tests), and
frontend typecheck pass. Production readiness remains open because dependent
provider/draw.io work (#407–#413), full `make check`, approved deployment
process verification, and remote branch handoff are still outstanding.

The draw.io chain has since advanced: a dedicated safe preview adapter,
editor object mutations, outer-layer controls, and a dependency-free
standalone HTML export runtime are implemented on the reconciliation branch.
Focused draw.io renderer/export/mutation tests pass, and the native
layer/editor suite passes 45 tests. The active Chrome production shell at
`https://animate.creatrweb.com/` remains healthy and authenticated, but it is
not evidence that this branch is deployed; no workflow run is associated with
the branch head, so deployment parity remains unverified.

## Browser-QA follow-up — 2026-09-05

The disposable PostgreSQL harness was exercised against the AI/recovery spec.
Chromium proved provider/model selection and PostgreSQL draft-sync
concurrency, but the full spec was not marked passed: autosave scenarios
timed out before finding the stage-authoring control. This is an
E2E/editor-surface integration blocker, not evidence of production parity.
The harness now accepts `BROWSER_QA_PLAYWRIGHT_PROJECT` (`chromium`,
`firefox`, or `webkit`) to isolate browser failures. The active Chrome
production shell remains healthy at `https://animate.creatrweb.com/`, but the
branch is not deployed there.

The backlog closure pass closed #404–#407 after the focused implementation
evidence and complete Chromium AI/recovery suite passed. The remaining open
issues are intentionally retained for missing matrix, draw.io surface,
deployment, distributed-process, and auth-browser evidence rather than being
closed by inference.
## Current readiness reconciliation — 2026-09-05

Local readiness advanced: 57 focused backend tests passed, the frontend build
passed, the draw.io and Google-only browser acceptance flows passed, and
production-like `manage.py check --deploy` passed with zero warnings. The
active Chrome session could not be re-inspected because macOS is currently
locked; the production baseline remains `https://animate.creatrweb.com/` and
the reconciliation branch is not deployed there.

GitHub now has 10 completed issues and 3 open issues. #413
remains open for the integrated draw.io regression/accessibility gate. #412
closed after focused backend/frontend coverage and a real Chromium flow
verified published public, embed, thumbnail, and full-download behavior.
#414 remains
open for two-worker shared-cache proof, and #415 remains open for exact
published ASGI/process-signal proof. These are verification boundaries, not
reasons to retain already-completed local capability issues.

The complete frontend check passed (2,424 tests). The backend suite reached
978 passed and 24 skipped, with one Git-safe-push fixture blocked by the
restricted host's inability to bind a loopback socket. The repository Makefile
was corrected to use `python3` for its check scripts because this macOS host
does not expose a `python` executable.

The latest backlog increment adds keyboard-operable validated Draw.io creation
for the approved rectangle, ellipse, line, and text subset; Chromium browser
acceptance passes. #410 is now closed after rotation, bidirectional selection,
and unsupported-object UX evidence passed. #414 now uses atomic daily quota increments across
2D, 3D, and art-piece paths, but still needs real two-worker deployed proof.

The latest editor increment adds bounded Draw.io rotation and stable object
selection rows in the layer outline; focused tests and Chromium acceptance
pass. #411 is now closed after ordered-layer drag/drop and fixed-viewport
z-order evidence passed; #413 is the remaining integrated Draw.io gate.

## Current readiness reconciliation — 2026-09-05

#413 is now closed: focused validation/accessibility/export/renderer coverage
passed (116 frontend tests and 70 backend tests with 2 PostgreSQL-gated skips),
and Chromium verified editor, public, embed, thumbnail, and download behavior.
GitHub now has 11 completed issues and 2 open issues. #414 remains open for
real two-worker shared-cache proof; #415 remains open for exact deployed ASGI
process/signal proof. The production baseline remains
https://animate.creatrweb.com/; because the active Mac session is locked and
the reconciliation branch is not deployed there, no production-readiness
claim is made from that baseline.

#414 is now closed after real two-worker PostgreSQL API verification. Overall
backlog state is 12 completed and one open (#415). Production readiness still
requires the published branch-parity and process/signal evidence owned by
#415.

The isolated PostgreSQL runtime check found and fixed a real distributed-quota
race: Django's stock DatabaseCache.incr was read/modify/write. Production now
selects AtomicDatabaseCache, which row-locks each counter increment. Two
independent workers passed the corrected test with exactly five of six
rate-window increments accepted and the daily counter reaching six. CI run
481 is queued; deployed process and endpoint-level proof remain open.
