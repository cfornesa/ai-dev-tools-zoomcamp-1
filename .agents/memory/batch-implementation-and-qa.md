---
name: batch-implementation-and-qa
description: Owner-mandated 2026-10-01 — issues stay atomic, but implementation and QA run in session batches with an impact analysis across all open issues and a batch gate before closure.
metadata:
  type: project
---

Implementation and QA are batched per session (regardless of milestone, with milestone recorded per issue); issues are still created and groomed atomically, with one commit per issue. A mandatory impact matrix searches every changed or deleted shared surface (files, CSS regions, selectors, routes, APIs, fixtures, helpers, specs) against **all** open issues, in or out of the batch. A batch gate (per-issue QA matrices, union of focused checks, one full `make check`, matrix re-verification, cross-issue review) must pass before any issue in the batch closes; a failing issue and its dependents stay open.

**Why:** per-issue closure repeatedly caused follow-up churn: a shared inline-toolbar CSS region edited by #1110/#1111/#1114/#1120, an unscoped CSS rule contradicting #1111's own "2D unchanged" criterion, #1119's wrong embed premise, #1112 blocked behind #1108 and #1114.

**How to apply:** follow `docs/process.md` "Canonical batch transaction" and the `backlog-session` skill; exceptions (hotfix, no-overlap/unshareable environment, explicit owner request, gate impossible) must be recorded in the ledger. Rule 4 separation of duties and the discovery gate are unchanged. "Batch N" milestone names are historical and unrelated to session batches. See [[atomic-task-sizing]].
