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

**Second correction, same session:** calling `ScheduleWakeup(stop:
true)` only cancels a dynamic-loop wakeup this agent itself scheduled —
it does **not** clear an active `/goal` command, which is a separate
mechanism the user set and which keeps re-invoking the agent via
"Stop hook feedback" on every turn as long as its condition is unmet.
The repository owner's exact words: "You did not stop the loop despite
the instruction. The loop means both the goal AND the current task. Do
NOT proceed with a task when Replit publishing is necessary on my end
as you will be misusing tokens." **How to apply:** when told to "stop
the loop" while an active `/goal` is what's driving repeated
re-invocation, do not perform any further task-related tool calls
(checks, retests, edits) in response to that goal's stop-hook feedback
at all — not even a cheap/zero-cost one. State plainly that clearing
the `/goal` itself is the user's action (`/goal clear`, a slash command
this agent cannot invoke), and that no further work will happen on this
task until either that happens or the user explicitly says to resume.
A single acknowledgement reply is appropriate; repeated identical
"holding" replies to every stop-hook re-fire is itself still "not
stopping" from the user's perspective and burns their tokens.
