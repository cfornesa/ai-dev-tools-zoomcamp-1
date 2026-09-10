---
name: Local-first project media architecture
description: Owner-confirmed product invariant for the multi-scene project media library and optional cloud backup.
metadata:
  type: project
---

Owner decision (2026-09-10, [#507](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/507)):
new projects are **Local only** by default. Their ordered scenes and
project-owned media library live in browser IndexedDB; persistence requests
are best-effort, and the product must clearly handle quota, eviction,
unavailable storage, export, and restore rather than promise permanent local
storage.

**Sync online** is explicit per-project backup, never an automatic upload.
It may be gated by the future `cloud_project_sync` entitlement after the
separate PayPal workflow #440, but an unavailable, expired, or revoked sync
entitlement must never restrict local project access, local media, or local
exports.

A 2D Project is being extended into a collection of ordered scenes that share
one project media library; scene-version history remains a separate concept.
Do not select or configure a cloud-storage vendor, quotas, retention policy,
or remote-deletion behavior without resolving #507's remaining provider
decision and the vendor-dependency disclosure. The implementation queue is
#510 → #512 → #508 → #513, then #509 and #511.
