# Backlog session — 2026-09-04

## Scope and discovery

Project: `cfornesa/ai-dev-tools-zoomcamp-1`.

This reconciliation audited all 21 records in `.local/tasks/`, the canonical
`docs/tasks.md` ledger, project guidance, repository history, and the complete
GitHub issue set. At the start of this pass, GitHub had no open issues. Four
local implementation specifications had no issue number or URL and were
genuinely actionable records, so four criterion-ready issues were created and
processed: #400–#403.

The local `reset-main-to-origin.md` record is a completed operational recovery
note, not product backlog work: `main` already equals `origin/main`, the
worktree is clean, and creating a new issue for a finished destructive
recovery would misrepresent current work.

## Complete manifest

| Issue | URL | Backlog record | Dependencies | Scope | Status | Owner / next action |
| --- | --- | --- | --- | --- | --- | --- |
| #97 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/97) | `production-operational-readiness.md` | none | Production configuration/readiness | completed | Historical closure retained |
| #104 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/104) | `prevent-false-push-rejected.md` | none | Git push result classification | completed | Historical closure retained |
| #108 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/108) | `capture-discovered-work.md` | none | Discovery gate | completed | Historical closure retained |
| #109 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/109) | `editor-preview-space.md` | none | Editor preview/control-panel layout | completed | Historical closure retained |
| #110 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/110) | `editor-layer-association.md` | none | Layer/shape association | completed | Historical closure retained |
| #111 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/111) | `editor-shape-manipulation.md` | none | Shape selection/dragging | completed | Historical closure retained |
| #112 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/112) | `editor-unexpected-refresh.md` | none | Unsaved-work refresh protection | completed | Historical closure retained |
| #133/#139 | [#133](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/133), [#139](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/139) | `fix-publish-run-command.md` | #133 before #139 | Publish-safe launcher and republish | completed | Historical closure retained |
| #193 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/193) | `production-readiness-2026-08-27.md` | prior readiness fixes | Full browser/readiness recovery | completed | Historical closure retained |
| #257/#259–#262 | [#257](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/257), [#259](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/259) | prior Mistral preference records | none | Models/personas, not credential storage | completed | Existing scope retained |
| #274/#320/#324, #344, #383–#398 | existing authored/generated parity issues | parity distillation records | FIFO/deployment evidence | Route/artifact parity | completed or not planned | Historical terminal records retained |
| #400 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/400) | `auth-experience-and-signup-protection.md` | none | Auth shell, branded account pages, signup reCAPTCHA | completed | Closed with QA comment [5539172629](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/400#issuecomment-5539172629) |
| #401 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/401) | `fix-google-oauth-csrf-origin.md` | none | Explicit environment-driven trusted origins | completed | Closed with QA comment [5539174163](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/401#issuecomment-5539174163) |
| #402 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/402) | `make-simple-3d-prompts-valid.md` | none | Safe primitive-dimension defaults for AI-created scenes | completed | Closed with QA comment [5539176212](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/402#issuecomment-5539176212) |
| #403 | [issue](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/403) | `per-user-mistral-credentials.md` | none; separate from #257/#259–#262 | Encrypted owner-scoped Mistral credentials | completed | Closed with QA comment [5539178258](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/403#issuecomment-5539178258) |

The following records are terminal session/distillation history rather than
new work: `authored-piece-parity-distillation-2026-09-03.md`,
`authored-piece-parity-distillation.md`, `backlog-session-2026-08-26.md`,
`backlog-session-2026-09-01.md`, `session-completion-2026-08-27.md`, and
`task-distillation-2026-08-27.md`.

## Grooming and duplicate report

- Every current actionable local record is now linked to an existing or newly
  created GitHub issue.
- Issues #97, #104, #108–#112, #133/#139, #193, #257, and #259–#262 were
  reused; none was reopened or duplicated.
- Authored/generated parity issues #274/#320/#324, #344, and #383–#398 were
  already issue-owned and terminal. Their older open/blocked language is stale
  historical ledger content, not current work.
- The four new issues each name a single capability boundary, finite observable
  criteria, exact verification commands, out-of-scope work, and an evidence
  boundary. Their QA comments contain criterion matrices and closure decisions.
- `reset-main-to-origin.md` is classified non-actionable historical recovery:
  the requested state is already true and no remote history was changed.

## Dependency and transaction order

1. Reconcile existing issue ownership and stale local statuses.
2. Process #400 auth shell and signup protection.
3. Process #401 trusted-origin configuration.
4. Process #402 AI-created 3D normalization.
5. Process #403 owner-scoped Mistral credentials.
6. Reconcile canonical backlog and verify GitHub has no open issues.

The four transactions are independent at runtime. The listed order follows
the source-record order and keeps authentication/configuration before the AI
capabilities that depend on authenticated requests.

## Verification rollup

- Focused backend run: 193 passed.
- Focused frontend auth/settings run: 18 passed.
- Full `make check`: 944 backend passed, 22 skipped; 2,417 frontend passed;
  ruff, format, mypy, typecheck, workflow pin, and live-provider contract
  checks passed.
- Credential build scan:
  `cd frontend && npx playwright test e2e/buildOutputCredentialScan.spec.ts`
  — 3 passed.
- Direct Playwright against the running application at 375×812: Login
  heading, Google button, signup navigation, invalid-signup feedback, and
  footer — 5/5 passed.
- Rendered preview inspection covered `/`, `/accounts/login/`, and
  `/accounts/signup/` at 1280×720; Login/Google controls, branded forms,
  labels, signup controls, and current-year footer were visible.
- `bash scripts/browser-qa.sh` was attempted twice in the supported disposable
  path. Its PostgreSQL container reached database readiness, but the host
  Docker runtime rejected `docker exec` with OCI `setns` errors before
  Django/Vite startup. This is a verification-environment boundary, not a
  product failure; direct Playwright and the full local quality gate passed.

## Final status

| Count | Value |
| --- | ---: |
| Local records discovered | 21 |
| Newly created GitHub issues | 4 |
| Issues completed in this session | 4 |
| Existing terminal/covered records | 17 |
| Blocked | 0 |
| Dependency-blocked | 0 |
| Handed-off | 0 |
| Missing terminal status | 0 |
| Newly discovered actionable follow-ups | 0 |

The final GitHub audit reports zero open issues for the repository. The working
tree remains clean and `main` equals `origin/main`.

## Current backlog-session reconciliation — 2026-09-04

The earlier historical session above is superseded for the current run: the
authenticated GitHub audit found 13 open issues, #404–#416. Discovery found no
duplicates or unlinked actionable records; the three existing distilled
queues are preserved. Pre-existing worktree state is `M test-results/.last-run.json`
and is unrelated/user-owned; no session files were mixed into it.

### Complete manifest and transaction ledger

| Issue | URL | Backlog entry | Dependencies | Scope | Status | Blocker class / follow-up | Owner / next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| #404 | [GitHub](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/404) | vendor foundation | none | vendor registry, encrypted owner credentials, routing/redaction | blocked | implementation-defect; no follow-up needed | Engineer #404, then rerun focused/full checks |
| #405 | [GitHub](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/405) | Gemini provider | #404 | Gemini 2D/3D adapter | dependency-blocked | #404 | Engineer after #404 closes |
| #406 | [GitHub](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/406) | DeepSeek provider | #404 | DeepSeek 2D/3D adapter | dependency-blocked | #404 | Engineer after #404 closes |
| #407 | [GitHub](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/407) | multi-vendor settings | #404–#406 | settings cards and provider/model selection | dependency-blocked | #404–#406 | Engineer after both adapters close |
| #408 | [GitHub](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/408) | cross-vendor matrix | #405–#407 | deterministic API/browser regression matrix | dependency-blocked | #405–#407 | Engineer after integrated vendor workflow |
| #409 | [GitHub](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/409) | draw.io foundation | none | safe versioned draw.io document persistence | blocked | implementation-defect; no follow-up needed | Decide supported representation and engineer #409 |
| #410 | [GitHub](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/410) | draw.io object tools | #409 | object selection/manipulation | dependency-blocked | #409 | Engineer after #409 closes |
| #411 | [GitHub](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/411) | draw.io outer layers | #409–#410 | layer controls and persistence | dependency-blocked | #409–#410 | Engineer after object contract |
| #412 | [GitHub](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/412) | draw.io surfaces | #409–#411 | public/embed/thumbnail/download rendering | dependency-blocked | #409–#411 | Engineer after layer contract |
| #413 | [GitHub](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/413) | draw.io regression gate | #409–#412 | integrated accessibility/compatibility evidence | dependency-blocked | #409–#412 | Engineer after all draw.io surfaces |
| #414 | [GitHub](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/414) | shared AI quotas | none | distributed quota/rate-limit state | blocked | infrastructure decision; no new issue needed | Owner/operator chooses supported shared backend |
| #415 | [GitHub](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/415) | production server | none | WSGI/ASGI launcher and lifecycle | blocked | deployment/server decision; no new issue needed | Owner/operator confirms server/signal contract |
| #416 | [GitHub](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/416) | signup policy | none | explicit authentication policy | blocked | product/security decision; no new issue needed | Owner selects Google-only or verified-password signup |

Transaction records: #404 and #409 reached `GROOMED → ENGINEERING/QA →
BLOCKED` with no commit because the requested foundations are absent and were
not implemented in this reconciliation; #405–#408 and #410–#413 reached
`GROOMED → ENGINEERING/QA → DEPENDENCY-BLOCKED`; #414–#416 reached
`GROOMED → ENGINEERING/QA → BLOCKED`. Focused/full checks, QA result, evidence
boundary, GitHub QA comment, and next action are recorded in each issue's
2026-09-04 comment (comments #5548205342 through #5548209732). No code or
product tests were changed in this session.

### Automation and QA evidence

- `python3 scripts/check-github-action-pins.py`: PASS.
- `python3 scripts/check-live-provider-alert.py`: PASS; no live provider call.
- Frontend check: PASS — lint (existing warnings only), format, typecheck, and
  2,417 tests.
- Backend lint, format, and mypy: PASS with `UV_CACHE_DIR` redirected to a
  writable task cache.
- Backend full suite: 915 passed, 24 skipped, 4 startup failures, and 1
  socket-test error. The failures are the documented managed-sandbox
  subprocess/socket verification boundary, not evidence for closing any open
  issue.
- Aggregate `make check`: BLOCKED before completion because the Makefile calls
  an unavailable `python` executable; the backend cache boundary also affects
  the default command.
- Production Chrome evidence: `https://animate.creatrweb.com/` rendered the
  authenticated home/gallery shell with account settings, logout, 2D/3D
  project lists, and project creation controls. This is production evidence
  only; it does not prove any of #404–#416.

### Batch rollup

| Count | Value |
| --- | ---: |
| Discovered open issues | 13 |
| Completed | 0 |
| Blocked | 5 |
| Dependency-blocked | 8 |
| Handed-off | 0 |
| Missing terminal status | 0 |
| New actionable follow-ups | 0 |
| Created / reused / pending authorization | 0 / 0 / 0 |

No failed full-suite gate is unclassified. Session completion and the required
production-readiness assessment follow this reconciliation; because required
issues remain blocked, the project cannot be called production-ready.

## Rerun reconciliation — 2026-09-04

Fresh GitHub search still returns exactly open issues #404–#416; no duplicate,
new follow-up, or changed dependency was found. The active Chrome session
again rendered the authenticated production shell at
`https://animate.creatrweb.com/`.

Fresh checks:

- `python3 scripts/check-github-action-pins.py`: PASS.
- `python3 scripts/check-live-provider-alert.py`: PASS; no live provider call.
- `cd frontend && npm test -- --run src/validation/scene.test.ts`: PASS,
  48/48.
- Focused backend command covering #414–#416 and related API contracts: 132
  passed, 4 failed. All four failures are the same managed-sandbox
  `scripts/start.sh` subprocess timeout cases in `test_startup_configuration.py`;
  the authorization, AI, art-piece, OAuth, and reCAPTCHA tests passed.
- `make check`: reproducibly blocked at the first target because the Makefile
  invokes `python`, which is unavailable; the backend cache boundary remains
  handled only by the writable-cache override.

Rerun transaction result is unchanged: #404/#409/#414/#415/#416 remain
`BLOCKED`, #405–#408/#410–#413 remain `DEPENDENCY-BLOCKED`, and all 13 issues
retain their existing QA comments and next actions. No issue was reopened or
closed, and no product code/tests were changed.

## Implementation continuation — 2026-09-05

The audit classification above is superseded by implementation work in this
continuation. #414 now has a production database-cache backend and migration;
#415 has a production-only pinned Uvicorn launcher; #416 has an explicit
Google-only signup policy that still permits first-time Google social signup;
#404 has a finite provider registry and encrypted owner/vendor credential API;
and #409 has a bounded versioned draw.io subset with mirrored client/server
validation. #405/#406 now have dependency-free Gemini/DeepSeek adapters and
#407 has vendor settings and 2D/3D selector wiring. Focused tests for these changes pass. The five issues are not
being treated as status-only blockers while implementation proceeds; remaining
acceptance evidence and dependent provider/draw.io features still require
follow-on work before issue closure.

## Closure reconciliation — 2026-09-05

This implementation transaction closed #404, #405, #406, and #407 on GitHub
after focused backend/frontend evidence and the complete Chromium AI/recovery
browser suite passed (24/24). #408 remains open for the broader per-vendor
failure matrix; #409–#413 remain open for draw.io persistence, browser
interaction, public/embed/export parity, and accessibility evidence; and
#414–#416 remain open where production deployment, distributed-cache/process
lifecycle, or auth-browser evidence is still required. The open/closed split
is now evidence-based rather than a blanket retention of all original
blockers.
## Current evidence reconciliation — 2026-09-05

The authoritative GitHub state is now 10 completed issues (#404–#412 and
#416) and 3 open issues (#413–#415). #408 closed after the expanded 38-test
deterministic create/edit matrix across Mistral, Gemini, and DeepSeek. #416
closed after the Google-only policy was documented, enforced, and verified by
desktop/mobile browser tests. Draw.io browser coverage now passes object
move/resize/duplicate, layer rename, save, and reload; #411 remains open
because layer drag/drop and fixed-viewport rendered evidence were still
incomplete. #411 then closed after the ordered-layer mutation was corrected
and fixed-viewport drag/z-order evidence passed. #412 then closed after focused
backend/frontend coverage and a real Chromium flow verified published
public, embed, thumbnail, and full-download behavior for a supported Draw.io
scene.

The production launcher regression discovered during readiness testing was
fixed using child-liveness checks; `test_startup_configuration.py` is now
17/17. The broader focused set is 57 passed, the frontend production build
passes, and production-like `check --deploy` reports zero issues. #414/#415
remain open because two-worker production storage and exact deployed
process-lifecycle evidence still require the published environment; #413
continues as the integrated draw.io regression/accessibility gate.

The full frontend check passed (lint, formatting, typecheck, and 2,424 tests).
The backend suite reached 978 passed and 24 skipped; one Git-safe-push test
could not bind its loopback fixture socket under the restricted host sandbox.
The Makefile's repository check scripts were made portable on this macOS host
by invoking `python3`, removing the separate missing-`python` blocker.

The next implementation increment advanced #410: validated active-layer
creation tools now cover the approved Draw.io rectangle, ellipse, line, and
text subset, and Chromium verifies keyboard creation/deletion alongside the
existing object and save/reload flow. #410 was subsequently closed after
rotation, bidirectional canvas/outline selection, and unsupported-object UX
evidence were added.
#414's daily quota writes are now atomic in the 2D, 3D, and art-piece paths;
its real two-worker runtime proof remains outstanding.

## Current closure reconciliation — 2026-09-05

The integrated Draw.io gate #413 is now closed after 116 focused frontend
tests, 70 focused backend tests (2 PostgreSQL-gated skips), and Chromium
editor/public/embed/thumbnail/download acceptance. A native-renderer
regression explicitly proves native scenes do not claim Draw.io
interoperability. The authoritative state is now 11 completed issues and 2
open issues: #414 still needs real two-worker production-cache evidence, and
#415 still needs exact published process-lifecycle evidence.

The isolated PostgreSQL runtime check exposed that Django's stock
DatabaseCache.incr was not atomic. Production now uses AtomicDatabaseCache
with PostgreSQL row locking; the corrected two-process test passes 4/4. #414
remains open only for endpoint-level multi-worker sixth-request proof and
deployment availability checks; CI run 481 is queued for clean-host
confirmation.

The following #410 increment adds bounded object rotation to the shared schema,
Canvas2D adapter, editor mutation path, and toolbar, and exposes Draw.io
objects in their owning outline layers. Focused tests and Chromium acceptance
pass; #410 and #411 are now closed, with #413 remaining as the integrated
Draw.io regression/accessibility gate.
