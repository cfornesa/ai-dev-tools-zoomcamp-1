---
name: Cloud media retention policy
description: Owner-approved lifecycle rules for remote cloud-media copies.
metadata:
  type: project
---

Owner decision (2026-09-13, #522): the existing application-owned
PostgreSQL/blob boundary is the lifecycle owner for remote copies. Active
copies remain available while the project and entitlement are active. Copies
for deleted projects, cancelled or expired entitlements, and disabled sync are
retained for 30 days, then eligible for bounded purge. Admins must explicitly
confirm a retroactive destructive purge.

The policy is configurable by admins through atomic revisioned settings and
audited changes. Purge is bounded and idempotent, and must never delete local
IndexedDB content, active local projects, billing/audit records, or another
user's copy. Local-first access remains available regardless of remote-copy
eligibility. External storage vendors and transport changes are outside this
decision and require separate approval.
