# Public gallery API contract

## Public profile handles (#551)

`GET /api/account/profile/` assigns a deterministic handle on first access when
the authenticated profile has none. The candidate is derived from the stable
account username, normalized to the handle grammar, and receives a numeric
suffix when needed; reserved application words are rejected and replaced with
an account-specific fallback. `PATCH /api/account/profile/` requires a valid,
unused handle and returns field-level validation errors for malformed,
reserved, or already-used values without changing the previous handle.

Changing a handle creates a durable redirect-history row. A request for an old
handle at `GET /api/users/@<handle>/` returns a permanent redirect to the
current API profile URL, and the frontend updates the browser URL to the
canonical `/users/@<current-handle>` route. Redirect history is owner-scoped
through the profile relation and is never exposed in public profile payloads.

## Profile style catalog (#552)

`GET /api/account/profile/` returns the current `style_key` and an
`available_styles` catalog containing only enabled, server-managed styles.
`PATCH /api/account/profile/` accepts `style_key`; unknown or newly disabled
styles return field-level validation errors, while an existing assignment
remains readable after an administrator disables it. `theme_config` remains a
validated token-only compatibility override and cannot contain CSS, HTML, or
JavaScript.

Application administrators can use `GET|POST /api/admin/profile-styles/` and
`PATCH /api/admin/profile-styles/<id>/` to manage the finite catalog. Anonymous
callers receive `401`, non-admins `403`, and updates require the current
integer `revision`. Styles contain only approved six-digit hex tokens for
`background`, `surface`, `text`, `muted`, and `accent`; disabling a style hides
it from new user selections without deleting existing assignments.

## Account billing contract (#440, #550)

Authenticated account billing is exposed through `/api/account/billing/` and
the frontend route `/account/billing`. `GET` returns the effective plan and
the user's latest PayPal subscription status. The returned plan pricing is
read from the active persisted `Plan` row: `price` is a two-decimal string,
`currency` is a three-letter code, and `interval` is the billing interval.
`POST` accepts a server-created
idempotency key and a published active plan key, creates a PayPal sandbox
subscription with the authenticated user's id as the provider correlation,
and returns only a provider approval URL plus an opaque checkout id. The
server records the checkout correlation before returning and never trusts
return-query parameters as proof of payment. PayPal webhook verification and
the existing billing service are the only paths that change subscription or
entitlement state.

The endpoint returns `401` for anonymous callers, `400` for malformed or
inactive plans, `409` for an idempotency-key conflict, `502` for an upstream
PayPal failure, and `200` for a status or successful idempotent retry. The
response contains no client secret, access token, raw provider payload, or
unverified entitlement claim.

Issue #550 adds subscriber self-service without changing webhook authority.
`GET` may return `subscription.can_manage`, `subscription.can_cancel`, and
`subscription.manage_url` for an active provider-backed subscription. The
manage URL is PayPal's hosted subscriptions page and is informational only;
the app never embeds or collects PayPal credentials. `POST` accepts
`{"action":"cancel","reason":"..."}` for the authenticated owner. The
server requests cancellation from PayPal, returns `202` with
`{"outcome":"pending_webhook"}`, and does not mutate the local subscription
until a verified webhook arrives. Missing subscription, already-terminal
state, provider failure, and malformed reasons return finite `400`/`502`
responses. Cancellation preserves the existing `paid_through` entitlement
policy.

### PayPal sandbox operator verification

The deterministic tests mock the approval transport; they do not create a
provider subscription. For the separately authorized sandbox roundtrip, use
the same `PAYPAL_MODE=sandbox` app credentials locally and in Replit, and keep
the existing webhook endpoint configured for the deployment being tested. Open
`/account/billing` as a fixture or sandbox buyer account, select the displayed
paid plan, and click **Subscribe with PayPal**. PayPal redirects to its
sandbox approval page: sign in there with a PayPal **sandbox personal/buyer**
account, not the sandbox business account that owns the app, then approve the
subscription. Return to the app and verify the subscription status only after
the webhook arrives. The server-side webhook remains the authority; the
browser return URL alone never grants paid access.

For local testing, the webhook must target the active HTTPS forwarding URL
for the local Django endpoint. Do not replace the Replit webhook with the
localhost-forwarding URL; maintain one provider webhook per target environment
or switch the callback only for the short local test and restore the deployed
URL immediately afterward. No production PayPal account or charge is needed.

This document is the canonical contract for the anonymous public gallery
listing API. It exists because the repository pre-write rule requires any
public API contract change to be documented **before** the product source
that implements it. Current contract owner: issue
[#491](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/491)
("Public gallery: unify authored and generated pieces with a visible type
filter").

## Endpoints at a glance

| Endpoint                             | Status                                                |
| ------------------------------------ | ----------------------------------------------------- |
| `GET /api/public/gallery/`           | **Canonical** unified listing (this document, #491).  |
| `GET /api/public/projects/`          | Legacy — frozen; unchanged response contract.         |
| `GET /api/public/art-pieces/`        | Legacy — frozen; unchanged response contract.         |
| `GET /art-pieces/gallery` (frontend) | Legacy route — redirect/shim to `/gallery?type=generated`. |

The two legacy API endpoints are **not** repurposed, extended, or removed by
the unified endpoint. Their existing response shapes (`results` keyset pages
for `/api/public/projects/`, an unpaginated list of public piece payloads for
`/api/public/art-pieces/`) remain stable for existing consumers; new gallery
work targets `/api/public/gallery/` only.

The legacy frontend route `/art-pieces/gallery` (currently
`PublicArtPieceGallery`) is also preserved: it must keep resolving, as a
backward-compatible redirect or shim rendering the unified gallery with its
type filter pre-set to **Generated** (`/gallery?type=generated`). The route is
never silently deleted.

## CMS pages (#517)

CMS pages are a separate content family from user artwork/projects. Public
page reads are published-only and expose bounded presentation metadata; drafts,
soft-deleted pages, private author data, and admin audit fields are never
returned. A renamed page preserves its old slug through a redirect record and
the canonical page is addressed by its current slug.

| Endpoint | Contract |
| --- | --- |
| `GET /api/pages/<slug>/` | Anonymous published-page read; returns `200` for the canonical page, `301` for a recorded old slug, and `404` for missing/draft/deleted pages. |
| `GET /api/admin/pages/` | Application-admin-only list of active published/draft pages with title, slug, status, updated time, author, navigation metadata, and revision. Anonymous callers receive `401`; non-admins receive `403`. |
| `POST /api/admin/pages/` | CSRF-protected application-admin create with bounded title, slug, description, status, navigation metadata, and optional system key. |
| `PATCH /api/admin/pages/<id>/` | CSRF-protected optimistic-concurrency update requiring the current `revision`; slug changes create redirect history. Supports publish/unpublish and navigation metadata changes. |
| `DELETE /api/admin/pages/<id>/` | CSRF-protected soft-delete. Required system pages cannot be deleted. |

Admin responses include `updated_by` as a display name only; no email,
provider identity, credentials, prompt, or billing data is exposed. Reserved
application paths and duplicate slugs are rejected. Public project and gallery
routes remain unchanged.

## `GET /api/public/gallery/`

Anonymous-reachable paginated listing merging three kinds of published work:

- **2D** — published `Project` records (authored canonical-scene pieces),
  eligible under exactly the same gate `scenes.gallery.eligible_projects`
  applies for the legacy `/api/public/projects/` endpoint
  (`visibility == public`, not soft-deleted, has a current version, and
  `published_at is not null`).
- **3D** — published `Project3D` records, eligible under
  `scenes.gallery.eligible_projects3d` (same gate shape).
- **Generated** — published generated `ArtPiece` records, eligible under
  exactly the same publication gate `PublicArtPieceListView` (the legacy
  `/api/public/art-pieces/` endpoint) applies
  (`scenes.art_piece_persistence.eligible_art_pieces`:
  `status == ArtPiece.Status.PUBLISHED`, joined owner and current version;
  soft-deleted pieces are excluded by the model's default manager).

Anonymous and signed-in requests receive **identical** response bodies: the
view never branches on `request.user`. No private or editing fields (scene
JSON, prompts, draft/session data, tags, descriptions, owner emails,
visibility/status internals) ever appear in any item.

### Query parameters

| Parameter   | Rule                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`      | `all` (default when omitted) \| `authored` (2D + 3D only) \| `generated` (generated pieces only). Any other value → **HTTP 400**.        |
| `engine`    | Optional server-supported generated engine (`canvas2d`, `svg`, `threejs`, or `aframe`). It composes with `type`; authored-only results are empty. Any other value → **HTTP 400**. |
| `cursor`    | Opaque keyset token from a previous response's `next_cursor`. Malformed, or bound to a different `type` (see below) → **HTTP 400**.         |
| `page_size` | Positive integer, default `24` (`DEFAULT_PAGE_SIZE`), clamped to `60` (`MAX_PAGE_SIZE`); a non-integer value → **HTTP 400**. Same shape as the legacy `/api/public/projects/` endpoint. |

Error bodies are finite JSON. An invalid filter:

```json
{ "errors": { "type": ["Must be one of: all, authored, generated."] } }
```

The response also includes `engine_catalog`, an array of server-derived
`{value, label, count, available}` entries for the currently implemented
generated engines. `available` is false when the selected type has no
published results for that engine; dormant or unsupported engine values are
never listed. The frontend uses this catalog for its engine control and keeps
the selected engine in the shareable URL.

## Signup-time cloud-sync consent (#524)

A brand-new social-login account (Google/GitHub -- local password signup
remains closed) is shown an explicit, one-time choice between "Keep projects
local only" (pre-selected default) and "Enable optional cloud sync" before
the account is created. `LinkedProvidersSocialAccountAdapter.is_auto_signup_allowed`
(`backend/backend/social_account_adapter.py`) always returns `False` for a
genuinely new identity, so allauth's standard social-signup form
(`socialaccount/signup.html`, `POST /accounts/3rdparty/signup/`) is shown
instead of auto-creating the account; a returning user signing in through an
already-linked identity never reaches this form and is never re-prompted or
changed.

The extra `cloud_sync_choice` field (`backend/backend/social_signup_forms.py`'s
`CloudSyncSignupForm`, wired in as `SOCIALACCOUNT_FORMS['signup']`) only
offers "Enable optional cloud sync" while the site-wide
`SiteSettings.cloud_sync_enabled` switch is on; a forged/replayed request for
that value while the switch is off is rejected with a validation error, and
omitting the field entirely is rejected the same way -- there is no blank or
implicit choice. The pending social login is cleared from the session as
soon as the form is submitted once, so a duplicate/replayed POST has no
sociallogin to finalize and is redirected to the login page rather than
creating a second account.

The choice is recorded exactly once, at account creation, as a
`CloudSyncSignupConsent` row (`owner` one-to-one, `sync_enabled`,
`decided_at`). This is only an account-level preference record: choosing
"enabled" here creates no `CloudBackupProject` row and uploads no content --
a project must still be explicitly opted in through the existing
`POST /api/projects/<public_id>/cloud-backup/` flow below, which
independently re-enforces the site-wide switch and the `cloud_project_sync`
entitlement.

The same signup form also nudges for browser persistent storage (issue
#525), alongside a one-line privilege summary for each: cloud sync
("Uploads an opt-in backup copy of a project to our servers so it survives
clearing this browser") and persistent storage ("Asks this browser not to
automatically delete your local project data when device storage runs
low"). Unlike the cloud-sync choice, persistent storage is a pure browser
permission with no server-side record -- a plain (non-Django-form) checkbox,
checked by default, triggers a best-effort, fire-and-forget
`navigator.storage.persist()` call on submit that never blocks or delays
account creation and never claims a result the browser didn't actually
report. The real granted/denied state is always readable afterward, and
re-requestable, from the local storage dashboard below (issue #525).

## Scheduled cloud-backup snapshots (#530)

The server never pushes a snapshot on its own -- it has no independent copy
of a project's media (an `"image"` shape's `mediaAssetId` only ever resolves
against the browser's own local IndexedDB media library, #508/#512). Instead,
`GET`/`POST /api/projects/<public_id>/cloud-backup/` (below) additionally
return `snapshot_cadence_days`, `snapshot_archive_enabled` (both resolved
from the owner's current `Plan`), and `last_snapshot_at` (the most recent
manifest's timestamp, or `null`). The frontend (`useCloudBackupSchedule`,
`storage/cloudSnapshot.ts`) reads these once whenever a cloud-sync-eligible
project opens and, if due, silently builds and pushes one snapshot through
the existing manifest/asset endpoints below -- no repeating background timer,
no user-facing prompt, and a missed/failed check is simply retried next time
the project opens.

Per the #529 policy: the free plan defaults to a 7-day cadence with
`snapshot_archive_enabled=False`; paid/admin default to a 1-day cadence with
archiving on. When `snapshot_archive_enabled` is false, `PUT .../manifest/`
atomically trims every manifest revision except the one just written and
deletes any blob no longer referenced by it, immediately after that write --
"only the latest snapshot" applies to every manifest write on such a plan,
not only ones a client marks as "scheduled." An archive-enabled plan keeps
full history, governed only by the existing #522 retention policy below.

## Cloud backup protocol (#509)

Cloud backup is an authenticated, owner-only, provider-neutral protocol for
the local-first project repository. It is disabled unless the singleton
`SiteSettings.cloud_sync_enabled` is true; the server rejects sync requests
before entitlement or storage access when it is false. PostgreSQL BLOBs are
the initial provider implementation. Local projects and exports never depend
on these endpoints.

| Endpoint | Contract |
| --- | --- |
| `POST /api/projects/<public_id>/cloud-backup/` | Body `{\"enabled\": true}` explicitly opts a project into backup. `409` is returned for a disabled site switch or read-only backup. |
| `GET /api/projects/<public_id>/cloud-backup/manifest/` | Returns the owner's latest manifest and revision, or `404` when no backup exists. |
| `PUT /api/projects/<public_id>/cloud-backup/manifest/` | Body `{\"revision\": n, \"idempotency_key\": \"...\", \"manifest\": {...}}`. `revision` must be the current revision; a replay is idempotent and a stale write returns `409`. |
| `PUT /api/projects/<public_id>/cloud-backup/assets/<asset_id>/` | Stores one binary asset with `X-Asset-Checksum`, `X-Idempotency-Key`, and `X-Asset-Mime-Type`. Replays with the same checksum are idempotent; a mismatch returns `409`. |
| `GET /api/projects/<public_id>/cloud-backup/assets/<asset_id>/` | Returns the stored bytes for the owner while the backup is readable. |

Cloud-sync entitlement and controls (#511)

The server-resolved `cloud_project_sync` entitlement is required before a
project can be enabled for remote backup. A missing or inactive plan and an
explicit deny override fail closed. The account UI may explain this state
without reading project content. Local project operations and exports do not
depend on the entitlement or backup provider.

`POST /api/projects/<public_id>/cloud-backup/` accepts `{"action":
"enable"}` or `{"action": "pause"}` for the authenticated owner. Enable
requires the entitlement; pause is always allowed for an existing owner
backup. A paused backup remains locally usable and its existing remote copy is
retained, but future manifest/blob writes return `409` with
`cloud_backup_paused`. Entitlement loss uses the same read-only retention
boundary. Provider/network failures are surfaced as retryable client errors;
they never delete local data.

## Offline mutation acknowledgement protocol (#543)

The offline editor uses a separate authenticated mutation endpoint for
cloud-synchronizable mutations. It is deliberately not the cloud-backup
manifest endpoint: a mutation is an operation in the deterministic outbox,
not a replacement snapshot. The endpoint records the operation receipt and
returns the same acknowledgement for a replay of the same operation.

| Endpoint | Contract |
| --- | --- |
| `POST /api/projects/<public_id>/sync/mutations/` | Authenticated owner-only operation receipt. The JSON body contains `operation_id`, `client_sequence`, `kind` (`scene`, `metadata`, or `media-reference`), `payload`, `payload_checksum`, `schema_version`, `dependency_operation_ids`, and optional `client_created_at`. The first accepted operation returns `201`; an identical replay returns `200` with `replayed: true`. |

The server scopes operation identity to the authenticated owner and project.
Reusing an operation ID with a different checksum or payload returns `409`;
reusing a client sequence for a different operation also returns `409`.
Anonymous callers and non-owners cannot discover a project's mutation receipt.
The receipt is an acknowledgement journal for the sync/conflict stages; it
does not enable offline generation, publishing, gallery reads, or AI flows.

### Deterministic conflict resolution (#544)

A scene conflict-resolution payload uses this additional shape:

```json
{
  "type": "conflict-resolution",
  "base_version": "<SceneVersion id>",
  "choice": "keep-local | keep-remote | compose",
  "resolved_payload": {"...": "validated scene snapshot"},
  "audit": {
    "conflict_paths": ["..."],
    "local_operation_ids": ["..."],
    "remote_operation_ids": ["..."]
  }
}
```

The server locks the owner’s project, compares `base_version` with the
authoritative current version, validates the resolved snapshot, and creates a
new immutable `SceneVersion` only when the base is still current. A stale base
returns `409` with the authoritative remote snapshot and the preserved base,
local, remote-operation, and affected-identity context; no receipt or version
is created. The accepted receipt stores the resulting version link, so an
identical replay returns the same applied version without creating a second
version. Artwork-bearing data never uses last-write-wins.

The status GET returns `404` when the owner has not opted the project in yet;
the editor treats that as the ordinary “Enable cloud sync” state. A `409`
from enable explains that the account is ineligible without uploading content.

The manifest is JSON metadata only and must include stable scene/asset IDs;
asset records include a checksum and byte size. The configured plan quota is
checked before a new blob lands. Entitlement loss marks the backup read-only
and retains it; account deletion purges the backup. A future entitlement/UI
issue owns the transition controls. The endpoints return finite error codes:
`401` unauthenticated, `403` non-owner, `404` absent resource, `409` disabled,
stale, read-only, or checksum conflict, and `413` quota exhaustion.

### Cloud-sync availability and snapshot policy (#529)

Cloud sync is available to both free and paid/admin accounts, with different
cadence and archiving:

- **Free plan:** silent scheduled snapshots on a 7-day cadence. Only the
  latest snapshot is retained — no archive of prior snapshots beyond the
  current one.
- **Paid and application-admin accounts:** silent scheduled snapshots on the
  plan's configured cadence, with archived snapshots retained per the
  existing [Cloud-media retention policy (#522)](#cloud-media-retention-policy-522)
  grace periods below.

Scheduled snapshots are silent: no per-snapshot user approval, email, or
blocking in-app notification is generated. A manual "Sync now" action remains
available on any entitled project regardless of the scheduled cadence. This
policy governs cadence and archiving only; it does not change the opt-in
consent flow (#524), the manual sync transport (#509), the entitlement
resolver (#511/#519), or the retention grace periods/purge endpoint (#522).
Implementation of the scheduled job itself is tracked in #530.

## Cloud-media retention policy (#522)

The application-owned PostgreSQL/blob lifecycle is governed by one atomic
admin policy. The approved defaults are: active copies retained while active;
deleted, entitlement-expired, and disabled-sync copies retained for 30 days;
retroactive destructive purge requires explicit confirmation. Local IndexedDB
content is never affected.

| Endpoint | Contract |
| --- | --- |
| `GET /api/admin/cloud-retention/` | Application-admin only. Returns the finite grace periods, revision, and update metadata. |
| `PATCH /api/admin/cloud-retention/` | Application-admin only. Requires `revision`, accepts the three non-negative grace periods, and rejects stale/invalid writes atomically. |
| `POST /api/admin/cloud-retention/purge/` | Application-admin only. Requires `confirm_retroactive=true` when the request may purge eligible existing copies; accepts bounded `limit` (1–100); returns scanned/purged/retained counts and policy revision. |

Each remote backup carries a retention state (`active`, `deleted`,
`entitlement_expired`, or `sync_disabled`) and an optional `retain_until`.
Purge is idempotent, locks rows before deletion, and deletes only remote
manifests/blobs whose deadline has passed. The account-deletion policy remains
owned by #443.

An invalid cursor (malformed or reused under a different `type` than it was
issued for — see binding rule below):

```json
{ "errors": { "cursor": ["Invalid or expired cursor."] } }
```

### Response body

```json
{
  "results": [ /* gallery items, see below */ ],
  "next_cursor": "string | null",
  "has_more": true
}
```

`next_cursor` is `null` exactly when `has_more` is `false`. Clients page by
passing `next_cursor` back as `cursor` until it is `null`.

### Result items: discriminated union

Every item carries a **`kind`** discriminator with value `"2d"`, `"3d"`, or
`"generated"`. Every item includes:

| Field          | Meaning                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `id`           | Stable public id (the record's `public_id` UUID as a string). Internal database pks never appear.                 |
| `title`        | Piece title.                                                                                                      |
| `owner`        | Owner display value (username, never email).                                                                       |
| `published_at` | Publication timestamp (ISO 8601).                                                                                  |
| `thumbnail_url`| URL of the piece's gallery-card thumbnail.                                                                         |
| `viewer_url`   | Path of the piece's public viewer route: `/p/:id` (`2d`), `/p3d/:id` (`3d`), `/art-pieces/p/:id` (`generated`).    |

Generated (`"kind": "generated"`) items additionally expose **`engine`** —
the piece's engine label (`canvas2d`, `svg`, `threejs`, or `aframe`).

Example items:

```json
{
  "id": "6f9619ff-8b86-d011-b42d-00c04fc964ff",
  "kind": "2d",
  "title": "Bouncing balls",
  "owner": "alice",
  "published_at": "2026-09-08T10:00:00Z",
  "thumbnail_url": "/api/public/projects/6f9619ff-…/thumbnail.png",
  "viewer_url": "/p/6f9619ff-…"
}
```

```json
{
  "id": "7b1c2d3e-…",
  "kind": "3d",
  "title": "Orbit study",
  "owner": "alice",
  "published_at": "2026-09-08T09:30:00Z",
  "thumbnail_url": "/api/projects3d/7b1c2d3e-…/thumbnail/",
  "viewer_url": "/p3d/7b1c2d3e-…"
}
```

```json
{
  "id": "9c4d5e6f-…",
  "kind": "generated",
  "title": "Calm blue field",
  "owner": "alice",
  "published_at": "2026-09-08T09:00:00Z",
  "thumbnail_url": "/api/public/art-pieces/9c4d5e6f-…/thumbnail.png",
  "viewer_url": "/art-pieces/p/9c4d5e6f-…",
  "engine": "canvas2d"
}
```

### Global sort

All three kinds are merged into one global order, sorted by:

1. **Newest `published_at` first** (descending);
2. then a **documented stable kind rank** (`2d` before `3d` before
   `generated` — rank 0, 1, 2), applied only between rows with the exact same
   `published_at` instant;
3. then **public id descending** (the record's internal pk, used purely as a
   tiebreaker; it never appears in any response body).

### Cursor pagination and type binding

Pagination is keyset ("seek"), not offset — the same duplicate/gap-safe
strategy `scenes/gallery.py`'s module docstring documents for the legacy
endpoint: each page asks for "everything strictly after the last row I
returned" in the global order, so a piece publishing *between* page requests
never duplicates or drops rows already seen. The cursor encodes the last
row's `(published_at, kind, pk)` position plus the **`type` filter the cursor
was issued under**.

**A cursor is bound to its `type`:** a `next_cursor` issued by a
`type=generated` page is rejected with **HTTP 400** (and the
`{"errors": {"cursor": [...]}}` body above) when presented alongside any
other `type` (`all`, `authored`), and vice versa. Reusing a cursor across
filters would silently re-anchor the walk inside a different result set, so
the API refuses rather than returning ambiguous pages. Clients changing the
filter must start a fresh walk with no `cursor`.

## Capability consistency (#519)

`GET /api/account/entitlements/` retains its legacy `features` list and adds a
`capabilities` map keyed by the atomic registry. Each entry includes
`available`, `source` (`local`, `plan`, `role`, `override`, or `global`),
`local`, `remote`, `quota`, and `daily_cap`.

Application-admin policy endpoints are additive:

| Endpoint | Contract |
| --- | --- |
| `GET/POST /api/admin/roles/` | List or create reusable role sections. Role capabilities are a bounded map of registry keys. |
| `PATCH /api/admin/roles/<role_key>/` | Revision-checked atomic role update. |
| `GET/PATCH /api/admin/global-capabilities/` | Read or revision-check one global capability toggle. Cloud sync also updates the existing site-wide switch in the same transaction. |
| `GET/PATCH /api/admin/plans/?plan_key=<key>` | Existing plan contract, extended with `role_key` for role assignment. |

Global denial takes precedence over role, plan, and per-user overrides. The
resolver never hides local create/open/edit/import/export because a plan lacks
a remote capability; frontend surfaces omit unavailable optional controls.
Application admins are a separate authorization class and receive all
capabilities (subject to an explicit global shutdown); they are not assigned a
role or per-user capability matrix.

## Public profiles (#520)

| Endpoint | Contract |
| --- | --- |
| `GET/PATCH /api/account/profile/` | Authenticated owner profile settings with a revision check; fields are a unique handle, display name, bounded bio, URLs, profile-image URL metadata, visibility, and revision. |
| `GET /api/users/@<handle>/` | Anonymous public profile read with safe metadata and only explicitly public 2D/3D/generated pieces. Missing, inactive, or private profiles return `404`. |

Provider identities, email, prompts, credentials, billing, drafts, deleted
pieces, and private pieces never appear in the public response. A profile
handle is an opaque user-selected slug and conflicts return `409`.

## Account identities (#559)

| Endpoint | Contract |
| --- | --- |
| `GET /api/account/identities/` | Authenticated caller's linked provider identities only; each entry contains `provider`, `enabled`, and `connected_at`, with no provider uid, token, or handle. |
| `GET /api/account/identity-providers/` | Authenticated caller's provider registry view. Returns every configured provider with its display label and enabled state, so the UI never hard-codes an enabled/disabled decision. |
| `DELETE /api/account/identities/<provider>/` | Removes only the caller's linked identity, returning `409` when the operation would leave no usable enabled sign-in method. |

Linking uses allauth's top-level CSRF-protected `POST /accounts/<provider>/login/`
flow with `process=connect` and a return path to account settings. Provider
identity ownership conflicts fail closed and never merge local accounts.

## Managed application-admin roster (#560)

| Endpoint | Contract |
| --- | --- |
| `GET /api/admin/content/access/` | Application-admin-only roster of canonical local accounts, including username, verified email when present, and linked provider names; no provider uid, token, or handle is returned. |
| `POST /api/admin/content/access/` | Application-admin-only grant/revoke by exact local `username` or exact verified allauth email. The legacy `username` field remains accepted; new callers may send `identifier` plus boolean `granted`. Grants/revokes are idempotent and return the resolved account. |

## Admin entitlements (#561)

`GET /api/account/entitlements/` keeps its existing feature summary and
capability map. For quota-bearing capabilities, an application administrator
receives `unlimited: true` and `daily_cap: null`; ordinary users continue to
receive their configured numeric cap. Admin status is resolved from the
current `ApplicationAdmin` grant on every request. Daily-cap enforcement is
skipped only for the active grant; request-rate limits and successful-use
accounting remain in place, and revocation immediately restores the user's
plan/override cap without changing owned data.

## Account email aliases (#562)

The account settings security links use allauth's existing authenticated
`/accounts/email/` flow for adding, verifying, setting primary, and removing
aliases. The flow rejects unverified addresses for sign-in/admin resolution
and preserves the same local user and owned records. Verification sends are
handled by the configured server mail backend; no address ownership detail is
returned to another account.

## Password lifecycle (#563)

Social-first users use allauth's existing top-level
`/accounts/password/set/`, `/accounts/password/change/`, and
`/accounts/password/reset/` flows. These retain CSRF protection, recent
authentication/session policy, generic reset responses, expiring single-use
tokens, and the existing controlled local-signup policy; reset tokens are not
placed in application URLs after consumption or in client diagnostics.

## Theme customization (#521)

`GET /api/site-theme/` is anonymous-safe and returns the effective finite site
tokens (`background`, `surface`, `text`, `muted`, `accent`).
`GET/PATCH /api/admin/settings/` includes `theme_config` and applies an
optimistic revision check; only validated six-digit hex colors and known token
names are accepted. `GET/PATCH /api/account/profile/` includes the same
bounded `theme_config` object for the profile accent/presentation. Profile
tokens are applied only inside the profile surface and cannot alter shell,
authentication, or security styling. Invalid or unavailable configuration uses
the compiled safe defaults.

`GET /api/account/entitlements/` remains the authenticated caller's own
summary and adds a stable `capabilities` object keyed by the finite capability
registry. Each entry contains `available`, `source` (`local`, `plan`, or
`override`), `remote`, and `daily_cap`/`used`/`remaining` where applicable.
Local editor capabilities default to available for every plan; a missing plan
feature can deny only the affected remote or paid operation. An explicit
per-user override may intentionally allow or deny one named capability.

The registry includes `editor_2d_local`, `editor_3d_local`,
`generated_pieces`, `ai_scene_create`, `ai_scene_edit`, `ai_art_generate`,
`publishing`, and `cloud_project_sync`. Plan and override changes are
transactional and never mutate projects, versions, media, credentials, or
sessions. Frontend surfaces consume this map and omit unavailable optional
controls rather than rendering locked-feature prompts.

## Admin content operations (#518)

`GET /api/admin/content/` is application-admin-only and returns a bounded,
list-oriented view of server-owned projects, 3D projects, generated pieces,
their immutable versions, and cloud-backup media blobs. Local IndexedDB data is
never exposed or mutated by this API.

`POST /api/admin/content/actions/` accepts one explicit action payload:
`{"resource_type": "project|project3d|art_piece", "resource_id": "...", "action": "publish|unpublish|restore|delete"}`.
The action runs in one transaction, reuses the resource's existing publication
and soft-delete invariants, and records an `AdminContentAuditEvent`. Delete is
soft-delete only and is rejected for a current/reference-protected resource.

`POST /api/admin/content/access/` accepts
`{"username": "...", "granted": true|false}` to grant or revoke an
application-admin identity. This changes only the `ApplicationAdmin` grant;
the next environment reconciliation remains authoritative for configured
admin identities.

All write endpoints require the normal authenticated session and CSRF token.
Anonymous callers receive `401`; authenticated non-admins receive `403`;
invalid actions, stale/conflicting invariants, and protected deletes receive
finite `400`/`409` responses. Audit responses expose actor username, action,
resource kind/id, and timestamp, never credentials or private content.
