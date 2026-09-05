# Open-issue distillation — 2026-09-05

This is the current manifest, superseding the historical open-state inventory
in pieces-readiness-audit-2026-09-05.md. Scope: cfornesa/ai-dev-tools-zoomcamp-1
only. User explicitly prohibits reopening closed issues. This pass changes
open issue contracts and documentation only; no product/test changes or issue
closures are performed.

## Current source and external state

- Checkout: e989ce1e4a16e31d530c24727665107f32465d61.
- Existing uncommitted #441 session implementation was present before this
  pass: Django session modules/signals/migration 0034, React route/API/page
  and tests. Preserve it; presence is not QA or completion evidence.
- Authenticated GitHub enumeration found 12 open issues at this continuation,
  then 3 new agentic issues; final manifest contains 15 unique open issues.
  Search used explicit state=open and limit=100, exceeding the result count.
- PR #417 remains open, merged=false, mergeable=false at b4cde2e.
  Current main has advanced; #445 must compare its actual diff/history before
  merge/close disposition. No product merge or PR state change is part of this
  distillation.
- Prior cb98fb6 / CI run 499 / assets/index-DqBGvDVD.js findings are historical
  snapshots, not fresh failure/deployment claims about e989ce1. Earlier
  generated runtime/thumbnail/export/privacy gaps now have terminal history;
  only surviving follow-ups below remain actionable here.
- No new full tests, browser scenarios, provider calls or deployment were run
  in this open-only continuation. Verification commands below are closure
  requirements, not claimed results.

## Complete current manifest

| Issue | Scope / goal | Dependencies | Status | Owner / exact next action |
|---|---|---|---|---|
| [#415](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/415) | Replit backend runtime: verify published ASGI routing and process lifecycle | operator deployment | BLOCKED / deployment | Operator: capture current disposable Replit process/signals and asset evidence. |
| [#419](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/419) | Full browser gate: classify current-revision failures and reconcile owning issues | current full CI evidence; #454 when reproduced | OPEN / verification container | CI/QA: run current complete matrix, classify actual failures and link owning issues. |
| [#440](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/440) | Account billing: create and display a PayPal sandbox subscription | none; local foundations closed | PROPOSED / GROOMED | Engineer: reuse billing foundation for mocked checkout/status, then operator sandbox proof. |
| [#441](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/441) | Account sessions: list and revoke owner sessions safely | none; implementation in progress | ACTIVE / preserve current work | Current engineer/QA: finish existing session changes and reconcile focused/full/browser checks. |
| [#442](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/442) | Account export: download an owner-scoped portable data archive | none; identity foundations closed | PROPOSED / GROOMED | Engineer: implement owner export allowlist and verify extracted artifact. |
| [#443](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/443) | Account deletion: deactivate access and apply an explicit retention contract | operator retention/cancellation policy | BLOCKED / policy | Operator: decide retention and active-subscription deletion policy before implementation. |
| [#445](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/445) | Release candidate: reconcile exact merged artifact, Replit schema and pieces evidence | all required open children | DEPENDENCY-BLOCKED | Release QA: reconcile current main/PR #417 and every child against exact deployed evidence. |
| [#454](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/454) | artPieceCameraRuntime.spec.ts: granted-camera scenario doesn't reach 'active' on WebKit | none | PROPOSED / GROOMED | Browser engineer: isolate WebKit camera promise/video/ack behavior. |
| [#455](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/455) | Generated regular viewer: full real hand-tracking (MediaPipe) for hand-steering | none; lifecycle foundation closed | PROPOSED / GROOMED | Runtime engineer: integrate existing vision pipeline and generated camera registration. |
| [#457](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/457) | Studio /art-pieces: 'ready' handshake stalls while the generated preview iframe is off-screen | none | PROPOSED / GROOMED | Frontend engineer: implement bounded offscreen readiness without hiding errors. |
| [#459](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/459) | Full ZIP export's Steer button stays gated to Three.js/A-Frame for flat pieces | none; live flat shell closed | PROPOSED / GROOMED | Export engineer: port existing flat spatial shell to Full ZIP and execute extracted fixture. |
| [#460](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/460) | Login /accounts/login/: add optional LinkedIn sign-in via OpenID Connect | none; OAuth foundation closed | PROPOSED / GROOMED | Auth engineer: implement optional OIDC provider with existing identity safety. |
| [#461](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/461) | AI workflow service: run bounded plan–validate–revise proposals | none | PROPOSED / GROOMED | AI engineer: implement bounded run state machine with fake providers and concurrency tests. |
| [#462](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/462) | AI 2D editor /ai-projects/:id: create and edit layers through agent runs | #461 | DEPENDENCY-BLOCKED | AI frontend engineer: integrate shared run into 2D route after #461. |
| [#463](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/463) | AI 3D editor /ai-projects3d/:id: create and edit scene objects through agent runs | #461, #462 | DEPENDENCY-BLOCKED | AI frontend engineer: reuse shared run/UI for 3D route after #461/#462. |

## Efficient agentic scope

#461 is one shared, provider-neutral plan/validate/revise service. #462 and
#463 are separate consumer transactions because the AI 2D and AI 3D routes
need different fixtures and rendered verification. Create-piece and selected
layer/object edits are modes of the same bounded proposal workflow, not
separate frameworks or queues.

Reuse provider registry/encrypted credentials, 2D/3D validation and patch
scope, entitlement/rate-limit policy, personas/model settings, draft state
and idempotent Accept. A run has a server-controlled 3-attempt/2-repair/
120-second default budget, persisted status, single advance lease, explicit
cancellation, selected-target checks and stale-base protection. Planning and
intermediate candidates never change saved creative state.

The service exposes concise plans and operation outcomes, not private model
reasoning. No autonomous publishing, deletion, billing/credential tools,
arbitrary code/network tools, unbounded background agents or new agent SDK
is included. Raw generated ArtPiece code remains a distinct sandboxed domain;
the MVP agent UI targets structured AI editors only. Existing one-shot flows
remain available. Optional LinkedIn/PayPal and real hand tracking are not
dependencies of agentic scene editing.

## Duplicate and already-covered report

- Existing one-shot generation, retries, validated patching, idempotent
  acceptance, vendor registry and encrypted keys are source prerequisites.
  #461 adds orchestration, not duplicates of those closed capabilities.
- Closed login/admin/entitlement/identity/display foundations are reused by
  #440/#442/#460 and the agent service; their old blocked prerequisites were
  removed from the active contracts. No closed issue was edited or reopened
  during this continuation.
- #441 already has uncommitted implementation; no competing session issue,
  alternate route or replacement implementation was created.
- #454 owns the existing WebKit camera verification failure; #455 owns real
  vision-to-steering integration; #459 owns only flat Full ZIP behavior.
  These do not reopen closed lifecycle/live-shell work or duplicate one
  another's runtime/evidence boundary.
- #457 owns below-fold Studio readiness; no separate generic iframe issue.
- #460 is the already-filed LinkedIn implementation after the provider
  decision. No new LinkedIn/Bluesky issue is created. Bluesky remains outside
  the currently accepted provider scope.
- #419 owns the current full-suite reconciliation. Old run-499 failures
  must not be refiled without current reproduction; failures match existing
  children where applicable.
- #445 owns release revision/schema/environment evidence and stale PR #417
  reconciliation; no duplicate deployment epic was created.
- Exactly 3 issues created in this continuation: #461–#463.

## Blocker triage and follow-up decisions

| Finding | Classification | Coverage / new issue decision | Owner / next action |
|---|---|---|---|
| Active session changes lack terminal reconciliation | In-progress implementation, not a new defect | #441; no duplicate | Current engineer/QA completes existing transaction |
| Missing bounded AI orchestration | Missing intended feature | New #461 shared capability | AI engineer builds bounded adapter-driven service |
| AI route consumers lack agent workflow | Missing intended feature | New #462 and #463, one per route | UI engineering after shared service |
| WebKit camera activation does not complete | Workflow/infrastructure-defect until actual root cause is classified | Existing #454 | Browser engineer isolates fake-stream versus runtime cause |
| Real generated steering pipeline absent | Implementation gap | Existing #455 | Runtime engineer reuses pinned vision infrastructure |
| Studio readiness depends on visible iframe | Implementation defect | Existing #457 | Offscreen/throwing-source regression contract |
| Flat Full ZIP omits steering | Implementation defect | Existing #459 | Execute extracted flat fixtures after port |
| Billing/exports/LinkedIn not delivered | Missing intended extensions | #440/#442/#460; no duplicates | Respective engineering transactions |
| Account deletion policy incomplete | Decision blocker | Existing #443; no new policy epic | Operator records finite retention/cancellation matrix |
| Current full browser/release evidence absent | Verification boundary / failed checks stay actionable | #419/#445 | Current SHA checks, classify every failure |
| Exact Replit process/revision unavailable | Verification boundary | #415/#445 | Operator supplies current disposable process/asset evidence |
| PR #417 now reports mergeable=false | History/workflow reconciliation boundary | #445; no product-conflict implementation in this pass | Compare PR to advanced main before deciding disposition |
| Live provider/device proof not executed | Verification boundary | Named issue plus #445 | Operator-provisioned non-production evidence; never infer from mocks |

No blocker is a reason to halt unrelated closure-ready work. No actionable
item is left only in prose or pending issue-creation authorization.

## Dependency order and one next transaction

Exactly one next transaction: **#441 — Account sessions: list and revoke owner
sessions safely**, because its existing implementation is already underway.
Its original finite contract remains intact: two sessions for user A, user B
sentinel, own-session list/revoke/logout, CSRF/cross-user denial, idempotency
and desktop/mobile rendered checks. Run:

```sh
cd backend && uv run pytest tests/test_account_sessions.py -q
cd frontend && npm run test:e2e -- e2e/accountSessions.spec.ts --project=chromium
make check
cd frontend && npm run test:e2e -- e2e/accountSessions.spec.ts
```

These are separate commands from the repository root unless the command
explicitly changes directory. Reconcile commit, focused/full results,
screenshots and GitHub status before another engineering transaction.

After #441 is terminal, apply dependencies, existing backlog order and
priority: #415 operator evidence and #419 verification can be handed off
without blocking independent #440/#442; #443 remains policy-blocked.
Then eligible #454/#455/#457/#459/#460 follow their existing order. The
agent chain is #461 → #462 → #463. #445 is the release container, never an
implementation selection. Do not restart closed predecessors to satisfy it.

## Memory and verification limits

[Agentic AI editing boundary](../.agents/memory/agentic-ai-editing-boundary.md)
records the durable reuse, trust and bounded-run rules.
Existing generated/artifact privacy and deployment memory remains relevant,
but old task status prose is historical. Pending work belongs in this
manifest and docs/tasks.md.

This distillation does not declare production readiness or completeness of
future arbitrary features. The required open contracts, enabled-provider
evidence and exact deployed release must finish before such a claim.

## Current criterion-ready contracts

The issue bodies below are a local snapshot of the active open contracts.
Planned test modules/routes are clearly marked as implementation deliverables.
GitHub remains the state authority; rerun open-issue enumeration before
starting a later transaction.


### #415 — Replit backend runtime: verify published ASGI routing and process lifecycle

## Goal
Replace Django's development server in the published runtime with a declared production WSGI or ASGI server while preserving local development behavior.

## Evidence and impact
The production launcher now selects a pinned Uvicorn ASGI server, while local development continues to use Django runserver. Startup configuration and child-liveness checks cover the launcher contract locally. Exact published-environment routing, SIGTERM, and process-cleanup proof remains outstanding.

## Entry point
scripts/start.sh; scripts/start-production.sh; .replit deployment command; backend process dependencies; startup configuration tests; health/readiness and signal handling.

## Acceptance criteria
- [x] A declared and pinned production WSGI or ASGI server is installed and launched only for production, with no autoreload or development-server warning.
- [ ] The server binds the expected backend port, serves health and API requests through the existing proxy, and starts Vite/frontend as currently configured in the published environment.
- [ ] SIGTERM/normal shutdown, child-process cleanup, startup failure propagation, and readiness behavior are proven in the published deployment process.
- [x] Local development continues to use the existing developer workflow and does not require production-only settings.
- [x] Deployment configuration and startup tests prove the production command does not contain manage.py runserver.

## Focused verification
cd backend && uv run pytest tests/test_startup_configuration.py; run the startup configuration and process-lifecycle checks against the production launcher; run manage.py check --deploy.

## Full verification
make check plus the disposable published-routing/browser readiness smoke in an approved deployment environment.

## Dependencies and next action
The production server choice is implemented as pinned Uvicorn ASGI. Operator/deployment verification is still required for the published process contract, routing, and signal lifecycle.

## Out of scope
Frontend Vite development/production mode, Django application behavior, database migration policy, autoscaling geography, and performance tuning beyond startup/concurrency correctness.

## Blocker classification
Deployment verification blocker: local implementation is complete, but the published process and signal contract has not been verified.

## Already covered
Frontend production serving and startup race fixes are already covered by #133/#139/#202; this issue is specifically the backend runtime server.

## Active closure contract — pieces readiness audit 2026-09-05

The following refinement is authoritative where it narrows earlier unchecked criteria; the earlier text remains scope history. No issue is closed or reopened in this audit.

This remains one deployed process workflow, independent of product parity. Preserve the existing checked local criteria.
Fixed precondition: operator-provisioned disposable Replit deployment using reviewed PR #417 merge SHA, production-like variables, separate PostgreSQL and the same launcher as production.
- [ ] Record launcher/process tree and bound port; verify /health/, /api/whoami/ and frontend proxy at the exact published asset.
- [ ] In the disposable deployment, SIGTERM exits parent and children; a failing backend prevents readiness and returns a nonzero launcher exit; restart leaves no orphan listener.
- [ ] Run `cd backend && uv run pytest tests/test_startup_configuration.py -q`, `make deploy-check`, `make check` and `PUBLISHED_APP_URL=<disposable-replit-origin> scripts/smoke-published.sh`; attach operator process/signal logs and published revision.
Owner: Replit operator; next action: deploy reviewed SHA to disposable Replit and capture process evidence. BLOCKED / verification-boundary. Overall release/route/schema inventory is #445, not this issue. Never send SIGTERM to shared production for this test.

Canonical manifest and backlog: docs/pieces-readiness-audit-2026-09-05.md and docs/tasks.md. Any remaining exact deployment/provider evidence is retained under #445 and must not be claimed from local checks.


## Current open-issue distillation — 2026-09-05

Current-open-only pass preserves this deployed-process contract. Local implementation and historical CI routing proof are prerequisites, not current Replit process evidence. Owner operator; next action identify reviewed current merge SHA and disposable Replit process/signals evidence. Do not reopen closed launcher foundations. Current release roll-up #445 owns revision/schema and route-artifact reconciliation. No new product behavior or deployment performed during this distillation.

Canonical current manifest: docs/open-issue-distillation-2026-09-05.md. Closed issue history is immutable; this pass modifies open records only.


### #419 — Full browser gate: classify current-revision failures and reconcile owning issues

## Goal
Make the complete disposable-stack Browser acceptance suite deterministic on the current application revision, without deleting or weakening acceptance coverage.

## Entry point
frontend/e2e/support/global-setup.ts; frontend/e2e/support/global-teardown.ts; frontend/e2e/; backend/scenes/management/commands/e2e_fixtures.py; backend/backend/database_cache.py; CI Browser acceptance job.

## Evidence
CI run #496 (commit 7c33f2f, canceled before terminal completion) reached at least 172 tests and logged repeated 30-second failures in public 3D embed/immersive/proportions, publishing/remix, responsive public gallery, and sound-engine scenarios. The PostgreSQL log also recorded duplicate-key violations for django_cache keys and unique_draft_scope. This is new evidence after closed #193 and does not reopen it.

## Fixed precondition
Use the CI disposable PostgreSQL service with AI_PROVIDER=fake, deterministic fixture users, a fresh database per run, and the declared Chromium/Firefox/WebKit Playwright projects.

## Acceptance criteria
- [ ] The full suite runs to a terminal result without fixture contamination, duplicate-key noise, or orphaned fixture state affecting later tests.
- [ ] Each reproduced timeout is classified as an implementation defect, test-fixture/harness defect, or environment boundary with a named owning spec and exact next action.
- [ ] Cache and draft setup paths are safe under the suite's concurrent requests and do not convert expected serialization into unhandled 5xx responses.
- [ ] Public 2D/3D, publishing/remix, responsive-gallery, and sound-engine scenarios each pass their existing assertions; no scenario is silently skipped.
- [ ] Focused reproductions, frontend quality checks, backend tests, and the complete Browser acceptance command pass in the supported CI environment.
- [ ] Any host-only browser/runtime failure is quarantined with exact browser, runner, dependency, and command evidence rather than treated as a product pass.

## Focused verification
Run the named failing specs from the CI log individually against a fresh disposable stack, then run the relevant backend cache/draft tests and the focused Playwright specs.

## Full verification
Run the complete Browser acceptance workflow from #418 and record the final test count, elapsed time, browser matrix, and artifacts.

## Out of scope
OAuth provider expansion, admin console, billing, PayPal, and unrelated closed-issue history.

## Dependency/order
Depends on the fast/full workflow separation issue created in this distillation pass; it is the next engineering issue only after that workflow change has CI evidence.

## Evidence boundary
Local targeted tests cannot close the full CI browser gate or prove parity at https://animate.creatrweb.com/.

## Refined smoke evidence — 2026-09-05

The owner-provided 43-test Chromium smoke run isolated a separate harness issue before the broader full-suite investigation: 15 editor/publishing/remix tests timed out because the shared E2E flow did not open the stage-local `Edit scene` popover before locating Add circle/publication controls. This is tracked in [#427](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/427); #419 remains responsible for the subsequent full-suite cache/draft/timeout reconciliation after #427 is resolved.

## Active closure contract — pieces readiness audit 2026-09-05

The following refinement is authoritative where it narrows earlier unchecked criteria; the earlier text remains scope history. No issue is closed or reopened in this audit.

This issue is a verification/reconciliation container, not authorization to batch-repair unrelated routes. Depends on #418, #427 and #444. Existing cache/draft duplicate-key log observations are unconfirmed product defects until fresh reproduction.
- [ ] Run `cd frontend && npm run test:e2e` on CI disposable PostgreSQL with AI_PROVIDER=fake and all configured browser projects; record SHA, counts/skips, traces and server logs.
- [ ] Group every failure by owning assertion and classify implementation-defect, workflow/infrastructure-defect or verification-boundary; reuse/create one bounded child per independent reproducible root cause before engineering.
- [ ] Specifically account for django_cache and unique_draft_scope duplicate-key entries, public 3D/embed/immersive/proportions, publishing/remix, responsive gallery and sound scenarios; no timeout-induced skip is a pass.
- [ ] Close only when required child failures are terminal and the complete current-revision matrix passes; manual hardware boundaries explicitly remain under #445.
Owner: CI/QA; next action: finish entry-point prerequisites, reproduce full matrix and distill its concrete failures. Full-suite failures are not silently converted into an environment-only pass.

Canonical manifest and backlog: docs/pieces-readiness-audit-2026-09-05.md and docs/tasks.md. Any remaining exact deployment/provider evidence is retained under #445 and must not be claimed from local checks.


## Fresh terminal CI evidence
Run [499](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/actions/runs/33954342751), head b4cde2e46deb2a9f1b1a24d27af0227389214b28: workflow/backend/frontend checks, disposable published-routing smoke, two-worker quota and isolated WebKit fullscreen passed. Chromium smoke failed: 14 failed, 15 passed, 14 did not run. Logs identify lifecycle hidden authoring/Save (#427), publishing/remix publication entry (#444), and responsive gallery fixture Publish (#450). Full matrix was skipped; diagnostics uploaded. These are distinct from unavailable physical Replit evidence. No new duplicate for these same failures.


## Current open-issue distillation — 2026-09-05

Current-open-only reconciliation supersedes the old run-499 queue. #418/#427/#444/#450 are now closed prerequisites; do not reopen or re-engineer them. Obtain a fresh full-browser run on the reviewed current SHA (checkout e989ce1 at audit), classify each actual failure and link existing #454 where it matches. Earlier 14-failure logs are historical, not proof of current failure. Exact command: `cd frontend && npm run test:e2e`; record browser projects, pass/fail/skip counts, artifacts and server logs. Owner CI/QA; next action inspect current run/evidence after active #441 transaction reconciles. This remains a reconciliation container, never a batch engineering task.

Canonical current manifest: docs/open-issue-distillation-2026-09-05.md. Closed issue history is immutable; this pass modifies open records only.


### #440 — Account billing: create and display a PayPal sandbox subscription

## Goal
Account billing: create and display a PayPal sandbox subscription.

## Entry point / fixed precondition
/account/billing (proposed)
Sandbox free user and one published USD monthly fixture plan, mock approval transport for local tests; separate provisioned sandbox transaction.
All browser UI evidence uses 1280x900 and 375x812, fresh contexts and disposable PostgreSQL. New routes/specs below are planned deliverables, not existing evidence.

## Evidence
#424 spans webhook processing plus checkout/admin/user UI; this child owns one customer subscription workflow.

## Acceptance criteria
- [ ] Display explicit plan price/currency/interval and confirmation; create checkout with idempotency key and ownership-bound return state.
- [ ] Return/cancel/refresh never grants access from query parameters; only server-verified subscription state changes effective plan through #424/#423.
- [ ] Display pending, active, past-due and cancelled status; safe retry creates no duplicate subscription and leaks no payloads/secrets.
- [ ] Run deterministic browser flow plus one operator-authorized PayPal sandbox approval/webhook roundtrip; no production charge is in scope.

## Focused and full verification
`cd backend && uv run pytest tests/test_billing_checkout.py -q` (add missing module as part of implementation).
`cd frontend && npm run test:e2e -- e2e/accountBilling.spec.ts --project=chromium` (add missing spec).
`make check`; then `cd frontend && npm run test:e2e -- e2e/accountBilling.spec.ts` against the supported disposable stack.

## Dependencies / out of scope
Dependencies: 423, 424. Related historical/parent issues: #424; never reopen closed history.
Other account/admin/provider/payment workflows and sibling piece surfaces stay in their separate contracts. No new dependencies without authorization. Product code changes are outside this distillation pass.

## Evidence and pending items
Status: PROPOSED; DEPENDENCY-BLOCKED.
Class: implementation-defect / missing intended extension.
Owner: next engineering/QA transaction.
Next action: resolve dependencies, reproduce fixture and implement only this workflow.
Evidence boundary: local/disposable runtime; credentials, hardware and exact published release are separately verified under the release manifest.
Backlog: docs/tasks.md; manifest: docs/pieces-readiness-audit-2026-09-05.md.


## Current open-issue distillation — 2026-09-05

Current dependencies #423/#424/#422 are closed and implemented; do not retain false dependency-blocked status or rebuild plan/webhook foundations. Local deterministic checkout/status work is eligible; real sandbox approval remains operator-bound. Use existing Subscription/BillingEvent and admin Plan mappings, and verify the current webhook ownership association with a server-issued checkout correlation identifier before accepting custom_id. No production merchant transaction. Next action implement only /account/billing against fixed mocks, then perform separately authorized sandbox verification. Exact commands remain the issue's focused/full contract.

Canonical current manifest: docs/open-issue-distillation-2026-09-05.md. Closed issue history is immutable; this pass modifies open records only.


### #441 — Account sessions: list and revoke owner sessions safely

## Goal
Account sessions: list and revoke owner sessions safely.

## Entry point / fixed precondition
/account/settings/sessions (proposed)
User A with current and second session; user B with separate session; fixed clock.
All browser UI evidence uses 1280x900 and 375x812, fresh contexts and disposable PostgreSQL. New routes/specs below are planned deliverables, not existing evidence.

## Evidence
#426 combines multiple independently testable account workflows; this child owns session revocation.

## Acceptance criteria
- [ ] List own sessions with current-session marker and safe last-active/device description; never expose raw cookies/tokens.
- [ ] Revoke another session and prove its next authenticated request fails while current and other user's sessions remain valid.
- [ ] Revoke current session/log out invalidates server session and returns to sign-in; repeat revoke is idempotent.
- [ ] CSRF/cross-user attempts fail; accessible confirmation/cancel/error states and desktop/mobile screenshots pass.

## Focused and full verification
`cd backend && uv run pytest tests/test_account_sessions.py -q` (add missing module as part of implementation).
`cd frontend && npm run test:e2e -- e2e/accountSessions.spec.ts --project=chromium` (add missing spec).
`make check`; then `cd frontend && npm run test:e2e -- e2e/accountSessions.spec.ts` against the supported disposable stack.

## Dependencies / out of scope
Dependencies: none. Related historical/parent issues: #426; never reopen closed history.
Other account/admin/provider/payment workflows and sibling piece surfaces stay in their separate contracts. No new dependencies without authorization. Product code changes are outside this distillation pass.

## Evidence and pending items
Status: PROPOSED; GROOMED.
Class: implementation-defect / missing intended extension.
Owner: next engineering/QA transaction.
Next action: resolve dependencies, reproduce fixture and implement only this workflow.
Evidence boundary: local/disposable runtime; credentials, hardware and exact published release are separately verified under the release manifest.
Backlog: docs/tasks.md; manifest: docs/pieces-readiness-audit-2026-09-05.md.


## Current open-issue distillation — 2026-09-05

Current code-state observation: account_sessions modules, migration 0034, React route/API/page and test files are already present as uncommitted work at e989ce1. Treat this issue as the active transaction; preserve those changes and reconcile their focused/full/browser QA before selecting another engineering issue. No implementation or QA result is inferred from file presence. Existing acceptance criteria remain authoritative. Owner current session-work engineer/QA; next action finish the existing transaction, not restart it.

Canonical current manifest: docs/open-issue-distillation-2026-09-05.md. Closed issue history is immutable; this pass modifies open records only.


### #442 — Account export: download an owner-scoped portable data archive

## Goal
Account export: download an owner-scoped portable data archive.

## Entry point / fixed precondition
/account/settings/export (proposed)
User A owns one 2D, one 3D and one generated piece with versions; user B sentinel data; encrypted provider credentials.
All browser UI evidence uses 1280x900 and 375x812, fresh contexts and disposable PostgreSQL. New routes/specs below are planned deliverables, not existing evidence.

## Evidence
#426 includes data export but has no finite export schema or route contract.

## Acceptance criteria
- [ ] Export schema includes profile, provider identifiers (no tokens), all owned creative documents/versions and entitlement/billing status references.
- [ ] Exclude decrypted/encrypted secrets, session tokens, raw payment payloads and other users' data; include schema version and manifest.
- [ ] Reauthentication/CSRF and owner authorization protect download; repeat requests are safe and large output has bounded processing with actionable failure.
- [ ] Extract actual downloaded archive, validate manifest and sentinel ownership/privacy; inspect request/progress/success/error UI at both viewports.

## Focused and full verification
`cd backend && uv run pytest tests/test_account_export.py -q` (add missing module as part of implementation).
`cd frontend && npm run test:e2e -- e2e/accountDataExport.spec.ts --project=chromium` (add missing spec).
`make check`; then `cd frontend && npm run test:e2e -- e2e/accountDataExport.spec.ts` against the supported disposable stack.

## Dependencies / out of scope
Dependencies: 420. Related historical/parent issues: #426; never reopen closed history.
Other account/admin/provider/payment workflows and sibling piece surfaces stay in their separate contracts. No new dependencies without authorization. Product code changes are outside this distillation pass.

## Evidence and pending items
Status: PROPOSED; DEPENDENCY-BLOCKED.
Class: implementation-defect / missing intended extension.
Owner: next engineering/QA transaction.
Next action: resolve dependencies, reproduce fixture and implement only this workflow.
Evidence boundary: local/disposable runtime; credentials, hardware and exact published release are separately verified under the release manifest.
Backlog: docs/tasks.md; manifest: docs/pieces-readiness-audit-2026-09-05.md.


## Current open-issue distillation — 2026-09-05

Current #420/#426 foundations are closed; implementation is eligible independently of optional LinkedIn #460. Reuse existing social account and entitlement/billing serializers with an explicit export allowlist. Profile/provider identifiers are included, provider tokens/keys and raw webhook/session values excluded. Fixed fixture covers Project, Project3D and ArtPiece plus immutable versions. Next action implement this one export workflow and validate the actual extracted archive, using the issue's named test commands.

Canonical current manifest: docs/open-issue-distillation-2026-09-05.md. Closed issue history is immutable; this pass modifies open records only.


### #443 — Account deletion: deactivate access and apply an explicit retention contract

## Goal
Account deletion: deactivate access and apply an explicit retention contract.

## Entry point / fixed precondition
/account/settings/delete (proposed)
User A with all three piece families, versions, identities, sessions, provider keys and billing reference; unaffected user B.
All browser UI evidence uses 1280x900 and 375x812, fresh contexts and disposable PostgreSQL. New routes/specs below are planned deliverables, not existing evidence.

## Evidence
#426 requires deletion but leaves retention and billing behavior undecided; this issue owns the bounded deletion workflow.

## Acceptance criteria
- [ ] Document the approved retention matrix before implementation: immediate access revocation, public unpublishing, credential erasure, creative-content deletion/retention and minimal audit/billing record treatment; leave BLOCKED if policy unresolved.
- [ ] Require reauthentication and explicit confirmation; cancel is non-mutating; deactivate all own sessions/identities atomically so retry cannot restore access.
- [ ] Handle active subscription using approved cancellation/retention policy; failures leave an explicit recoverable deletion state and no orphaned paid access.
- [ ] PostgreSQL rollback/retry/concurrency and cross-user tests pass; browser confirms inaccessible public/owner content and unaffected user B; no real account deletion during QA.

## Focused and full verification
`cd backend && uv run pytest tests/test_account_deletion.py -q` (add missing module as part of implementation).
`cd frontend && npm run test:e2e -- e2e/accountDeletion.spec.ts --project=chromium` (add missing spec).
`make check`; then `cd frontend && npm run test:e2e -- e2e/accountDeletion.spec.ts` against the supported disposable stack.

## Dependencies / out of scope
Dependencies: 420, 424. Related historical/parent issues: #426; never reopen closed history.
Other account/admin/provider/payment workflows and sibling piece surfaces stay in their separate contracts. No new dependencies without authorization. Product code changes are outside this distillation pass.

## Evidence and pending items
Status: PROPOSED; BLOCKED pending operator retention/billing policy.
Class: implementation-defect / missing intended extension.
Owner: operator plus next engineering/QA transaction.
Next action: record retention/cancellation decision before engineering.
Evidence boundary: local/disposable runtime; credentials, hardware and exact published release are separately verified under the release manifest.
Backlog: docs/tasks.md; manifest: docs/pieces-readiness-audit-2026-09-05.md.


## Current open-issue distillation — 2026-09-05

Current identity/billing foundations #420/#424/#426 are closed. Remaining blocker is the deletion retention/cancellation contract, not missing OAuth implementation. Owner/operator must record creative-content and billing/audit retention and active-subscription treatment before destructive behavior is engineered. Preserve the original issue's finite test/fixture contract and avoid blocking unrelated work. Next action record that policy; do not run against a real account.

Canonical current manifest: docs/open-issue-distillation-2026-09-05.md. Closed issue history is immutable; this pass modifies open records only.


### #445 — Release candidate: reconcile exact merged artifact, Replit schema and pieces evidence

## Goal
Reconcile one reviewed release candidate against current open issue contracts, exact Replit revision/schema and route/artifact evidence. This is a release-assessment container, never a combined engineering task.

## Current state — open-only distillation 2026-09-05
Checkout e989ce1e4a16e31d530c24727665107f32465d61 has progressed beyond the original cb98fb6 audit; uncommitted #441 session implementation is in progress. The previous child inventory and run-499 evidence are historical. Closed issues remain immutable and are not reopened or assigned new work.
PR #417 still reports open, merged=false, mergeable=false at b4cde2e; compare its actual diff with current main before choosing merge/close disposition. Do not blindly merge stale duplicate implementation or infer it is deployed.
No new live deployment/provider test is claimed during this distillation.

## Fixed boundary
One reviewed merge SHA/build digest and operator-provisioned Replit development/production identities; separate disposable PostgreSQL, explicit owner/public fixtures, 1280x900 and 375x812 rendered checks. Never mutate shared production fixtures to obtain a pass.

## Acceptance criteria
- [ ] Record current main/release SHA, relevant PR disposition, built asset digest, Replit workspace/published revision and served asset; explain all mismatches.
- [ ] Reconcile every current child below using its own finite criteria and evidence; terminal historical issues are context only, never reopened. Route/functionality failures remain in their named child.
- [ ] Record clean local make check and complete current CI browser gate #419 separately from #415 disposable Replit process/signals and production schema/env checks; no secret values in evidence.
- [ ] Confirm schema includes current migrations (including account-session/AI-run tables when delivered), required plan configuration and environment variable names; migrations remain outside Replit deployment build.
- [ ] Map supported manual/AI/generated/public/embed/immersive/download surfaces to fixtures and rendered/extracted artifacts for the reviewed revision. Missing fixture, hardware or provider account remains an explicit operator boundary, not a pass.
- [ ] Real non-production PayPal/LinkedIn/AI callbacks or explicitly disabled configuration have their own recorded outcome; fake providers do not establish external integration.
- [ ] Agentic workflow release evidence uses #461–#463, preserving bounded attempts, cancellation, selected-object scope, quota accounting and explicit Accept; no autonomous publication.
- [ ] Final release is BLOCKED while required children/environment criteria remain incomplete. Do not resurrect waived mobile physical-gesture work (#391 historical not-planned).

## Current open children
- [ ] #415 — Replit backend runtime: verify published ASGI routing and process lifecycle
- [ ] #419 — Full browser gate: classify current-revision failures and reconcile owning issues
- [ ] #440 — Account billing: create and display a PayPal sandbox subscription
- [ ] #441 — Account sessions: list and revoke owner sessions safely
- [ ] #442 — Account export: download an owner-scoped portable data archive
- [ ] #443 — Account deletion: deactivate access and apply an explicit retention contract
- [ ] #454 — artPieceCameraRuntime.spec.ts: granted-camera scenario doesn't reach 'active' on WebKit
- [ ] #455 — Generated regular viewer: full real hand-tracking (MediaPipe) for hand-steering
- [ ] #457 — Studio /art-pieces: 'ready' handshake stalls while the generated preview iframe is off-screen
- [ ] #459 — Full ZIP export's Steer button stays gated to Three.js/A-Frame for flat pieces
- [ ] #460 — Login /accounts/login/: add optional LinkedIn sign-in via OpenID Connect
- [ ] #461 — AI workflow service: run bounded plan–validate–revise proposals
- [ ] #462 — AI 2D editor /ai-projects/:id: create and edit layers through agent runs
- [ ] #463 — AI 3D editor /ai-projects3d/:id: create and edit scene objects through agent runs

## Exact verification
`make check`; `cd frontend && npm run test:e2e`; `make deploy-check` on reviewed non-production configuration; `PUBLISHED_APP_URL=https://animate.creatrweb.com scripts/smoke-published.sh` for credential-free production smoke. Store exact SHA/run/artifact and operator process IDs; no stale passing test counts.

## Evidence and pending items
Status: DEPENDENCY-BLOCKED / verification-boundary. Owner: release operator and QA. Next action: preserve/finish active #441 transaction, reconcile current PR #417 history and all current child evidence, then verify the exact release identity.
Canonical current manifest: docs/open-issue-distillation-2026-09-05.md; backlog docs/tasks.md.
Original parity audit: docs/pieces-readiness-audit-2026-09-05.md (historical); closed #274/#313/#319/#320/#324/#379 and successors retain their own scoped history.


### #454 — artPieceCameraRuntime.spec.ts: granted-camera scenario doesn't reach 'active' on WebKit

## Goal
Diagnose and fix (or reclassify with product-code evidence) why the granted-camera sub-scenario in `artPieceCameraRuntime.spec.ts` never reaches the 'active' state on the `webkit` Playwright project, while passing identically on `chromium` and `firefox`.

## Entry point
`frontend/e2e/artPieceCameraRuntime.spec.ts`, the `mockCamera(context, 'granted')` helper (a `canvas.captureStream()`-based fake `MediaStream`) and the test at line 70.

## Evidence
`npx playwright test e2e/artPieceCameraRuntime.spec.ts` (disposable PostgreSQL stack, 2026-09-05): 5/6 pass; the sole failure is `[webkit] ... camera starts from its own gesture, ...`, timing out waiting for the "Disable camera view" button (which only renders once the parent receives a `{status: 'camera', active: true}` acknowledgment from the sandbox).

Confirmed `canvas.captureStream` exists as a function in Playwright's bundled WebKit build (checked directly: `typeof HTMLCanvasElement.prototype.captureStream === 'function'`), so this is not a flat missing-API case. Root cause is not yet isolated -- candidates include a WebKit-specific `getUserMedia`/Permissions-Policy interaction with the sandboxed `srcDoc` iframe's `allow="microphone; camera"` attribute, or a timing/user-activation quirk between the button click and the async `getUserMedia().then()` resolution.

The product code itself (`artPieceSandbox.ts`'s `enable-camera` handler, `PieceStageControls.tsx`'s message handling) is unchanged between browsers -- it is standard `postMessage`/`getUserMedia` with no WebKit-specific branches, and passes identically on chromium/firefox with the exact same source.

## Acceptance criteria
- [ ] Reproduce in isolation (`--project=webkit` only, not the full multi-browser run) to rule out cross-test state leakage.
- [ ] Determine whether the sandboxed iframe's `getUserMedia` call ever resolves/rejects in WebKit for this fake stream (add temporary diagnostic logging via `page.on('console')`/`page.on('pageerror')` against a real page, not just this spec, then remove it).
- [ ] If it's the test's fake-stream construction (WebKit-specific `captureStream` behavior), fix `mockCamera` for WebKit without weakening chromium/firefox coverage.
- [ ] If it's a real product-code gap (e.g. a missing explicit `video.play()` call losing WebKit's user-activation window), fix `artPieceSandbox.ts`'s camera overlay setup.
- [ ] `npx playwright test e2e/artPieceCameraRuntime.spec.ts` passes on all three declared browser projects.

## Out of scope
#431's own already-verified chromium/firefox evidence; #430 (microphone, unaffected); any other artPieceCameraRuntime.spec.ts scenario (the disabled-capability scenario already passes on all three browsers).

## Dependency/order
Independent. Discovered while verifying #431.

## Evidence boundary
Local disposable-stack reproduction only.

## Current open-issue distillation — 2026-09-05

Closure contract refinement: entry /art-pieces/p/:id with the existing deterministic camera fixture; 1280x900 and 375x812. Run `cd frontend && npm run test:e2e -- e2e/artPieceCameraRuntime.spec.ts --project=webkit`, then all projects for this spec and `make check`. Record whether getUserMedia resolves, video becomes playable and the camera acknowledgment is emitted; require actual visible synthetic-frame composition. If fake stream setup is broken, fix the harness; if runtime lifecycle is broken, fix it here. Unsupported host alone is a classified boundary, never a pass. Owner browser/runtime engineer; independent next action isolate WebKit. No need to reopen #431.

Canonical current manifest: docs/open-issue-distillation-2026-09-05.md. Closed issue history is immutable; this pass modifies open records only.


### #455 — Generated regular viewer: full real hand-tracking (MediaPipe) for hand-steering

## Goal
Replace #432's scoped, synthetic-signal-driven hand-steering with real camera-based hand-landmark detection (MediaPipe), matching the fidelity #432's own acceptance criteria literally describe: "requires an actual spatial camera adapter for Three.js/A-Frame."

## Background
#432 implemented the real, testable *lifecycle* half of hand-steering: activation gating (camera-required, engine-required, camera-registration-required), exclusive ownership of exactly one registered camera adapter, bounded pose changes via a documented `steer-signal` command, and Reset -- all driven through `window.__registerArtPieceCamera({ getPose, setPose, reset })`, a hook a Three.js/A-Frame snippet calls to opt in. This was scoped down (repository owner decision, 2026-09-05) from full real hand-tracking because it requires two substantially larger pieces of work described below, and the owner asked that scoping be documented here as an explicit follow-up rather than silently left incomplete.

## What full real hand-tracking additionally requires

1. **Backend system-prompt change**: `backend/ai_provider/art_piece_provider.py`'s Three.js/A-Frame system prompts must instruct the model to call `window.__registerArtPieceCamera(...)` (or an equivalent convention) so *newly generated* pieces actually opt into steering. Today no generated snippet calls this hook -- #432's mechanism only activates for a piece that adopts the convention (e.g. a hand-authored E2E fixture). This is a prompt-engineering change with its own regression risk across all Three.js/A-Frame generations, not just steering ones.
2. **Real vision-model integration inside the sandbox**: the main app already has a full MediaPipe hand-tracking stack (`frontend/src/tracking/`, `mediapipeProvider.ts`, using `@mediapipe/tasks-vision` pinned at `MEDIAPIPE_TASKS_VISION_VERSION`, WASM assets from `MEDIAPIPE_WASM_BASE_URL`), but it's loaded via a bundled npm dynamic `import()` -- not usable as-is inside `artPieceSandbox.ts`'s `srcDoc`-isolated, CSP-locked iframe. The sandbox would need its own CDN-script-loaded copy (mirroring the existing Three.js/A-Frame `LIBRARY_CDN` pattern), CSP `script-src`/`connect-src` widened for that CDN and the WASM fetch, real camera-frame-driven `HandLandmarker` inference, and gesture classification (open palm / pinch / closed fist / etc., matching `frontend/src/tracking/handSignals.ts`'s existing taxonomy) mapped to `steer-signal` calls -- replacing the synthetic caller, not the lifecycle underneath it.

## Acceptance criteria
- [ ] Three.js/A-Frame system prompt updated so generated pieces register a real scene camera via the existing `window.__registerArtPieceCamera` hook.
- [ ] `@mediapipe/tasks-vision` (or an equivalent) loaded via a pinned CDN script inside the sandbox, with CSP updated narrowly for that origin plus WASM fetch, mirroring the existing `LIBRARY_CDN`/`buildCsp` allowlist pattern.
- [ ] Real hand-landmark detection drives `steer-signal` with actual gesture-derived deltas (Look/Move/Orbit/Zoom), not a test-injected payload.
- [ ] "Model preparation status" (loading/ready/failed) is a real reflection of the vision model's load state, shown in the existing "Hand gesture guide" dialog or a new status element.
- [ ] Denied camera permission and model load failure both report actionable, distinct states (already true for camera denial via #431/#432; model load failure is new).
- [ ] `frontend/e2e/artPieceSteeringRuntime.spec.ts` (or a renamed/extended version) verifies the real pipeline against a disposable stack, retaining #432's synthetic-signal test coverage as a fallback/unit-level check of the lifecycle itself.

## Out of scope
Re-litigating #432's lifecycle/ownership/reset contract, which is already implemented and closed; other generated-piece engines (Canvas2D/SVG remain "unsupported-engine" for steering, unchanged).

## Dependency/order
Depends on #432 (closed, provides the registration hook and lifecycle this issue replaces the signal source for).

## Evidence boundary
Local/disposable-stack verification only; real hardware and the exact Replit published revision remain separate operator verification per this backlog's existing convention (see #445).

## Current open-issue distillation — 2026-09-05

Efficient current scope: one regular generated-piece camera-frame → landmark → steering pipeline at /art-pieces/p/:id. Preserve closed #432 ownership and closed #449 flat shell. Reuse the project's pinned vision assets and signal/gesture definitions; choose a trusted bundled runtime/asset path compatible with the sandbox rather than mandating a second CDN-only implementation or broad CSP relaxation. Do not grant generated source same-origin privileges.
Fixed fixtures: generated Three.js cube and A-Frame box with real camera registration, fake provider source and deterministic video/landmark replay; permission/model-denied siblings. Verify prompt contract includes registration and that an unmodified generated fixture reaches the adapter. Verify actual vision-pipeline preparation and bounded Look/Move/Orbit/Zoom, release/hand loss and model/permission error states; synthetic steer-signal injection alone cannot pass. Commands: `cd backend && uv run pytest tests/test_art_piece_provider.py -q` (confirm/add focused prompt module during engineering); `cd frontend && npm run test:e2e -- e2e/artPieceSteeringRuntime.spec.ts`; `make check`. Inspect 1280x900/375x812 screenshots. Other route/export consumers stay out of this local regular-surface contract; #445 records the exact evidence boundary. Owner runtime engineer; next action integrate the existing vision pipeline, not redesign steering.

Canonical current manifest: docs/open-issue-distillation-2026-09-05.md. Closed issue history is immutable; this pass modifies open records only.


### #457 — Studio /art-pieces: 'ready' handshake stalls while the generated preview iframe is off-screen

## Goal
Make the Studio's ready-detection for a newly generated piece resilient to the preview iframe being scrolled out of view, instead of depending on Chromium's `requestAnimationFrame` scheduling for a cross-origin iframe.

## Entry point and fixed fixture
`/art-pieces` (authenticated owner), `frontend/src/pages/ArtPieceStudio.tsx`; the sandbox's own ready signal in `frontend/src/generative/artPieceSandbox.ts`'s `buildListenerScript`.

## Evidence
Discovered 2026-09-05 while implementing #428's real generate -> configure -> save E2E coverage. `buildListenerScript`'s `window.addEventListener('load', ...)` handler defers `report('ready', '')` behind two nested `requestAnimationFrame` calls (to let the snippet's own first paint happen and let a same-frame synchronous throw be caught first). Confirmed via a debug harness that in a headless Chromium `srcdoc` sandboxed iframe positioned below the viewport fold (a very plausible layout on `/art-pieces`, since the Library/prompt/model/Generate form and the title/description fields all render above the iframe), the first `requestAnimationFrame` callback fires but the *second* nested one never fires, even after 6+ seconds -- while a plain `setInterval` in the same frame keeps ticking normally. Calling `iframe.scrollIntoViewIfNeeded()` immediately unblocks it and the `ready` message posts right away. This matches Chromium's documented behavior of throttling `requestAnimationFrame` for cross-origin iframes that are not intersecting the viewport.

`ArtPieceStudio.tsx` is the only surface that gates UI (the Save/Download buttons) on this `ready` message; `PublicArtPieceViewer.tsx`, `ImmersiveArtPieceViewer.tsx`, and every other viewer render their toolbar immediately regardless of readiness, so they're unaffected. No existing E2E spec drove the real Studio generate flow before #428, so this had no test coverage in either direction.

## Acceptance criteria
- [ ] The Studio's Save/Download availability does not depend on the generated preview iframe being within the browser viewport.
- [ ] Reproduce with `frontend/e2e/artPieceCapabilities.spec.ts` (added for #428) with the `scrollIntoViewIfNeeded()` workaround removed from its `generate()` helper -- it should still reach the `ready` phase promptly.
- [ ] No change to the deliberate two-frame same-frame-throw-catching behavior for a real generated piece that does throw synchronously.

## Out of scope
Any other viewer/embed surface (none of them gate on this message). The underlying sandbox postMessage protocol and command handlers are unaffected.

## Dependencies and order
Independent. Discovered while implementing #428; #428 itself works around this with a realistic `scrollIntoViewIfNeeded()` call (mirroring what a real user does to look at their own generated piece) rather than depending on this fix.

## Evidence boundary
Local disposable-stack reproduction only, headless Chromium. Not yet confirmed whether other engines (WebKit/Firefox) throttle identically.

## Current open-issue distillation — 2026-09-05

Finite verification: use fixed fake Canvas2D fixture with preview below the fold at 375x812 and above fold at 1280x900; require ready/Save/Download within 5 seconds in both cases without scrolling. Add throwing-source fixture: synchronous/first-render error produces error and unavailable save rather than false ready. Retain the deliberate visible-frame error observation while adding a bounded offscreen readiness strategy; never simply suppress runtime errors. `cd frontend && npm run test:e2e -- e2e/artPieceCapabilities.spec.ts`; focused artPieceSandbox tests; `make check`. Current generated save/capability workflow #428 remains closed; owner frontend engineer, next action remove the helper workaround only with replacement regression evidence.

Canonical current manifest: docs/open-issue-distillation-2026-09-05.md. Closed issue history is immutable; this pass modifies open records only.


### #459 — Full ZIP export's Steer button stays gated to Three.js/A-Frame for flat pieces

## Goal
Make the downloadable Full ZIP export's Steer button consistent with the live preview for a Canvas2D/SVG piece with hand_steering enabled (#449).

## Entry point and fixed fixture
\`frontend/src/export/standaloneArtPieceRuntimeSource.ts\`'s \`includeSteering\` flag; \`frontend/src/generative/artPieceBundle.ts\`'s \`buildExportControls\`. A published Canvas2D piece with \`hand_steering: true\` and \`camera_view: true\`, downloaded as a Full ZIP.

## Evidence
Discovered 2026-09-05 while implementing #449 (live-viewer reversible spatial steering for flat Canvas2D/SVG pieces via a lazily-built CSS 3D shell in \`artPieceSandbox.ts\`). \`artPieceCapabilities.ts\`'s \`sanitizeCapabilities\`/\`CAPABILITY_OPTIONS\` no longer treat \`hand_steering\` as spatial-only, so a flat piece can now persist \`hand_steering: true\` -- but \`standaloneArtPieceRuntimeSource.ts\`'s own \`includeSteering\` still requires \`SPATIAL_LIBRARIES.includes(library)\`, so the exported Full ZIP's Steer button never renders for that same piece, even though the live preview's Steer button now works for it. #449's own acceptance criteria and verification section are scoped to the live regular viewer (\`/art-pieces/p/:id\`) only and never mention the ZIP export, so this was filed as a follow-up rather than absorbed into that issue.

## Acceptance criteria
- [ ] A Canvas2D/SVG piece with \`hand_steering: true\` shows a functional Steer button in its downloaded Full ZIP, using the same lazy CSS-3D-shell approach \`artPieceSandbox.ts\` implements for the live preview (ported the same hand-synced way #436/#448 already port other runtime behavior into \`standaloneArtPieceRuntimeSource.ts\`).
- [ ] No change to Three.js/A-Frame's own native-camera steering path in the export.
- [ ] The Non-Camera ZIP variant keeps excluding the Steer/camera UI for flat pieces exactly as it already does for spatial ones.

## Verification
Extend or add a focused browser spec extracting a real Full ZIP from a flat-engine, hand_steering-enabled piece and driving real steer-signal-equivalent interaction against it, matching #436/#449's own real-execution (not string-match) evidence standard.

## Dependencies and out of scope
Depends on #449 (closed) for the live-preview shell logic to port. Does not touch the live sandbox runtime itself.

## Evidence boundary
Local disposable-stack reproduction/verification only.

## Current open-issue distillation — 2026-09-05

Fix escaped-backtick prose as needed during engineering; the exact artifact contract is regular Full ZIP index.html from a Canvas2D red rectangle and SVG blue circle, both camera_view/hand_steering true. Prerequisite #449 is closed; reuse its shell logic without editing that closed contract. Verify enable → move → disable/freeze → Reset/home and animation continuity after extraction, camera permission only on activation, and Three.js/A-Frame regression plus Non-Camera exclusion. Add `frontend/e2e/artPieceFlatZip.spec.ts`; run `cd frontend && npm run test:e2e -- e2e/artPieceFlatZip.spec.ts` and `make check`. Inspect 1280x900/375x812 actual artifact screenshots; string tests alone cannot close it. Physical model integration is #455 and must not be claimed from injected signals. Owner export-runtime engineer; next action port only missing flat shell/control gate.

Canonical current manifest: docs/open-issue-distillation-2026-09-05.md. Closed issue history is immutable; this pass modifies open records only.


### #460 — Login /accounts/login/: add optional LinkedIn sign-in via OpenID Connect

## Goal

Add LinkedIn as a third, environment-gated OAuth provider using LinkedIn's
current "Sign In with LinkedIn using OpenID Connect" product, following the
exact same optional-provider pattern #420 established for GitHub. Extends
the provider registry decided feasible in #425.

## Background

Decided in [#425](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/425)
(2026-09-05 review of LinkedIn's official documentation, reviewed at
https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2,
last updated 2024-08-08 per that page's own metadata):

- LinkedIn's currently-supported sign-in product is OpenID Connect
  (`openid profile email` scopes), **not** the older `r_liteprofile`/
  `r_emailaddress` OAuth 2.0 product that django-allauth's bundled
  `linkedin_oauth2` provider targets. That bundled provider is stale and
  must **not** be used — implement this against LinkedIn's OIDC discovery
  document (`https://www.linkedin.com/oauth/.well-known/openid-configuration`)
  instead, most likely via allauth's generic `allauth.socialaccount.providers.openid_connect`
  provider (server-based, no code changes needed to allauth itself).
- Discovery document confirms: `authorization_endpoint`
  `https://www.linkedin.com/oauth/v2/authorization`, `token_endpoint`
  `https://www.linkedin.com/oauth/v2/accessToken`, `userinfo_endpoint`
  `https://api.linkedin.com/v2/userinfo`, `jwks_uri`
  `https://www.linkedin.com/oauth/openid/jwks`, `subject_types_supported`:
  `pairwise` (stable per-app `sub`, suitable for account linking).
- **Important caveat, confirmed from LinkedIn's own documented response
  schema**: the `email` and `email_verified` userinfo claims are
  documented as **optional and may be absent** ("Ensure your application
  can handle cases where these fields are absent"). Our #420/#426
  identity-linking policy is email-based, so a LinkedIn login that omits
  `email` must fail closed with an actionable message (mirroring how
  Google's `EMAIL_REQUIRED`/no-email case is already handled), not crash
  or silently create an unlinkable account.
- PKCE is not documented as required by LinkedIn's OAuth 2.0 endpoint
  (unlike Google/GitHub's PKCE usage in this repo); confirm whether
  allauth's `openid_connect` provider can still enable it client-side
  as defense in depth, and document the finding either way.

## Entry point

`backend/backend/settings.py` (provider registry, alongside
`GITHUB_OAUTH_*`/`GITHUB_OAUTH_ENABLED`), `backend/backend/oauth_gates.py`
(gate pattern), `backend/backend/social_account_adapter.py`
(`LinkedProvidersSocialAccountAdapter.pre_social_login`, already handles
conflicting-identity fail-closed generically), `backend/templates/account/login.html`
(already provider-registry-driven via `{% get_providers %}`, needs no
changes), `backend/tests/test_github_oauth.py` (pattern to mirror as
`test_linkedin_oauth.py`).

## Fixed precondition

A disposable PostgreSQL database, no real LinkedIn OAuth app credentials
committed, deterministic mocked-adapter fixtures for the callback flow
(same technique `test_github_oauth.py`/`test_google_oauth.py` use:
monkeypatch the two points that talk to the provider over HTTP).

## Acceptance criteria

- [ ] `LINKEDIN_OAUTH_CLIENT_ID`/`LINKEDIN_OAUTH_CLIENT_SECRET` are
      optional; setting only one is a startup configuration error naming
      both variables (mirrors GitHub's `#420` validation exactly).
- [ ] Both unset keeps LinkedIn disabled by default; the login page shows
      only the already-enabled providers, unaffected.
- [ ] LinkedIn is implemented against the OIDC product (`openid profile
      email` scopes, discovery-document-derived endpoints), not the
      deprecated bundled `linkedin_oauth2` provider.
- [ ] A LinkedIn login whose userinfo response omits `email`/`email_verified`
      fails closed with an actionable message, not a crash or an
      unlinkable/duplicate account.
- [ ] A LinkedIn identity whose verified email matches an existing user
      fails closed (409, no silent merge) via the same
      `LinkedProvidersSocialAccountAdapter.pre_social_login` used for
      GitHub — no LinkedIn-specific carve-out.
- [ ] Focused backend callback/security tests (disabled-404, enabled
      login/callback, missing-email, conflicting-identity) pass; the full
      backend suite and `authPolicy.spec.ts` remain green.
- [ ] `.env.example` documents the two optional variables with the exact
      LinkedIn Developer Portal product name to request ("Sign In with
      LinkedIn using OpenID Connect") and the callback URL to register.

## Full verification

`make check` plus the auth browser suite in CI; real LinkedIn OAuth app
credential/callback verification against a live LinkedIn account is a
separately recorded deployment boundary (tracked under #445, mirroring
Google's #75 and GitHub's #420 precedent) — never claimed from local
override_settings-driven tests.

## Dependencies

Depends on #420's provider registry, gate pattern, and identity-linking
adapter (all reused as-is, no new abstraction). Decision recorded in #425.

## Out of scope

Bluesky/AT Protocol (explicitly decided not-supported-at-this-time in
#425 — architectural mismatch, see that issue's closing comment).
Password signup, MFA, billing, entitlements, admin authorization,
explicit account linking (#426), production credentials.

## Current open-issue distillation — 2026-09-05

Current optional-provider decision #425 and Google/GitHub identity flow #420/#426 are closed. Implement this provider only. For explicit linking by an already authenticated user, reuse #426's ownership-aware connect behavior: matching their own verified identity is not a different-user conflict, but another account's identity must fail closed. Add `backend/tests/test_linkedin_oauth.py`; run `cd backend && uv run pytest tests/test_linkedin_oauth.py tests/test_google_oauth.py tests/test_github_oauth.py tests/test_account_identities.py -q`; `cd frontend && npm run test:e2e -- e2e/authPolicy.spec.ts`; `make check`. Fixed absent/configured/partial-config/missing-email/unverified-email/conflicting-sub fixtures; inspect configured and disabled login at 1280x900/375x812. Current provider claims must be verified against official documentation during implementation; do not treat an old documentation date as live credential proof. Owner auth engineer; next action implement existing generic OIDC pattern with conditional exposure.

Canonical current manifest: docs/open-issue-distillation-2026-09-05.md. Closed issue history is immutable; this pass modifies open records only.


### #461 — AI workflow service: run bounded plan–validate–revise proposals

## Goal
AI workflow service: run bounded plan–validate–revise proposals.

## Current-code rationale
At e989ce1, ai_api.py/ai_api3d.py and useAIProposal/useAIProposal3D provide one-shot create/edit, bounded retry and explicit idempotent Accept. Provider registry, encrypted keys, validators, patch scope, quotas and entitlement services already exist. Missing capability is a persistent bounded plan/validation/revision workflow; reuse existing foundations, do not reopen their closed issues.

## Entry / fixed fixture
Proposed owner-only /api/ai/runs/ start/detail/advance/cancel workflow
One owner, another user, a fixed 2D scene with locked background plus editable foreground, and a 3D cube/light scene. Fake providers return: valid candidate; invalid candidate then repair; repeated invalid output; timeout; out-of-scope patch; duplicate advance; stale base.
Use AI_PROVIDER=fake and disposable PostgreSQL; no live credentials or production data are needed for deterministic checks.

## Acceptance criteria
- [ ] Persist an owner-scoped run bound to project family, base version, input scene digest, selected object/layer IDs, provider/model/persona and idempotency key. Finite states: running, awaiting-review, accepted, cancelled, failed, expired; reload/status reads never trigger another model call.
- [ ] Implement a server-controlled loop with allowlisted operations read_scene, propose_create, propose_patch and validate_candidate. Feed validation errors back for revision; no shell, arbitrary Python/JavaScript, external browsing, publication, credential or billing tools. Treat prompts/source/tool output as data, never tool authorization.
- [ ] Defaults: at most 3 provider attempts, 2 repair attempts, 120 seconds total and one active advance lease per run; configure lower/upper limits server-side. Enforce the shared entitlement and rate-limit services per attempt and one successful proposal charge per run. Return actual usage when supplied by provider; do not fabricate token counts or monetary cost.
- [ ] Reuse existing provider request/response adapters, schema/patch validators and accept transaction; no native provider tool-calling requirement or new agent framework/queue dependency. Short owner-authorized advance requests persist checkpoints in PostgreSQL; never keep a DB transaction open during a provider call.
- [ ] Preview intermediate candidates without mutating persisted scene/draft. Accept revalidates owner, base version and input digest and creates exactly one version; reject/cancel/timeout do not write creative state. A late in-flight response after cancellation cannot resume or accept; cancellation prevents further calls, while already-sent calls may still incur provider cost.
- [ ] Selected-object edits enforce target IDs/lock state on the server; whole-scene scope must be explicit. Invalid output cannot escape scope through repair. Duplicate starts/advances/accepts and competing workers do not double-charge or create duplicate versions; stale base requires a fresh run.
- [ ] Return concise plan, step outcomes, validation summaries and final change summary—no hidden chain-of-thought, credentials, private other-user data or raw provider secrets. Gate status/cancel endpoints by owner and expire old run data with documented retention.

## Exact verification
Add test_ai_runs.py as implementation deliverables.
`cd backend && uv run pytest tests/test_ai_runs.py -q` with disposable POSTGRES_TEST_DATABASE_URL for concurrency cases.
Service tests exercise each 2D/3D fake-provider contract, cancellation and concurrent advance/accept; route screenshots belong to the consumer children.
`make check`; release full-browser gate remains #419.

## Dependencies / exclusions
Dependencies: none. Existing provider/accept/entitlement foundations are reused as closed historical prerequisites, not reopened. New payment checkout, LinkedIn and real hand tracking are not prerequisites.
MVP excludes raw generated-code ArtPiece agent execution, manual-editor UI, autonomous publishing/deletion, arbitrary network/code tools, indefinite background agents, multi-agent orchestration, new SDK/framework/queue dependencies and hidden reasoning traces. Raw generated-piece lifecycle remains its existing separate domain; no promise to agent-enable it in this MVP.

## Evidence and pending items
PROPOSED / GROOMED; missing intended feature explicitly requested by owner. Owner: next AI engineering/QA transaction. Next action: implement bounded service and fake-provider state-machine tests.
Evidence boundary: deterministic local/CI only; opt-in live-provider smoke and Replit revision/configuration remain #445, never inferred from fake runs.
Backlog docs/tasks.md; current manifest docs/open-issue-distillation-2026-09-05.md.


### #462 — AI 2D editor /ai-projects/:id: create and edit layers through agent runs

## Goal
AI 2D editor /ai-projects/:id: create and edit layers through agent runs.

## Current-code rationale
At e989ce1, ai_api.py/ai_api3d.py and useAIProposal/useAIProposal3D provide one-shot create/edit, bounded retry and explicit idempotent Accept. Provider registry, encrypted keys, validators, patch scope, quotas and entitlement services already exist. Missing capability is a persistent bounded plan/validation/revision workflow; reuse existing foundations, do not reopen their closed issues.

## Entry / fixed fixture
/ai-projects/:id
Blank project for create; saved 2D scene with locked background, editable foreground rectangle and supported draw.io layer. Fake three-attempt run with one invalid candidate then a repaired result; second browser edits the base version.
Use AI_PROVIDER=fake and disposable PostgreSQL; no live credentials or production data are needed for deterministic checks.

## Acceptance criteria
- [ ] Offer an Agent workflow action alongside the current one-shot flow; preserve vendor/model/persona settings. User selects Create piece, Edit selected layer/object, or Edit whole scene. Resolve selection to stable IDs rather than trusting text mentions.
- [ ] Show concise proposed steps, current attempt/limit, validation repair status and a Stop action; show intermediate preview without changing saved scene. No fake progress or private reasoning trace.
- [ ] Creating a scene and editing foreground produce validated candidates; locked background/unselected objects stay byte-equivalent for selected edits. Existing draw.io documents remain versioned; unsupported draw.io object mutation is explicitly unavailable rather than flattened or silently altered.
- [ ] Before Accept show final change summary and comparison; Accept commits exactly once using existing proposal/version semantics. Reject/Stop keeps previous scene; browser reload reconnects to the run without spending another attempt; stale base gives explicit retry/rebase choice that starts a new scoped run.
- [ ] Keyboard/mobile workflow remains usable at 1280x900 and 375x812 with inspected rendered screenshots; permission/quota/provider/validation failures are actionable; existing one-shot AI and draft-recovery tests pass.

## Exact verification
Add test_ai_runs.py and frontend/e2e/aiAgent2d.spec.ts as implementation deliverables.
`cd backend && uv run pytest tests/test_ai_runs.py -q` with disposable POSTGRES_TEST_DATABASE_URL for concurrency cases.
`cd frontend && npm run test:e2e -- e2e/aiAgent2d.spec.ts --project=chromium`; repeat this spec across all configured browsers.
`make check`; release full-browser gate remains #419.

## Dependencies / exclusions
Dependencies: #461. Existing provider/accept/entitlement foundations are reused as closed historical prerequisites, not reopened. New payment checkout, LinkedIn and real hand tracking are not prerequisites.
MVP excludes raw generated-code ArtPiece agent execution, manual-editor UI, autonomous publishing/deletion, arbitrary network/code tools, indefinite background agents, multi-agent orchestration, new SDK/framework/queue dependencies and hidden reasoning traces. Raw generated-piece lifecycle remains its existing separate domain; no promise to agent-enable it in this MVP.

## Evidence and pending items
PROPOSED / DEPENDENCY-BLOCKED; missing intended feature explicitly requested by owner. Owner: next AI engineering/QA transaction. Next action: integrate this route after prerequisites reconcile.
Evidence boundary: deterministic local/CI only; opt-in live-provider smoke and Replit revision/configuration remain #445, never inferred from fake runs.
Backlog docs/tasks.md; current manifest docs/open-issue-distillation-2026-09-05.md.


### #463 — AI 3D editor /ai-projects3d/:id: create and edit scene objects through agent runs

## Goal
AI 3D editor /ai-projects3d/:id: create and edit scene objects through agent runs.

## Current-code rationale
At e989ce1, ai_api.py/ai_api3d.py and useAIProposal/useAIProposal3D provide one-shot create/edit, bounded retry and explicit idempotent Accept. Provider registry, encrypted keys, validators, patch scope, quotas and entitlement services already exist. Missing capability is a persistent bounded plan/validation/revision workflow; reuse existing foundations, do not reopen their closed issues.

## Entry / fixed fixture
/ai-projects3d/:id
Blank 3D project plus cube, sphere, camera and two lights with fixed IDs and camera pose. Select cube only; fake invalid material/geometry response then repair; concurrent owner update changes base version.
Use AI_PROVIDER=fake and disposable PostgreSQL; no live credentials or production data are needed for deterministic checks.

## Acceptance criteria
- [ ] Expose Agent workflow with Create piece, Edit selected object and Edit whole scene; reuse shared run service, vendor/model/persona and common progress/review components from 2D without a second orchestrator.
- [ ] Display candidate in actual 3D preview with bounded geometry/camera/material validation; cube-only edit preserves sphere/lights/camera. Whole-scene changes require explicit selected scope; no arbitrary generated scripts.
- [ ] Show concise plan/step outcome, validation repair, attempt cap and Stop; candidate and saved scene remain distinct. Accept creates exactly one current version; Reject/Stop and late results do not mutate the scene.
- [ ] Reload reconnects without a new request charge; concurrent saves produce a stale-base message and explicit new-run option. Preserve existing 3D one-shot proposal behavior and renderer/selection semantics.
- [ ] Inspect actual rendered cube change and fixed-viewport controls at 1280x900 and 375x812; cover create/edit/repair/cancel/reload/stale/quota/provider failure with deterministic fixtures. Do not infer this route passes from the 2D integration.

## Exact verification
Add test_ai_runs.py and frontend/e2e/aiAgent3d.spec.ts as implementation deliverables.
`cd backend && uv run pytest tests/test_ai_runs.py -q` with disposable POSTGRES_TEST_DATABASE_URL for concurrency cases.
`cd frontend && npm run test:e2e -- e2e/aiAgent3d.spec.ts --project=chromium`; repeat this spec across all configured browsers.
`make check`; release full-browser gate remains #419.

## Dependencies / exclusions
Dependencies: #461, #462. Existing provider/accept/entitlement foundations are reused as closed historical prerequisites, not reopened. New payment checkout, LinkedIn and real hand tracking are not prerequisites.
MVP excludes raw generated-code ArtPiece agent execution, manual-editor UI, autonomous publishing/deletion, arbitrary network/code tools, indefinite background agents, multi-agent orchestration, new SDK/framework/queue dependencies and hidden reasoning traces. Raw generated-piece lifecycle remains its existing separate domain; no promise to agent-enable it in this MVP.

## Evidence and pending items
PROPOSED / DEPENDENCY-BLOCKED; missing intended feature explicitly requested by owner. Owner: next AI engineering/QA transaction. Next action: integrate this route after prerequisites reconcile.
Evidence boundary: deterministic local/CI only; opt-in live-provider smoke and Replit revision/configuration remain #445, never inferred from fake runs.
Backlog docs/tasks.md; current manifest docs/open-issue-distillation-2026-09-05.md.
