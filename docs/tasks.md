# Creatrweb Animation Studio Backlog

## 2026-09-05 backlog implementation continuation

The earlier 2026-09-04 report was an audit snapshot. This continuation is
implementation work: #414, #415, #416, #404, and the #409 foundation now have
code and focused tests in the working tree.

- #414: production selects Django's shared database cache and migration
  `0026_create_django_cache_table`; development/tests retain isolated locmem.
- #415: production exports `BACKEND_SERVE_MODE=asgi` and launches pinned
  Uvicorn; local startup remains Django `runserver`.
- #416: local password signup is closed with an explicit Google-only policy;
  verified first-time Google social signup remains enabled.
- #404: finite Mistral/Gemini/DeepSeek registry and encrypted owner/vendor
  credential metadata endpoint were added without exposing plaintext.
- #409: the canonical schema now carries a versioned bounded draw.io subset,
  with mirrored client/server duplicate-ID and reference validation.
- #405/#406: Gemini and DeepSeek now have dependency-free server adapters for
  validated 2D/3D create/edit operations, with deterministic fake-client
  contract tests and owner credential routing.
- #407: account settings now expose named vendor credential cards, and 2D/3D
  AI proposal panels send a selected validated vendor/model pair.

The quota implementation was subsequently hardened: Django's stock database
cache increment was found to be read/modify/write under a real two-process
PostgreSQL run. `backend.database_cache.AtomicDatabaseCache` now uses a
PostgreSQL row lock, and `/health/` performs a cache round-trip so an
unavailable quota backend returns 503. The isolated worker test passes; CI
run 485 remains queued for clean-host confirmation.

Focused evidence: backend provider/auth/draw.io/cache tests pass; backend
scene validation tests pass (52); frontend scene validation tests pass (48)
and frontend typecheck passes. Full `make check` remains unavailable in this
managed host because its first target invokes an unavailable `python` binary;
startup subprocess/socket tests remain host-boundary failures documented in
the readiness report.

Status convention: Each completed item is marked `Status: COMPLETE` only after
its acceptance evidence is reconciled and the corresponding GitHub issue is
closed. Passing implementation or QA alone is not completion. Work that is
underway is marked `Status: ACTIVE`, and not-yet-started work is marked
`Status: PROPOSED`; blocked or handed-off work remains open with its owner,
blocker, and next action recorded.

Blocked-work continuation: a blocked issue does not stop the backlog session
or goal. After reconciling its blocker class, owner/context, exact next action,
and dependency edge, continue with the next independent closure-ready issue;
skip only issues that depend on the blocker. Halt the goal only when no
independent actionable work remains or all remaining work requires the same
unavailable external state. Engineering and testing remain strictly
per-issue, and completion still means GitHub closure.
For a dependency or environment blocker unrelated to the user's judgment or
decision, perform and record a fresh task-distillation reconciliation when that
issue ends, before selecting the next issue. Recheck duplicates, dependency
order, closure criteria, ownership, and follow-up issue coverage.

Closed-issue rule: completed issues stay closed. A current owner report that a
feature is absent or visually unusable is a new distillation signal, not an
automatic reopen. Create or reuse a criterion-ready follow-up linked to the
closed issue, preserving the original closure record. Reopening is permitted
only when the owner explicitly authorizes reopening that specific issue in the
current conversation. A closed GitHub state, DOM-role/bounds assertion, source
match, or shared-component QA comment is not sufficient to claim broader
parity; it is evidence only for the original issue's recorded scope.

CMS pieces parity boundary: the overarching goal is parity with the PHP
repository's pieces implementation as a behavioral/design reference, translated
into this Django/Python backend and React/TypeScript frontend. PHP is not
implemented here. The app must eventually create, render, publish, embed,
immerse, and package pieces like the maintained examples/fixtures. It does not
include unrelated augment-humankind CMS features such as blog, collections,
site administration, or other content types. Each issue must name its single
pieces surface or workflow.

## 1. Set up an empty project with a passing test
Goal: Create the minimal Django and React/TypeScript project structure and prove the test toolchain works.
Description: Initialize the backend and frontend applications, add their test runners, and document the local test commands. Include one trivial backend test and one trivial frontend test that both pass without implementing product behavior.
Status: COMPLETE

## 2. Add local development configuration
Goal: Make the empty application reproducible in a local development environment.
Description: Add example environment configuration for Django, PostgreSQL, the frontend, and required secrets without committing real credentials. Document the commands for installing dependencies, starting services, applying migrations, and running both applications.
Status: COMPLETE

## 3. Configure Replit-managed PostgreSQL and health checks
Goal: Connect deployed Django environments to Replit-managed PostgreSQL through `DATABASE_URL` while retaining SQLite only for isolated offline tests.
Description: Configure Django to consume the development or production `DATABASE_URL` supplied by Replit, document the separation between those databases, and add a lightweight endpoint that reports application and database availability without leaking connection details. Add PostgreSQL-backed tests for successful health responses and database connection failures, plus an explicit test-only SQLite path for tests that do not rely on PostgreSQL semantics.
Status: COMPLETE

