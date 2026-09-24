# DECISIONS.md

## 2026-09-19 — Production importer must execute in the production runtime

- The authorized `import_reference_pieces --allow-production` workflow was
  exercised twice in Replit's interactive Shell and proved idempotent, but that
  Shell targets Development Database. The published app reads the separate
  Production Database, which still has only the pre-existing profile pieces.
- Keep the application-layer importer and its explicit production guard. Do not
  count a development-Shell run as production evidence or replace the workflow
  with direct SQL/UI inserts; the next execution must use a confirmed
  production-runtime/database context, followed by live API and browser checks.

## 2026-09-19 — Production fixture import remains a separately scoped workflow

- Replit Publish completed and the published smoke plus direct production table
  inspection passed for #622. The production owner represented by `@cfornesa`
  currently has zero pieces and collections.
- Keep `import_reference_pieces` DEBUG/disposable-only. Do not bypass its guard
  or write production rows through SQL. #633 owns the explicit opt-in,
  owner-resolving, idempotent production import workflow; #622 is
  dependency-blocked on that issue for authenticated surface evidence.

Append-only log of agent-relevant decisions. See `AGENTS.md` Section 10 for
ownership and read cadence.

## 2026-09-23 — Persisted camera placement uses the additive compatibility path

- The owner approved option 1 for camera placement: add the backward-compatible
  `ArtPieceVersion.camera_placement` field, validate and project it through the
  API, propagate it to viewers and exports, and use a reversible additive
  migration. `NULL` remains the legacy overlay behavior.
- Generated previews retain the opaque-origin `allow-scripts` sandbox; the
  PHP reference's `allow-same-origin` behavior is not copied where it would
  grant generated source app credentials. Camera and hand tracking stay in the
  trusted parent runtime with an allowlisted message bridge.

## 2026-09-21 — #671 refinement-provider prerequisite is a distinct follow-up

- Fresh task distillation of the corrected #684 route contract and the live
  open issues found that #671's named six-engine manual-plus-AI matrix cannot
  honestly run its AI half: `AI_PROVIDER=fake` covers structured scene APIs but
  not generated art-piece refinement.
- Created and linked #698 for that provider-selection/browser-evidence gap.
  Keep #671 evidence-only and do not absorb provider implementation into it.
- Direct Codex/GPT-5 implementation is an owner-authorized substitution for
  unavailable rostered external services; stage provenance must be recorded
  on #698 and in the task ledger.

## 2026-09-21 — #671 evidence matrix passes against corrected #684 contract

- After #698 closed, the named `editOutputConsistency.spec.ts` evidence matrix
  was added without changing product code. It verified manual and fake-provider
  AI edits through regular, immersive, and extracted ZIP outputs for every
  required engine, plus the current C2.js Interactive engine.
- Docker Chromium passed the matrix and the full `make check` gate passed.
  Representative screenshots were inspected with no output defect discovered;
  #671 was therefore QA-passed and closed. Commit: `48abed7`.
- #640 remains the only open issue in this batch and is an owner-controlled
  publication boundary; no Replit state was mutated.

## 2026-09-21 — production-readiness remains open at publication boundary

- Production-readiness/session-completion ran as an owner-authorized
  Codex/GPT-5 substitution because the rostered readiness service was
  unavailable. `make check`, Compose preflight, and published credential-free
  smoke passed; deploy-check passed with five environment warnings.
- The local authenticated smoke was not counted because host-side fixture
  creation targeted the host `.env` database while the URL reached the Docker
  backend, producing a mismatched 401 boundary. No product defect was inferred.
- #640 remains open: the published asset/revision still needs owner-approved
  publication, exact live regular/immersive/profile/collection/embed route
  inspection, and post-publish smoke/revision evidence. No Replit mutation was
  initiated.

## 2026-09-21 — Replit republish entered an active infrastructure boundary

- The verified local `main` was fast-forward-pushed to GitHub at `c6ce160`.
  Replit's clean workspace was reconciled from its old checkpoint-diverged
  branch to `origin/main`, preserving `gitsafe-backup/main` before the reset.
- The owner-authorized Republish created revision `6dc01ac6` and passed its
  visible security checks, but remained in Bundle at `Pushing nix-0 layer...`
  for roughly ten minutes. Public domains still served `index-BQvbObdP.js`
  and the legacy `/immersive/p3d/...` link, so #640 cannot close yet.
- This is the existing #640 workflow/infrastructure boundary; no duplicate was
  created and no second publish was started while the active operation remained
  live.

## 2026-09-21 — final #640 promotion and #699 regression follow-up

- The owner-authorized publication eventually promoted the verified bundle after
  the temporary Bundle delay. Replit was aligned to `b737e5d` with the prior
  checkpoint preserved as `backup-before-699-import`; public asset
  `index-DVp0GEG1.js` and the canonical regular/immersive/profile routes were
  then verified in Chrome.
- Live QA exposed the remaining underlined immersive anchor, so closed #637 was
  not reopened. Criterion-ready #699 owns the regression. Its canonical inline
  viewer action is now a styled semantic button with keyboard/new-tab coverage;
  legacy menu-mode link behavior remains compatible.

## 2026-09-19 — QA reconciliation of residual browser families

- #625 stage geometry and #628 admin/settings contracts were closed after
  terminal full-matrix run `35432568533` showed no failures in either family.
  The remaining five failures were kept in their scoped follow-ups (#624,
  #627, and #630) rather than reopening or broadening the closed issues.
- Ordinary push CI remains one browser shard for bounded feedback; scheduled
  and manual runs retain the complete three-shard browser matrix.

## 2026-09-19 — full-browser residual contract repairs

- Keep `/gallery?type=all` as the canonical public landing destination for
  anonymous/protected redirects; update stale browser expectations instead of
  regressing the public shell route.
- Preserve account-settings progressive disclosure. Browser scenarios now
  explicitly expand the section whose content they verify.
- The shared stage command card is not a second scrolling surface on narrow
  viewports. The full-screen overlay owns overflow; the card is sized to keep
  controls inside the viewport.
- Actual implementation/QA runtime is owner-authorized Codex/GPT-5
  substitution; rostered external services were unavailable.

## 2026-09-19 — terminal full-browser reconciliation

- Workflow run `35420287899` completed with `243 passed`, `33 failed`, and
  `6 skipped` after a 33-minute browser step. The slug-allocation repair held:
  no `unique_project_public_slug_per_owner` failures appeared.
- The account/admin failures are contract and fixture-isolation work: protected
  admin destinations are `/studio`, account settings secondary sections are
  collapsed by default, and profile handle mutations must be restored before
  later serial specs.
- Generated preview failures remain a distinct runtime family and are tracked
  in #627; admin settings/profile-style/theme feedback remains #628. Do not
  reopen closed predecessor issues.
- #626 records the missing bounded workflow/Playwright timeout discovered from
  the long-running full-browser step; its implementation is deferred until
  the current repair batch is terminal.

## 2026-09-19

- **#621 slug-collision root cause:** retain soft-deleted rows in canonical
  public-slug collision checks by querying each model's `all_objects` manager.
  The database uniqueness constraints still protect those rows, so using the
  filtered default manager is incorrect. Regression coverage covers Project,
  Project3D, and ArtPiece.
- **#623 browser contract:** anonymous billing is expected to land on the
  current public gallery route `/gallery?type=all`, so the stale E2E expectation
  of `/` is tracked as a separate mechanical issue rather than mixed into the
  backend slug repair.

## 2026-09-19 — CI runtime strategy and transient-failure reconciliation

- Ordinary push CI remains intentionally short: one Chromium smoke shard plus
  the WebKit fullscreen regression. The complete browser acceptance suite is
  retained for scheduled/manual execution as three parallel one-worker shards
  rather than being made a required serial push gate.
- Full matrix `35435158520` supplied the required art-piece and slug evidence:
  `275 passed`, `1 failed`, `6 skipped`; the one failure was an unrelated
  mobile admin-entitlement login timeout. Rerunning the failed shard as job
  `105878745662` completed successfully, so #632 was closed as a transient
  CI-load/fixture timing failure.
- #631's controlled-input timing fix is `7e22707`; focused coverage passed and
  the full frontend suite passed with `241` files and `2734` tests. No test
  reduction was needed; the runtime problem is addressed by separating bounded
  push feedback from scheduled full coverage.
- Do not manually trigger the full matrix as a routine post-batch action. Use
  the latest scheduled result or targeted local/CI evidence; manually run the
  full matrix only for an owner-requested release or closure gate.
- Final push run `35437244888` on `385dd99` passed all required jobs: backend
  `2m07s`, frontend `6m04s`, disposable routing `1m11s`, and browser smoke /
  WebKit `5m47s`. The shorter required gate is green without reducing the
  frontend or browser test set.

## 2026-09-14

- **#542 conflict policy (owner-selected):** deterministic hybrid merge. The
  outbox automates operation identity, ordering, retry/backoff, idempotent
  replay, divergence detection, and merges proven independent. Overlapping or
  otherwise ambiguous edits become explicit reproducible conflicts with an
  owner resolution/rebase action. Last-write-wins is excluded because it can
  silently discard artwork. #542 remains open until this policy is translated
  into a criterion-ready follow-up decomposition and implementation contract.

## 2026-09-08

- Roster finalized for ai-dev-tools-zoomcamp-1 — see LOOP-AGENTS.md Section 4 and GRAPH-AGENTS.md Section 5.
- Corrected the adapted orchestrator to use this Case E repo's canonical
  `.agents/memory/MEMORY.md` index and linked topic pages; a parallel root
  `MEMORY.md` must not be created. The root file was already absent, so no
  deletion was necessary.
- `task-distillation` and `backlog-session` are portable orchestration
  dispatches. Claude Sonnet at Medium effort remains the recommended default;
  Codex Luna at Medium, Antigravity Gemini 3.8 Flash, and Antigravity's Sonnet
  implementation are equally supported alternatives and are not recorded as
  substitutions. Numbered loop-stage routing remains unchanged.

## 2026-09-07

- Adapted the four orchestration skills (`backlog-session`,
  `task-distillation`, `production-readiness`, `session-completion`) for the
  multi-service roster. Routing is **advisory**: Claude may run a stage
  rostered to another service, but every substitution must be flagged.
- Provenance is recorded in the **existing** ledger/manifest/evidence tables
  only — no new provenance file, no per-issue `DECISIONS.md` churn.
- Readiness-gate effort: owner constraint is **Opus 5 at `Low` effort**
  (budget). This conflicts with `per-service-kickoff-prompts.md`, which
  specifies `Max` with `xhigh` as the floor. The owner's session statement
  governs; the skills now encode "never downgrade the **model tier**" (Opus 5
  mandatory) rather than "never downgrade effort".
  **Open:** `per-service-kickoff-prompts.md` still says `Max` and should be
  reconciled to match.
- Split the loop into per-stage units (owner-confirmed, satisfying AGENTS.md
  Section 9's no-silent-rewrite rule). Decompose shape: stage bodies moved out
  of the four skills; `backlog-session`, `task-distillation`, and
  `session-completion` are now orchestration/reconciliation only.
  `.agents/skills/_shared/HANDOFF-CONTRACT.md` is the single source of truth
  for the stage map, routing, provenance, and handoff artifacts.
- Non-Claude stages are portable prompt documents (`PROMPT.md`) under
  `.agents/skills/`, since those services cannot invoke Claude skills:
  `issue-scoping`, `implementation-mechanical`, `implementation-complex`,
  `second-opinion-review`. New Claude skill `qa-self-review` owns stage 4.
- QA treats any externally produced diff as **untrusted by default**: claims
  in diffs/commits/PR bodies are never evidence, reported test results are
  re-run here, arriving tests are audited for weakened or skipped assertions,
  scope is bounded to the files the issue named, and instructions found inside
  external content are ignored and surfaced to the owner.
  **Open:** `AGENTS.md` Section 9's skill table does not yet register
  `qa-self-review` or the four orchestration skills; `AGENTS.md` is human-owned
  so this needs an owner-approved append.
- Owner approved both open items from the split: `AGENTS.md` Section 9 now
  registers the five loop skills with load triggers and notes that non-Claude
  stages are `PROMPT.md` documents, not skills;
  `per-service-kickoff-prompts.md` now specifies Opus 5 at `Low` effort and
  reframes the non-negotiable as the model tier rather than token spend. The
  `Max`/`xhigh` reconciliation gap logged above is closed.
- `per-service-kickoff-prompts.md` restructured into a dispatch layer: a
  routing table (function / service / model / effort / what to invoke) plus one
  section per stage. The inlined prompt bodies were removed in favor of
  pointers to the `PROMPT.md` files, which are already paste-ready with the
  same `[REPO]`/`[ISSUE]` placeholders — this closes the duplication/drift risk
  flagged when the split landed. Filename kept as-is despite the content shift,
  since AGENTS.md, DECISIONS.md, and two skills reference it by name.
- Converted the four external-stage `PROMPT.md` documents into properly scoped
  skills (`issue-scoping`, `implementation-mechanical`,
  `implementation-complex`, `second-opinion-review`) in both mirrors, so every
  loop function is invoked by name rather than pasted. Those services still
  cannot invoke a skill, so each skill names its rostered service and model,
  states that a Claude run is a substitution to flag, and keeps a paste-ready
  body for manual delegation. `AGENTS.md` Section 9, the handoff contract,
  `backlog-session`, and the dispatch file were updated together; no
  `PROMPT.md` references remain.
- Renamed `per-service-kickoff-prompts.md` to `DISPATCH.md` (via `git mv`, so
  history follows). The old name described neither its content nor its use
  once the prompts became skills. Live references in `production-readiness`
  and durable memory were updated; the earlier entries in this file keep the
  old name, since this log is append-only history.
- `AGENTS.md` Section 9 now points at `DISPATCH.md` as the routing index, so
  the file is reachable from the orchestrator rather than only by name.
- Ran the full loop on issue #485 (accessible not-found view): stage 4
  (`qa-self-review`) caught a real desktop-viewport accessible-name collision
  between the not-found page's own recovery links and `Layout`'s persistent
  nav that the unit suite's scoped assertions couldn't see — first verdict
  `QA: FAIL`, returned to stage 2a, fixed in commit `afde244`, re-verified
  independently including inspected rendered screenshots, second verdict
  `QA: PASS`. Issue closed; durable lesson recorded at
  `.agents/memory/recovery-link-accessible-name-collision.md`.
- Stage 5 (`production-readiness`) ran on Claude Sonnet 5 instead of the
  mandatory Opus 5. Per this skill's own Rule 6 instruction, flagged the
  mismatch and stopped for owner confirmation before proceeding; owner
  explicitly authorized the substitution rather than switching model tier.
  Recorded as a flagged substitution, not a silent downgrade. Finding:
  CI's `Browser acceptance E2E` job is currently red on `main` (same-day
  run, commit `adfe702`) with concurrent-request duplicate-key races
  (`django_cache_pkey`, `unique_draft_scope`, `unique_creation_request_per_owner`)
  — an already-groomed, already-open defect (#419), previously deferred to
  "the final production-readiness pass," now recorded with fresh same-day
  evidence there rather than re-run locally. #445 (release-candidate
  container) remains blocked on #419; #485 itself is unaffected and closed.

## 2026-09-08 (stage-2a backlog run)

- **#479 camera architecture decision (owner-selected):** Option A — parent
  frame owns real camera/mic capture and MediaPipe tracking, relaying only
  derived signals into the opaque-origin sandbox; `allow-same-origin` stays
  prohibited. Owner confirmed via the options gallery this session; the
  already-merged PR #484 implements exactly this shape, so no re-derivation
  was needed. Real-device (webcam/hand/mic) evidence remains the owner's live
  session per `.agents/memory/camera-synthetic-verification-gap.md`.
- **#482/#483 topology decision:** the Full and Immersive art-piece ZIP
  runtimes are single top-level documents (no sandbox attribute, no iframe),
  so #479's opaque-origin defect cannot occur there; the parent-frame relay
  is recorded N/A with unit + unmocked-extracted evidence.
- **#490 platform boundary:** the upstream Replit/Google-Frontend HSTS field
  cannot be configured or suppressed from the repo, and Django's field cannot
  be dropped without breaking the fail-closed production gate — exact vendor
  action handoff recorded in settings.py; owner decision on aligning the
  policy (incl. `preload`) remains open.
- Provenance for this run: stage 2a executed as a substitution of the
  rostered Opencode Go run (frontend via implementation-mechanical-frontend
  subagents, backend via implementation-mechanical-backend), recorded here
  because no backlog-session ledger file was active this session.

## 2026-09-08 (stage-4 QA pass on the stage-2a run above)

Ran `qa-self-review` against a local disposable PostgreSQL + Django
(`AI_PROVIDER=fake`) + Vite stack for the four diffs from the stage-2a run
above (`c272473`, `74ef304`, `234fcaf`, `9df2168`). Full `make check` green
(backend 1141 passed/29 skipped, frontend 2494/2494, lint/format/typecheck
clean). Verdicts posted as GitHub comments, not set here (this skill does not
close issues):

- **#479: `QA: PASS`.** 7/7 chromium (`artPieceCameraRuntime.spec.ts` +
  `artPieceSteeringRuntime.spec.ts`), including the new unmocked
  fake-device `getUserMedia` scenario through the parent frame. One open
  gap flagged, not blocking: the issue's own microphone criterion has no
  independent unmocked evidence in this diff — `PieceStageControls.tsx`'s
  `enable-microphone` path still appears to go through the sandbox
  (unlike camera, which moved to the parent frame), so it likely still
  carries #479's own root cause. Owner should confirm or file as a
  follow-up before closing #479.
- **#482/#483: `QA: PASS`.** 2/2 and 3/3 chromium respectively, including
  each issue's new unmocked fake-device camera scenario. Topology N/A
  finding (single top-level document, no sandboxed iframe) verified
  directly against the generated bundle's own markup, not taken from the
  commit message.
- **#490: `QA: PASS` for the delivered application-layer scope.**
  `test_hsts_header.py` 5/5, real assertions against `SecurityMiddleware`
  behavior. Issue is **not fully closable yet** — the actual upstream
  duplicate field is a platform boundary outside repo control (matches the
  issue's own dependency note deferring published evidence to #445); kept
  open pending that or an owner decision to accept the upstream policy
  as-is.

No product code was changed during this QA pass (per the skill's own
"do not modify product code" rule). Local Django/Vite dev servers used for
verification were stopped afterward.

## 2026-09-08 (stage-5 production-readiness gate)

`production-readiness` requires Opus 5, never a lesser model. This session
is Sonnet 5; flagged per Rule 6 before proceeding, owner explicitly
authorized the substitution (same precedent as the earlier #485 stage-5
run) via `AskUserQuestion`. Full report posted on
[issue #445](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/445#issuecomment-5588861368).
Key findings:

- **New gap found:** #487/#488/#489 have real implementation commits
  (`0eb4067`, `5e9a721`, `f2549ff`) but never went through stage-4 QA —
  `docs/tasks.md` items 288/289/291 were stale (still said
  PROPOSED/GROOMED) and no GitHub QA comment exists. Corrected the
  statuses; QA itself deferred to a future stage-4 dispatch, staying in
  stage-5's read-only assessment role.
- **This entire 10-commit local batch is unpushed and un-CI'd** — GitHub
  Actions has not run against any of #479/#482/#483/#487/#488/#489/#490/#492.
  No push was performed (not authorized this session).
- **Live-confirmed against `https://animate.creatrweb.com`:** #489's
  caching fix is not yet deployed (live hashed asset still `no-cache`);
  #490's duplicate-HSTS defect is still live and reproducible on `/health/`
  exactly as the issue describes (root `/` only showed the upstream field,
  worth narrowing later). Both expected — production predates this batch —
  and consistent with #445's own DEPENDENCY-BLOCKED status, not a new
  blocker.
- #445's own child-issue checklist is stale (2026-09-05 snapshot, lists
  issues now closed, omits the current 16-issue open manifest) — flagged
  for the next `task-distillation` pass to refresh, not corrected here
  (out of stage-5's scope).
- Local full disposable-stack `npm run test:e2e` (819 tests, 1 worker) was
  started as supplementary evidence but not waited on to completion,
  matching this repo's own established precedent (#485's stage-5 run) of
  using existing CI evidence over multi-hour local re-runs under the
  Low-effort budget. Partial snapshot (76/819, 3 unclassified failures in
  `accountSessions`/`adminSettings`, unrelated to this batch) left for
  #419's own reconciliation scope.

Overall verdict: **not yet production-ready** — three concrete blockers
recorded above and on #445. No product code changed; `docs/tasks.md`
reconciled (commit `f545773`).

## 2026-09-08 (post-readiness: batch pushed)

Repository owner pushed the 10-commit batch (`989795e`..`7546cd2`) to
`origin/main` after the stage-5 report was posted, resolving the "unpushed,
un-CI'd" blocker recorded above. CI run `34256163552` started immediately
(`gh run watch` monitoring in background). Local supplementary full e2e run
also continuing in parallel; both will be reconciled once CI completes.

## 2026-09-08 (CI evidence for the pushed batch)

CI run [34256163552](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/actions/runs/34256163552)
completed for the pushed batch (`7546cd2`, later `6edf17b`): Backend checks,
Frontend checks, Workflow validation, and the disposable published-routing
smoke check all **passed**. `Browser acceptance E2E` failed on exactly one
test — `publishingAndRemix.spec.ts`'s "10-second synthetic camera
diagnostics" (`inferenceFps` ~15-20 vs required >20) — the same
already-tracked, already-classified CI-runner-capacity flake from #419/#465,
not a regression from this batch. This resolves the "unpushed, un-CI'd"
readiness blocker: the full #479/#482/#483/#487/#488/#489/#490 batch now has
real, clean CI evidence.

The local single-worker supplementary full e2e run (819 tests, started
during the stage-5 pass) was stopped partway (320/819, 37 failures) once
authoritative CI evidence landed — its noisier local-sandbox results are
non-authoritative per [[local-sandbox-verification-boundaries]] and
[[full-browser-readiness-gate]]; CI is authoritative for this dimension going
forward for this batch.

## 2026-09-08 (stage-4 QA on #487/#488/#489 + stage-5 re-run)

Owner authorized proceeding with QA on #487/#488/#489 plus live
re-verification of #489/#490 against the republished site, then a
production-readiness re-run. All in one pass, Sonnet 5 (same
already-authorized substitution for the mandatory Opus 5 on stage 5).

- **#487/#488: QA PASS, closed.** All criteria verified locally
  (unit + Chromium e2e + `make check`); no gaps.
- **#489: QA PASS at the application layer, stays open.** Live
  re-verification against the republished site found a new platform
  boundary: Replit's Google Frontend edge injects a `Set-Cookie:
  GAESA=...` affinity cookie on every response, which downgrades
  `Cache-Control: public` to `private` per GFE's standard behavior —
  `max-age`/`immutable` are correct, but the literal "public" criterion
  cannot be met from this repo. Same root cause as #490. Recorded as
  durable memory:
  `.agents/memory/replit-google-frontend-header-rewriting.md`.
- **#490: re-verified live, unchanged.** Duplicate HSTS still present on
  `/health/`/`/accounts/login/` after the republish; root cause
  independently reconfirmed to be the same GFE edge.
- Pushed the full batch (`GIT_URL=... make git-safe-push`, fast-forwarded
  to `58efc5e`). Three consecutive CI runs on three consecutive pushed
  commits all show identical results: everything green except the
  already-tracked #419/#465 camera-FPS flake — no new failures anywhere.
- Refreshed #445's own child-issue checklist (stale since 2026-09-05,
  named issues now closed) to the current 12-issue open manifest; kept
  the historical list rather than deleting it.
- Updated production-readiness report posted on
  [#445](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/445#issuecomment-5589671853):
  the batch is now engineering-complete and CI-verified; what remains is
  three owner decisions (GFE platform-boundary disposition for #489/#490,
  #479's mic-evidence gap, and finalizing #465's flake classification
  off three consistent reproductions), not further engineering.

## 2026-09-08 (owner decision: #489/#490 accepted as platform boundary)

Owner reviewed the confirmed Replit Google Frontend root cause and
accepted both #489's Cache-Control downgrade and #490's HSTS duplication
as permanent platform boundaries rather than pursuing vendor
remediation. Application code for both is correct and unchanged; added
closing ownership notes to `backend/backend/settings.py` and
`frontend/src/vitePreviewCachePolicy.ts` pointing at
`.agents/memory/replit-google-frontend-header-rewriting.md`. Both issues
closed. `make check`-relevant checks (ruff, tsc) pass on the doc-only
diff.

Owner also directed a follow-up prompt be drafted for the implementation
agents (per `DISPATCH.md`) covering: #479's newly found microphone
SecurityError gap (mic capture still runs inside the sandboxed iframe,
never moved to the parent frame the way camera was), #492 (loginViaUI
harness flake), and any other currently-open issue ready for engineering
without further owner input. #440/#460 stay excluded (credential-blocked)
and #467/#465/#419 stay excluded (owner/CI-evidence actions, not
engineering).

## 2026-09-08 (stage-4 QA on #491, Opencode Desktop's first engineered batch)

Opencode Desktop (implementation-complex substitution, stage 2b) delivered
#491 (unified public gallery with type filter) across 6 commits. QA
(qa-self-review, Sonnet 5) verified all 10 acceptance criteria against a
local disposable stack: backend 48/48, frontend 24/24, e2e 2/2, `make
check` green (203 files/2505 tests). Independently re-derived and traced
the #493 same-instant cursor fix by hand before trusting its regression
test (page_size=1, three same-instant items across all three kinds,
asserting exact walk order — genuinely adversarial, not shape-only) rather
than accepting the commit message's "fixes #493" claim on its word.
Re-generated and visually inspected the rendered screenshot evidence
myself rather than reusing the diff's own claim. Two discovery-gate
follow-ups (#493, #494) both filed correctly with matching GitHub issues
and `docs/tasks.md` entries. #491 closed. `docs/tasks.md` item 293
reconciled.

## 2026-09-08 (stage-5 re-run after #491 batch)

Fourth consecutive CI run (`34269238187`, commit `95fdd10`) identical to
the prior three: everything green except the already-tracked #419/#465
flake. #491 and #493 closed this pass (QA: PASS both). #494 confirmed
correctly still open (out of #491's scope). Updated readiness report
posted on
[#445](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/445#issuecomment-5590742351):
nothing engineering-blocked remains for closed work; owner is
deliberately holding the Replit republish until #492/#474 also land, to
batch one republish rather than several — an intentional state, not a
readiness gap.

## 2026-09-08 (stage-4 QA on #492/#474, second Opencode Desktop batch)

Rewrote both dispatch prompts to be fully prescriptive (exact code, not
"investigate whether") after the first, more open-ended prompts produced
no diff. Opencode Desktop (`implementation-mechanical-frontend`)
delivered both exactly as specified: `ee1c5b8` (#492, 15s timeout on the
post-login heading assertion) and `878d907` (#474, forced
`/api/whoami/` round-trip after login, hard-failing rather than masking
the race). QA re-verified both independently against a local disposable
stack (not the reporting session's claimed results): 10/10 and 40/40
repeats for #492, 10/10 for #474's exact original repro, `make check`
green (203 files/2505 tests), `oxlint` showing exactly the 14 pre-existing
warnings claimed, none in the touched file. Both closed.

Noted and resolved: the reporting session flagged commits `95fdd10`/
`6b4684d` as "not authored by me" — these are this session's own earlier
#491 QA/readiness work, not an external actor; no actual conflict, two
sessions legitimately working the same repo in parallel on independent
issues.

This is now 12 local commits ahead of `origin/main`
(`ee1c5b8`..`878d907` plus this doc reconciliation), ready to push.

## 2026-09-08 (stage-5 re-run after #492/#474 closure)

Fifth consecutive CI run (`34271782685`, commit `8f6d1d3`) identical to
the prior four. #492/#474 closed. Flagged in the readiness report posted
on
[#445](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/445#issuecomment-5591077624):
#479's microphone gap (originally dispatched alongside #492/#474/#491 in
the same 4-prompt batch) was never re-attempted with the same prescriptive
rewrite that got #492/#474 unstuck -- still open, owner decision needed on
whether to pursue it before the bulk republish or track separately.

## 2026-09-08 (stage-4 QA on #479's microphone fix)

Opencode Desktop delivered `c273264`/`72779c9` exactly per the prescriptive
dispatch prompt (mirrors #479's own camera fix, moving microphone to the
parent frame). Code review (all 4 files) fully accepted. QA re-verification
diverged from the reporting session's claim on exactly one thing: the new
unmocked real-`getUserMedia` regression, which that session reported as
passing (~2.3s, after approving a pending macOS TCC prompt), failed on
independent re-run here -- `getUserMedia` never settled. Camera's identical-
shaped real-hardware regression passed reliably on the same run. Root cause:
camera and microphone are separate macOS TCC permission categories; this
machine's Playwright Chromium binary has camera access granted from an
earlier session but not microphone. Per
[[camera-synthetic-verification-gap]]'s standing rule (this issue class does
not close on synthetic evidence alone, and does not close on an unreproduced
claim either), **#479 stays open** -- code accepted, real-hardware
microphone evidence still outstanding, next action recorded on the issue
and in `docs/tasks.md` item 297. Extended the memory topic with this
finding rather than creating a new one, since it's the same lesson one
level down (audio, not video).

## 2026-09-08 (stage-5 re-run after #479 code acceptance)

Sixth consecutive CI run (`34275855571`, commit `3e90e27`) identical to
the prior five. Updated readiness report posted on
[#445](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/445#issuecomment-5591605352):
#479's application code is accepted and safe to include in the eventual
bulk republish regardless of the mic-verification outcome (strict
architectural improvement, no regression risk), but the issue itself
stays open pending either a real microphone TCC grant on this machine or
an explicit owner waiver (mirroring #192's own precedent).

## 2026-09-08 (#479 closed: real-hardware microphone confirmed)

Owner confirmed the macOS microphone TCC permission had already been
granted to Playwright's Chromium binary; the previously-failing unmocked
regression was re-run and passed reliably (1/1, then 5/5 on
`--repeat-each=5`, all ~2.4s, plus 4/4 full-file and 7/7 camera/steering
non-regression). #479 closed -- the entire camera+microphone parent-frame
architecture is now real-hardware verified end to end. This is not a
retraction of the earlier caught claim: that re-run genuinely failed at
the time it ran (a real local-permission state, not a false report), and
this one genuinely passes now -- both observations were accurate for their
own moment.

This closes the last open engineering item from this session's stage-2a
batch. Everything closed today (#474, #479, #482, #483, #487, #488, #489,
#490, #491, #492, #493) is now ready for the owner's planned bulk Replit
republish, after which #467/#465/#419 become checkable via Claude in
Chrome per the owner's own stated plan.

## 2026-09-08 (stage-5 final: batch complete, ready for republish)

Seventh consecutive CI run (`34276826933`, commit `6f3c0f0`) identical to
the prior six. Every issue engineered or QA'd this session is now closed:
#474, #479, #482, #483, #487, #488, #489, #490, #491, #492, #493.
Refreshed #445's child checklist to the final 7-issue open manifest
(#419, #440, #445, #460, #465, #467, #494 — all owner/credential/CI-
evidence-gated, none engineering-blocked). Final readiness verdict:
this batch is READY for the owner's planned bulk Replit republish.

## 2026-09-08 (#467 closed: AGENTS.md updated with owner approval)

Owner approved the proposed diff (presented in chat, not applied silently
per Section 11's AGENTS.md safeguard) documenting that `django_migrations`
is never a valid post-publish success signal and naming `/health/` +
direct table inspection as the correct check. All three of #467's
criteria now satisfied: `scripts/smoke-published.sh` was actually run
after today's publish (not assumed from the checkpoint commit), AGENTS.md
now states the guidance, and no script timeout extension was needed (the
existing retry loop completed cleanly). Closing #467.

## 2026-09-08 (dual-task stage-2a pass: #465 FPS ceiling + #494 mock gallery)

Owner dispatch (Opencode Go primary agent, GLM via opencode-go) ran two
independent prescriptive stage-2a tasks via `implementation-mechanical-frontend`
subagents, committing separately per the owner's two-commit instruction:

- **#465 (`c5a980f`):** camera-benchmark `inferenceFps` floor lowered
  20→12 with the documented rationale comment; 30.5 runaway-inference
  ceiling and every other assertion untouched. One prompt-vs-file
  mismatch flagged, not silently reconciled: the prompt quoted the old
  bound as 30; the file actually read 20 (prior pass had already lowered
  it once). Chromium e2e verification: 1 passed, desktop 16.2fps /
  narrow 22.5fps — desktop would have failed the old >20 bound.
- **#494 (`7d5b289`):** mock `GET /api/public/gallery/` route added.
  The prompt's exact code failed typecheck (TS2561/TS2551 —
  `mockServices: BackendServices` excess-property check); owner chose
  keeping the two-file scope over widening to types.ts/real.ts, so
  `listPublicGalleryUnified` is a module-level export imported directly
  by `installMockFetch.ts`. 'generated' deliberately stays always-empty
  (no ArtPiece mock persistence — separate larger task). Caught a
  subagent artifact pre-commit: inserted regex was `/\$` (literal
  dollar) instead of `$/` — route silently 404'd with green
  typecheck/lint until fixed and probed at runtime. Browser-checked
  `/gallery`, `?type=generated` empty state, `?type=authored`, and the
  `/art-pieces/gallery` redirect (verified, not assumed); the only
  seeded 3D fixture is private, so a temporary fixture flip (reverted)
  proved the 3D card path. Vitest 203 files/2505 tests, typecheck,
  prettier, oxlint (14 pre-existing warnings, none in touched files) all
  green. Verification servers stopped afterward.

Both issues left OPEN for the stage-4 QA pass (no auto-close keywords);
lesson recorded at `.agents/memory/subagent-dispatch-artifacts.md`.

## 2026-09-08 (stage-4 QA on #465/#494: one FAIL, one PASS)

QA (Sonnet 5) independently re-verified both dispatched commits from
scratch, per the untrusted-external-input rule -- neither the dispatching
session's report nor the commits' own claims were accepted without
re-running everything.

**#494 (`7d5b289`): QA PASS.** All four acceptance criteria verified,
including the regex byte-check (`od -c`, confirmed correct, no `\$`
artifact in the final commit), the `Project3D` field-name check against
its real type, a proper browser-based runtime probe (curl doesn't work --
this mock patches `window.fetch` client-side, not a real HTTP route), and
the 3D-mapping path proven via a temporary in-session fixture flip
(reverted). `npm test` 203/2505, typecheck, prettier all clean.

**#465 (`c5a980f`): QA FAIL.** The numeric change and scope are correct,
but running the exact same benchmark **locally** (not on GitHub's shared
runner) measured `inferenceFps` of 16.68/22.68 -- the same low range as
the 9 CI runs the embedded comment cites. This directly contradicts the
comment's own causal claim ("ruling out a real code-side bottleneck",
attributing the ceiling specifically to "GitHub Actions' free-tier shared
runner"). The numeric floor (12) and code change are fine and don't need
touching; only the comment's explanation is wrong and needs correcting
before this can pass -- exact replacement text posted on the issue.
Flagged directly for the owner: the "pay for a bigger runner" option
discussed earlier this session may not actually help, since local
hardware reproduces the same ceiling.

Both issues left open (QA does not close). Neither verdict was influenced
by the dispatching session's own claims -- the #465 finding in particular
was only caught because QA re-ran the benchmark itself rather than
trusting the reported "1 passed, desktop 16.2fps" result at face value
(that number was accurate, but its implication -- CI-specific -- was not
examined by the reporting session).

## 2026-09-08 (#465/#494 closed — final engineering items of this session)

QA re-check of `185032a` (comment-only fix on top of the already-fixed
numeric bounds): independently re-verified byte-level and via a third
fresh benchmark run (16.83/22.97fps, consistent with the two prior
measurements). QA: PASS. Both #465 and #494 closed. This is the last
engineering item from today's session -- everything closed today
(#474, #479, #482, #483, #487, #488, #489, #490, #491, #492, #493, #494,
#465) is now ready for the owner's planned bulk republish. Remaining open
issues (#419, #440, #445, #460) are all owner/credential/CI-evidence
gated, not engineering-blocked.

## 2026-09-09 (stage-2a handback: #502 regression subprocess isolation, `05fed05`)

Stage-4 QA handback accepted: #502's fix correct, its regression test
broken mid-suite (subprocess and parent derived the same physical test
database; parent's session-scoped connections made the subprocess's
create/teardown collide). Reproduced here first (full suite 1 failed/1193
passed; also observed the teardown race directly as "database does not
exist" on the parent side in a two-test repro), then fixed strictly in
scope (one file): subprocess gets a `-single-selection`-suffixed
`POSTGRES_TEST_DATABASE_URL`. Independently re-verified: handback's exact
full-suite repro green (1194/2), no stray databases, skip convention
intact, lint/format/mypy clean. Provenance: stage 2a substitution of the
rostered Opencode Go (qwen3.6-plus backend slot), recorded here per
standing practice (no backlog-session ledger active).

## 2026-09-09 (stage-2a batch: #502 + #500 delivered, #501 handback)

Owner dispatch: implement #419, #445, #500, #501, #502 mechanically. Owner
correction mid-session: #419/#445 already QA-passed — skipped, not touched
(consistent with both issues' own bodies: reconciliation/release containers,
not engineering). Stage 2a executed as a substitution of the rostered
Opencode Go (implementation-mechanical-backend / -frontend subagents under
this session); provenance per the handoff contract, no backlog-session
ledger active. Issues left OPEN for stage-4 QA.

- **#502 (`2a977fe`):** two-layer fix — explicit empty `TEST[DEPENDENCIES]`
  in test_settings (setup-ordering layer) + dual-alias
  `["default", "postgres_test"]` markers across 22 markers/12 files (the
  issue's own working convention; fixes the migration-routing layer exposed
  once setup no longer crashed: allauth `0006_emailaddress_lower`'s unguarded
  RunPython needs `default` migrated first). Subprocess regression test on
  the issue's exact repro. First dispatch round's "other selection passed"
  verification was void (a SQLite-only node id was chosen) — caught on
  independent re-run, corrected, then fully re-verified (single selections,
  full backend suite, lint/format/mypy) before commit.
- **#500 (`7bd5d2e`):** standalone Mistral form + legacy client/mock wiring
  removed; sole generic card remains. Disclosed deviations: mock-mode
  provider-credentials routes added (none existed), now-unused imports
  dropped, Shift+Tab used for reachability (Save button is after the input
  in DOM order). Independently re-verified: unit 36/36, typecheck, Chromium
  E2E 2/2 both viewports (first re-run self-skipped because this session's
  own backgrounded Django server died between tool calls — environment
  artifact, not code; re-ran stack+suite in one invocation), `make check`
  green.
- **#501:** handback, no work attempted — its own contract requires #499
  (open, stage 2b) terminally reconciled first. Routing handoff recorded;
  not a blocker.

`docs/tasks.md` reconciled with a dated session entry (commit follows).

## 2026-09-09 (CI concurrency fix + standing rule against manual full-matrix triggers)

Manually triggering the full multi-browser matrix for #419's own
acceptance criterion was cancelled twice by unrelated routine pushes
(a Replit publish checkpoint, then this very fix's own commit) sharing
`ci.yml`'s branch-scoped concurrency group. Fixed in commit `2f60f65`:
`workflow_dispatch` now gets an isolated group keyed by `github.run_id`.

Owner correction, recorded as a standing rule: this repo's CI already
runs the full matrix automatically every weeknight
(`schedule: cron: "17 3 * * 1-5"`) -- there was never a need to manually
force it in the same session as an engineering batch. Recorded at
`.agents/memory/full-matrix-scheduled-not-manual.md`: future sessions
should check the nightly scheduled run's own results rather than
manually re-triggering, and only force a fresh manual run when the owner
explicitly asks for it.

## 2026-09-09 (#499 closed: credential-resolution parity was already correct, only test coverage was missing)

Stage 2b implementation dispatched to Opencode Go/Ollama Cloud on the
corrected roster model (`kimi-k3`, replacing `qwen3-coder:cloud`, which
Ollama Cloud no longer offers -- `DISPATCH.md` and both
`implementation-complex` skill mirrors updated to match).

**Provenance:**
- Stage 2b: rostered Ollama Cloud `kimi-k3` -- ran as intended, not a
  substitution.
- Stage 3 (`second-opinion-review`, Mistral Vibe): not run for this diff.
- Stage 4 (QA): Claude Sonnet 5, Medium -- substitution for no rostered
  alternative (Claude is this stage's own roster).

Stage 2b's own artifact claimed the production code already satisfied
#499's criteria after #498/#500, and only test coverage was missing --
independently re-verified rather than accepted: direct `grep`/read of
both `ai_api.py` and `art_piece_api.py` confirmed no legacy
`MistralCredential` reference remains outside the two exception classes
that are supposed to stay, and both generation paths share byte-identical
`ProviderCredential`-only lookup/error semantics. The artifact's central
claim ("zero production changes needed") held up.

One of the new tests replaced a genuinely vacuous existing test
(`test_fake_provider_does_not_require_a_personal_key` patched a name that
only ever exists via a local import inside the real function, so
`raising=False` patched nothing live, then asserted against the wrong
provider class) with one that proves the credential store is never
queried on the fake-provider path. `make check` fully green (backend
1198 passed/2 skipped, frontend 203 files/2503 tests). Closed with full
criterion-matrix evidence on the issue.

This also unblocks #501, whose own contract required #499 terminally
reconciled first.

## 2026-09-09 (stage-2a batch: #504 + #505 delivered, #506 handback)

Owner dispatch: implement #504/#505/#506 mechanically via the
implementation-mechanical skill. Stage 2a executed as a substitution of
the rostered Opencode Go (Claude session dispatching per AGENTS.md's
Implementation Delegation block; primary agent handled the diagnosis,
no subagent dispatch this run). Provenance recorded here per the handoff
contract, no backlog-session ledger active. Issues left OPEN for stage-4
QA.

- **#504 (`9c47c54`):** animationFps floor lowered 30→12 with its own
  rationale comment. Root cause confirmed by reading the seam: animationFps
  and inferenceFps are NOT identical by construction — the provider
  throttles inference to 30Hz via MIN_INFERENCE_INTERVAL_MS while
  animationFrames counts every rAF tick. On loaded CI runners rAF drops
  below 30fps (17.6 and 21.2 observed in two full-matrix CI runs), failing
  >=30 for the same runner-capacity reason inferenceFps did in #465.
  Verified locally: 3/3 repeats passed (desktop 35.3-35.5, narrow 60.0).
- **#505 (`14ec618`):** two fixes landed — (1) e2e_fixtures.py gained a
  `reset-sessions` action; accountSessions.spec.ts calls it once per file
  in beforeAll via resetSessions.ts, preventing accumulated owner sessions
  from breaking the exact-count assertion. (2) adminSettings.spec.ts now
  reads the live plan value from the API instead of hardcoding '5'
  (migration 0031 seeds 50; '5' was only ever a local-run leftover).
  Verified with the exact alphabetical serial ordering CI failed on:
  accountEntitlements + accountIdentities + accountSessions + adminSettings
  = 18/18 passed.
- **#506:** handback to stage 2b, no code change. Classification: the
  curated firefox subset's artPieceSteeringRuntime tests (all 3 scenarios
  in that file) timeout at 30.3-30.4s on waitForThreeJsReady and
  sendCommandAndAwaitPose (waiting for the CDN-loaded sandboxed iframe's
  canvas/postMessage). Standalone passes at ~14s; repeat-each=3 under
  interleaved curated files also passes. Likely a CI-runner-capacity
  boundary (Firefox WebGL sandboxed-iframe overhead on a shared runner),
  but the fix would touch the Three.js/A-Frame runtime or iframe
  postMessage protocol — shared with chromium/webkit — so it's
  stage-2b territory per the issue's own stop condition. Owner decision
  needed on whether to pursue a runtime fix, a longer firefox-only
  timeout, or a curated-subset change.

  **QA correction (stage 4, Sonnet 5):** the original handback cited "12
  other artPiece firefox tests timeout identically" from CI run
  `34307303394` — that run predates both today's fixes and the
  firefox-curation change itself, so files it ran on firefox
  (`artPieceFullZipRuntime`/`artPieceImmersive*`/`artPieceNonCameraZip`)
  aren't even in the current firefox project (`playwright.config.ts`
  curates only `drawioEditor.spec.ts`, `artPieceSteeringRuntime.spec.ts`,
  `manual2dStageChrome.spec.ts`). Independently re-verified against the
  actual current-`main` owner-triggered run (`34404323033`): only the 3
  `artPieceSteeringRuntime.spec.ts` firefox failures exist, nothing
  broader. Both `.agents/memory/e2e-full-matrix-firefox-iframe-timeouts.md`
  and this entry corrected accordingly. The classification conclusion
  (stage-2b handback) still holds; only the supporting evidence scope
  was wrong.

## 2026-09-09 (stage 2b: #506 delivered, `ae9392a`)

Provenance: stage 2b ran as the rostered Ollama Cloud `kimi-k3` (not a
substitution). No backlog-session ledger active; recorded here.

- Instrumented with temporary `[506]` probes on CDN request/response,
  iframe attach, and canvas attach (later reverted), and reproduced under
  genuine full-run-equivalent load: full serial `npx playwright test`
  (193 tests, 22.7 minutes) with an all-core CPU stressor holding load
  average ~21-27 on 8 cores. Did NOT reproduce the stall locally —
  CDN responses in ~64ms, iframe attach at ~600ms, all 7 curated firefox
  tests passed (both in the full run and repeated after).
- Classification: (a) Firefox-specific sandbox/WebGL init timing on
  headless Linux CI, NOT generic capacity — chromium passed the identical
  scenarios in ~6.0s in the same CI run where firefox stalled at 30.3s,
  which a genuine (c) runner-capacity boundary would not produce. Local
  macOS Firefox has GPU-backed WebGL; the Linux CI runner's headless
  Firefox uses software rendering, whose opaque-origin sandboxed-iframe
  context init can stall past 30s on a shared vCPU. Not (b): every path
  that initializes completes the scenario's work in seconds.
- Fix: 90s timeout (3x the observed stall) on exactly the 3 rendering
  scenarios, gated on `testInfo.project.name === 'firefox'`. Chromium's
  default 30s and the non-rendering capability test (4.3s on CI)
  untouched. No assertion weakened or deleted.
- Verified locally: curated firefox subset 7/7 (23.7s), this file's
  firefox 8/8 under repeat-each=2 (45.9s), chromium 4/4 (19.0s),
  typecheck/lint/prettier clean on the touched file.
- Honesty note for stage 4: the true "full serial suite passes
  repeatedly" bar is CI's own nightly full-matrix — the stall never
  reproduced locally even before the fix (GPU-backed local WebGL), so
  the fix is verified in shape and non-regression but its CI resolution
  is pending the next nightly run. The memory page records
  re-instrumentation guidance if 90s still stalls.
- Memory page `e2e-full-matrix-firefox-iframe-timeouts.md` extended in
  place with the confirmed classification and resolution.


## 2026-09-10 (owner-triggered CI re-confirmation: #506's 90s fix falsified)

Owner explicitly requested a second manual full-matrix `workflow_dispatch`
run to confirm #506's timeout fix, per the standing convention's
explicit-request carve-out. Run
[34419548768](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/actions/runs/34419548768)
at current `main` (`915416a`): the same 3 `artPieceSteeringRuntime.spec.ts`
firefox scenarios still failed — now at 90s instead of 30s, identical
`page.evaluate`/`sendCommandAndAwaitPose` timeout signature. Everything
else in the run was clean (#504/#505's fixes hold; no other failures).

This falsifies the "just needs more time" classification (a)/(c) the
stage-2b fix assumed and confirms exactly the contingency that fix's own
commit message anticipated: a genuine deadlock, not slowness. #506
reopened for a second stage-2b pass — real root-cause instrumentation
(is the canvas ever created? does the postMessage handler ever reach a
respondable state?) rather than another timeout adjustment, which the
owner-confirmed evidence already rules out. Memory topic
(`.agents/memory/e2e-full-matrix-firefox-iframe-timeouts.md`) updated
with the revised classification.

## 2026-09-10 (stage-5 model roster: Sonnet 5 permanently authorized alongside Opus 5)

Every prior stage-5 run required asking the owner to authorize a Sonnet 5
substitution for the mandatory Opus 5 tier (2026-09-08 entries above, same
precedent as #445/#485). Asked again before this run (resuming
production-readiness + session-completion for #508, handed off from a prior
session that ran out of usage credits mid-gate); owner responded: authorize
Sonnet 5 **permanently**, adding it to the approved-model list rather than
re-asking each run.

Updated the roster in four places to state Opus 5 **or** Sonnet 5 as the
mandatory stage-5 tier (Low effort for Opus 5, Medium for Sonnet 5), with
this entry cited as the authorization so future runs don't re-flag it as a
substitution:
- `DISPATCH.md` (dispatch table row 5, the "not substitutable" note, and
  the Stage 5 detail section)
- `.agents/skills/_shared/HANDOFF-CONTRACT.md` (stage map row 5 and the
  "Routing is advisory" section)
- `.agents/skills/production-readiness/SKILL.md` and its `.claude/` mirror
  (Stage ownership and effort floor)

Only Opus 5 and Sonnet 5 qualify — Haiku and non-Claude services remain
excluded from stage 5, unchanged. This does not touch stage 4's existing
Sonnet 5 roster.

## 2026-09-12 (owner-approved durable memory updates)

The owner approved two durable memory updates based on the completed #513/#445
verification pass. Added linked topic pages and concise index entries for:

- using a reachable local non-production PostgreSQL server with Django/Vite
  when Docker is unavailable, and retrying Playwright outside the managed
  sandbox when macOS blocks Chromium Mach-port startup;
- verifying migration-bearing Replit publishes by rejecting destructive
  conflict options, staging schema/backfill work, and checking real
  production tables, relationships, smoke, and authenticated runtime instead
  of relying on `django_migrations`.

No credentials, tokens, or personal data were recorded.

## 2026-09-12 (issue-scoping routing correction)

Owner explicitly corrected the active Stage 1 issue-scoping route to Codex
GPT-5.6 Luna at Medium effort. Updated `DISPATCH.md`, the `.agents` and
`.claude` issue-scoping skill mirrors, and the backlog-session routing note.
Historical Sol/Terra provenance entries remain unchanged.

## 2026-09-12 (owner-directed in-task agent substitution)

The owner explicitly directed that no Opencode Desktop or other external model
be invoked. The #509/#511 complex implementation and QA stages therefore ran
in this Codex task, while preserving the documented external roster as the
normal route and flagging the substitution in the task ledgers and GitHub QA
evidence.

## 2026-09-15 (production-readiness + task-distillation: #543 API decision authorized)

Ran `production-readiness` against the full manifest (backend mypy 267 files
clean, frontend `tsc -b` clean, GitHub open-issue enumeration, cross-repo
parity memory review against `augment-humankind`/`augment-humankind-react-node`).
No new implementation gap was found: the pieces-parity effort is closed out
through its scoped chain (#274/#320/#324 remain immutable containers), the
blog/comments/feeds/syndication domain (`augment-humankind-react-node` AH-10)
remains an intentional out-of-scope exclusion per `docs/process.md`'s parity
boundary, and privacy-first workflows (camera opt-in, account export/deletion,
cloud retention policy, encrypted provider credentials) are already
implemented and covered by closed issues. Corrected one stale memory pointer:
`.agents/memory/production-readiness-gaps.md` cited #414-#416 as open
next actions; verified all three CLOSED and updated the page.

The only live blocker found was #543 (durable mutation outbox), QA-returned
2026-09-14 pending an explicit owner decision: implementation needs a new
dedicated authenticated backend endpoint plus a DB migration for server-side
idempotency/acknowledgement records, since the existing cloud-backup manifest
endpoint is not semantically sufficient. Per `AGENTS.md`'s dependency/schema
rule, this required asking rather than deciding silently. Owner authorized the
new endpoint and migration in this conversation. #543 is now unblocked for
stage 2b `implementation-complex`; #544/#545/#546 remain dependency-blocked on
#543's transport and operation-identity contract, in that order, per
`docs/distillation-2026-09-14-local-workspaces.md`.

## 2026-09-15 (Claude in Chrome production audit: #547/#548 filed)

Owner asked for a follow-up readiness pass using Claude in Chrome against
the live `https://augmentrart.com` deployment (Account settings layout,
WCAG 2.2, editor functionality, admin-panel theme customization parity),
explicitly instructing no amendment of any existing issue and use of
`task-distillation` to scope and file new issues instead. Owner also
explicitly authorized issue-scoping ahead of distillation and use of Claude
in Chrome for this pass.

Findings: (1) `GET /api/account/entitlements/` returns HTTP 500 in
production — the real cause of Account settings' permanent "Could not load
your plan and usage." error — filed as
[#547](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/547);
(2) Account settings renders as one flat, ungrouped column across ~7
distinct concerns despite well-formed underlying accessibility semantics
(landmarks/labels/headings all correct) — a WCAG 2.2 SC 1.3.1
grouping/usability gap — filed as
[#548](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/548).
Confirmed via source review (could not reach live as a non-admin account,
expected fail-closed behavior) that the admin panel
(`/admin/settings`/`/admin/pages`/`/admin/content`) is built and already
has site theme customization (closed #521). #521's exclusion of arbitrary
custom CSS/HTML/JS theming (unlike `augment-humankind-react-node`'s
sandboxed custom-runtime system) is a deliberate, already-recorded security
scope decision, not a gap — not re-filed. No existing issue duplicated
either finding. Full detail in `docs/tasks.md` and
`.agents/memory/account-settings-production-audit-2026-09-15.md`.

## 2026-09-15 (#544 server-authoritative resolution authorized)

Owner authorized the `SyncMutationReceipt.applied_scene_version` schema
migration after the deterministic-hybrid contract and rollback boundary were
shown. The implementation keeps the receipt as the immutable audit record,
locks only the project row (nullable related joins cannot be selected for
update on PostgreSQL), rejects stale bases with the authoritative remote
snapshot, and creates one immutable `SceneVersion` linked to the receipt.
Stage 2b is a Codex/GPT-5 substitution for rostered Ollama Cloud `kimi-k3`;
Stage 4 and the readiness gate remain separate stages and are not implied by
this implementation increment.

## 2026-09-15 (final backlog reconciliation and readiness gate)

After the owner-authorized #544 migration, the authenticated GitHub connector
was re-enumerated and returned no open issues. Direct fetches confirmed #543
through #548 are closed with `state_reason: completed`; #548 is included in
the terminal batch despite the earlier historical manifest naming only #544/#546.
The stale open-only text was preserved as history and superseded by the final
manifest at the top of `docs/tasks.md`.

Stage 5 production-readiness ran on the rostered Claude Sonnet 5 Medium in the
active Chrome Claude session. It passed local deployment, approved Chromium/CI
evidence, and scoped functionality, but returned `OPEN FOLLOW-UP` for overall
production readiness because no migration-bearing Replit publish, production
schema inspection, or deployed-browser smoke matrix was performed in this
batch. This does not reopen a closed child or create a duplicate: #445 owns
release-candidate reconciliation and #467 owns the post-publish schema
verification practice. Session completion therefore records the batch as
`deployment-pending`, not production-ready.

The owner approved the proposed durable-memory updates. Added
`.agents/memory/server-authoritative-sync-conflict-resolution.md` documenting
the project-row lock, stale-base/no-write rule, immutable receipt linkage, and
PostgreSQL nullable-join failure from #544. Extended
`.agents/memory/replit-final-schema-publish-verification.md` and its index entry
to record that the successful local `scenes.0065` migration does not establish
production schema or runtime evidence; Publish, direct table checks, smoke, and
deployed-browser verification remain required.

The owner then authorized a Replit republish. The active Replit session showed
“Database migrations validated successfully,” and the publish completed with a
new “Published your app” event. Post-publish checks passed for
`GET /health/` (HTTP 200, status ok), `/` (200), anonymous `/api/whoami/` (401),
and `/accounts/login/` (200). However, read-only production
`information_schema.columns` inspection found `scenes_sceneversion` but no
`scenes_syncmutationreceipt` or `scenes_cloudbackupblobtransfer`. This is a
schema-verification failure despite the publish UI success. No production SQL
was written; the next action is the non-destructive log/retry path under #467,
followed by direct table and deployed-browser checks.

The documented non-destructive retry was then performed. It completed with a
second successful “Published your app” event and the published smoke check
passed again, but the same read-only `information_schema.columns` query still
showed no `scenes_syncmutationreceipt` or `scenes_cloudbackupblobtransfer`.
Deployment logs exposed release identity `edcd459` with successful
security/build/promotion stages and no migration error. Further retries are
stopped; escalation under #467 must use that release identity and the exact
missing-table evidence, with no direct production SQL.

## 2026-09-15 — Resolve #467 by synchronizing Replit's Git revision

Owner approved fast-forwarding GitHub `main` and importing it through Replit's
Git tab. The Replit workspace was stale at migrations `0062`; after Fetch/Pull,
Development-only migration applied `0063`, `0064`, and `0065` successfully.
The supported Republish flow completed as `f65b4223`, the published smoke check
passed, and read-only Production Database inspection confirmed both missing
tables plus `applied_scene_version_id`. Production startup migrations remained
disabled and no manual production SQL was used.

## 2026-09-16 (production-readiness + session-completion: full batch verified, one new gap)

Re-ran `production-readiness` after Codex closed the entire #534/#536/#542-#548
batch, independently re-verifying rather than trusting the closure record:
backend `1,319 passed/39 skipped`, frontend `229 files/2,682 tests passed`
(both match the batch's own last-recorded numbers), clean working tree,
production `https://augmentrart.com` healthy (`/health/` 200, anonymous
`/api/whoami/` 401, confirming #547's schema repair is live).

Found CI red on current `main` (`3b33e46`, run `35039206301`): `loginViaUI`
timed out in `e2e/projectLifecycle.spec.ts` even though the prior commit
(docs-only diff) was green, ruling out a code regression — a flake. This is
the identical symptom `qa-self-review` had already independently reproduced
locally earlier this session (`offlineSync.spec.ts` mobile viewport), and the
same symptom [#492](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/492)
was closed for after widening the same timeout to 15s with 10/10 and 40/40
repeat-run verification — that fix is still present but the flake still
recurs on different specs/viewports #492 never exercised. Filed as new
[#549](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/549) per
this repo's immutable-closed-issue rule rather than reopening #492. Durable
memory topic added:
`.agents/memory/login-flake-outlives-timeout-fix.md`.

No other gaps found. Readiness verdict: local **PASS**, full suite **PASS**,
Replit production **PASS**, CI **FAIL** (test-infrastructure flake, tracked
as #549, not a product defect and not blocking on the already-closed feature
work).

## 2026-09-16 (session-completion: batch rollup)

Ran `session-completion` over the #534/#536/#542-#548 batch (9 issues, all
closed) plus #549 (new). Reconciliation found two closed issues (#536,
#545) closed via a "Backlog-session reconciliation" comment describing
passing evidence rather than the qa-self-review skill's strict `## QA:
PASS` comment format — content is adequate (specific commits, viewports,
pass counts named), format deviation only, not reopened for it. #547 was
closed with **zero** GitHub comments explaining the fix (root cause,
production SQL repair, verification) — a real reconciliation gap, not just
a format one; posted a closure-reconciliation comment recovering that from
`docs/tasks.md` (GitHub comment 5690204222) so the record is complete
without reopening anything.

Full batch rollup, per-issue routing audit, and final verdict recorded in
the `session-completion` report returned to the user this turn. Missing-
terminal-status count: zero (all 9 processed issues + #549 have a recorded
status). No further reconciliation gaps found.

## 2026-09-16 (#549 engineering substitution and QA evidence)

The rostered Opencode Go Stage 2a implementation was unavailable through the
active browser tab after two bounded attempts. Continued as an explicit Claude
substitution; no Opencode result was represented as having run. Investigation
found the actual login-context defect: a reused Playwright context could
submit a stale Django CSRF form/cookie pair on its second login after cookie
clearing, producing a 403 that the helper surfaced later as a `Your projects`
heading timeout. `loginViaUI` now reloads the server-rendered login form and
stages readiness on the `/` redirect plus the page's authenticated
`/api/whoami/` response before retaining the Gallery assertion and Firefox
cookie-jar round trip. Focused 60-run Chromium evidence passed across the
affected project desktop/narrow loop and offline desktop/mobile cases; full
`make check` passed (backend 1,319 passed/39 skipped; frontend 229 files and
2,682 tests passed). Independent Stage 3 review was not run because the
rostered reviewer path was unavailable; QA used the issue's repeat harness
and repository checks directly.

## 2026-09-16 (qa-self-review + production-readiness: #549 CI-confirmed, backlog production-ready)

Re-ran `qa-self-review` on #549's self-closed fix rather than trusting its
`QA: PASS` claim: independently reproduced 64/64 across the two originally
affected specs plus the Firefox cookie-jar path, and matched `make check`'s
exact numbers. Root cause (stale CSRF token/cookie pair on a reused login
context) and fix (reload login form, wait for redirect + authenticated
`/api/whoami/` before the existing unweakened heading assertion) both hold
up under independent review.

Found that all evidence, including the original closure's own, was local
only — `main` was 4 commits ahead of `origin/main` and CI had never run
against the fix. Asked the owner before pushing (a shared-state action);
approved. Pushed `bdcb2a0` and watched CI run to completion: every job
green, including the previously-red "Browser acceptance E2E" job. This is
the first real CI evidence for #549.

`production-readiness` then found: zero open issues, all local suites
green, CI green on the pushed commit, and production (`augmentrart.com`)
healthy with #547's earlier schema fix still confirmed live. No blockers or
open follow-ups remain — the project is production-ready as of `bdcb2a0`.

## 2026-09-18 (owner-authorized GPT-5 production-readiness substitution)

The owner explicitly authorized the active Codex/GPT-5 runtime to run the
production-readiness and session-completion gates when the rostered Claude
Opus 5/Sonnet 5 tier is unavailable. This is a permitted, session-recorded
substitution rather than a change to the rostered owner: the actual
service/model/effort must be recorded in the backlog ledger, and the result
must never be represented as a Claude run. The governing dispatch contract,
production-readiness, backlog-session, and session-completion documents (and
their mirrored skills where present) were updated together.

## 2026-09-19 (final backlog/session completion for #622, #633, #634, #635)

The owner-authorized GPT-5 runtime ran the final production-readiness and
session-completion gates as an explicit substitution for the rostered Claude
Opus/Sonnet tier. All four manifest issues are terminal and closed: #634
security remediation, #633 production reference import, #622 published
canonical route evidence, and #635 CI feedback optimization. Stage 3
second-opinion review was not run and remains explicitly recorded as not run,
not implicitly covered by QA.

Readiness evidence is separated by boundary: local full backend/frontend
checks passed; CI run `35444460681` on `4fd39f8` passed backend, frontend,
workflow, browser acceptance, and disposable routing jobs; the promoted
production route exposes the owner-only edit URL and slug-based immersive URL;
anonymous access omits editing; and `scripts/smoke-published.sh` passed
against `https://augmentrart.com`. No open issues or unlinked actionable
follow-ups remain in the reconciled manifest.

## 2026-09-21 — Readiness/completion pass and #700 handoff
Claude Sonnet 5 / Medium ran the stage-5 gate and session completion on the
rostered tier. #700 was implemented directly by Sonnet 5 (flagged substitution
for the rostered stage 2b service; no second-opinion review). Production HTML
lacked server-rendered metadata; local fixes shipped in `a7ff330`; verification
of the production cause requires an owner Replit Publish and server log read.

## 2026-09-21 — #701 provenance reconciled by owner statement
Owner stated that stages Claude did not run were run by Codex. Recorded in
`docs/tasks.md` for #636, #641, #655, #692–#695: Codex/GPT-5 for implementation
and QA (and scoping for #636/#641), Claude Sonnet 5/Medium scoping for the
others, no second-opinion review. Effort values are unrecoverable and accepted
as a documented gap. The owner asked to wait on Replit Publish; #702 stays
handed-off.
## 2026-09-22 — #724 shared parity theme system closed

#724 completed the shared admin/account design contract in commits `c6bf366`
and `46e540c`. The owner-authorized Codex/GPT-5 runtime performed the Stage 2b
implementation and Stage 4 QA as explicit substitutions for unavailable rostered
services; Stage 3 second opinion was not run and is recorded as such. QA found
two in-scope fixes (separate readable body and script heading fonts, plus stable
preview accessible names), then reran focused tests, the full frontend suite,
rebuilt Compose images, and the fixed-viewport Chromium scenarios. The QA
verdict was posted through the authenticated active Chrome session and #724 was
closed. Evidence remains local disposable Compose only; production publication
is not claimed. #725 is the next transaction.

## 2026-09-22 — #725 AI theme generation workflow closed

#725 completed in `3d14f81` after #724. The owner-authorized Codex/GPT-5
runtime implemented and self-reviewed the bounded fake-provider workflow,
including persisted attempts, safe preview validation, revision-checked
accept/reject actions, and exact restoration of legacy style token shapes.
Focused checks passed (12 backend, 5 frontend), and `make check` passed with
1,508 backend tests plus 2,804 frontend tests. The requested Playwright
Chromium spec was listed and attempted, but the local macOS headless binary
could not launch because of its Mach port sandbox; this is recorded as host
setup evidence rather than a product failure. QA evidence was posted through
the authenticated active Chrome session and #725 was closed. No production
provider credentials or publication are claimed.

## 2026-09-22 — #721 create wording and shell spacing closed

Reviewed pre-existing implementation commit `2a11de3` for #721. Focused
Create/Gallery/Templates tests passed 31/31, with frontend typecheck and
format checks also passing. The QA self-review was posted through the
authenticated active Chrome session and the issue was closed. The change is
UI-only; no production data mutation was required.

## 2026-09-22 — #720 unified gallery closed

Reviewed existing implementation commits `9dc300d` and `7fc48f2` for #720.
Focused Gallery/PublicGallery tests passed 45/45, with frontend typecheck and
format checks also passing. The QA self-review was posted through the
authenticated active Chrome session and the issue was closed. The change is
UI-only and preserves owner scoping, card actions, creation actions, and
public filter behavior.

## 2026-09-22 — #714 profile alignment closed

Reviewed existing implementation commit `0641f71` for #714. Focused
PublicProfile tests passed 11/11, with frontend typecheck and format checks
passing. Existing fixed-viewport Chromium evidence covered desktop and mobile
alignment/no-overflow scenarios. The QA self-review was posted through the
authenticated active Chrome session and the issue was closed.

## 2026-09-22 — #719 Project3D thumbnail backfill closed

Reviewed existing commits `151e61d`, `2b91e26`, and `019533a` for #719.
Focused backend/API/renderer tests passed 33/33 and Project3DCard tests passed
14/14, with frontend typecheck and format checks also passing. Existing
independent production evidence confirmed radial sphere shading. The QA
self-review was posted through the authenticated active Chrome session and the
issue was closed; no additional production mutation was performed.

## 2026-09-22 — #713 mobile header closed

Reviewed existing implementation commit `e4f05a6` for #713. Focused Layout
tests passed 18/18, with frontend typecheck and format checks passing.
Existing fixed-viewport Chromium evidence covered 375px and the 768px
boundary. The QA self-review was posted through the authenticated active
Chrome session and the issue was closed.

## 2026-09-22 — #712 Celestial default closed

Reviewed existing commits `700c2b2`, `c6bf366`, and `46e540c` for #712.
Focused backend theme/profile tests passed 29/29, with frontend typecheck and
format checks passing. Existing fixed-viewport style evidence covers the
Celestial default, readable serif body text, cosmic backdrop, reduced motion,
and mobile/desktop shell behavior. The QA self-review was posted through the
authenticated active Chrome session and the issue was closed.

## 2026-09-22 — Compose browser gates closed #703, #705–#711, #715

The owner-authorized Codex/GPT-5 runtime resolved the earlier local Chromium
launch limitation by running the repository-owned Compose-backed Chromium
scenarios. `pieceStageSizing.spec.ts` passed 1/1; the combined fill, toolbar,
and card-thumbnail run passed 4/4; and `publicDraw.spec.ts` passed 1/1 across
regular/immersive desktop and touch-sized scenarios. Focused checks were also
recorded in each issue ledger. QA comments were posted through active Chrome
and the issues were closed. Stage 3 second opinion was not run, and no
production evidence is claimed.

## 2026-09-22 — #716 generated thumbnails closed after #723

#716's prior production blocker was the missing trusted-thumbnail data, not an
implementation defect. After the owner-only #723 refresh completed, the six
stable-marker reference pieces returned non-fallback thumbnails from the live
API and rendered artwork in gallery/profile surfaces. Focused security tests
passed 29/29; QA was posted through active Chrome and #716 was closed. Stage 3
second opinion was not run.

## 2026-09-22 — final verification boundary

The final `UV_CACHE_DIR=/tmp/codex-final-uv-cache make check` run passed action
pin checks, backend lint/format/typecheck/tests (1,508 passed, 39 skipped),
frontend lint/format/typecheck, and 2,803 of 2,804 frontend tests. One full-run
frontend test transiently timed out while waiting for the Tools region in
`EditorWorkspace.draftSyncError.test.tsx`; the focused rerun passed 4/4 in
4.34s without code changes. This is classified as a non-reproducible test
timing boundary, not an unresolved product defect.

## 2026-09-22 — production-readiness gate

The complete backlog has no remaining open GitHub issues. Local backend and
frontend checks, Compose browser verification, and the published #718 matrix
are recorded separately above. `UV_CACHE_DIR=/tmp/codex-final-uv-cache make
deploy-check` passes with five warnings from the development `.env`:
HSTS/SSL redirect, secure session/CSRF cookies, and DEBUG. These are a
deployment-configuration verification boundary, not evidence about the
published environment; production readiness is therefore not claimed from
this local gate. No new issue was created because the warnings are local
development configuration and no production defect was established.

## 2026-09-22 — #717 and #718 terminal published gates closed

#717's live diagnostic satisfied its explicit fallback criterion by naming the
sanitized `TypeError: fetch failed` cause while confirming middleware and
origin handling. #718's exact published design matrix then passed all 16
light/dark desktop/mobile cases across the four required routes. QA comments
were posted through active Chrome and both issues were closed. The remaining
deployment connectivity note from #717 is an owner operational follow-up,
outside that issue's contract; stage 3 second opinion was not run.

## 2026-09-22 — #727 production schema-diff outage resolved

The live `augmentrart.com` `/api/site-theme/` and `/api/public/gallery/` routes
returned HTTP 500 while `/health/` remained HTTP 200. Replit `main` matched
`origin/main` at `370c9d1c...`, so revision drift was ruled out. A supported,
non-destructive Republish completed as release `fc631d4e` but did not repair the
routes. Read-only Production Database inspection confirmed that the 0086 palette
columns are missing from `PublicProfile` and `SiteSettings`, and the 0088
`ThemeGenerationAttempt` table is absent; the 0087 seven-row `ProfileStyle` seed
is present. This was the documented missed schema-diff pattern. No direct
production SQL, destructive resolution, deployment-build change, or startup
migration was used. The repair added database defaults for the six new non-null
shared palette/presentation fields in `cb80b47`. Replit Development migrations
through 0089 passed, and the approved non-destructive schema diff published
release `14278c04`, creating `scenes_themegenerationattempt` and all six missing
columns without truncation or deletion. Read-only Production Database
inspection confirmed those invariants. `/api/site-theme/`,
`/api/public/gallery/`, and `/health/` all returned 200; active Chrome showed
the public gallery cards after retrying the stale error page. The published
smoke script's health check passed, while its already-tracked share-metadata
backend diagnostic still reports `TypeError: fetch failed`; that separate
diagnostic is not attributed to this outage. Evidence was posted to #727 and
the issue is ready to close.

## 2026-09-23 — implementation references and Replit host confirmed

The owner confirmed that piece-related work should use the local
`augment-humankind-react-node` repository as the React implementation
reference and the local `augment-humankind` repository as the functional
source of truth, including social sharing and prompt-to-product/output
workflows. The owner also identified `replit.com/@fornesus/creatrweb` as the
Replit project hosting this application. Its Git tab is linked to
`cfornesa/ai-dev-tools-zoomcamp-1`; a sync attempt after the reviewed push
reported `MERGE_CONFLICT`, so publication remains blocked until that workspace
state is reconciled and the exact reviewed commit is verified.

## 2026-09-24 — Stage toolbar: icon-only with desktop hover labels, reference order (#751)

The owner decided the piece stage toolbar is icon-only on all surfaces (regular, embed, immersive, ZIP exports) with a contextual hover/focus label on desktop and none on touch, and that the reference order (Screenshot, Immersive/VR, Sound, Piece controls, Download, Fullscreen, Hand guide) needs no further decision. This supersedes the labelled-button wording of closed #690/#694/#706 for new work. Implementation: #752-#756, #761. Cross-repo follow-ups filed in augment-humankind-react-node: #117 (ZIP toolbar), #118 (ZIP guide/reset), #119 (c2 interactive drawing).

## 2026-09-24 — C2.js canvas uses the reference 1280x720 (#759)

The owner decided C2.js and C2.js Interactive canvases use the reference dimensions, superseding the 320x240 rule in memory `c2-opaque-sandbox-rendering`. Implementation: #763 (live sandbox), #764 (ZIP); real c2 runtime #760.

## 2026-09-24 — Toolbar order follows PHP; A-Frame in scope; ink layers requested

The owner decided the stage toolbar order follows the PHP augment-humankind implementation where sensible: Screenshot, Download, Immersive/VR, Sound, Piece controls, Hand guide, engine-specific tools, Fullscreen last; icon-only with desktop hover labels. It supersedes the earlier react-node-order note in #751 and applies to augmenthumankind.com (restore) and to augmentrart.com private (owner) and public regular views, embeds, immersive, and downloads (ZIPs omit Download/Immersive). The owner also confirmed A-Frame must be implemented for structured 3D pieces (#772) and that both repos treat Three.js and A-Frame as required engines. A single ink layer with a frozen-scene edit mode across 2D and 3D was assessed as feasible and is tracked in #774-#777 (design decision first).

## 2026-09-24 — 3D drawings are flat plane assets (#774 closed; #778–#787)

The owner rejected screen-space and world-stroke ink for 3D. A manual drawing in a 3D piece is a flat plane object (a rectangle-only drawing reads as a flat plane; multi-colour shapes allowed) authored in a frozen-scene Draw mode and treated as an asset: transformable, expandable, rotatable horizontally/vertically, and animatable manually or via AI prompts, on both Three.js and A-Frame. Assessed as feasible: scene3d already has a `plane` object; missing pieces are a drawing-content schema (#778), Three.js/A-Frame rendering (#779/#780), Draw mode (#781), manual transforms (#782), a per-object animation channel that scene3d lacks (#783), AI operations (#784), and viewer/immersive/ZIP surfaces (#785–#787). #777 was superseded.

## 2026-09-24 — Animation kinds, proportional expansion, contextual UX (#782–#784)

The owner confirmed animation kinds rotate, orbit, oscillate, and pulse (#783). Drawing-plane expansion is proportional by default; non-proportional stretch only on explicit request (contextual control or an AI prompt such as "elongate layer <name>") (#782, #784). Workspace UX principle: controls are contextual, grouped by task in familiar menus, with progressive disclosure so the default workspace stays focused; applied as acceptance to #775, #776, #781–#784.

## 2026-09-24 — Contextual selection UI for layers (#781–#783)

The owner approved a photo-editor-style interaction model for drawing planes and other selected objects: on-canvas handles (proportional scaling by default), a small anchored floating toolbar for common actions with one "More" overflow, an on-demand precise-values panel, nothing shown when nothing is selected, and never a modal dialog. Touch docks the toolbar at the bottom; full keyboard access required. Recorded as acceptance on #781, #782, #783.

## 2026-09-24 — Test cadence for the backlog session

The owner reported that a full check historically took hours. In this environment `make check` measures about 4-7 minutes, but to keep the session fast each issue runs focused unit tests, lint, typecheck, and only the Playwright specs for its surface; the full `make check` runs per cluster of related issues and at production readiness. Pre-existing e2e drift is repaired inside the issue that owns the surface, not by running the whole matrix.

## 2026-09-24 — "One ink layer" in structured 2D is one ink group (#775)

The scene model enforces one shape per layer (`duplicateLayerAssignment`, #142), so "many strokes in one ink layer" is realised as one reserved group (`ink-group`, named "Ink") whose children are the stroke `path` shapes; each stroke keeps the layer the invariant requires ("Ink stroke N"). This needs no schema change, no new shape type, and no migration, and every existing renderer, runtime, exporter, and thumbnail path already draws it. Trade-off: the layer panel lists one row per stroke under the Ink group, and the scene's shape/layer limits (200) bound the stroke count. The shared ink core (`frontend/src/ink/`: geometry, history, `InkEditor`) is reused by the 3D drawing-plane Draw mode (#781). Alternative rejected: a new `ink` shape type (about 25 touchpoints across three standalone runtimes, thumbnails, and both AI providers) — revisit only if the per-stroke layer rows prove unusable.

## 2026-09-24 — Generated 2D ink is a drawing document in version metadata (#776)

The generated-piece ink layer is the canonical `drawingDocument` (shared with 3D drawing planes, #778) stored at `ArtPieceVersion.generation_metadata["ink"]` — no migration, no source edits. Saving ink creates a new immutable version with identical source; source-only edits and AI refinements inherit the previous ink unless the request sets `ink` (or `null` to clear). It is composited by an injected, strictly sanitised `<svg id="art-piece-ink-overlay">` block (aligned to the artwork's letterboxed content rectangle) in the sandbox document and the ZIP; the sandbox stays `allow-scripts` (opaque origin). The #667 fixed-snippet buttons now open the ink editor (pen/rectangle/ellipse/line/eraser); a new "Edit source" button keeps the live source preview reachable. Known boundaries filed as follow-ups: gallery thumbnails and the ZIP screenshot of SVG pieces do not include ink.

## 2026-09-24 — 3D Draw mode reuses the ink core; unlit scenes get an ambient light (#781)

Draw mode on a `drawingPlane` mounts the shared `InkEditor` (the same core as the 2D ink layer) on a flat face-on surface at the drawing's own resolution (new planes: 1024x768, a 4 x 3 plane), with the stage hidden and frozen: object animation, orbit/zoom drag, fly keys, and hand steering are all held, so Confirm/Cancel returns to exactly the prior camera (asserted byte-for-byte on the rendered stage). Confirm writes `drawing.shapes` as one undoable scene edit. Because drawing planes use a lit material, adding the first drawing plane to a scene with no lights also adds a neutral ambient light (otherwise the drawing renders black). A-Frame stages are hidden but not paused during Draw mode.

## 2026-09-24 — Drawing-plane selection chrome and gesture model (#782)

Selecting a drawing plane (from the outline or by clicking it in the Three.js stage) shows on-canvas handles (move, rotate, four proportional corner handles, four stretch edge handles), a floating action toolbar anchored above the selection (Horizontal, Vertical, Flip, Animate, Draw, Precise, More → Duplicate/Reset transform/Delete) that docks to the bottom on stages <= 480px, and an on-demand precise panel (bottom sheet on phones); nothing renders when nothing is selected, and Escape (panel first, then selection, but never while the piece-controls menu is open) or a click on empty stage dismisses everything. Expansion is proportional by default (corner handle, `+`/`-`, precise panel with "Keep proportions" on); Shift+corner, an edge handle, or unticking the panel option stretches. A drag is a transient edit folded into ONE undo step. The Three.js stage now keeps the visitor's camera across scene edits while the authored camera is unchanged (previously every edit snapped it back). Boundary: the A-Frame stage has no handles yet (#796); precise edits there stay in the Inspector.

## 2026-09-24 — AI drawing-plane proposals: JSON Patch, proportional by default (#784)

3D AI edits stay JSON Patch proposals (allowlisted `/objects/...` paths, validated against the shared scene3d schema, reference-checked by id/name). The create and edit prompts now restate the whole drawingPlane and animation vocabulary (types, shape types, colour format, limits, the rotation presets `x = -90` flat / `x = 0` upright, animation kinds/axes) and tell the model to resize both dimensions by the same factor. The proportional rule is enforced server-side rather than trusted: `proportionalize_drawing_plane_patch` appends `replace` ops so a resize that touched one dimension, or both by different factors, lands proportional, unless `has_stretch_intent` sees an explicit phrasing (elongate, stretch, widen, squash, taller, ...). The edit request carries `Stretch requested: yes|no` (the non-proportional flag) for the model. `AI_PROVIDER=fake` understands five phrasings (add, expand, elongate, rotate horizontally/vertically, spin) so the flow is testable without a real model. An accepted proposal selects the affected plane (the #782 handles/toolbar are then available) and Undo steps back to the pre-proposal scene as an unsaved working-copy edit. `AiProject3DWorkspace` is only reachable through the legacy redirect now; the single 3D editor hosts the AI panel. Selection chrome pauses a selected plane's animation at its authored pose so handles line up.

## 2026-09-24 — Structured 3D ZIPs: shared JS sources for the standalone runtime (#787)

The standalone Three.js runtime (`standaloneThreeRuntimeSource.ts`, a self-contained re-implementation) now draws `drawingPlane` textures and applies per-object animations offline. To avoid a third divergent copy of the maths, `drawingRaster.ts` exports `DRAWING_PAINTER_SOURCE` and `objectAnimation.ts` exports `ANIMATION_MATH_SOURCE` (plain-JS text embedded in the runtime); unit tests evaluate each against its TypeScript twin (a recording 2D context for the painter, `computeAnimatedTransform` for the maths) so they cannot drift. A-Frame exports already carry the plane as an inline PNG asset plus the first-party animation component. Two latent export defects found by the new offline test and fixed here: the Three.js runtime's renderer lacked `preserveDrawingBuffer` (its screenshot button produced a blank PNG), and generated-art ZIPs for Three.js/A-Frame did not include the WebGL capture prelude (blank screenshots for A-Frame).

## 2026-09-24 — Owners read their own private structured pieces at the regular route (#790)

`PublicPieceBySlugView` now falls back, for the signed-in owner only, to their own non-deleted private 2D/3D project when no public record matches the slug, and returns `edit_url` for the owner on structured pieces (as generated pieces already did). Anonymous visitors and other users still get 404 (asserted per family), deleted pieces never resolve, and no serializer changed — the response is the same public payload the stage already renders, so private and public pieces look and behave the same for the owner.

## 2026-09-24 — Selection chrome on the sandboxed A-Frame stage (#796)

The A-Frame stage stays an opaque-origin `allow-scripts` iframe. An editor-only script (never in public, immersive, or exported markup) reports the camera matrix/fov/canvas size and stage clicks over the existing versioned bridge; the parent rebuilds a Three.js camera, projects the plane with the same maths as the Three.js stage, and picks planes by point-in-projected-quad. During a handle drag the stage keeps its last render (`holdRender`) and reloads once on release; a selected plane's animation holds at its authored pose. Limits: the sandbox reloads on each committed edit (its camera view resets), and only drawing planes are click-selectable on this stage.

## 2026-09-24 — Fork ensures the visitor's profile handle (#749)

Triage of #749: responsiveShell, drawioPublicSurfaces, and aiAndRecovery already pass (earlier toolbar/create-flow repairs); publishingAndRemix had four test-only drifts (inline public stage toolbar, the title heading is now an h1, the render-failure fixture must also corrupt the canonical resolver payload, the fork lands on the canonical editor route) plus one real defect: a visitor who has never loaded their account profile has no handle, so forking ended on "Editor unavailable". The fork handler now loads the account profile (which creates the handle) before navigating.

## 2026-09-24 — Independent slug; old slugs hard-404 (#750)

Owner decision (asked in session): after a slug change the old URL is a hard 404, with no redirect table and no migration. `public_slug` is an optional field of the 2D and 3D metadata PATCH (declared free-text, normalised, non-empty, unique per owner including soft-deleted rows) and is returned by the project serializers; `ArtPiece` already supported it. A shared `PieceSlugField` (own Save button, explicit "old links will stop working" warning, collision message) is in the 2D Details panel, a 3D "Web address" disclosure, and the generated-piece editor; saving navigates the editor to the new address. Titles never touch the slug.

## 2026-09-24 — External-repo parity distillation

Added #807, #798–#806 (new issues only; no closed issue reopened). Star field implemented first-party CSS/React, not theme JS. Claude Sonnet 5 / Medium ran distillation. Production verification #806 stays owner/Codex-gated.

## 2026-09-24 — Production importer reconciliation boundary (#788/#808)

The authorized production reference import was run exactly once. Replit logged the six marked pieces, but C2.js and C2.js Interactive remained on their snapshotted version-1 fixed-coordinate sources, so #788 is QA FAIL and stays open. No rollback was needed because the snapshot was unchanged, and no second production data action is authorized in this session. #808 adds source comparison, dry-run update reporting, immutable next-version creation, and idempotence coverage; it is locally green and production re-import remains a new-owner-authorization follow-up.

## 2026-09-24 — Browser evidence boundary for #807

#807's first-party cosmic star field implementation and focused tests are committed as `d0819d0`. Compose preflight and local checks pass, but the required Playwright Chromium launch fails on this macOS host at the OS Mach-port permission boundary; the issue remains open until a real browser runner supplies the two viewport screenshots and animation-delta evidence.
