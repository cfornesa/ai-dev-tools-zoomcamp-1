---
name: stop-goal-loop-when-blocked-on-replit-publish
description: When a task/goal is blocked on the user explicitly publishing to Replit, stop the active goal/loop entirely rather than repeatedly polling or retesting — wait for the user's explicit confirmation before resuming.
metadata:
  type: feedback
---

During #236 verification, an automated stop-hook kept re-firing the
same "publish to Replit and retest" goal condition dozens of times in a
row while the repository owner had not actually republished yet. Each
firing triggered a fresh live-retest (first via AI generation, later
via a zero-quota-cost JS-bundle grep), producing a long unproductive
loop of identical "still not deployed" responses.

The repository owner's explicit correction: "if you need me to
explicitly publish to Replit, stop the current task/goal."

**Why:** repeatedly re-checking a condition that only the user's own
action (a manual Replit publish) can change is not useful work — it
does not get closer to the goal, and in this case it even caused a side
effect (exhausting the daily AI-generation quota from repeated
live-generation retests before switching to the zero-cost bundle
check).

**How to apply:** the moment a task's progress genuinely depends on the
user explicitly publishing/deploying something (Replit publish, or any
similar action only the user can trigger), stop actively working the
goal/loop — do not keep polling, retesting, or re-checking deployment
state on every subsequent nudge or automated re-invocation. State
clearly what is blocked and what specifically needs to happen, then
wait for the user's explicit confirmation that they've done it before
resuming verification. This applies even under an active `/goal` or
stop-hook loop that keeps re-firing the same unmet condition — the
loop's own repeated firing is not itself new information and is not a
reason to keep re-testing.
