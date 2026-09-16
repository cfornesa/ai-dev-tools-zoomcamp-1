# Account settings and portfolio parity distillation — 2026-09-15

## Scope

This manifest captures the owner-reported follow-up work from the live
AugmentrART account/settings review and the requested parity investigation
against the read-only `augment-humankind` and
`augment-humankind-react-node` references. No product source or product tests
were changed during distillation.

## Evidence and duplicate report

- Authenticated Chrome inspected `https://augmentrart.com/account/settings`.
- The supplied narrow screenshots show the existing Public profile and Saved
  Mistral models cards, including the current empty-state/form spacing.
- The billing page currently supports PayPal checkout and status polling, but
  exposes no provider-side subscription-management or cancellation affordance.
- GitHub issue enumeration through the authenticated Chrome session reports
  zero open issues.
- Closed #548 owns the previous account-settings grouping pass; these items
  are narrower follow-ups and must not reopen #548.
- Closed #422 owns the existing application-admin settings console; it does
  not own a user-facing admin navigation link or a style-catalog contract.
- Closed #440 owns the initial PayPal subscription and webhook path; its
  provider client and webhook authority are reusable for self-service
  management.
- #532/#540–#546 and #544/#546 own browser storage accounting and offline
  mutation/sync contracts; no duplicate issue is proposed for those concerns.
- The reference contracts are read-only inputs:
  `../augment-humankind/algorithms/Collections.md`,
  `../augment-humankind/algorithms/ImmersiveGallery.md`,
  `../augment-humankind/docs/api.md`, and the corresponding React-node
  migration/task records.

## Criterion-ready issue manifest

### A. [#550](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/550) PayPal subscription self-service — PROPOSED

**Goal:** From `/account/billing`, let a signed-in subscriber manage or cancel
the subscription through PayPal's hosted customer-management flow where
PayPal supports it, then return to a truthful AugmentrART status view.

**Acceptance criteria:**

- An active PayPal subscription shows a named Manage subscription action and a
  separately named cancellation action or the provider's supported equivalent.
- The action opens PayPal's hosted management path; AugmentrART never collects
  PayPal credentials or invents local subscription state.
- Return/cancel/error states are visible and accessible; webhook state remains
  authoritative for plan and entitlement changes.
- Cancellation retains access through the existing paid-through policy and
  does not downgrade merely because the browser returned from PayPal.
- Authenticated Chromium evidence covers 1280×900 and 375×812, including the
  active, pending-webhook, provider-error, and no-subscription states.

**Dependencies:** Closed #440 billing foundation; release verification remains
#445/#467. **Routing:** stage 2b `implementation-complex`.

### B. [#551](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/551) Deterministic public-handle lifecycle — PROPOSED

**Goal:** Give every eligible account a deterministic, collision-safe default
handle while preserving an explicit unique-handle change workflow.

**Acceptance criteria:**

- A profile without a handle receives a deterministic candidate derived from
  stable account data, with collision suffixing and reserved-word rejection.
- The owner can edit the handle and receives field-level feedback for invalid,
  reserved, or already-used values without losing the prior handle.
- Existing `/users/@handle` links remain compatible through the repository's
  confirmed URL/redirect policy; the acceptance contract must name the
  chosen old-handle behavior before implementation.
- Browser evidence covers first-load generation, successful change, collision,
  rejected value, and 375×812 layout.

**Open owner choice:** stable redirect/alias versus immediate old-handle
retirement. **Routing:** stage 2b `implementation-complex`.

### C. [#552](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/552) Profile style catalog and user customization — PROPOSED

**Goal:** Replace the single profile-accent control with a safe, reusable set
of profile style options, while allowing administrators to manage the global
catalog and users to choose only permitted styles.

**Recommended policy:** an admin-managed, token-only style registry seeded from
the original repositories' approved visual options; user profiles store a
style key plus small token overrides. Do not port arbitrary CSS/HTML/JS into
the parent document; the existing sandbox/security boundary remains intact.

**Acceptance criteria:**

- An admin can create, edit, enable/disable, and preview a token-only global
  style option through a protected admin surface.
- A user can choose an enabled style and preview/save/reset it in profile
  settings; disabled styles remain readable on existing profiles but cannot be
  newly selected.
- Public profile rendering applies only the validated token contract and keeps
  contrast, focus, reduced-motion, and narrow-screen behavior intact.
- Browser evidence covers admin/non-admin authorization, user selection,
  reset, disabled-option behavior, and 1280×900/375×812 public profile views.

**Open owner choice:** exact seeded catalog and whether per-user token overrides
are allowed beyond the style key. **Routing:** stage 2b `implementation-complex`.

### D. [#553](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/553) Vendor-aware saved model preferences — PROPOSED

**Goal:** Generalize the Mistral-only saved-model UI into a vendor-aware model
registry and vendor-specific selector without exposing credentials.

**Acceptance criteria:**

- Every enabled provider can own saved model entries with vendor-specific slug
  validation and labels; Mistral remains backward-compatible.
- The assistant model dropdown is filtered to the selected vendor and cannot
  submit a model belonging to another vendor.
- Empty, duplicate, invalid, disabled-provider, and delete states are
  explicit and accessible.
- Provider keys remain encrypted, owner-scoped, and absent from browser
  bundles, public types, logs, scenes, and exports.
- Browser evidence covers the saved-model form and assistant selector at both
  fixed viewports, with deterministic fake-provider fixtures.

**Dependencies:** existing multi-vendor credential foundation. **Routing:**
stage 2b `implementation-complex`.

### E. [#554](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/554) Settings progressive disclosure and empty-state polish — PROPOSED

**Goal:** Make settings readable by default: forms are hidden until requested,
empty states are separated from actions, and each section exposes its own
details affordance.

**Acceptance criteria:**

- Saved models and Personas show a clear empty state with separate New model /
  New persona actions; their forms are hidden initially and revealed by those
  actions.
- Each settings section has an independently named See more details control;
  expanding one section does not expand another.
- The spacing and grouping are visually verified at 1280×900 and 375×812;
  screenshots or equivalent rendered inspection cover empty, populated, and
  validation-error states.
- Keyboard focus, Escape/close behavior where applicable, and screen-reader
  expanded/collapsed state are covered.

**Routing:** stage 2a `implementation-mechanical`; no schema change expected.

### F. [#555](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/555) Persistent settings layout preferences — PROPOSED

**Goal:** Let each user keep their preferred settings section order and
expanded/collapsed state across reloads without affecting server data.

**Recommended policy:** versioned local browser storage for per-device layout
preferences, with corrupt/unknown entries discarded deterministically; do not
send layout state to the server unless cross-device sync is separately chosen.

**Acceptance criteria:**

- Sections can be reordered with a keyboard-usable drag/reorder control and a
  non-drag fallback; the example Automatic retry → top is supported.
- Expanded/collapsed state and order survive reload, reset cleanly, and remain
  isolated per account/browser origin.
- Storage failures, malformed state, and reduced-motion mode leave settings
  usable with the default order.
- Browser evidence covers 1280×900 and 375×812, reload persistence, keyboard
  reordering, and malformed-storage recovery.

**Routing:** stage 2a `implementation-mechanical`.

### G. [#556](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/556) Collections and portfolio management — PROPOSED

**Goal:** Add a native, ordered collection domain for grouping published
artworks/media with public listing/detail surfaces and owner/admin management.

**Reference contract:** preserve ordered mixed items, status/privacy boundaries,
stable slugs, collection thumbnails, and compatibility redirects as described
by the reference collection API. This is a contract translation, not a copy of
the PHP implementation.

**Acceptance criteria:**

- Authorized owners/admins can create, edit, reorder, publish/unpublish, and
  delete a collection; unauthorized users cannot mutate it.
- Public list/detail routes render ordered artwork/media items, empty/error
  states, thumbnail fallback, and stable slug behavior. A user's collection
  is canonically reachable at `/users/@alias/collection-name`, with the
  handle/collection-slug route contract documented before implementation.
- A collection snapshot/export path is separately identified and does not
  claim offline behavior until its own artifact issue passes.
- Browser evidence covers authenticated management and anonymous public views
  at 1280×900 and 375×812.

**Routing:** stage 2b `implementation-complex`; likely split into API/domain
and UI children before engineering if the issue body exceeds one transaction.

### H. [#557](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/557) Immersive collection gallery — PROPOSED

**Goal:** Provide a collection-specific immersive gallery that reuses the
shared stage/runtime contract while supporting narrow-screen camera fitting,
bounded progressive live rendering, navigation, capture, and an embed entry
point.

**Acceptance criteria:**

- A public collection exposes an immersive entry point and a chrome-less embed
  variant without changing the canonical collection URL.
- Ordered items mount deterministically; unsupported or missing items degrade
  to placeholders without breaking the room.
- Arrow-key/click navigation, reset, progressive live-slot budgeting,
  capture, reduced-motion behavior, and mobile camera framing are functional.
- Browser evidence covers 1280×900 and 375×812, public and embed/privacy
  states, with no claim of headset WebXR unless separately approved.

**Dependencies:** G; existing individual immersive routes are reusable but do
not satisfy collection evidence. **Routing:** stage 2b `implementation-complex`.

### I. [#558](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/558) Admin navigation discoverability — PROPOSED

**Goal:** Make the existing protected admin console discoverable to signed-in
application administrators without exposing it to ordinary users.

**Acceptance criteria:**

- An application administrator sees a clearly named Admin link in the desktop
  and mobile primary navigation, linking to the admin console.
- A non-admin and an anonymous visitor do not see the link and remain subject
  to the existing fail-closed admin-route protection.
- The link remains usable from the responsive menu and has active/current-route
  state when an admin route is open.
- Browser evidence covers admin, ordinary-user, and anonymous fixtures at
  1280x900 and 375x812.

**Dependencies:** Existing #422/#517 admin authorization and console routes.
**Routing:** stage 2a `implementation-mechanical`.

## Order and blocker triage

1. **A** after confirming PayPal's supported customer-management API/path;
   external provider capability is the only blocker.
2. **B**, then **C**, because profile identity and style selection define the
   public profile contract.
3. **D**, then **E**, then **F**; vendor model semantics precede the settings
   presentation and persistence work.
4. **G**, then **H**; the immersive gallery cannot be criterion-ready without
   the collection item/order/privacy contract.

No implementation may begin until the open owner choices in B/C and the
collection split in G are resolved. The next independent engineering issue is
A once its PayPal capability check is recorded.

## Clarifying design questions

1. For handle changes, should old `/users/@handle` URLs redirect to the new
   handle (recommended for durable public links), or should old handles be
   retired immediately?
2. For styles, should the seeded catalog be a small fixed set of approved
   token themes (recommended), or should admins be able to add arbitrary token
   combinations? In either case, should users have any per-token overrides?
3. For collections, should the first slice be owner-created collections only,
   with admin/platform collections deferred, or should both be included in the
   first domain contract?

## Transaction ledger

- **Phase:** DISTILL
- **Issue owner / current transaction:** Nine GitHub issues were created: #550
  through #557 plus the admin-navigation follow-up #558. The next independent
  engineering handoff is #550 after PayPal capability discovery.
- **Implementation:** None.
- **Product tests/source changed:** None.
