---
name: replit-userenv-scope-unverified
description: The scope of .replit's [userenv]/[userenv.production] blocks relative to Replit Secrets and the published deployment runtime is not yet confirmed.
metadata:
  type: project
---

`.replit`'s `[userenv.shared]` sets `DJANGO_DEBUG = "true"` and
`DJANGO_ALLOWED_HOSTS = "*"`, and `[userenv.production]` is an empty override
section. Whether these values reach the live published (autoscale)
deployment process, or only the interactive Agent/dev workspace, or are
always overridden by Replit Secrets regardless of `[userenv]`, has not been
confirmed against Replit's platform behavior or a live deployment's actual
process environment.

**Why:** If `[userenv]` does govern the published deployment and is not
overridden by Secrets, `config/settings.py`'s hard production-safety block
(HSTS, secure cookies, HTTPS redirect, non-console email — all gated on
`DEBUG=False`) would be silently skipped in production. Issue #97's closing
evidence (passing `check --deploy` and a passing published smoke check)
suggests this is very likely *not* actually happening today, but the repo
has no explicit statement of why not — see [[critical-actions]] for the
broader index of decisions this touches.

**How to apply:** Before changing `.replit`'s `[userenv]` blocks, or before
treating a `DEBUG`/`ALLOWED_HOSTS`-adjacent production symptom as impossible,
confirm the actual precedence live (Replit's own docs, or environment
variables inspected inside a running production deployment) rather than
assuming either direction from the repo alone. Tracked in
[#129](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/129) /
`_docs/tasks.md` item 98.
