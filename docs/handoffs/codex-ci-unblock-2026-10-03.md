# Codex handoff — unblock CI and clean up the E2E suite (2026-10-03)

Paste everything below the line into Codex. It is written to be self-contained.

---

## Role and repository

You are working in `cfornesa/ai-dev-tools-zoomcamp-1` (Django + React/Vite, local and Replit deployments) on branch `docs/backlog-reevaluation-2026-09-27` (PR #1094 into `main`). The owner is not a CI specialist: explain anything that needs their hands in plain steps, with exact commands.

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
