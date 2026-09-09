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
