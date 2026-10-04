# Codex handoff — unblock CI and clean up the E2E suite (2026-10-03)

**Audience:** this file is read by Codex directly (the owner points Codex at this path). Everything from "Role and repository" to "How you can support the owner" is the instruction set. The last section is the owner's goal checklist.

---

## Role and repository

You are working in `cfornesa/ai-dev-tools-zoomcamp-1` (Django + React/Vite, local and Replit deployments) on branch `docs/backlog-reevaluation-2026-09-27` (PR #1094 into `main`). The owner is not a CI specialist: explain anything that needs their hands in plain steps, with exact commands.

**Known uncommitted files (not a blocker).** `.local/tasks/backlog-session-2026-10-02-batch19.md` and `docs/tasks.md` carry uncommitted edits from an earlier Codex session (batch-19 ledger and task updates, e.g. run 37081997610 and the #1138/#1156 closures). They are expected. Leave them exactly as they are: never `git add -A`, `git commit -a`, stash, reset or discard them, and stage only the files your own change touches (`git add <path>`; for `docs/tasks.md`, stage only your own hunks with `git add -p`, or leave it and tell the owner). Any *other* unexpected modified file, or any change to those two files you did not make, is still a stop-and-ask.

**Step 0 — confirm the branch before anything else.** Run `git branch --show-current` and `git log --oneline -3`. The expected branch is `docs/backlog-reevaluation-2026-09-27` and its latest commits include "docs: add Codex handoff for CI unblock and E2E cleanup" (and the branch is ahead of `origin` by unpushed commits). If you are on any other branch (for example `main`), or if those commits are missing, **stop and tell the owner**: do not switch branches, fetch, reset or recreate commits on your own. If you are running in a remote sandbox that only has the pushed code, say so: you cannot see unpushed work.

**Read first, in this order:** `AGENTS.md`, `.agents/memory/MEMORY.md` (and the topics it links that touch E2E, Replit and git safety), the top entries of `DECISIONS.md`, `docs/process.md` (sections "Canonical batch transaction" and "CI tiers and E2E suite standards"), `docs/ci-failure-map-run1126.md`, `docs/e2e-suite-audit.md`, and the GitHub issues named below (their bodies are the source of truth).

**Situation in one paragraph.** The PR check that blocks merging is `Browser acceptance E2E (shard 1)`; it fails on exactly two tests, both in `frontend/e2e/authPolicy.spec.ts` (#1179). The 16-shard browser matrix is **advisory** (owner decision): it fails daily on 120 mostly stale tests (not flaky), is mapped to child issues, and will be made quiet by a known-failure ratchet (#1190). `main` has no branch protection and no green run in 100 runs.

## Standing rules (they bind every task below)

1. **Batch process.** Issues stay atomic; implement them as a batch in the order below, **one commit per issue**, then run the batch gate (the union of each issue's focused checks, the full `make check`, and a re-check of every shared surface in `docs/process.md`'s impact matrix). Keep a batch ledger in `.local/tasks/` and update `docs/tasks.md` / `DECISIONS.md`. Do **not** close issues: post a `## QA` criterion matrix comment with exact commands and results and leave closure to the reviewing agent (Claude) after the gate.
2. **Separation of duties.** Claude scoped these issues; you implement them. Do not QA your own diff as final; record provenance (`service / model / effort`, `track: mixed`) for every stage.
3. **No weakening.** Never delete, skip, `fixme`, tag-out, retarget or loosen a test or assertion to get green. If an assertion has no equivalent in the current UI, stop and quote it for the owner (the #1109 "stop rule"). If first-cause evidence shows a **product** defect, stop and file or link a product issue.
4. **Discovery gate.** A new actionable finding gets a criterion-ready GitHub issue **and** a concise `docs/tasks.md` entry (both, linked) in milestone "Batch 14: matching-ref CI stabilization (2026-09-30)"; do not implement it in this run.
5. **Shared working tree.** Other agents may have uncommitted edits (`docs/tasks.md`, `DECISIONS.md`, `.local/`). Run `git status` first. Commit only your own files. For `docs/tasks.md` and `DECISIONS.md`, stage only your own block: write `HEAD`'s file plus your block to a temp file, `git hash-object -w` it, `git update-index --cacheinfo 100644,<hash>,<path>`, then append the same block to the working copy.
6. **No new dependencies.** Node scripts must use built-ins only (`node:test`, `node:fs`).
7. **Authorizations.** You may edit `.github/workflows/ci.yml` **only** for #1190 and #1191, limited to the full-suite step, the JSON reporter, the summary step and the stale "327 minutes" comment: no new jobs, triggers, matrix or secrets, and the PR/push smoke behavior stays byte-identical. You are **not** authorized to push, dispatch workflows, merge, change branch protection, delete specs, or edit `AGENTS.md`.
8. **Evidence.** Closure evidence is Linux CI. On macOS, Playwright's Chromium may fail at launch (Mach-port permission); try unsandboxed, otherwise record the boundary. Docker may be unavailable. Label local results "local" and never claim Linux evidence you did not see.

## Work order

### Wave 0 — unblock the PR gate (do first, alone)
**#1179** `authPolicy.spec.ts` (2 tests). Facts: `:12` waits for the text `uses Google sign-in for new accounts.`, which #1127 replaced with provider-neutral guidance in `backend/templates/account/login.html`; `:23` (mobile) expects `body` `background-color: rgb(22, 23, 29)` but the page now paints its background on the themed root (#1124), so `body` is transparent. Fix the **assertions to the current contract** (quote the template copy; read the computed `--bg` background on the element that carries it, e.g. `html` or `.account-shell`), keep every Google-only account-creation policy assertion. Verify: `cd frontend && E2E_BASE_URL=http://localhost:5000 npx playwright test e2e/authPolicy.spec.ts --project=chromium` (needs the PostgreSQL stack and `E2E_FIXTURE_ENVIRONMENT`/`E2E_ENV_FILE` per `fixtureCommand.ts`), plus the PR smoke set: `e2e/authPolicy.spec.ts e2e/projectLifecycle.spec.ts e2e/publishingAndRemix.spec.ts e2e/responsiveShell.spec.ts`, then `npm run typecheck && npm run lint && npm run format:check`. Commit as `test(e2e): align auth policy expectations (#1179)`.

### Wave 1 — make the advisory matrix quiet and fast (one implementer, this order)
1. **#1190 ratchet.** `--reporter=list,json` on the full-suite step; a built-ins-only comparator `frontend/scripts/e2e-ratchet.mjs` with tests; baseline `frontend/e2e/known-failures.json` generated from `docs/ci-failure-map-run1126.md` (each entry: key `project|spec|full title`, owner issue, added date, expiry; 21 days, 7 for #1163/#1180). Evaluate only baseline entries whose test appears in the shard's report; fail on new failures, baseline entries that now pass, expired entries, entries without an issue. Prove the four cases with unit tests and a dry run on a downloaded `results.json` or the parsed run #1126 logs.
2. **#1191 fast-fail timeouts.** `actionTimeout` ~10 s and `navigationTimeout` ~20 s in `frontend/playwright.config.ts`; correct the stale comment. The "two consecutive full runs show no new failures" criterion needs the owner's dispatches (see the owner section); until then report it as pending.
3. **#1194** (docs, independent, may run in parallel): `frontend/e2e/support/README.md` documenting every exported helper, deprecated legacy helpers, recipes, stale patterns; link it from `docs/process.md` standard 2.

### Wave 2 — migration children, as batches grouped by shared files (after Wave 1)
Work each group as one batch with one gate; every child's commit also **removes its entries from `known-failures.json`** (and lowers helper-allowlist counts once #1195 exists). Groups:
- **Account/shell:** #1160, #1161, #1162 (re-scoped: wait for `html[data-reduced-motion]`, poll the `:active` offset), #1179 (done), #1172, #1184.
- **Creation/setup family:** #1168, #1169, #1170 (shares `project3dLifecycle.spec.ts`), #1166 then #1187 (the shim removal, last).
- **Stage and toolbar geometry:** #1188, #1189 (product CSS, owner-decided: declared ratio on phones, tall stage only for `c2js-interactive`, toolbar below the stage) then #1175, #1177 (bisect first), #1178, #1176.
- **Profile and publication:** #1164 first, then #1165, #1173, #1174.
- **Security and authorization checks (do not batch with others; report immediately):** #1163, #1180.
- **Diagnosis-first:** #1171, #1185, #1186, #1181, #1182, #1183.

Defer **#1193** (class F audit) and **#1195** (helper-use check).

## Report format (per issue, then per batch)
Commit hash; files changed; exact commands run and their outputs (counts, failures, skips); criterion matrix PASS/FAIL; baseline entries removed; provenance line; newly discovered issues (number, tasks.md entry); anything that needs the owner. Finish with the batch gate result and what remains open.

## How you can support the owner (do this in plain language; do not run it for them)
The owner is unsure how to do the following. Prepare short, copy-pasteable instructions and a checklist, and answer follow-up questions:
1. **Push the branch** (needed before CI can run on it): confirm the remote with `git remote -v`, show `git status` and `git log origin/docs/backlog-reevaluation-2026-09-27..HEAD --oneline | wc -l`, then give `git push origin docs/backlog-reevaluation-2026-09-27` (no `--force`; if the push is rejected, explain why and stop).
2. **Run the full matrix on the branch:** GitHub → Actions → CI → "Run workflow" → branch `docs/backlog-reevaluation-2026-09-27`; or `gh workflow run CI --ref docs/backlog-reevaluation-2026-09-27` and `gh run watch`. Explain that it takes ~25 minutes and that a failing-but-baselined run should be green once #1190 is in.
3. **Read a CI result:** `gh run view <id> --json jobs --jq '.jobs[]|[.name,.conclusion]|@tsv'`; the ratchet summary is in the job summary; the diagnostics artifact is `browser-e2e-diagnostics`.
4. **Merge PR #1094** once `Workflow validation`, `Backend checks`, `Frontend checks` and `Browser acceptance E2E (shard 1)` are green. Recommend a **merge commit** (keeps the per-issue commits as the restoration path); the owner chooses.
5. **Branch protection (#1192):** GitHub → Settings → Branches → Add rule for `main`: require a pull request; require status checks `Workflow validation`, `Backend checks`, `Frontend checks`, `Browser acceptance E2E (shard 1)` (confirm the exact names in the PR's check list); do **not** require the other 15 shards or any scheduled or dispatched run.
6. **Decision sheet:** a one-page table of the 20 "E?" rewrite-or-retire candidates in `docs/e2e-suite-audit.md` with a recommended default of **rewrite**, and the PR-smoke widening proposal (the three offline specs), for the owner to answer yes/no per row.

If a requirement is ambiguous or a step would break a rule above, stop and ask the owner one short question instead of guessing.

---

## Owner reference: goals to set, one at a time

*This section is the owner's checklist; Codex does not set or change goals itself. Each fenced prompt is complete and can be pasted as is, in order.*

### 1. Wave 0 — PR gate (set first)

```text
Read docs/handoffs/codex-ci-unblock-2026-10-03.md in full, follow its Step 0 branch check and its Standing rules, then do this.

Goal: finish #1179 so the PR's "Browser acceptance E2E (shard 1)" check can pass.

Scope: only frontend/e2e/authPolicy.spec.ts (2 tests) and any helper it needs.
1. Read #1179 and its "Distillation refinement" section, then backend/templates/account/login.html and the two failing tests.
2. Fix the assertions to the current contract: quote the current login copy instead of "uses Google sign-in for new accounts."; for the mobile test, read the computed background on the element that carries the themed --bg (html or .account-shell), not body. Keep every Google-only account-creation policy assertion.
3. Run: cd frontend && E2E_BASE_URL=http://localhost:5000 npx playwright test e2e/authPolicy.spec.ts --project=chromium; then the PR smoke set (e2e/authPolicy.spec.ts e2e/projectLifecycle.spec.ts e2e/publishingAndRemix.spec.ts e2e/responsiveShell.spec.ts); then npm run typecheck && npm run lint && npm run format:check. If the local PostgreSQL stack is unavailable, say exactly which command could not run and why.
4. One commit: "test(e2e): align auth policy expectations (#1179)". Post the ## QA criterion matrix on #1179.
Stop after reporting. Do not start any other issue.

Ground rules: do not push, dispatch workflows, merge, or close issues. Two files carry expected uncommitted edits from an earlier Codex session: .local/tasks/backlog-session-2026-10-02-batch19.md and docs/tasks.md. Do NOT stop for them. Leave them as they are, never use git add -A or git commit -a, never stash, reset or discard, and stage only the paths you changed (git add <path>; for docs/tasks.md stage only your own hunks with git add -p). Stop and ask me only if: you are on the wrong branch, some other file is modified that you did not change, an action would delete or overwrite work, or the work would touch production data or secrets. For any other ambiguity, choose the conservative option, record the choice in your report, and keep going.
```

### 2. Security and authorization checks

```text
Read docs/handoffs/codex-ci-unblock-2026-10-03.md in full, follow its Step 0 branch check and its Standing rules, then do this.

Goal: diagnose #1163 and #1180 and report immediately.

1. Read both issues and their refinement sections.
2. For #1163, capture every script element on the affected page and which generator emits it. For #1180, capture what a non-owner sees at the owner editor URL, including HTTP status codes and visible controls.
3. Post the evidence as a comment on each issue.
4. Fix only if the cause is test-side and safe. If any owner content or write control is reachable by a non-owner, or any fixture content reaches the extra script, stop at once, file a P0 issue (milestone assigned, matching docs/tasks.md entry) and report to me before doing anything else. This is the one finding that must always stop the run.
5. Do not batch these with any other issue.

Ground rules: do not push, dispatch workflows, merge, or close issues. Two files carry expected uncommitted edits from an earlier Codex session: .local/tasks/backlog-session-2026-10-02-batch19.md and docs/tasks.md. Do NOT stop for them. Leave them as they are, never use git add -A or git commit -a, never stash, reset or discard, and stage only the paths you changed (git add <path>; for docs/tasks.md stage only your own hunks with git add -p). Stop and ask me only if: you are on the wrong branch, some other file is modified that you did not change, an action would delete or overwrite work, or the work would touch production data or secrets. For any other ambiguity, choose the conservative option, record the choice in your report, and keep going.
```

### 3. Wave 1 — quiet and fast matrix

```text
Read docs/handoffs/codex-ci-unblock-2026-10-03.md in full, follow its Step 0 branch check and its Standing rules, then do this.

Goal: make the full 16-shard matrix advisory and quiet, per the Wave 1 section of the handoff.

One commit per issue, in this order:
1. #1190 known-failure ratchet: --reporter=list,json on the full-suite step; built-ins-only frontend/scripts/e2e-ratchet.mjs with unit tests; baseline frontend/e2e/known-failures.json generated from docs/ci-failure-map-run1126.md (key project|spec|full title, owner issue, added date, expiry: 21 days, 7 for #1163 and #1180). Evaluate only baseline entries whose test appears in the shard's report. Fail on new failures, baseline tests that now pass, expired entries, and entries without an issue. Prove all four cases with unit tests plus a dry run against a downloaded results.json or the parsed run #1126 logs. Edit .github/workflows/ci.yml only as far as #1190 and #1191 authorize: no new jobs, triggers, secrets, or permissions.
2. #1191 fast-fail timeouts: actionTimeout about 10 s and navigationTimeout about 20 s in frontend/playwright.config.ts; correct the stale 327-minute comment. Report the "two consecutive full runs show no new failures" criterion as pending the owner's dispatches.
3. #1194 frontend/e2e/support/README.md documenting every exported helper, deprecated legacy helpers, recipes and stale patterns; link it from docs/process.md standard 2.
Run make check before reporting. Post a ## QA matrix on each issue and list the owner dispatches still needed.

Ground rules: do not push, dispatch workflows, merge, or close issues. Two files carry expected uncommitted edits from an earlier Codex session: .local/tasks/backlog-session-2026-10-02-batch19.md and docs/tasks.md. Do NOT stop for them. Leave them as they are, never use git add -A or git commit -a, never stash, reset or discard, and stage only the paths you changed (git add <path>; for docs/tasks.md stage only your own hunks with git add -p). Stop and ask me only if: you are on the wrong branch, some other file is modified that you did not change, an action would delete or overwrite work, or the work would touch production data or secrets. For any other ambiguity, choose the conservative option, record the choice in your report, and keep going.
```

### 3b. Repair the CI regressions from #1190 (done: commit 55dca9d2; kept for reference)

```text
Read docs/handoffs/codex-ci-unblock-2026-10-03.md in full, follow its Step 0 branch check and its Standing rules, then do this.

Goal: make PR #1094's required checks green again by repairing two regressions introduced by your own #1190 commit 17f077e1. I reported the evidence as a comment on #1190. They are NOT pre-existing and NOT out of scope: a failure caused by your own commit belongs to that commit's issue. Never call a failure pre-existing without checking git log and the base commit first.

1. Backend: backend/tests/test_browser_qa_configuration.py::test_ci_runs_the_full_browser_acceptance_suite_and_uploads_diagnostics asserts the literal `run: npm run test:e2e`, which your workflow edit removed (it is now a `run: |` block). Keep the test's intent (the full browser suite runs on dispatch/schedule and diagnostics are uploaded) and update the assertions to the new workflow shape, including the `--reporter=list,json` run and the `node scripts/e2e-ratchet.mjs` ratchet step. Do not weaken it to a bare existence check.
2. Frontend: Vitest picks up frontend/scripts/e2e-ratchet.test.mjs and fails on `node:test`. Exclude frontend/scripts/** from Vitest in frontend/vite.config.ts, and run those tests with `node --test` through a new package.json script that is part of `npm test` (so `make check` and CI still run them). No new dependency. Prove the ratchet's four cases still run and pass.
3. Run, and record the output of: cd backend && uv run pytest tests/test_browser_qa_configuration.py; cd frontend && npm test; then make check from the repo root. All three must pass before you commit. A failure you cannot fix within these two items: stop and report it.
4. One commit: "fix(ci): repair backend workflow assertion and ratchet test runner (#1190)". Post the refreshed ## QA matrix on #1190 and a short note on #1096. Do not close issues.
5. Do not push. If your first goal run pushed the branch, tell me what instruction led to it. I will push and dispatch checks myself.

Ground rules: do not push, dispatch workflows, merge, or close issues. Two files carry expected uncommitted edits from an earlier Codex session: .local/tasks/backlog-session-2026-10-02-batch19.md and docs/tasks.md. Do NOT stop for them. Leave them as they are, never use git add -A or git commit -a, never stash, reset or discard, and stage only the paths you changed (git add <path>; for docs/tasks.md stage only your own hunks with git add -p). Stop and ask me only if: you are on the wrong branch, some other file is modified that you did not change, an action would delete or overwrite work, or the work would touch production data or secrets. For any other ambiguity, choose the conservative option, record the choice in your report, and keep going.
```

### 4. Wave 2A — account and shell

```text
Read docs/handoffs/codex-ci-unblock-2026-10-03.md in full, follow its Step 0 branch check and its Standing rules, then do this.

Goal: fix the account/shell E2E failures as one batch.

Issues: #1160, #1161, #1162 (re-scoped: wait for html[data-reduced-motion] and poll the :active offset instead of asserting a fixed value), #1172, #1184. #1179 is already done.
1. Write the batch impact analysis first (all open issues, not only these) and record it in the batch ledger.
2. One commit per issue. Each commit also removes that issue's entries from frontend/e2e/known-failures.json.
3. Run the union of the focused specs plus responsiveShell, headerMobile, publicShell, accountShell and accountThemeParity, then make check.
4. Post a ## QA matrix on each issue and the batch gate result. Do not close issues.

Ground rules: do not push, dispatch workflows, merge, or close issues. Two files carry expected uncommitted edits from an earlier Codex session: .local/tasks/backlog-session-2026-10-02-batch19.md and docs/tasks.md. Do NOT stop for them. Leave them as they are, never use git add -A or git commit -a, never stash, reset or discard, and stage only the paths you changed (git add <path>; for docs/tasks.md stage only your own hunks with git add -p). Stop and ask me only if: you are on the wrong branch, some other file is modified that you did not change, an action would delete or overwrite work, or the work would touch production data or secrets. For any other ambiguity, choose the conservative option, record the choice in your report, and keep going.
```

### 5. Wave 2B — creation and setup, including its product blockers (and publishing the branch)

```text
Read docs/handoffs/codex-ci-unblock-2026-10-03.md in full, follow its Step 0 branch check and its Standing rules, then do this.

Goal: publish the branch and clear PR #1094's required checks, then finish Wave 2B as one batch, including the product defects your first run found. This replaces your current blocked version of this goal.

State you reported: #1168 is committed; the #1190 repair is committed (55dca9d2) and unpushed; #1169, #1170 and #1166 are blocked by product issues #1225, #1226 and #1227; #1174 is blocked by the same footer layering as #1227. Your uncommitted spec edits in the working tree are your own earlier work: keep and continue from them, never discard them. The pending frontend/e2e/accountComponentStyles.spec.ts change belongs to Goal 4 (#1162): leave it uncommitted and untouched.

Owner permissions for this goal (they replace the generic "do not push" rule only as listed here):
- You may commit your own changes and push the current branch with a normal fast-forward push: `git push origin docs/backlog-reevaluation-2026-09-27`. Never force-push (not even --force-with-lease), never push another branch, a tag or main.
- If authentication fails, follow .agents/memory/github-https-credential-helper.md (an in-memory credential helper); never print, store or put the credential in a remote URL.
- If the local origin tracking-ref update fails on a lock-file permission error, that is a sandbox detail: confirm with `git ls-remote origin refs/heads/docs/backlog-reevaluation-2026-09-27` against `git rev-parse HEAD`.
- Read-only CI commands are allowed: `gh pr checks 1094`, `gh run list`, `gh run view`, `gh run watch`.
- NOT permitted: `gh workflow run`, `gh run rerun`, merging, closing issues, changing branch protection or repository settings. Dispatching the full matrix and merging stay with me.

Part A — publish and verify (do this first):
1. Push now. If the push is rejected, run `git fetch origin`, show me the divergence and stop; do not merge, rebase or reset.
2. Watch the pull_request run on the new head. Required checks: Workflow validation, Backend checks, Frontend checks, Browser acceptance E2E (shard 1).
3. If a required check is red: decide from the log and git history whether this branch caused it. If so, repair it in a follow-up commit under the owning issue, push, and watch again (at most two repair rounds, then stop and report). If it is genuinely pre-existing on the base, report it with evidence and do not fix it.
4. When all four are green, post the run URL and head SHA on #1096 and #1190 and tell me the PR is ready for me to merge. Then continue with Part B without waiting.

Part B — Wave 2B. Owner authorization (updated): #1225, #1226, #1227 and #1174 were filed or groomed before this run, carry a "Distillation refinement" comment, and are in scope. Product CSS and markup changes are allowed for these four issues only. Do not touch the generated-piece stage rules (#1175, #1188, #1189; Goal 7 owns them). Keep every existing assertion strict: no forced clicks, no weakened expectations. A failure caused by your own commit belongs to that commit's issue; never call a failure pre-existing without checking git history.
Order, one commit per issue, each with its restoration path (revert that commit):
1. #1227 first: fix the shared app-shell footer layering. Verify the refinement hypothesis first: in frontend/src/index.css the rule `.app-shell > :not(.cosmic-starfield):not(.shell-display-toggles):not(.skip-link) { position: relative; z-index: 1; }` gives #main-content and .app-shell-footer the same z-index, so the later footer paints over menus and dialogs inside main. Choose the smallest fix that keeps the footer visible. Then #1174, whose specs may need only their own expectation updates; if its disabled Publish button has a different cause, classify it and fix only test-side causes.
2. #1226: stop the decorative cosmic backdrop from creating horizontal overflow at 768px (verify the container's rule first; clipping the decorative container is the candidate). Reduced-motion and low-power behavior must not change.
3. #1225: public structured-3D toolbar placement (desktop fullscreen action right of the stage midpoint; phone toolbar must not cover the immersive touch D-pad or zoom buttons). Structured-3D routes only; relocate, never hide.
4. Then complete #1169, #1170 and #1166: finish their spec migrations, run the previously blocked cases, and remove their known-failures.json entries and #1168's, #1174's and these four product issues' entries as each case passes. Creation is local-first (IndexedDB, /local-projects/:id) and /ai-projects* redirect to the unified editor, so update tests to that contract. Rewrite stale specs to current behavior; never retire one without asking me. Do NOT remove the inert "Open piece controls menu" shim (#1187).
Write the batch impact analysis first, including Goal 7's open issues that touch index.css. For the CSS issues inspect screenshots at 375x812, 768x1024 and 1280x900 and describe what you saw. Run the union of focused specs plus responsiveShell, headerMobile, publicShell and the stage and toolbar regression specs, then make check. After the batch passes, push once more (same rules), confirm the PR checks are still green, and repair branch-caused failures the same way. Post a ## QA matrix on each issue and the batch gate result. Do not close issues. Stop after this goal; I will set Goal 6.

Report after Part A and again after Part B: head SHA, run URL, each required check's conclusion, anything repaired (commit, reason), and what remains.

Ground rules: do not dispatch workflows, merge, or close issues. Pushing is permitted only as described in this goal. Two files carry expected uncommitted edits from an earlier Codex session: .local/tasks/backlog-session-2026-10-02-batch19.md and docs/tasks.md. Do NOT stop for them. Leave them as they are, never use git add -A or git commit -a, never stash, reset or discard, and stage only the paths you changed (git add <path>; for docs/tasks.md stage only your own hunks with git add -p). Stop and ask me only if: you are on the wrong branch, some other file is modified that you did not change, an action would delete or overwrite work, or the work would touch production data or secrets. For any other ambiguity, choose the conservative option, record the choice in your report, and keep going.
```

### 5b. Baseline reconciliation and the helper README (after the owner's full-matrix dispatch)

```text
Read docs/handoffs/codex-ci-unblock-2026-10-03.md in full, follow its Step 0 branch check and its Standing rules, then do this.

Goal: reconcile frontend/e2e/known-failures.json with real Linux evidence and finish the one Wave 1 item still open.

State from the repository: commits already exist for #1160, #1161, #1162, #1163, #1166, #1168, #1169, #1170, #1172, #1174, #1179, #1180, #1184, #1190, #1191, #1225, #1226 and #1227 (all verified locally, Linux evidence pending); #1194 has no commit yet; #1228 is recorded but not implemented (Goal 7 owns it). The baseline still holds 49 entries: #1163 (5), #1164 (6), #1165 (2), #1166 (1, Firefox Draw.io, blocked by the host's Firefox build), #1171 (12), #1173 (4), #1175 (4), #1176, #1177, #1178, #1179 (2), #1180 (2), #1181, #1182 (2), #1183, #1185 (3), #1186.

1. #1194 first (docs only, no dependency): frontend/e2e/support/README.md documenting every exported helper (include the helpers added by #1168, #1169, #1170 and #1174), the deprecated legacy helpers, recipes and stale patterns; link it from docs/process.md standard 2. Acceptance and verification are in the issue. One commit, ## QA matrix.
2. Ask me for a full-matrix run ID only if I have not given you one in this goal's message. With a workflow_dispatch run ID for a head at or after the current branch head, read each shard's ratchet summary (`gh run view <id> --log` or the diagnostics artifacts) and produce a table: (a) baseline entries that now pass, (b) baseline entries that still fail, (c) failures not in the baseline, (d) expired or issue-less entries.
3. For (a): remove those entries in one commit per owning issue, citing the run URL; the ratchet is designed to fail when a baseline entry passes. For (b): leave them, with the issue link. For (c): classify each (test-side, product, environment); fix nothing here, file or reference issues (milestone, matching docs/tasks.md entry). Keep the #1166 Firefox Draw.io entry unless the Linux run shows it passing. The #1180 2D owner-flow entries stay until #1187 (Goal 15).
4. Without a run ID, do step 1 only and report that step 2 waits for my dispatch. Post a ## QA matrix on #1194 and a comment on #1096 with the reconciliation table.

Ground rules: do not dispatch workflows, merge, or close issues. Pushing is permitted only as described in this goal. Two files carry expected uncommitted edits from an earlier Codex session: .local/tasks/backlog-session-2026-10-02-batch19.md and docs/tasks.md. Do NOT stop for them. Leave them as they are, never use git add -A or git commit -a, never stash, reset or discard, and stage only the paths you changed (git add <path>; for docs/tasks.md stage only your own hunks with git add -p). Stop and ask me only if: you are on the wrong branch, some other file is modified that you did not change, an action would delete or overwrite work, or the work would touch production data or secrets. For any other ambiguity, choose the conservative option, record the choice in your report, and keep going.
```

### 6. Wave 2C — profile and publication

```text
Read docs/handoffs/codex-ci-unblock-2026-10-03.md in full, follow its Step 0 branch check and its Standing rules, then do this.

Goal: resolve the profile/publication E2E failures.

1. Start with #1164 (6 baseline entries): capture each failing request's HTTP 400 response body and classify the cause (test data, contract change, or product defect).
2. Then #1165 and #1173, which may be fixed by #1164 (#1174 moved to Goal 5 together with its product cause). Fix test-side causes. For any product cause, file a product issue (milestone, matching docs/tasks.md entry), leave its baseline entry in place with the issue link, and continue with the next issue; do not fix product code in this goal.
3. One commit per issue, each removing its known-failures.json entries. Run the focused specs and make check.
4. Post ## QA matrices and the batch gate result. Do not close issues.

Ground rules: do not dispatch workflows, merge, or close issues. You may commit your own changes and push the current branch with a normal fast-forward push (`git push origin docs/backlog-reevaluation-2026-09-27`) after a completed batch whose make check passed; never force-push, never push another branch, a tag or main; if authentication fails use .agents/memory/github-https-credential-helper.md and never print a credential; if a push is rejected, run `git fetch origin`, report the divergence and stop. After each push, watch the PR checks with read-only commands (`gh pr checks 1094`, `gh run watch`) and repair branch-caused failures in a follow-up commit (at most two rounds); never call a failure pre-existing without checking git history. Files left uncommitted by your earlier goals (the batch ledger under .local/tasks/, DECISIONS.md, docs/tasks.md, and frontend/e2e/accountComponentStyles.spec.ts while #1162 is open) are expected: commit only your own hunks and leave the rest. If you see any other modified file that you did not change, stop and ask. Never use git add -A or git commit -a, never stash, reset or discard, and stage only the paths you changed (for docs/tasks.md stage only your own hunks with git add -p). Stop and ask me only if: you are on the wrong branch, an unexpected file is modified, an action would delete or overwrite work, or the work would touch production data or secrets. For any other ambiguity, choose the conservative option, record the choice in your report, and keep going.
```

### 7. Wave 2D — stage and geometry

```text
Read docs/handoffs/codex-ci-unblock-2026-10-03.md in full, follow its Step 0 branch check and its Standing rules, then do this.

Goal: apply the owner-decided phone stage rule and clear the geometry failures.

Owner decisions (do not relitigate): at 701px and wider the stage uses the declared ratio (16:9 fallback, --art-piece-aspect-ratio); at 700px and narrower the toolbar sits below the stage; the tall stage min(70vh, 26rem) applies only to c2js-interactive pieces.
1. Implement #1188 then #1189 (product CSS), then #1175, then bisect and resolve #1177, #1178 and #1176, then #1228 (desktop display toggles over the unified editor AI prompt at 1280x900: reserve space in the editor panel on the editor routes only; keep #1158's fixed placement and its <=767px in-flow rule; see the refinement comment on #1228).
2. Serialize all edits to index.css; no parallel edits.
3. Inspect screenshots at 375x812 and 1280x900 for the changed surfaces and describe what you saw.
4. One commit per issue, each removing its known-failures.json entries. Run the focused specs, make check, and the existing stage and toolbar regression specs.
5. Post ## QA matrices and the batch gate result. Do not close issues.

Ground rules: do not dispatch workflows, merge, or close issues. You may commit your own changes and push the current branch with a normal fast-forward push (`git push origin docs/backlog-reevaluation-2026-09-27`) after a completed batch whose make check passed; never force-push, never push another branch, a tag or main; if authentication fails use .agents/memory/github-https-credential-helper.md and never print a credential; if a push is rejected, run `git fetch origin`, report the divergence and stop. After each push, watch the PR checks with read-only commands (`gh pr checks 1094`, `gh run watch`) and repair branch-caused failures in a follow-up commit (at most two rounds); never call a failure pre-existing without checking git history. Files left uncommitted by your earlier goals (the batch ledger under .local/tasks/, DECISIONS.md, docs/tasks.md, and frontend/e2e/accountComponentStyles.spec.ts while #1162 is open) are expected: commit only your own hunks and leave the rest. If you see any other modified file that you did not change, stop and ask. Never use git add -A or git commit -a, never stash, reset or discard, and stage only the paths you changed (for docs/tasks.md stage only your own hunks with git add -p). Stop and ask me only if: you are on the wrong branch, an unexpected file is modified, an action would delete or overwrite work, or the work would touch production data or secrets. For any other ambiguity, choose the conservative option, record the choice in your report, and keep going.
```

### 8. Wave 2E — diagnosis first

```text
Read docs/handoffs/codex-ci-unblock-2026-10-03.md in full, follow its Step 0 branch check and its Standing rules, then do this.

Goal: classify and resolve the remaining unexplained failures.

Issues: #1171, #1185, #1186, #1181, #1182, #1183.
1. For each, capture the first-failure evidence the issue requires (trace, log, or request), classify the cause as test-side, product, or environment, and post it on the issue.
2. Fix test-side causes (one commit each, removing baseline entries). For product causes, file a product issue (milestone, matching docs/tasks.md entry) and leave the baseline entry in place with its issue link.
3. End with a table: issue, cause, action, status.
4. Do not change gallery markup or behavior beyond what #1181 and #1182 require; Goal 9 (#1197) changes the same gallery code later.

Ground rules: do not dispatch workflows, merge, or close issues. You may commit your own changes and push the current branch with a normal fast-forward push (`git push origin docs/backlog-reevaluation-2026-09-27`) after a completed batch whose make check passed; never force-push, never push another branch, a tag or main; if authentication fails use .agents/memory/github-https-credential-helper.md and never print a credential; if a push is rejected, run `git fetch origin`, report the divergence and stop. After each push, watch the PR checks with read-only commands (`gh pr checks 1094`, `gh run watch`) and repair branch-caused failures in a follow-up commit (at most two rounds); never call a failure pre-existing without checking git history. Files left uncommitted by your earlier goals (the batch ledger under .local/tasks/, DECISIONS.md, docs/tasks.md, and frontend/e2e/accountComponentStyles.spec.ts while #1162 is open) are expected: commit only your own hunks and leave the rest. If you see any other modified file that you did not change, stop and ask. Never use git add -A or git commit -a, never stash, reset or discard, and stage only the paths you changed (for docs/tasks.md stage only your own hunks with git add -p). Stop and ask me only if: you are on the wrong branch, an unexpected file is modified, an action would delete or overwrite work, or the work would touch production data or secrets. For any other ambiguity, choose the conservative option, record the choice in your report, and keep going.
```

### 9. Batch 17 — public discoverability (after Goal 8; decision #1196 already made)

```text
Read docs/handoffs/codex-ci-unblock-2026-10-03.md in full, follow its Step 0 branch check and its Standing rules, then do this.

Goal: make the public site discoverable by crawlers (Batch 17, Muse AI finding). Run only after Goal 8 is done (the owner decided on #1196: server-side injection plus a noscript fallback, extending the #700 injection path; no prerender, SSR or new dependency).

Issues and order, one commit per issue (read each issue and `backend/scenes/llms.py` first; llms.txt is already generated per request and must not change behavior except under #1204):
1. #1199 generated /robots.txt and #1200 generated /sitemap.xml (reuse llms.py helpers and the eligible_* selectors; proxy in frontend/vite.config.ts like /llms.txt; update docs/api.md before the contract change).
2. #1201 unknown public URLs return 404 (verify on the production run path first; do not break deep links like /users/@handle/pieces/slug).
3. #1198 bounded loading state with timeout and retry in frontend/src/pages/PublicGallery.tsx.
4. #1197 crawlable /gallery content per the owner's choice in #1196 (privacy tests for private, unlisted, draft and soft-deleted pieces).
5. #1203 collections index and art-piece gallery listings, then #1202 the propagation guard test, then #1204 the llms.txt absolute-URL evaluation.
Verify with `curl` of rendered HTML without JavaScript against the local stack, the focused pytest and Vitest suites, the existing gallery E2E specs and the PR smoke set, then make check. If a new product defect or gap appears, file it (milestone, tasks.md entry) and continue. Post a ## QA matrix on each issue and the batch gate result. Do not close issues.

Ground rules: do not dispatch workflows, merge, or close issues. You may commit your own changes and push the current branch with a normal fast-forward push (`git push origin docs/backlog-reevaluation-2026-09-27`) after a completed batch whose make check passed; never force-push, never push another branch, a tag or main; if authentication fails use .agents/memory/github-https-credential-helper.md and never print a credential; if a push is rejected, run `git fetch origin`, report the divergence and stop. After each push, watch the PR checks with read-only commands (`gh pr checks 1094`, `gh run watch`) and repair branch-caused failures in a follow-up commit (at most two rounds); never call a failure pre-existing without checking git history. Files left uncommitted by your earlier goals (the batch ledger under .local/tasks/, DECISIONS.md, docs/tasks.md, and frontend/e2e/accountComponentStyles.spec.ts while #1162 is open) are expected: commit only your own hunks and leave the rest. If you see any other modified file that you did not change, stop and ask. Never use git add -A or git commit -a, never stash, reset or discard, and stage only the paths you changed (for docs/tasks.md stage only your own hunks with git add -p). Stop and ask me only if: you are on the wrong branch, an unexpected file is modified, an action would delete or overwrite work, or the work would touch production data or secrets. For any other ambiguity, choose the conservative option, record the choice in your report, and keep going.
```

### 10. Batch 18A — public MCP server

```text
Read docs/handoffs/codex-ci-unblock-2026-10-03.md in full, follow its Step 0 branch check and its Standing rules, then do this.

Goal: build the public, no-auth MCP surface (tracker #1207).

Owner decisions (do not relitigate; see #1205 and DECISIONS.md): the official `mcp` Python SDK, mounted in the existing Django ASGI app; the dependency is approved. Add it with `uv add mcp` (not by hand-editing pyproject.toml), record it in docs/dependencies.md including the AGENTS.md section 8 answer, and commit the lockfile with it. Use the SDK's FastMCP-style API (`mcp.server.fastmcp.FastMCP` with decorated tool functions), configured for stateless_http and JSON responses, and follow the hosting findings in the comments on #1210 and #1213. Do not add the separate `fastmcp` package; if you believe a feature of it is needed, file a decision issue instead. Confirm the current package version and API names against the installed package before relying on them.

Order, one commit per issue (read each issue first; update docs/api.md and openapi.yaml before any contract change):
1. #1210 MCP scaffold with the health tool.
2. #1211 public 2D tools and resources, then #1212 public 3D, generated-piece and collection tools (document the endpoints that openapi.yaml lacks first).
3. #1213 rate limiting and audit logging.
4. #1214 docs/mcp.md and the API docs.
Prove privacy gating with a fixture for each state (private, unlisted, draft, soft-deleted). Verify against the SDK's test client or a real MCP client, the focused pytest suites, and make check. Post a ## QA matrix on each issue and the batch gate result. Do not close issues.

Ground rules: do not dispatch workflows, merge, or close issues. You may commit your own changes and push the current branch with a normal fast-forward push (`git push origin docs/backlog-reevaluation-2026-09-27`) after a completed batch whose make check passed; never force-push, never push another branch, a tag or main; if authentication fails use .agents/memory/github-https-credential-helper.md and never print a credential; if a push is rejected, run `git fetch origin`, report the divergence and stop. After each push, watch the PR checks with read-only commands (`gh pr checks 1094`, `gh run watch`) and repair branch-caused failures in a follow-up commit (at most two rounds); never call a failure pre-existing without checking git history. Files left uncommitted by your earlier goals (the batch ledger under .local/tasks/, DECISIONS.md, docs/tasks.md, and frontend/e2e/accountComponentStyles.spec.ts while #1162 is open) are expected: commit only your own hunks and leave the rest. If you see any other modified file that you did not change, stop and ask. Never use git add -A or git commit -a, never stash, reset or discard, and stage only the paths you changed (for docs/tasks.md stage only your own hunks with git add -p). Stop and ask me only if: you are on the wrong branch, an unexpected file is modified, an action would delete or overwrite work, or the work would touch production data or secrets. For any other ambiguity, choose the conservative option, record the choice in your report, and keep going.
```

### 11. Batch 18B — security check and OAuth foundation

```text
Read docs/handoffs/codex-ci-unblock-2026-10-03.md in full, follow its Step 0 branch check and its Standing rules, then do this.

Goal: add per-user authorization for MCP (tracker #1208).

Owner decisions (do not relitigate; see #1206 and DECISIONS.md): django-oauth-toolkit is approved (add with `uv add django-oauth-toolkit`, record in docs/dependencies.md with the section 8 answer); clients are pre-registered only (no dynamic registration); scopes are `gallery:read`, `projects:write`, `ai:use` and a separately granted `destructive`; AI tools use the same quotas and entitlements as the web app.

1. #1215 first and alone: verify the access level of the 3D accept-proposal endpoint with tests for anonymous, non-owner and owner on both the 2D and 3D accept-proposal routes. The repository shows `x-access: owner` and a 404 for non-owners; record what the tests show and do not change the spec to match an outside report. If an anonymous write is possible, stop at once, file a P0 issue and report.
2. #1216 OAuth 2.1 provider (PKCE S256 only, exact redirect matching, pre-registered clients with an admin-only registration path, additive migrations), then #1217 bearer authentication, scope enforcement and the cross-user isolation test across every tool. Reuse backend/scenes/permissions.py; never bypass it.
One commit per issue. Run the focused tests, the full backend suite and make check. Post a ## QA matrix on each issue and the batch gate result. Do not close issues.

Ground rules: do not dispatch workflows, merge, or close issues. You may commit your own changes and push the current branch with a normal fast-forward push (`git push origin docs/backlog-reevaluation-2026-09-27`) after a completed batch whose make check passed; never force-push, never push another branch, a tag or main; if authentication fails use .agents/memory/github-https-credential-helper.md and never print a credential; if a push is rejected, run `git fetch origin`, report the divergence and stop. After each push, watch the PR checks with read-only commands (`gh pr checks 1094`, `gh run watch`) and repair branch-caused failures in a follow-up commit (at most two rounds); never call a failure pre-existing without checking git history. Files left uncommitted by your earlier goals (the batch ledger under .local/tasks/, DECISIONS.md, docs/tasks.md, and frontend/e2e/accountComponentStyles.spec.ts while #1162 is open) are expected: commit only your own hunks and leave the rest. If you see any other modified file that you did not change, stop and ask. Never use git add -A or git commit -a, never stash, reset or discard, and stage only the paths you changed (for docs/tasks.md stage only your own hunks with git add -p). Stop and ask me only if: you are on the wrong branch, an unexpected file is modified, an action would delete or overwrite work, or the work would touch production data or secrets. For any other ambiguity, choose the conservative option, record the choice in your report, and keep going.
```

### 12. Batch 18C — authenticated MCP tools

```text
Read docs/handoffs/codex-ci-unblock-2026-10-03.md in full, follow its Step 0 branch check and its Standing rules, then do this.

Goal: implement the authenticated tools (tracker #1208). Run only after Goal 11 finished #1216 and #1217; otherwise report and skip.

Owner decisions (do not relitigate): AI tools use the same quotas and entitlements as the web app; deletion ships in the first release behind the separately granted `destructive` scope.

Order, one commit per issue: #1218 2D projects and versions; #1220 AI tools (use AI_PROVIDER=fake in tests); #1221 3D mirror tools (expose the accept tool only because #1215 confirmed its access level); #1222 piece package intake; then #1219 destructive tools last (a `confirm` argument that must match the target, soft-delete semantics identical to the web UI, one audit row per call, restore path documented).
Every tool needs a contract test against its REST endpoint, a non-owner/not-found test and a scope test. Run make check. Post a ## QA matrix on each issue and the batch gate result. Do not close issues.

Ground rules: do not dispatch workflows, merge, or close issues. You may commit your own changes and push the current branch with a normal fast-forward push (`git push origin docs/backlog-reevaluation-2026-09-27`) after a completed batch whose make check passed; never force-push, never push another branch, a tag or main; if authentication fails use .agents/memory/github-https-credential-helper.md and never print a credential; if a push is rejected, run `git fetch origin`, report the divergence and stop. After each push, watch the PR checks with read-only commands (`gh pr checks 1094`, `gh run watch`) and repair branch-caused failures in a follow-up commit (at most two rounds); never call a failure pre-existing without checking git history. Files left uncommitted by your earlier goals (the batch ledger under .local/tasks/, DECISIONS.md, docs/tasks.md, and frontend/e2e/accountComponentStyles.spec.ts while #1162 is open) are expected: commit only your own hunks and leave the rest. If you see any other modified file that you did not change, stop and ask. Never use git add -A or git commit -a, never stash, reset or discard, and stage only the paths you changed (for docs/tasks.md stage only your own hunks with git add -p). Stop and ask me only if: you are on the wrong branch, an unexpected file is modified, an action would delete or overwrite work, or the work would touch production data or secrets. For any other ambiguity, choose the conservative option, record the choice in your report, and keep going.
```

### 13. Batch 18D — MCP Apps gallery widget

```text
Read docs/handoffs/codex-ci-unblock-2026-10-03.md in full, follow its Step 0 branch check and its Standing rules, then do this.

Goal: build the in-chat gallery widget (tracker #1209, issue #1223). Run only after Goal 10 is done.

1. First verify the current status of SEP-1865 and which clients support it, from primary sources, and record it in the issue; if the standard is not stable enough to build on, stop and report instead of guessing.
2. Build the UI resource using only the public tools, with the narrowest sandbox and CSP, and a text fallback. Verify in at least two supporting clients with screenshots; if no supporting client is available to you, say so and leave the issue unverified.
Run make check. Post a ## QA matrix and the batch gate result. Do not close issues.

Ground rules: do not dispatch workflows, merge, or close issues. You may commit your own changes and push the current branch with a normal fast-forward push (`git push origin docs/backlog-reevaluation-2026-09-27`) after a completed batch whose make check passed; never force-push, never push another branch, a tag or main; if authentication fails use .agents/memory/github-https-credential-helper.md and never print a credential; if a push is rejected, run `git fetch origin`, report the divergence and stop. After each push, watch the PR checks with read-only commands (`gh pr checks 1094`, `gh run watch`) and repair branch-caused failures in a follow-up commit (at most two rounds); never call a failure pre-existing without checking git history. Files left uncommitted by your earlier goals (the batch ledger under .local/tasks/, DECISIONS.md, docs/tasks.md, and frontend/e2e/accountComponentStyles.spec.ts while #1162 is open) are expected: commit only your own hunks and leave the rest. If you see any other modified file that you did not change, stop and ask. Never use git add -A or git commit -a, never stash, reset or discard, and stage only the paths you changed (for docs/tasks.md stage only your own hunks with git add -p). Stop and ask me only if: you are on the wrong branch, an unexpected file is modified, an action would delete or overwrite work, or the work would touch production data or secrets. For any other ambiguity, choose the conservative option, record the choice in your report, and keep going.
```

### 14. PR gate widening (#1224)

```text
Read docs/handoffs/codex-ci-unblock-2026-10-03.md in full, follow its Step 0 branch check and its Standing rules, then do this.

Goal: add the three offline core-journey specs to the blocking PR smoke set (issue #1224). Run only after #1179 is committed and `gh pr checks 1094` shows all four required checks green on the current head; otherwise report and skip.

1. Read #1224, docs/e2e-suite-audit.md "Owner decision B" and the `e2e-browser` job's pull_request path in .github/workflows/ci.yml.
2. Run offlineConflictResolution, offlineMediaTransfer and offlineSync locally on the PostgreSQL stack; if any fails, stop and report instead of adding it.
3. Edit only the PR smoke spec list in ci.yml (#1224 is the scoped authorization: no new jobs, triggers, secrets or permissions), update the CI-tier table in docs/process.md, run make check, one commit, post a ## QA matrix on #1224. Do not close it.
4. Remind me to dispatch a branch run to prove the wider shard 1 passes before merging.

Ground rules: do not dispatch workflows, merge, or close issues. You may commit your own changes and push the current branch with a normal fast-forward push (`git push origin docs/backlog-reevaluation-2026-09-27`) after a completed batch whose make check passed; never force-push, never push another branch, a tag or main; if authentication fails use .agents/memory/github-https-credential-helper.md and never print a credential; if a push is rejected, run `git fetch origin`, report the divergence and stop. After each push, watch the PR checks with read-only commands (`gh pr checks 1094`, `gh run watch`) and repair branch-caused failures in a follow-up commit (at most two rounds); never call a failure pre-existing without checking git history. Files left uncommitted by your earlier goals (the batch ledger under .local/tasks/, DECISIONS.md, docs/tasks.md, and frontend/e2e/accountComponentStyles.spec.ts while #1162 is open) are expected: commit only your own hunks and leave the rest. If you see any other modified file that you did not change, stop and ask. Never use git add -A or git commit -a, never stash, reset or discard, and stage only the paths you changed (for docs/tasks.md stage only your own hunks with git add -p). Stop and ask me only if: you are on the wrong branch, an unexpected file is modified, an action would delete or overwrite work, or the work would touch production data or secrets. For any other ambiguity, choose the conservative option, record the choice in your report, and keep going.
```

### 15. Finish

```text
Read docs/handoffs/codex-ci-unblock-2026-10-03.md in full, follow its Step 0 branch check and its Standing rules, then do this.

Goal: remove the inert shim and wrap up.

1. Run rg "Open piece controls menu" frontend/ and confirm that only menu-mode usages remain. If any test still depends on the inert sr-only shim, list them, leave the shim in place, and report instead of removing it.
2. Otherwise implement #1187: remove the shim, run the focused specs and make check, one commit, ## QA matrix. Also remove the #1180 2D owner-flow baseline entries that #1187 resolves (see the #1180 comment) once they pass, and note that #1167 (the owner decision) is satisfied by this change.
3. Report the final state: baseline entries remaining, issues still open (including Batch 17, #1196 to #1204, and Batch 18, #1205 to #1223), owner decisions outstanding (for example branch protection #1192, merge of PR #1094).
4. Do not start #1193 or #1195 until I ask.

Ground rules: do not dispatch workflows, merge, or close issues. You may commit your own changes and push the current branch with a normal fast-forward push (`git push origin docs/backlog-reevaluation-2026-09-27`) after a completed batch whose make check passed; never force-push, never push another branch, a tag or main; if authentication fails use .agents/memory/github-https-credential-helper.md and never print a credential; if a push is rejected, run `git fetch origin`, report the divergence and stop. After each push, watch the PR checks with read-only commands (`gh pr checks 1094`, `gh run watch`) and repair branch-caused failures in a follow-up commit (at most two rounds); never call a failure pre-existing without checking git history. Files left uncommitted by your earlier goals (the batch ledger under .local/tasks/, DECISIONS.md, docs/tasks.md, and frontend/e2e/accountComponentStyles.spec.ts while #1162 is open) are expected: commit only your own hunks and leave the rest. If you see any other modified file that you did not change, stop and ask. Never use git add -A or git commit -a, never stash, reset or discard, and stage only the paths you changed (for docs/tasks.md stage only your own hunks with git add -p). Stop and ask me only if: you are on the wrong branch, an unexpected file is modified, an action would delete or overwrite work, or the work would touch production data or secrets. For any other ambiguity, choose the conservative option, record the choice in your report, and keep going.
```
