---
name: ligdol-adaptation-guardrails
description: Owner-approved guardrails for adapting LIGDOL thesis ideas into this app (additive, deployment-light, user-controlled memory), plus what is deferred or a non-goal.
metadata:
  type: project
---

LIGDOL (`LIGDOL_Creative_Continuity_Thesis.md`, local/gitignored) is a long-term product thesis; this app stays an animation/generative-art studio. Only deployment-light ideas are adopted, tracked in `docs/ligdol-adaptation.md` (Batch 16, #1129-#1143).

**Why:** the app already holds most of the "project graph" (versions, AIRun, ForkProvenance, media); the real gaps are an unused activity log (`ProjectActivity` writes 3 of 11 event types, no API/UI), no per-project intent, no compare view, no related-work discovery. The Replit deployment applies schema diffs, takes no new packages, and has no worker or vector store.

**How to apply:** every LIGDOL-derived change must be additive and revertible, go through `permissions.py`, keep memory user-visible/editable/deletable and covered by account export/deletion, stay out of public APIs and piece packages, keep AI context bounded/disclosed/optional (byte-identical prompt when empty), and keep local-first creation intact. Non-goals: DMs/communities/notifications/calls, Context APIs, vector DB, multi-agent orchestration, third-party tool routing. Deferred: "ask about a piece" (AI quota), references-as-links (needs the D2 decision, #1130), public process sharing. See [[ai-feature-daily-quota-exhaustible-by-retesting]] and [[replit-final-schema-publish-verification]].
