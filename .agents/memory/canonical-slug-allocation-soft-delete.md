---
name: canonical-slug-allocation-soft-delete
description: Canonical public slugs remain unique across soft-deleted rows.
metadata:
  type: constraint
---

Canonical `Project`, `Project3D`, and `ArtPiece` rows all retain their
`(owner, public_slug)` database uniqueness constraints after soft deletion.
Their filtered default managers hide deleted rows for product reads, so slug
allocation and collision retries must query `all_objects`. Otherwise a new
piece can repeatedly choose the deleted row's slug, exhaust the retry loop,
and return a false creation failure. Keep regression coverage for every
piece-model family whenever slug allocation changes.
