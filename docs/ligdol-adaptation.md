# LIGDOL adaptation plan (status: PROPOSED — filed as Batch 16; owner decisions pending)

Source: `LIGDOL_Creative_Continuity_Thesis.md` (local, gitignored) revised 2026-10-01 from the owner's two architecture diagrams. Scope rule from `DECISIONS.md` (2026-09-27) still holds: **this application stays an animation / generative-art studio**. LIGDOL is a long-term product thesis; this plan adopts only the parts that fit the existing Django + PostgreSQL + React/Vite + local-first architecture and the Replit deployment. Distilled with `.claude/skills/task-distillation` (backlog definition only; nothing here is implemented).

## 1. Guardrails (apply to every Batch 16 issue)

1. **Additive only.** No removed or renamed fields, routes, labels, or behaviors. Every issue names a restoration path: revert its commit, or switch off its capability flag.
2. **Deployment-light.** No new package (`AGENTS.md` rule), no vector database, no new service, no background worker, no new cron. Everything runs in the existing Django process and the managed PostgreSQL. Schema changes are additive and nullable/defaulted, because Replit Publish applies a schema *diff* rather than running migrations (`.agents/memory/replit-final-schema-publish-verification.md`, `postgresql-migration-sql.md`); each schema-bearing issue must be followed by the documented post-publish table check.
3. **Single authorization path.** Every new endpoint goes through `backend/scenes/permissions.py`; new data is owner-private unless an issue explicitly makes it public.
4. **User control.** Anything the system "remembers" about a person's work is visible to them, editable or deletable by them, included in the account data export (`account_export.py`) and removed by account deletion (`account_deletion.py`), and never included in public APIs, piece packages (`schema/piece-package.schema.json`), or exports unless the owner chooses.
5. **Bounded AI context.** Anything added to an AI prompt is capped in size, labelled as untrusted user text like existing prompt inputs, shown to the user ("context used"), and optional per request. When the new input is empty, the prompt and `AIRun.input_digest` stay byte-identical to today.
6. **Local-first character preserved.** Gallery creation stays local-first. Server-side features apply to server-backed pieces; nothing here makes a local piece require the network.
7. **Terminology.** User-facing words are "Project history", "Intent notes", "Compare versions", "More like this"; LIGDOL's name and jargon do not appear in the product.

## 2. Concept map: what exists, what is missing, what we do

| LIGDOL concept | Already in this app | Gap | Disposition |
|---|---|---|---|
| Project Graph (source of truth) | `Project`/`Project3D`/`ArtPiece`, `SceneVersion*`/`ArtPieceVersion` (origin, parent, fork source), media assets, `AIRun` (prompt, scope, targets, assets, plan, patch, summary, status), `ForkProvenance`, `ProjectActivity` | Pieces exist, but decisions and rejections are not recorded: `ProjectActivity` defines 11 event types and **only 3 are ever written** (`published`, `unpublished`, `forked`; `backend/scenes/api.py:240,297,827`), there is no read API and no UI. AIRun has no "rejected" status; discard = `cancelled`. | Slice A (issues A1–A5) |
| Remember (history, decisions, rejections) | Version history panel (`VersionHistoryPanel.tsx`), `AIRun` rows | No timeline; no reason captured for accepting or discarding an AI proposal. | Slice A |
| Judge (review, compare options) | AI proposal review (`AIProposalPanel.tsx`), accept/cancel (`ai_runs_api.py`), version restore | No way to compare two versions. | Slice B (B1–B2) |
| Creative Memory — intent and constraints | Account-level `AIPersona` (a named, additive system-prompt add-on) already feeds AI prompts | No per-project intent/constraints. | Owner decision D1, then M1–M3 |
| Context Engine / AI Orchestration | AI create/edit/agent runs with plans, repairs, vendor/model preference, personas | Context is only the scene + prompt (+ persona). | M3 (bounded, disclosed brief) |
| Discovery (feed, search, explore) | Gallery, public search/filters, profiles, collections | No "related work"; no recommendations. | Slice C (C1–C2), metadata-based, no ML |
| Bring a reference into a project | Fork/remix with `ForkProvenance`; media library; collections | No lightweight "save as reference" that is not a fork. | Deferred; depends on decision D2 |
| Share (show process) | Publishing; generated-piece pages show version context | Process of 2D/3D pieces is not shareable. | Deferred until Slice A proves the log (owner decision on public exposure) |
| North star ("Project 2 takes less effort") | `AIRun` + (after A1/A2) activity data | No measurement. | E1 (owner-only aggregate) |
| Inquiry ("talk to it") | Whole-scene "Ask AI to improve" for editing | Read-only Q&A about a piece. | Deferred: AI quota is already exhaustible (`.agents/memory/ai-feature-daily-quota-exhaustible-by-retesting.md`) |
| Social graph: DMs, communities, notifications, calls | Profiles, collections, collection comments | Entire messaging/community layer. | Non-goal for this app (separate product, heavy moderation/infra) |
| Context APIs, vector DB, multi-agent orchestration, external-tool routing (Figma, Ideogram, Higgsfield) | Engines and AI providers already abstracted (`ai_provider/`) | New infra and third-party dependencies. | Non-goal now; revisit only with an owner-approved dependency review (`AGENTS.md` §8) |

## 3. Filed issues (Batch 16) and order

Decisions first (they only record an owner choice, no code): **D1** where project intent lives; **D2** whether the history log generalizes beyond the structured 2D editor.

Slice A — Remember (structured 2D editor, server-backed): **A1** write version lifecycle events → **A2** write AI accept/discard events with optional reason → **A3** owner-only read API → **A4** Project history UI → **A5** optional "why" note in the AI proposal panel.
Slice B — Judge: **B1** scene diff summary function → **B2** Compare versions UI.
Slice M — Intent notes (after D1): **M1** field + API + export/deletion → **M2** editor UI → **M3** bounded, disclosed AI context.
Slice C — Discovery: **C1** related-pieces query → **C2** "More like this" on the public 2D piece page.
Slice E — **E1** owner-only continuity metrics (after A1, A2).

**Issue key:** D1 = [#1129](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1129), D2 = [#1130](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1130), A1 = [#1131](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1131), A2 = [#1132](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1132), A3 = [#1133](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1133), A4 = [#1134](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1134), A5 = [#1135](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1135), B1 = [#1136](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1136), B2 = [#1137](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1137), M1 = [#1138](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1138), M2 = [#1139](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1139), M3 = [#1140](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1140), C1 = [#1141](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1141), C2 = [#1142](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1142), E1 = [#1143](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/1143). Milestone: [Batch 16](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/milestone/16).

Suggested start: A1 and A2 in parallel, then A3 → A4 → A5; B1 and C1 are independent and can fill gaps. M-slice waits for D1.

## 4. Owner decisions requested

- **D1 — where "intent notes" live** (recommended: per-project server field, 2D structured first). Alternatives: reuse account-level `AIPersona` only (zero schema, no per-project intent); or per-project local IndexedDB field sent with each AI request (local-first parity, but needs a local schema v6).
- **D2 — history beyond 2D.** The activity log is keyed to the 2D `Project` model only. Options: (a) keep 2D-only for now; (b) make `ProjectActivity.project` nullable and add nullable `project3d`/`art_piece` FKs; (c) a new generic event table. Recommended: (a) until Slice A proves its value, then (c).

## 5. Rollback and risk summary

Each issue is independently revertible. Schema-bearing issues (M1 only; A-slice reuses an existing table) add one nullable/defaulted column and can be left in place when the UI is reverted. The AI-context change (M3) is a no-op when the field is empty, which is the safety valve if prompts regress.
