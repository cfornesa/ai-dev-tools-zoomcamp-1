# Task distillation: billing, CMS, entitlement, profile, and theme parity

Date: 2026-09-13

## Source inventory

- Current project: `ai-dev-tools-zoomcamp-1` (Django + React/Vite, one deploy
  target: Replit `creatrweb`). `LOOP-AGENTS.md` governs this node; the graph
  remains a standalone single-node graph with markdown Case D.
- Current implementation: `backend/scenes/admin_authorization.py` provides a
  fail-closed application-admin boundary; `backend/scenes/admin_settings.py`
  and `frontend/src/pages/AdminSettings.tsx` expose site title and plan
  quota/feature/PayPal fields; `backend/templates/account/base.html` is a
  separate light-only auth shell; no user profile model or public profile route
  exists; no pages CMS/content-management route exists.
- Reference behavior: local `/Users/Fornesus/Code/augment-humankind-platform`
  and `/Users/Fornesus/Code/augment-humankind-react-node`, especially the
  latter's `_docs/task-records/fp-21-public-theme-parity.md`,
  `fp-22-admin-console-parity.md`, `_docs/tasks.md`, and `.agents/memory/`.
  These are read-only behavior inventories, not permission to copy their
  schemas, routes, or dependencies.

## Duplicate and already-covered-work report

| Existing item | Result |
|---|---|
| #421, #422, #423 | Closed foundations for configured admin identities, atomic plan/settings policy, and entitlement resolution. Reuse; do not reopen. |
| #424, #440 | Closed PayPal synchronization and checkout/status flow. The new delayed-status UX is a follow-up, not a reopening. |
| #425, #426, #460 | Closed provider feasibility and identity-management work. Profile work must use the existing identity boundary. |
| #507, #509, #511, #512, #513 | Closed local-first, cloud-sync, and media-library foundations. CMS/media administration must preserve their local-first and opt-in contracts. |
| #443 | Closed account-deletion retention policy. Cloud-media retention is a separate operational policy and must not rewrite account deletion history. |
| Reference #66/#67 | Different repository and closed reference transactions; use only as parity evidence. |
| Open-issue search | No current open issue matches billing pending UX, auth-shell theme parity, pages CMS, admin content operations, cross-surface capability consistency, public profiles, or site/profile customization. |

## Ordered manifest

| Order | New issue | Scope | Dependency | Routing | Status |
|---:|---|---|---|---|---|
| 1 | [#515](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/515) | Published billing pending state and centered layout | #440 closed | Stage 2a mechanical | GROOMED; next transaction |
| 2 | [#516](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/516) | Dark branded authentication templates | #400/#460 closed | Stage 2a mechanical | GROOMED |
| 3 | [#517](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/517) | Protected admin shell and pages configuration | #421/#422 closed | Stage 2b complex (admin/API/data) | GROOMED |
| 4 | [#518](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/518) | Admin project/piece/media operations | #517, #512/#513 closed | Stage 2b complex | GROOMED |
| 5 | [#519](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/519) | Cross-surface capability registry and plan consistency | #423 closed | Stage 2b complex | GROOMED |
| 6 | [#520](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/520) | Public profiles and user profile settings | #426 closed | Stage 2b complex | GROOMED |
| 7 | [#521](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/521) | Site-wide and per-profile customization/theme parity | #517/#520 | Stage 2b complex | COMPLETED and closed; finite tokens, scoped profiles, reset/fallback evidence |
| 8 | [#522](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/522) | Admin-configurable cloud-media retention policy | #509/#511 closed; owner approved existing PostgreSQL/blob lifecycle | Stage 2b complex | COMPLETED and ready/closed after QA evidence |

## Blocker triage

- No environment or credential blocker prevents #515–#520 engineering.
- #521's profile and admin settings dependencies are now stable; it completed
  with local PostgreSQL, focused browser, and full `make check` evidence. Its
  closure comment is recorded on GitHub.
- #522's policy/provider boundary was resolved by the owner on 2026-09-13:
  existing application-owned PostgreSQL/blob storage is the lifecycle owner;
  the finite 30-day grace matrix and explicit retroactive-purge confirmation
  are recorded in durable memory and the issue execution plan.
- Live Replit proof is not required to groom these issues. Each issue must
  still include local PostgreSQL and fixed-viewport browser evidence.

## Next transaction

No independent engineering issue remains. #522 is the final implementation
transaction and has passed its local PostgreSQL, responsive Chromium, and full
repository checks; release readiness is now the remaining handoff gate.

## Fresh blocker reconciliation for #522 (2026-09-13)

- Current behavior: local-first projects and optional cloud backup exist, but
  remote-copy retention/deletion semantics are intentionally unspecified.
- Previous blocker class: `dependency-blocked` / owner-policy boundary, not a
  code or credential failure. Resolved by owner approval.
- Duplicate check: #443 owns account deletion; #509/#511 own sync transport and
  entitlement; neither defines cloud-media lifecycle semantics. No new issue
  is needed.
- Exact resolved decision: active copies remain; deleted,
  cancelled/expired, and disabled-sync copies receive 30 days; the existing
  PostgreSQL/blob boundary owns lifecycle; retroactive purge requires explicit
  confirmation; local IndexedDB is never purged.
- Evidence boundary: the implementation does not claim Replit publication or
  external-provider proof. Those belong to the production-readiness gate.

## Reference-derived durable lesson

The legacy/React reference has separate protected admin domains (pages, media,
pieces, recycle bin), public profiles, site/profile theme controls, and a
consistent auth shell. Those domains must be ported as separate contracts so
that a free user's local/editor access is never accidentally coupled to a
paid-only cloud or AI capability.
