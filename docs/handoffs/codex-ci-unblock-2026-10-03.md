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

*This section is the owner's checklist; Codex does not set or change goals itself. Copy each fenced prompt into the goal field, one at a time, in order. Every prompt is self-contained and points back to this file.*

### 1. Wave 0 — PR gate (set first)

```text
Goal: finish #1179 so the PR's "Browser acceptance E2E (shard 1)" check can pass.

Scope: only frontend/e2e/authPolicy.spec.ts (2 tests) and any helper it needs.
1. Read #1179 and its "Distillation refinement" section, then read backend/templates/account/login.html and the two failing tests.
2. Fix the assertions to the current contract: quote the current login copy instead of "uses Google sign-in for new accounts."; for the mobile test, read the computed background on the element that carries the themed --bg (html or .account-shell), not body. Keep every Google-only account-creation policy assertion.
3. Run: cd frontend && E2E_BASE_URL=http://localhost:5000 npx playwright test e2e/authPolicy.spec.ts --project=chromium, then the PR smoke set (e2e/authPolicy.spec.ts e2e/projectLifecycle.spec.ts e2e/publishingAndRemix.spec.ts e2e/responsiveShell.spec.ts), then npm run typecheck && npm run lint && npm run format:check. If the local PostgreSQL stack is unavailable, say exactly which command could not run and why.
4. One commit: "test(e2e): align auth policy expectations (#1179)". Post the ## QA criterion matrix on #1179.
Stop after reporting. Do not start any other issue.

Ground rules: first read docs/handoffs/codex-ci-unblock-2026-10-03.md in full and follow its Step 0 branch check and Standing rules. Do not push, dispatch workflows, merge, or close issues. If you see an unexpected branch, uncommitted files that are not yours, an unexpected failing baseline, or a rule that needs the owner, stop and ask me one short question before continuing.
Owner checkpoint afterwards: push the branch, confirm the PR's shard 1 is green, merge when ready.
```

### 2. Security and authorization checks (right after goal 1)

```text
Goal: diagnose #1163 and #1180 and report immediately.

1. Read both issues and their refinement sections.
2. For #1163, capture what the issue asks for: every script element on the affected page and which generator emits it. For #1180, capture what a non-owner sees at the owner editor URL, including HTTP status codes and visible controls.
3. Post the evidence as a comment on each issue.
4. Fix only if the cause is test-side and safe. If any owner content or write control is reachable by a non-owner, or any fixture content reaches the extra script, stop at once, file a P0 issue (milestone assigned, matching docs/tasks.md entry) and report to me before doing anything else.
5. Do not batch these with any other issue.

Ground rules: first read docs/handoffs/codex-ci-unblock-2026-10-03.md in full and follow its Step 0 branch check and Standing rules. Do not push, dispatch workflows, merge, or close issues. If you see an unexpected branch, uncommitted files that are not yours, an unexpected failing baseline, or a rule that needs the owner, stop and ask me one short question before continuing.
```

### 3. Wave 1 — quiet and fast matrix

```text
Goal: make the full 16-shard matrix advisory and quiet, per the Wave 1 section of the handoff.

Order, one commit per issue:
1. #1190 known-failure ratchet: --reporter=list,json on the full-suite step; built-ins-only frontend/scripts/e2e-ratchet.mjs with unit tests; baseline frontend/e2e/known-failures.json generated from docs/ci-failure-map-run1126.md (key project|spec|full title, owner issue, added date, expiry: 21 days, 7 for #1163 and #1180). Evaluate only baseline entries whose test appears in the shard's report. Fail on new failures, baseline tests that now pass, expired entries, entries without an issue. Prove all four cases with unit tests plus a dry run against a downloaded results.json or the parsed run #1126 logs. Edit .github/workflows/ci.yml only as far as #1190 and #1191 authorize: no new jobs, triggers, secrets, or permissions.
2. #1191 fast-fail timeouts: actionTimeout about 10 s and navigationTimeout about 20 s in frontend/playwright.config.ts; correct the stale 327-minute comment. Report the "two consecutive full runs show no new failures" criterion as pending the owner's dispatches.
3. #1194 frontend/e2e/support/README.md documenting every exported helper, deprecated legacy helpers, recipes and stale patterns; link it from docs/process.md standard 2.
Run make check before reporting. Post a ## QA matrix on each issue and list the owner dispatches still needed.

Ground rules: first read docs/handoffs/codex-ci-unblock-2026-10-03.md in full and follow its Step 0 branch check and Standing rules. Do not push, dispatch workflows, merge, or close issues. If you see an unexpected branch, uncommitted files that are not yours, an unexpected failing baseline, or a rule that needs the owner, stop and ask me one short question before continuing.
Owner checkpoint afterwards: push, dispatch the full matrix twice (gh workflow run CI --ref docs/backlog-reevaluation-2026-09-27), send me the results.
```

### 4. Wave 2A — account and shell

```text
Goal: fix the account/shell E2E failures as one batch.

Issues: #1160, #1161, #1162 (re-scoped: wait for html[data-reduced-motion] and poll the :active offset instead of asserting a fixed value), #1172, #1184. #1179 is already done.
1. Write the batch impact analysis first (all open issues, not only these) and record it in the batch ledger.
2. Implement one commit per issue. Each commit also removes that issue's entries from frontend/e2e/known-failures.json.
3. Run the union of the focused specs plus responsiveShell, headerMobile, publicShell, accountShell and accountThemeParity, then make check.
4. Post a ## QA matrix on each issue and the batch gate result. Do not close issues.

Ground rules: first read docs/handoffs/codex-ci-unblock-2026-10-03.md in full and follow its Step 0 branch check and Standing rules. Do not push, dispatch workflows, merge, or close issues. If you see an unexpected branch, uncommitted files that are not yours, an unexpected failing baseline, or a rule that needs the owner, stop and ask me one short question before continuing.
```

### 5. Wave 2B — creation and setup

```text
Goal: fix the creation/setup E2E failures as one batch with a single implementer.

Issues: #1168, #1169, #1170, #1166. #1170 shares project3dLifecycle.spec.ts and support/ helpers with the others, so do not parallelize. Do NOT remove the inert "Open piece controls menu" shim (#1187) in this batch.
1. Batch impact analysis first.
2. One commit per issue, each removing its known-failures.json entries. Creation is local-first (IndexedDB, /local-projects/:id) and /ai-projects* redirect to the unified editor, so update tests to that contract rather than restoring old routes.
3. Run the union of focused specs and make check.
4. Post ## QA matrices and the batch gate result. Do not close issues.

Ground rules: first read docs/handoffs/codex-ci-unblock-2026-10-03.md in full and follow its Step 0 branch check and Standing rules. Do not push, dispatch workflows, merge, or close issues. If you see an unexpected branch, uncommitted files that are not yours, an unexpected failing baseline, or a rule that needs the owner, stop and ask me one short question before continuing.
```

### 6. Wave 2C — profile and publication

```text
Goal: resolve the profile/publication E2E failures.

1. Start with #1164: capture each failing request's HTTP 400 response body and classify the cause (test data, contract change, or product defect).
2. Then #1165, #1173 and #1174, which may be fixed by #1164. Fix test-side causes. For any product cause, stop, file a product issue (milestone, tasks.md entry) and report; do not fix product code in this goal.
3. One commit per issue, each removing its known-failures.json entries. Run the focused specs and make check.
4. Post ## QA matrices and the batch gate result. Do not close issues.

Ground rules: first read docs/handoffs/codex-ci-unblock-2026-10-03.md in full and follow its Step 0 branch check and Standing rules. Do not push, dispatch workflows, merge, or close issues. If you see an unexpected branch, uncommitted files that are not yours, an unexpected failing baseline, or a rule that needs the owner, stop and ask me one short question before continuing.
```

### 7. Wave 2D — stage and geometry

```text
Goal: apply the owner-decided phone stage rule and clear the geometry failures.

Owner decisions (do not relitigate): at 701px and wider the stage uses the declared ratio (16:9 fallback, --art-piece-aspect-ratio); at 700px and narrower the toolbar sits below the stage; the tall stage min(70vh, 26rem) applies only to c2js-interactive pieces.
1. Implement #1188 then #1189 (product CSS), then #1175, then bisect and resolve #1177, #1178 and #1176.
2. Serialize all edits to index.css; no parallel edits.
3. Inspect screenshots at 375x812 and 1280x900 for the changed surfaces and describe what you saw.
4. One commit per issue, each removing its known-failures.json entries. Run the focused specs, make check, and the regression specs for the stage and toolbar.
5. Post ## QA matrices and the batch gate result. Do not close issues.

Ground rules: first read docs/handoffs/codex-ci-unblock-2026-10-03.md in full and follow its Step 0 branch check and Standing rules. Do not push, dispatch workflows, merge, or close issues. If you see an unexpected branch, uncommitted files that are not yours, an unexpected failing baseline, or a rule that needs the owner, stop and ask me one short question before continuing.
```

### 8. Wave 2E — diagnosis first

```text
Goal: classify and resolve the remaining unexplained failures.

Issues: #1171, #1185, #1186, #1181, #1182, #1183.
1. For each, capture the first-failure evidence the issue requires (trace, log, or request), classify the cause as test-side, product, or environment, and post it on the issue.
2. Fix test-side causes (one commit each, removing baseline entries). For product causes, file a product issue (milestone, tasks.md entry) and leave the baseline entry in place with its issue link.
3. End with a table: issue, cause, action, status.

Ground rules: first read docs/handoffs/codex-ci-unblock-2026-10-03.md in full and follow its Step 0 branch check and Standing rules. Do not push, dispatch workflows, merge, or close issues. If you see an unexpected branch, uncommitted files that are not yours, an unexpected failing baseline, or a rule that needs the owner, stop and ask me one short question before continuing.
```

### 9. Finish

```text
Goal: remove the inert shim and wrap up.

1. Run rg "Open piece controls menu" frontend/ and confirm that only menu-mode usages remain. If any test still depends on the inert sr-only shim, stop and list them.
2. Implement #1187: remove the shim, run the focused specs and make check, one commit, ## QA matrix.
3. Report the final state: baseline entries remaining, issues still open, owner decisions outstanding.
4. Do not start #1193 or #1195 until I ask.

Ground rules: first read docs/handoffs/codex-ci-unblock-2026-10-03.md in full and follow its Step 0 branch check and Standing rules. Do not push, dispatch workflows, merge, or close issues. If you see an unexpected branch, uncommitted files that are not yours, an unexpected failing baseline, or a rule that needs the owner, stop and ask me one short question before continuing.
Owner checkpoint afterwards: decide the rewrite-or-retire candidates and the PR smoke widening.
```
