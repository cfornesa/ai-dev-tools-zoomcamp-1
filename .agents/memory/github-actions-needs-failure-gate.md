---
name: GitHub Actions needs failure gate
description: Dependent notification jobs need an explicit always gate to observe failed prerequisite jobs.
---

# GitHub Actions needs failure gate

When a job must run because a required job failed, its job-level condition must
start with `always()` before checking the required job's result. Otherwise
GitHub's implicit `success()` gate skips the dependent job before the explicit
failure check can be evaluated.

**Why:** A scheduled provider-drift notifier appeared logically correct but was
skipped on every failed smoke job until a real Actions probe exposed the
implicit dependency gate.

**How to apply:** Use `always() && needs.<job>.result == 'failure'` for failure
alert jobs, while retaining the event-specific guard that limits when alerts
are allowed.