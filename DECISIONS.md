# DECISIONS.md

Append-only log of agent-relevant decisions. See `AGENTS.md` Section 10 for
ownership and read cadence.

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
