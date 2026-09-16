# Identity, admin access, and entitlement distillation — 2026-09-16

## Scope and provenance

This manifest records the follow-up identity and administration work found by
reviewing the current Django/allauth and React account surfaces after the
account-settings batch. It is distillation and issue-scoping only: no product
source or product tests are changed here.

Evidence inspected:

- `backend/backend/settings.py`, `backend/backend/social_account_adapter.py`,
  `backend/backend/oauth_gates.py`;
- `backend/scenes/account_identities.py`,
  `backend/scenes/account_identities_api.py`,
  `backend/scenes/management/commands/reconcile_admin_identities.py`,
  `backend/scenes/admin_authorization.py`, and `backend/scenes/entitlements.py`;
- `frontend/src/pages/AccountIdentities.tsx`,
  `frontend/src/pages/AdminContent.tsx`, and the corresponding API wrappers;
- authenticated Chrome inspection of the live application and GitHub's open
  issue list.

## Duplicate and already-covered-work report

| Existing record | Result |
| --- | --- |
| #420, #425, #460 | Closed provider enablement/feasibility foundations. Reuse; do not reopen. |
| #421 | Closed environment-driven `email:`/`username:` admin reconciliation. Reuse as bootstrap compatibility; the managed roster below is a new UI/workflow gap. |
| #422, #423 | Closed admin settings and entitlement services. Reuse their authorization, transactional, fail-closed boundaries; do not reopen. |
| #426 | Closed Google/GitHub identity link/unlink service and page. The new item is the missing configured-provider parity and canonical-account continuity gap. |
| #440, #547 | Closed billing foundation/production repair. Subscription status is not changed by these identity tasks. |
| #550–#558 | Current account/portfolio batch; none owns OAuth identity parity, admin roster management, credential changes, or admin downgrade retention. |
| #443, #522 | Closed account-deletion/cloud retention boundaries. New entitlement work must preserve their data-retention rules. |

## Criterion-ready manifest

### A. [#559](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/559) OAuth identity linking across every configured provider — OPEN

**Entry point/fixture:** signed-in `/account/settings/identities`; fixture is
one user with Google linked and GitHub/LinkedIn enabled but unlinked, plus a
second user owning a conflicting provider identity.

**Goal:** Make explicit OAuth linking produce one canonical local account for
every configured provider, including LinkedIn, without email-only account
merges or provider-handle trust.

**Acceptance criteria:**

- Every enabled provider in the server registry appears in the identity page
  with the correct enabled state; LinkedIn is not hard-coded as disabled.
- Each unlinked enabled provider exposes a real top-level allauth
  `process=connect` POST form with a return path to this page; linked providers
  are not offered twice.
- Linking the signed-in user's own second provider succeeds even when its
  verified email equals the user's local email; linking an identity owned by a
  different local account returns the existing conflict response and creates no
  duplicate user or identity.
- Unlinking cannot leave the user without a usable enabled sign-in method, and
  linked identity changes do not alter projects, pieces, subscriptions, or
  entitlement records.

**Focused verification:**

`cd backend && uv run pytest tests/test_account_identities.py tests/test_google_oauth.py tests/test_github_oauth.py tests/test_linkedin_oauth.py`

`cd frontend && npx vitest run src/pages/AccountIdentities.test.tsx`

**Full verification:** `make check` plus the account-identities Playwright
spec at 1280x900 and 375x812 in Chromium with the disposable PostgreSQL OAuth
fixtures.

**Out of scope:** provider credential provisioning/live OAuth deployment
evidence (#445), admin grant policy (#560), email/password management (#562,
#563), and arbitrary provider handles as an authorization key.

**Evidence boundary:** local/disposable OAuth callback mechanics and rendered
Chromium account-settings identity UI; real provider consent requires configured
non-production credentials.

**Routing:** stage 2b `implementation-complex` because it changes auth/provider
registry semantics and identity data invariants.

### B. [#560](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/560) Managed application-admin roster across linked accounts — OPEN

**Entry point/fixture:** protected `/admin/content` application-admin access
panel; fixture is an existing admin, a target user with verified local email,
username, and linked OAuth identities, and an ordinary user.

**Goal:** Let authorized administrators add and revoke application-admin access
against the canonical local account while recognizing linked OAuth identities
as access paths to that same account.

**Acceptance criteria:**

- An admin can resolve a target by exact local username or verified allauth
  email, see the canonical account and linked provider names, and grant access
  idempotently.
- An admin can revoke access from the same roster; the action removes only the
  `ApplicationAdmin` grant, never user data, provider links, sessions,
  subscriptions, or editor records.
- A raw provider username/handle alone cannot grant access; provider identities
  are displayed as evidence for a resolved local account, not treated as a
  cross-provider identity key.
- Every grant/revoke records actor, target, action, and timestamp; ordinary
  users and anonymous visitors receive the existing fail-closed 403/401.
- `ADMIN_IDENTITIES` plus `reconcile_admin_identities` remains a compatible
  bootstrap/reconciliation path, with no secret or email value exposed in
  logs or API responses.

**Focused verification:**

`cd backend && uv run pytest tests/test_admin_identities.py tests/test_admin_content.py tests/test_account_identities.py`

`cd frontend && npx vitest run src/pages/AdminContent.test.tsx src/pages/AccountIdentities.test.tsx`

**Full verification:** `make check` plus rendered Chromium admin/ordinary/
anonymous browser evidence at 1280x900 and 375x812.

**Out of scope:** provider linking mechanics (#559), generation caps and
downgrade behavior (#561), email/password self-service (#562, #563), and
Django staff/superuser administration.

**Evidence boundary:** local/disposable PostgreSQL admin authorization and
rendered admin-console behavior; environment reconciliation remains a deploy
operator action.

**Routing:** stage 2b `implementation-complex` because it changes
authorization, account lookup, persistence, and audit behavior.

### C. [#561](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/561) Reversible admin entitlements and data-preserving downgrade — OPEN

**Entry point/fixture:** the existing admin entitlement resolution used by the
named AI generation endpoints; fixture is one application admin with existing
projects/pieces and one ordinary paid/free user.

**Goal:** Define and implement the reversible entitlement policy implied by
admin access: unlimited generation while the grant is active, configured
baseline limits after revocation, and permanent retention of created data.

**Acceptance criteria:**

- The effective-capability contract represents administrator generation as an
  explicit unlimited state, not an arbitrary oversized integer, and all named
  generation endpoints enforce it consistently.
- Revoking the `ApplicationAdmin` grant atomically restores the user's
  configured plan/feature caps and daily accounting behavior without deleting
  or mutating existing projects, pieces, versions, media, provider links, or
  subscriptions.
- After downgrade, local editor access and read access to previously created
  work remain available; only explicitly plan-gated remote/editor capabilities
  become unavailable.
- Grant/revoke transitions are auditable, idempotent, fail closed, and safe
  under concurrent requests; no stale admin capability remains in a cache or
  session after reauthentication/entitlement refresh.

**Focused verification:**

`cd backend && uv run pytest tests/test_entitlements.py tests/test_admin_identities.py tests/test_admin_settings.py tests/test_authorization_and_rate_limit_boundaries.py`

**Full verification:** `make check` plus disposable-PostgreSQL concurrency
checks and Chromium account-entitlement evidence at 1280x900 and 375x812.

**Out of scope:** who may grant/revoke access (#560), billing webhook policy
(#424/#440/#550), cloud-media retention (#522), and account deletion (#443).

**Evidence boundary:** local/disposable PostgreSQL transactional semantics and
browser capability/retention evidence; no claim of live production quota reset
until the published database is inspected.

**Routing:** stage 2b `implementation-complex` because it changes entitlement
business logic, quota state, and persistence invariants.

### D. [#562](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/562) Verified account email aliases and primary-email changes — OPEN

**Entry point/fixture:** a signed-in account-security surface; fixture is a
user with one verified primary email, one linked OAuth identity, and a second
unverified candidate email, plus a collision account.

**Goal:** Allow safe email-address management without breaking the canonical
account, OAuth links, or admin/data ownership.

**Acceptance criteria:**

- A user can add an email, complete verification, set a verified address as
  primary, and remove a non-primary address; the last usable sign-in address
  cannot be removed.
- A pending address is not used for sign-in or admin matching, and a collision
  with another account is rejected without changing either account.
- Changing the primary email preserves the same user id, projects, pieces,
  versions, subscriptions, provider links, sessions according to the stated
  security policy, and entitlement history.
- Application-admin status is re-evaluated against the managed roster/config
  after the change; an email change can revoke access, but never deletes data.
- Verification messages and API responses do not disclose whether another
  account owns an address.

**Focused verification:**

`cd backend && uv run pytest tests/test_admin_identities.py tests/test_account_identities.py tests/test_account_sessions.py`

`cd frontend && npx vitest run src/pages/AccountSettings.test.tsx src/pages/AccountIdentities.test.tsx`

**Full verification:** `make check` plus rendered Chromium security-flow
evidence at 1280x900 and 375x812 using a disposable mail/test backend.

**Out of scope:** provider linking (#559), admin roster UI (#560), password
credential changes (#563), and account deletion (#443).

**Evidence boundary:** local/disposable email-verification and browser flow;
real SMTP delivery is a deployment configuration boundary.

**Routing:** stage 2b `implementation-complex` because it changes auth,
identity uniqueness, verification, and admin authorization.

### E. [#563](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/563) Password set, change, and recovery for social-first accounts — OPEN

**Entry point/fixture:** the account-security surface; fixture is a social-only
user with a verified email and one linked OAuth provider, plus a second user.

**Goal:** Provide secure password credentials and recovery without reopening
local signup or changing OAuth account identity semantics.

**Acceptance criteria:**

- A social-first user can set a local password only after recent authenticated
  reauthentication, then sign in through the existing email/password route.
- A user can change the password with the current password or equivalent
  recent reauthentication; wrong credentials do not mutate the account.
- Password reset requires a verified account email, uses a single-use,
  expiring token, and never reveals whether an email belongs to an account.
- OAuth sign-in and linked-provider identity ownership remain intact, and the
  flow does not reopen public/local password signup or expose secrets in logs.
- The chosen session policy is explicit and tested; resetting/changing a
  password never deletes creative data, subscriptions, provider links, or
  entitlement history.

**Focused verification:**

`cd backend && uv run pytest tests/test_account_sessions.py tests/test_account_identities.py tests/test_account_deletion.py`

`cd frontend && npx vitest run src/pages/AccountSettings.test.tsx`

**Full verification:** `make check` plus Chromium account-security evidence at
1280x900 and 375x812, including reset request, invalid token, successful reset,
and post-reset OAuth continuity.

**Out of scope:** local signup reopening, provider linking (#559), email alias
management (#562), admin roster (#560), and account deletion (#443).

**Evidence boundary:** local/disposable email delivery and browser security
flows; production mail and OAuth credentials remain deployment boundaries.

**Routing:** stage 2b `implementation-complex` because it changes auth,
credential storage, session invalidation, and recovery security.

### F. [#564](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/564) Public gallery filters by implemented piece engine — OPEN

**Entry point/fixture:** anonymous `/gallery`; fixture contains published
generated pieces for each currently implemented `ArtPiece.Engine` value and
published authored 2D/3D projects, with at least one unsupported/future engine
represented only in the database fixture if the model permits it.

**Goal:** Let visitors filter generated pieces by their actual engine (for
example Three.js or p5.js) while never presenting an option that has no
implemented/public data contract.

**Acceptance criteria:**

- The API exposes a stable engine-filter parameter alongside the existing
  `type` filter and returns only published generated pieces of that engine;
  authored 2D/3D items remain available under their existing type semantics.
- The gallery derives its engine options from the server's implemented engine
  catalog, not a hand-maintained list that can advertise unsupported types.
- If an engine has no eligible public pieces, it is absent or explicitly
  disabled according to the documented catalog rule; it never produces a
  misleading selectable option or a 500.
- Engine and gallery filters compose deterministically with keyset pagination,
  invalid values fail closed with a documented 400/default behavior, and the
  selected filters survive reload through query parameters.
- Rendered cards identify the engine where it is meaningful, while anonymous
  and signed-in callers receive the same public fields.

**Focused verification:**

`cd backend && uv run pytest tests/test_public_gallery.py tests/test_art_piece_api.py tests/test_gallery.py`

`cd frontend && npx vitest run src/pages/PublicGallery.test.tsx src/pages/PublicGallery.a11y.test.tsx`

**Full verification:** `make check` plus rendered Chromium gallery evidence at
1280x900 and 375x812 covering each implemented engine, empty engine results,
pagination, reload, and invalid-filter behavior.

**Out of scope:** collection cards/toggle (#565), collection context on a
piece viewer (#566), private gallery behavior, and adding a new rendering
engine.

**Evidence boundary:** local/disposable public fixtures and anonymous Chromium;
production engine availability remains a deployed-data verification boundary.

**Routing:** stage 2b `implementation-complex` because it changes a public API
filter, query/pagination semantics, and the server/client engine contract.

### G. [#565](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/565) Public gallery pieces/collections view toggle — OPEN

**Entry point/fixture:** anonymous `/gallery`; fixture contains published
individual pieces and at least two public collections with ordered members,
plus a private collection and unpublished member.

**Goal:** Let visitors choose whether the public gallery shows individual
pieces, public collections, or both without leaking private/unpublished items.

**Acceptance criteria:**

- The gallery exposes an accessible, URL-addressable view control with exactly
  `Pieces`, `Collections`, and `All` states; the default remains backward
  compatible with the current pieces view.
- `Pieces` returns individual published pieces, `Collections` returns only
  public collections, and `All` merges both with a deterministic discriminator,
  ordering, and cursor that cannot be reused across incompatible filters.
- A collection card links to its canonical public collection route and shows
  stable title/owner/thumbnail metadata without embedding private member data.
- Private/unpublished collections and pieces never appear in any state; empty
  states and pagination are distinct and actionable.
- The control is keyboard accessible and remains usable without horizontal
  overflow at 1280x900 and 375x812.

**Focused verification:**

`cd backend && uv run pytest tests/test_public_gallery.py tests/test_collections.py`

`cd frontend && npx vitest run src/pages/PublicGallery.test.tsx src/pages/PublicGallery.a11y.test.tsx`

**Full verification:** `make check` plus anonymous Chromium evidence at
1280x900 and 375x812 for all three modes, privacy filtering, pagination, and
reload/deep-link behavior.

**Out of scope:** collection creation/order management (#556), immersive
collection presentation (#557), engine-specific filtering (#564), and the
piece-viewer collection back-link (#566).

**Evidence boundary:** local/disposable public collection fixtures and rendered
Chromium; production publication/privacy parity remains a deployment gate.

**Routing:** stage 2b `implementation-complex` because it adds a cross-model
public API union, privacy filtering, and cursor semantics.

### H. [#566](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/566) Show collection context below associated public pieces — OPEN

**Entry point/fixture:** public individual piece route `/art-pieces/p/:id`
  (and the authored-piece viewer equivalent); fixture is a published piece in
  one public collection, a piece in multiple collections if supported, and an
  uncollected piece.

**Goal:** Make collection membership discoverable outside the canvas/stage so a
  visitor can return from an individual piece to its public collection.

**Acceptance criteria:**

- A public piece associated with a public collection renders a clearly named
  collection link below the stage/content area, with the collection title and
  canonical route.
- Multiple public memberships render deterministically without duplicate links;
  private/unpublished collections are omitted.
- An uncollected piece renders no misleading empty collection link, and an
  embed/chrome-less route does not leak collection navigation unless the embed
  contract explicitly includes it.
- Navigating the link preserves the piece's public/privacy boundary and works
  at 1280x900 and 375x812 without overlapping the stage controls.
- API responses expose only public collection metadata and preserve backward
  compatibility for clients that ignore the additive field.

**Focused verification:**

`cd backend && uv run pytest tests/test_art_piece_api.py tests/test_public_projects.py tests/test_collections.py`

`cd frontend && npx vitest run src/pages/PublicArtPieceViewer.test.tsx src/pages/PublicProjectViewer.test.tsx`

**Full verification:** `make check` plus rendered Chromium viewer evidence at
1280x900 and 375x812 for associated, multi-associated, uncollected, private,
and embed states.

**Out of scope:** collection creation/order/domain model (#556), gallery mode
toggle (#565), immersive collection gallery (#557), and adding new engines.

**Evidence boundary:** local/disposable public fixtures and rendered viewer
routes; published-site collection membership requires the production gate.

**Routing:** stage 2b `implementation-complex` because it changes public
serialization, privacy filtering, and multiple viewer consumers.

## Dependency/order rationale

1. #559 establishes provider-aware canonical identity behavior.
2. #560 builds the managed admin roster on that canonical identity.
3. #561 consumes the grant boundary to implement reversible entitlement policy.
4. #562 and #563 are independent account-security transactions and may run in
   parallel after the existing identity foundations. #560 may start with the
   existing local-username/verified-email boundary; if alias lookup is adopted,
   #562's verified-alias contract must be reconciled into #560 before closure.
5. #564 is independent of collection work; #565 depends on #556, and #566
   depends on #556's membership/publication contract. #557 remains the
   immersive child after #556 and is separate from the public gallery toggle.

## Blocker triage and verification boundaries

- No new implementation blocker was found during distillation.
- Real provider consent, SMTP delivery, and published quota behavior remain
  verification boundaries, not reasons to defer issue creation; each issue
  names the disposable/local evidence and the external boundary explicitly.
- No provider handle/username issue is filed separately: provider handles are
  not a safe cross-provider canonical key. They are deliberately out of scope
  as authorization principals and may only be displayed after resolving a
  provider identity to the local account.

## Transaction ledger

- **Phase:** DISTILL → GROOM → ISSUE-CREATED
- **Actual profile:** Codex via ChatGPT Plus, GPT-5-class reasoning; issue
  scoping and task-distillation were run in this session.
- **Implementation:** None.
- **Issue records:** #559–#566 were created as open GitHub issues and each was
  verified in the active Chrome session by URL, title, open state, and rendered
  acceptance criteria.
- **Next independent handoff:** #559 and #564 are independent starting points;
  #560/#561 follow the identity/admin boundary, #562/#563 are account-security
  work, and #565/#566 follow #556's collection contract.
- **Product source/tests changed:** None.
