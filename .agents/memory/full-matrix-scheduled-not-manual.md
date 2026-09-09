---
name: full-matrix-scheduled-not-manual
description: Don't manually re-trigger the full multi-browser CI matrix after every engineering batch; it already runs on a nightly schedule, and repeated manual triggers on a shared-concurrency-group workflow can cancel each other.
metadata:
  type: feedback
---

The full multi-browser Playwright matrix (`npm run test:e2e`, no `--project`
filter, single-worker per `playwright.config.ts`) genuinely takes ~40
minutes to run — that is not a bug or something to optimize away, it is the
real cost of 819 tests across chromium/firefox/webkit with `workers: 1`
(a deliberate choice for fixture/concurrency-test correctness, see
[[full-browser-readiness-gate]]).

**2026-09-09 incident:** during one session, this full matrix was manually
triggered via `gh workflow run CI --ref main` (`workflow_dispatch`) three
times in under two hours, chasing evidence for issue #419's "complete
current-revision matrix passes" criterion. The first two attempts were
each cancelled around the 40-minute mark by an unrelated routine push
landing on `main` (a Replit publish checkpoint commit, then the very fix
commit for this problem) — because `ci.yml`'s `concurrency.group` grouped
`workflow_dispatch` and `push` events together by branch with
`cancel-in-progress: true`. Fixed in commit `2f60f65`: `workflow_dispatch`
now gets its own group keyed by `github.run_id`, so a manual full-matrix
run can no longer be cancelled by an unrelated push. That fix is real and
worth keeping, but it does not address the deeper issue below.

**The actual lesson, per the repository owner's explicit correction:**
`ci.yml` already runs this exact full matrix automatically every weeknight
(`schedule: cron: "17 3 * * 1-5"`) — there was never a need to manually
re-trigger it in the same session as an engineering batch. Manually
re-running a ~40-minute single-worker suite after every batch, "just to be
sure," is the actual waste — not the suite's own runtime, which is fixed
and known.

**How to apply:** for future sessions on this repo, do not call
`gh workflow run CI` to manually force the full multi-browser matrix as a
matter of routine after closing out engineering work. Prefer, in order:
1. The already-scheduled nightly cron run — check its most recent result
   (`gh run list --workflow CI --event schedule`) rather than triggering a
   fresh one, if a recent run already covers the current code.
2. Targeted CI evidence (the push-triggered Chromium smoke suite, ~5-6 min)
   plus local per-file Playwright runs during stage-4 QA — sufficient
   day-to-day signal for a specific issue's own acceptance criteria.
3. Only manually trigger the full matrix when the repository owner
   explicitly asks for it (e.g. genuinely closing out #419's own
   container criterion), and even then, let one run complete rather than
   re-triggering speculatively.
