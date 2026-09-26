# Local-first storage and transfer contract

This document is the source of truth for the local-first model in #928 and
the follow-on implementation issues. It applies to authored projects,
generated art pieces, and their required media.

## Record states and transitions

| State | Authoritative copy | Allowed actions |
| --- | --- | --- |
| `local-only` | The author's browser IndexedDB/local archive | Edit, preview, version locally, export/import a package, or opt in to sync. No server copy is implied. |
| `synced` | The local copy plus an owner-authorized PostgreSQL copy | Edit locally, upload an explicitly consented sync mutation, resolve conflicts, or disable sync under retention. Losing sync eligibility never removes the local copy. |
| `public` | PostgreSQL, including every media asset required to render the published version | Publish is a warned transfer from local storage when needed. Anonymous routes, embeds, immersive views, and downloads use the server copy. |

`local-only ⇄ synced` is opt-in per piece or through the account-level “sync
all” setting. Account-level sync offers existing local pieces for upload; it
never silently uploads them. `synced → local-only` leaves the browser copy
available and applies retention to the server copy. `local-only → public` and
`synced → public` require confirmation that the piece and required media leave
the browser. `public → unpublished` removes public routing but retains the
server copy for the configured grace period. Permanent purge is a separate,
explicitly confirmed administrative action.

## Per-kind server mapping

- **2D structured pieces:** local projects contain ordered `Scene` documents,
  versions, and media-library references/blobs. The synced server copy is the
  `Project`/`Scene`/`SceneVersion` family plus cloud-backup manifests/blobs.
- **3D structured pieces:** the local representation preserves the `Project3D`
  document and immutable 3D versions. The synced/public server copy is
  `Project3D`/`SceneVersion3D` plus referenced server media.
- **Generated pieces:** the local package preserves source, engine, ink, sonic
  defaults, capabilities, metadata, and versions. The synced/public copy is
  `ArtPiece`/`ArtPieceVersion` plus owner-authorized media required by the
  selected version. Public projections never expose prompts, credentials, or
  private generation metadata.

Existing cloud-backup tables cover the 2D family today. 3D and generated
media delivery are implementation work owned by linked issues; this contract
does not pretend those paths already exist.

## Transfers, warnings, and consent

The following are off-browser transfers and must be visible, attributable, and
recorded with versioned copy and a timestamp: sync uploads, publish transfers,
server draft synchronization, explicit AI requests, and telemetry (disabled
unless a future consented feature says otherwise). The warning owner is the
control that initiates the transfer; the consent record includes the versioned
warning text, user, piece when applicable, and `consented_at`.

Account-level sync consent is not permission to publish. Publishing and AI
transfer each require their own explicit confirmation and owner authorization.

## Secure-transfer requirements

All transfers require HTTPS/TLS, the authenticated session and CSRF boundary,
per-owner authorization, idempotent checksummed chunked upload semantics, and
server-side size, MIME, archive, decompression, and count limits. Public image
delivery strips metadata before serving. Uploaded/imported code executes only
inside the opaque sandbox; never in Django or the parent page. This model is
not end-to-end encrypted: the server is the trusted storage boundary for
synced/public copies.

## Retention, quotas, and grandfathering

The existing `CloudRetentionPolicy` governs active, deleted,
entitlement-expired, and sync-disabled remote copies; the default grace period
is 30 days. Local IndexedDB content is never purged by that policy. There is
no hard-coded product-wide size cap: administrators set plan caps, measured
against actual stored data and media, with generous defaults. Limits are
enforced server-side and reported before a transfer.

Existing pieces remain synced (grandfathered). The one-time owner-run
grandfathering script makes every free-account piece public and enables
account-level sync for admin/paid accounts. It is not an application startup
action, is not a migration, and must produce a before/after manifest.

Open owners: media/public delivery implementation (#941), per-piece package
format/import/export (#930, #935, #936), local-first record implementation
(#929, #933–#934, #937–#938), and account-level sync/transfer UX (#939–#943).
