---
name: Ambient audio export-only delivery
description: Owner-confirmed architecture for owner-uploaded ambient audio (#886) — export/local playback only, no new public server contract.
metadata:
  type: project
---

Owner decision (2026-09-27, [#886](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/886),
Option 1; contract reconciliation [#1067](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1067)):
an owner-uploaded ambient audio sample (`ambient_sample`, #847)
plays only in the authoring browser and is bundled directly into the piece's
downloaded ZIP export. There is **no new public server asset contract** for
this audio — public viewers, embeds, and immersive views fall back to the
existing synthesized ambient voice with a status message when a sample is
active but not deliverable server-side.

Rejected for now: extending the paid-entitlement cloud-backup blob store with
a public-read variant (couples audio to billing/entitlements, a bigger
decision — see the "Needs owner decision" note on billing in `docs/plan.md`),
and a new owner-scoped public upload/signed-URL pipeline (a second upload
path plus a vendor/dependency question). Either could be revisited later as
its own owner-decision issue if public delivery of ambient audio becomes a
real requirement — do not infer it from this decision.

This narrows #847's scope: no writing server endpoint, no public playback of
the sample, ZIP-bundled and browser-local only. The retired compatibility
route returns `410 Gone` without writing data, and public asset delivery
rejects ambient-sample references. See `docs/api.md`'s "Owner-uploaded
ambient audio (#886)" entry for the contract statement.
