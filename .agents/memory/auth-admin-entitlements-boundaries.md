---
name: Auth, admin, and entitlement boundaries
description: Durable decomposition for future identity, administration, and access-capacity work.
---

Keep provider login, configured admin identity authorization, entitlements,
admin settings, billing synchronization, and account self-service as separate
transactions. Provider credentials and payment webhooks require explicit
non-production verification boundaries. Feature grants, revocations, quota
changes, and billing transitions must go through one auditable transactional
entitlement service so unrelated user data and active sessions remain intact.

The criterion-ready queue was #420, #425, #421, #423, #422, #424, and
#426 -- all seven closed 2026-09-05. Key durable design decisions from
that work, relevant to anything that touches this boundary next:

- `scenes.entitlements` resolves per-feature daily caps from a `Plan`
  row (`plan_key`, `daily_ai_requests`, `feature_keys`, `active`,
  `paypal_plan_id`) plus an optional per-user `UserFeatureOverride`
  (deny always wins). It fails closed to 0 for an unknown feature key,
  an inactive/missing plan, or a deny override -- never raises in a way
  a caller could mishandle as "allowed."
- `scenes.admin_authorization.is_application_admin` is the one shared,
  fail-closed authorization check for anything admin-only; it is
  entirely independent of Django's own `is_staff`/`is_superuser`.
- Optional providers/services (GitHub OAuth #420, PayPal billing #424)
  share one pattern: all-or-none env vars, an `_ENABLED` flag, and the
  route itself 404s while disabled rather than the view erroring.
- PayPal billing policy (#424, no live operator was available to
  confirm otherwise): cancellation retains paid access only through
  `Subscription.paid_through`; a failed payment never advances/shortens
  it; a refund can only move it earlier, never later. Revisit via a new
  issue if this should ever differ from actual commercial policy.
- Linking a second OAuth identity to your own account (#426) is
  allauth's real `?process=connect` flow reusing the existing login
  routes -- there is no separate "link" endpoint. Unlinking one is
  blocked only when it would leave zero *usable* (site-wide-enabled)
  sign-in methods; a since-disabled provider's linked row never counts
  toward that and is always removable.
