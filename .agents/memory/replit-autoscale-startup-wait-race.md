---
name: replit-autoscale-startup-wait-race
description: An ordinary Replit autoscale stop cycle could log a false "exited with status 127" from scripts/start.sh due to a trap/wait race; fixed, but the log pattern is worth recognizing if seen again.
metadata:
  type: project
---

`scripts/start.sh` (the launcher for both the interactive Replit workflow and
`scripts/start-production.sh`'s deployment wrapper) previously had an
`EXIT INT TERM` trap (`cleanup()`) that called an unconditional `wait` after
killing the companion process (Django or Vite/`vite preview`), *in addition
to* the main flow's own explicit `wait "$django_pid"`/`wait "$frontend_pid"`
calls used to collect real exit status.

If SIGTERM arrives — which happens on an ordinary Replit autoscale
scale-to-zero stop, not only on a code deploy — while the main polling loop
is between its `ps` state check and its own explicit `wait` call, the trap
fires first, kills, and reaps the pid via its own bare `wait`. When the
interrupted loop iteration resumes and reaches its own `wait "$pid"`, bash
has already forgotten that job and returns exit code `127` with
`"wait: pid N is not a child of this shell"`, logged as a false
`"Startup process exited with status 127"` — even though nothing actually
crashed.

**Why:** This was discovered 2026-08-28 while investigating an unrelated
production camera regression report — the pasted logs included exactly this
message, initially raising suspicion of a real backend crash coinciding with
the report. Investigation confirmed the backend recovered and served
correctly within ~10 seconds in every observed case, and the log line was a
logging artifact of the trap/wait race, not a real failure. Fixed in
[#202](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/202),
commit `8df580d`: removed the trap's redundant `wait` — its only real job is
killing the surviving companion process; the kernel reaps any remaining
zombie children once the shell itself exits, without an explicit wait.

**How to apply:** If `"wait: pid N is not a child of this shell"` or
`"Startup process exited with status 127"` appears again in Replit logs
around an autoscale stop/restart (not a deploy), treat it as a logging
artifact unless subsequent request logs also show real failures (non-200
responses, missing health checks) — check for genuine service disruption
before assuming the log line itself indicates one. If it reappears after
commit `8df580d`, the fix did not fully close the race and needs
re-investigation, not just re-suppression.
