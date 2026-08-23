---
name: replit-userenv-scope
description: .replit's [userenv] blocks are workspace-scoped, not deployment-authoritative; [userenv.production] is now pinned to production-safe values as defense-in-depth regardless.
metadata:
  type: project
---

`.replit`'s `[userenv.shared]` sets `DJANGO_DEBUG = "true"` and
`DJANGO_ALLOWED_HOSTS = "*"` for the interactive Agent/dev workspace.
Whether `[userenv]` values are ever visible to the published (autoscale)
deployment process could not be confirmed from Replit's official docs (no
public reference for `[userenv]` exists as of 2026-08-23) or by inspecting a
live production process directly (this project has no tooling/credentials
for that). The evidence available points strongly, but not with 100%
certainty, at "workspace-only, not deployment-authoritative":

- AGENTS.md already documents that Replit Secrets — configured separately in
  the Deployments pane — supply the production database, OAuth, Mistral, and
  mail settings, not values checked into `.replit`. Replit's own docs
  describe workspace secrets and deployment secrets as separate stores that
  don't automatically carry over, consistent with `[userenv]` (checked into
  `.replit`, workspace-side) being a distinct layer from deployment env vars.
- Issue #97's closing evidence (`manage.py check --deploy` passing, and
  `scripts/smoke-published.sh` passing against the real published URL) is
  consistent with `DEBUG=False` and a real `ALLOWED_HOSTS` in effect in
  production today — `config/settings.py` defaults `DJANGO_ALLOWED_HOSTS` to
  `localhost,127.0.0.1` when unset, so the published domain responding at
  all means something (not `[userenv.shared]`'s `*`) is supplying the real
  hostname in production.
- This evidence is not fully conclusive: `DEBUG=True` alone would not break
  an anonymous smoke check that never triggers a Django exception page, so a
  live-process inspection would be the only fully conclusive check.

**Why this still matters:** if `[userenv]` ever does reach the deployment
process, `config/settings.py`'s hard production-safety block (HSTS, secure
cookies, HTTPS redirect, non-console email — all gated on `DEBUG=False`)
would be silently skipped. See [[critical-actions]] for the broader index.

**How to apply:** `[userenv.production]` is now pinned to
`DJANGO_DEBUG = "false"` and the real production hostnames
(`animate.creatrweb.com,creatrweb.replit.app`), overriding
`[userenv.shared]`'s dev-unsafe values regardless of which layer actually
wins at runtime — this closes the residual risk cheaply without needing
100% certainty about `[userenv]` precedence. Do not remove that override
without first getting a definitive answer (Replit support, or inspecting a
live deployment process's actual environment) on `[userenv]` vs. deployment
secrets precedence. Resolved via
[#129](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/129).
