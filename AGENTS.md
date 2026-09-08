Layout

- Backend: Django project in `backend/` (`backend/manage.py`,
  `backend/backend/` — the Django settings package, renamed from the
  former `config/` — `backend/tests/`)
- Frontend: React/TypeScript/Vite app in `frontend/`
- `backend/scenes/`: Django app for the canonical scene domain — `validation.py`
  (Tasks 5-7), `models.py` (Tasks 8-10), `permissions.py` (Task 11), the
  single authorization service every project/version/draft/template
  endpoint must go through.
- `schema/`: the canonical scene JSON Schema, complexity/payload limits,
  and shared fixtures — the single contract both `backend/scenes/validation.py`
  and `frontend/src/validation/scene.ts` validate against. See
  `schema/README.md`.
- `frontend/src/api/`: typed fetch wrappers for the Django API
  (`client.ts` handles the session cookie + CSRF header; `auth.ts`,
  `projects.ts` are the per-resource calls). Requests use relative paths
  (`/api/...`) — `vite.config.ts` proxies them to Django in dev so the
  browser sees everything as same-origin (no CORS/SameSite cookie
  configuration needed).
- `frontend/src/auth/`: `AuthProvider`/`useAuth` — who, if anyone, is
  signed in, checked once via `GET /api/whoami/`.
- `frontend/src/pages/`, `frontend/src/components/`: routed pages
  (`Gallery`, `ProjectMetadataForm`, `EditorPlaceholder`, `Home`) and
  shared UI (`ProjectCard`, `Layout`) — see `App.tsx` for the route table.

## Durable agent memory

Before making a non-trivial change, read
`.agents/memory/MEMORY.md`, then open the linked topic pages relevant to the
boundary being changed. The index records durable lessons that are easy to
miss from the current source alone, especially Replit publishing/database
behavior, authentication and secret handling, Git push safety, and browser
test prerequisites.

When work reveals a new non-obvious, durable constraint, update or add one
topic page and one concise index entry before finishing. Do not use memory as
a changelog, and never store credentials, tokens, connection strings, or
other sensitive values there.

Pending implementation and verification work belongs in `docs/tasks.md`,
using `docs/task-template.md` and, when needed, a `.local/tasks/<slug>.md`
execution plan. Do not put ordinary TODOs or task status in memory. Use
`.agents/memory/` only for durable unresolved constraints, platform behavior,
decisions, or lessons that future agents would otherwise lose. The complete
capture and reconciliation loop is documented in `docs/process.md`.

**Discovery gate:** whenever exploration, implementation, QA, or review finds
an actionable issue outside the current scope, stop and check for duplicates
in the backlog, task files, and GitHub issues. If it is new, create a
`PROPOSED` backlog entry and matching GitHub issue, link both records, and
only then continue or defer the work. If issue access is unavailable, record
the missing link explicitly instead of dropping the item. Reconcile newly
discovered issues before declaring the current task complete.

Environment setup (clean checkout)

Django reads required settings (secret key, PostgreSQL `DATABASE_URL`)
from environment variables and fails fast, naming the missing or
malformed variable, if any are unset — see `backend/backend/settings.py`.
`backend/.env.example` and `frontend/.env.example` document every
variable Django, PostgreSQL, and the frontend use; neither example file
contains real credentials. `.env` files are gitignored and must never be
committed.

The codebase should be implemented and designed as such to where it works as a Replit web application and a local deployment.

`DATABASE_URL` must point at a real, reachable PostgreSQL server — there
is no SQLite fallback outside the test suite. In Replit-deployed
environments Replit's managed PostgreSQL integration supplies
`DATABASE_URL` automatically, with development and production Repls each
getting their own separate database; for local development outside
Replit, point it at your own PostgreSQL server (see `.env.example`).

1. Install backend dependencies: `cd backend && uv sync`
2. Create your local backend env file (from `backend/`):
   `cp .env.example .env`, then edit `backend/.env`:
   - Set `DJANGO_SECRET_KEY` to a real generated value:
     `uv run python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
   - Set `DATABASE_URL` to a real PostgreSQL connection URL.
   - Set `CSRF_TRUSTED_ORIGINS` to the exact comma-separated scheme-and-host
     origins used locally or by the Replit preview/deployment (for example
     `https://animate.creatrweb.com`); do not use a wildcard or path.
   - Set `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET` to a real
     Google OAuth client (see `backend/.env.example`); Google sign-in
     doesn't work against real accounts with the placeholder values, but
     everything else — including the whole test suite — works fine
     without them until [issue #75](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/75) provisions real ones.
3. Install frontend dependencies: `cd frontend && npm install`
4. Create your local frontend env file: `cp frontend/.env.example frontend/.env`
5. Apply database migrations (from `backend/`):
   `uv run --env-file .env python manage.py migrate`
6. Start the backend dev server (from `backend/`):
   `uv run --env-file .env python manage.py runserver`
7. In a second terminal, start the frontend dev server: `cd frontend && npm run dev`
8. Check application and database availability at any time:
   `GET /health/` (no connection details are exposed in the response).
9. Sign in with Google at `/accounts/login/`; `GET /api/whoami/` is a
   minimal example of a login-required route.

`--env-file .env` (a built-in `uv run` flag, not an extra dependency)
loads `backend/.env` into the process environment for that command when run
from `backend/`. Vite loads `frontend/.env` on its own, so `npm run
dev`/`npm test`/`npm run build` need no extra flag.

Frontend dev server port, `CSRF_TRUSTED_ORIGINS`, and Google OAuth must
stay in sync: `frontend/vite.config.ts` fixes the Vite dev server
(`npm run dev`) at port `5000` with `strictPort: true`, so it always
either starts on `http://localhost:5000` or fails loudly with Vite's own
"Port 5000 is already in use" error — it never silently drifts to
5001/5002/etc. Local sign-in is served through that frontend origin (the
Vite dev server proxies `/accounts`, `/api`, and `/health` to Django —
see the `server.proxy` comment in `vite.config.ts`), so three things must
name the exact same port together, and changing the port means updating
all three:

1. `frontend/vite.config.ts`'s `server.port`.
2. `backend/.env`'s `CSRF_TRUSTED_ORIGINS`, which must include
   `http://localhost:5000`.
3. The Google OAuth client's registered "Authorized redirect URI"
   (`http://localhost:5000/accounts/google/login/callback/`) and
   "Authorized JavaScript origin" (`http://localhost:5000`).

A mismatch among these three shows up as `redirect_uri_mismatch` from
Google during sign-in. Known gotcha on macOS: AirPlay Receiver also
listens on port 5000 by default, which is what most often occupies it
before `npm run dev` ever runs. Fix it by disabling AirPlay Receiver
(System Settings → General → AirDrop & Handoff → AirPlay Receiver), or,
if you'd rather keep it enabled, change the fixed port everywhere it's
referenced (`vite.config.ts`, `backend/.env`'s `CSRF_TRUSTED_ORIGINS`, and
the Google OAuth client) — see "Out of scope" in
[issue #86](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/86)
for why the port isn't made configurable via an environment variable
instead.

Deployment tracks and preflight

Keep deployment environments isolated: Replit development and Replit
published production receive different `DATABASE_URL` values from their
respective environment configuration. An external local deployment must use
its own non-production PostgreSQL URL in `backend/.env`; never copy a
published database URL or production secret into that file.
`POSTGRES_TEST_DATABASE_URL` is optional and only used by PostgreSQL health
tests; if set, it must point at a separate disposable test database.

For a Replit publish, the deployment build (`.replit`'s `[deployment].build`)
runs dependency installation, `manage.py check --deploy`, and the frontend
build — it does not run migrations. Development migrations run through
`scripts/post-merge.sh` (Replit's post-merge/development setup flow); Replit's
Publish flow separately compares development and production schemas and
applies the diff. `scripts/start.sh` (the deployment runtime) only runs
`manage.py migrate` when `RUN_MIGRATIONS_ON_START=true` is explicitly set, and
otherwise waits for Django health before starting Vite. See
`.agents/memory/replit-production-schema-publishing.md` for why migrations
must stay out of the deployment build. Replit Secrets and the production
environment supply the production database, OAuth, Mistral encryption, and
mail settings; local values are not reused. `.replit`'s `[userenv]` blocks
are workspace-scoped (the interactive Agent/dev workspace), not confirmed to
reach the published deployment process; `[userenv.production]` is pinned to
production-safe `DJANGO_DEBUG`/`DJANGO_ALLOWED_HOSTS` values as
defense-in-depth regardless of that precedence. See
`.agents/memory/replit-userenv-scope.md`.

For an external non-production deployment, create `backend/.env` from
`backend/.env.example`, set its own PostgreSQL `DATABASE_URL`, then run
(from the repo root; the `make` targets below `cd` into `backend/` or
`frontend/` as each command needs):

```bash
cd backend && uv sync --locked && cd ..
npm --prefix frontend ci
make deploy-check
make migrate
BASE_URL=http://localhost:5000 make smoke-local
```

Production-like settings use `DJANGO_DEBUG=False`, explicit
`DJANGO_ALLOWED_HOSTS`, HTTPS redirects, secure session/CSRF cookies, and a
reviewed positive `DJANGO_SECURE_HSTS_SECONDS`. Production mail defaults to
SMTP and must not use console, locmem, or dummy backends. Missing required
values or unsafe combinations fail before startup without printing
connection strings or secrets. Treat any `make deploy-check` warning as a
release blocker.

The published anonymous smoke check is credential-free:

```bash
PUBLISHED_APP_URL=https://published.example.com scripts/smoke-published.sh
```

It waits for `/health/`, then checks `/`, anonymous `/api/whoami/`, and the
login form. The authenticated smoke path is only for an external local or
disposable PostgreSQL deployment: `make smoke-local` creates fixture users,
logs in one, checks authenticated `/api/whoami/`, and removes the fixtures
even when the check fails. Never run it against a shared or published
database.

Commands

Quality checks (run from the repo root):

- `make check` - every backend and frontend check below, in one command;
  this is exactly what CI (`.github/workflows/ci.yml`) runs on every push
  and pull request
- `make lint` / `make format` / `make format-check` / `make typecheck` /
  `make test` - one check across both stacks
- `make backend-lint` / `make backend-format` / `make backend-format-check`
  / `make backend-typecheck` / `make backend-test` - one backend check
- `make frontend-lint` / `make frontend-format` / `make frontend-format-check`
  / `make frontend-typecheck` / `make frontend-test` - one frontend check

Backend (run from `backend/`):

- `uv sync` - install dependencies
- `uv run ruff check .` - lint
- `uv run ruff format .` - format (add `--check` to only verify)
- `uv run mypy .` - type-check (uses `backend.test_settings`'s
  (`backend/backend/test_settings.py`) safe defaults; no real `.env` needed)
- `uv run pytest` - the whole suite (runs offline, without a real `.env`,
  using safe test-only defaults from `backend.test_settings`; SQLite
  backs `default`, and the small number of tests in `tests/test_health.py`
  that need real PostgreSQL semantics skip themselves unless
  `POSTGRES_TEST_DATABASE_URL` is set — see `.env.example`)
- `uv run pytest tests/test_home.py` - one test file
- `uv run --env-file .env python manage.py migrate` - apply DB migrations
- `uv run --env-file .env python manage.py runserver` - start the backend dev server
- `GIT_URL=... make git-safe-push` (from the repo root) - refresh and
  safely push `main` without force-pushing or persisting the credential

Frontend (run from `frontend/`):

- `npm install` - install dependencies
- `npm run lint` - lint (oxlint)
- `npm run format` - format with Prettier (add `:check` to only verify)
- `npm run typecheck` - type-check (`tsc -b`)
- `npm test` - the whole suite (`vitest run`)
- `npm run build` - type-check and production build
- `npm run dev` - start the frontend dev server

End-to-end tests (Playwright)

Task 65 (issue #65) added a real-browser project-lifecycle end-to-end
suite (`frontend/e2e/`), covering blank/template project creation, shape
editing, save, version history, restore, and soft-delete against a real
Django + PostgreSQL stack. Task 66/issue #68 added a companion
interaction-runtime suite (`interactionRuntime.spec.ts`), and Task
66/issue #66 added a companion AI-proposal/draft-recovery suite
(`aiAndRecovery.spec.ts`) — same infrastructure, same conventions. All
three are deliberately **not** part of `make check`/`npm test`: unlike
every other test in this repo they need a real, already-*running*
PostgreSQL-backed Django dev server and the Vite dev server, and
Playwright's own downloaded browser binaries. SQLite cannot satisfy this
suite — several scenarios exist specifically to prove
transaction/concurrency guarantees SQLite doesn't provide.

- `make e2e` (from the repo root) - run the whole suite; equivalent to
  `cd frontend && npm run test:e2e` (`playwright test`)
- `make compose-preflight` - read-only verification that an already-running
  Docker Compose stack belongs to this repository (`ai-dev-tools-zoomcamp-1`),
  was created from the repository's `compose.yaml`, and serves this app's
  health/root/auth identity before browser scenarios use it. It never starts,
  stops, or removes containers; it reports the exact conflicting project and
  safe start command when the wrong stack is running.
- CI's `Responsive shell E2E` job provisions PostgreSQL, installs Chromium
  with Linux browser dependencies, applies migrations, starts Django and
  Vite, and runs `responsiveShell.spec.ts` at its 375px viewport. Its
  disposable `DATABASE_URL` and test-only OAuth values are written to
  `backend/.env` because Playwright global setup loads that file before
  creating fixtures (`frontend/e2e/support/global-setup.ts`/
  `global-teardown.ts` shell out to `manage.py e2e_fixtures` with `cwd`
  set to `backend/` and look for `backend/.env`, updated for task
  217/issue #249's move of the backend into `backend/`).
- `cd frontend && npx playwright test --list` - list every scenario
  without running a browser; useful to confirm the suite is syntactically
  valid and every test is discoverable with no server running at all
- `cd frontend && npx playwright install --with-deps chromium firefox webkit`
  - on a supported Ubuntu/Debian host, one-time download of the browser
  builds plus the Linux libraries their exact builds require (only needed
  once per machine, not before every run). The `--with-deps` step is
  important for WebKit: its ABI dependencies include the matching ICU,
  `libatomic`, Opus, and GStreamer codec libraries, so installing similarly
  named but different Nix libraries is not a supported substitute.
- `make webkit-fullscreen` (from the repo root) - run the exact WebKit
  fullscreen/Escape regression isolated in CI. Start the disposable local
  stack first with `make dev`, or set `E2E_BASE_URL` to another reachable
  Django/Vite origin. This target expands to:

  ```bash
  cd frontend && E2E_BASE_URL=http://localhost:5000 npm run test:e2e -- \
    e2e/manual2dStageChrome.spec.ts \
    --project=webkit \
    --grep "keeps the fullscreen command synchronized after browser Escape"
  ```

  The Replit Nix host may still reject the downloaded WebKit binary because
  its system library ABI differs from the browser build. In that environment,
  use the repository's CI `e2e-browser` job (or another disposable
  Ubuntu/Debian browser runner) as the approved validation path; it runs the
  same `npx playwright install --with-deps chromium firefox webkit` setup and
  the same regression command. A WebKit process-launch error is a host setup
  failure, not evidence that the fullscreen assertion failed.

Before running `make e2e`, in order:

1. A real, reachable PostgreSQL server (see "Environment setup" above —
   this suite does not work against SQLite).
2. `cd backend && uv run --env-file .env python manage.py migrate`
3. `AI_PROVIDER=fake uv run --env-file .env python manage.py runserver`
   (from `backend/`, leave running) — `AI_PROVIDER=fake` swaps every AI
   endpoint (`scenes/ai_api.py`'s `get_ai_provider`) to a deterministic,
   network-free fake provider (`ai_provider/e2e_provider.py`) instead of the
   real Mistral client, so `frontend/e2e/aiAndRecovery.spec.ts` (Task 66,
   issue #66) never needs a real `MISTRAL_API_KEY`. Every other suite
   (`projectLifecycle.spec.ts`, `interactionRuntime.spec.ts`) runs the
   same either way — this only affects the three AI endpoints. Omitting
   it just makes `aiAndRecovery.spec.ts` self-skip its AI scenarios with
   an actionable message; nothing else is affected.
4. `cd frontend && npm run dev` (leave running, in another terminal)

The suite signs in through the real `/accounts/login/` allauth
email/password form (not Google OAuth, which needs real third-party
credentials — see issue #75 above) as two deterministic fixture users a
Playwright `globalSetup` hook creates via `uv run --env-file .env python
manage.py e2e_fixtures create --json`
(`backend/scenes/management/commands/e2e_fixtures.py`) before the suite
runs, and removes via `e2e_fixtures cleanup` after it finishes, along with
every project/version they created — no fixture data or browser storage
(cookies/localStorage/IndexedDB) survives past one run (subject to the
known backend/-restructure gap in that `globalSetup` hook noted above). If
the dev server's `/health/` check isn't reachable when the suite starts,
every scenario self-skips with an actionable message instead of failing,
the same convention `backend.test_settings`'s `POSTGRES_TEST_DATABASE_URL`
gate already uses for backend-only PostgreSQL tests. Set `E2E_BASE_URL`
to point the suite at a different origin than the default
  `http://localhost:5000`.

Rules

- Dependencies are added in `pyproject.toml`. Do not add one without asking.
  Once a dependency is authorized, add it with `uv add <PACKAGE-NAME>`
  (this updates `pyproject.toml` and `uv.lock` together) rather than
  editing `pyproject.toml` by hand.
- Commit regularly. Agents doing multi-step work in this repo should
  commit coherent, working increments as they go rather than
  accumulating a single large uncommitted change.

Documents

- `docs/process.md` - how work is organized


<!-- ===== BEGIN CREATRWEB ORCHESTRATOR ===== -->

## Creatrweb Agentic Workflow System

> **Context: general.** This file is pre-adapted for the `general` context.
> It carries no domain-specific obligations beyond conventional
> web-application practice.
> Installed via `START-HERE.md`, which adapts to whatever agentic markdown the
> repo already has and creates only what is missing.
>
> This folder ships only what cannot be reconstructed: this orchestrator, the
> two process files, `START-HERE.md`, the two setup prompts, and the skills.
> Everything else is generated at install time.

> **Read this section first, every session.** It is the entry point for every
> tool. It holds the rules that never change regardless of how the work is
> shaped, and routes the mechanics to the right process file.
>
> **Precedence.** Explicit session statement > SESSION CONSTRAINTS block > this
> system > `LOOP-AGENTS.md` / `GRAPH-AGENTS.md` > skills.
>
> **If this block was appended to an existing `AGENTS.md`:** everything above it
> is that repo's own standing instruction set and takes precedence over
> everything below. Those rules encode decisions someone actually made about
> this codebase. Where a rule above and a rule below disagree, follow the one
> above, name the conflict to the person, and let them decide — never resolve it
> silently in either direction, and never delete either rule. Where a rule above
> already covers one below, note the overlap rather than applying both as if
> they were separate requirements.
>
> **Section references are scoped to this block.** Throughout this system and
> its companion files, "Section N" means Section N of this block — not of any
> content preceding it. If the surrounding file already numbers its own
> sections, the two numbering schemes are independent and do not interact.

## 0. Routing — which process file governs this work

Decide once, at session start, and state the answer:

| This repo | Process file | How it runs |
|---|---|---|
| One codebase, one deploy target, one production surface | `LOOP-AGENTS.md` | Read it in full. Its Section 0 Merge Protocol classifies the repo before anything is written. |
| More than one repo, deploy target, or independently-owned codebase | `GRAPH-AGENTS.md` | Read it in full. Each node in the graph still runs `LOOP-AGENTS.md` internally. |

If the answer is genuinely unclear — a monorepo with independently deployed
packages, say — that ambiguity is a Rule 1 question. Ask it before proceeding;
do not pick silently.

`GRAPH-AGENTS.md` never replaces `LOOP-AGENTS.md`. It sits one level above it,
coordinating nodes that each run their own loop.

## 1. Six Rules
1. **Ask one question first.** Before any significant change, ask one
   assumption-surfacing question — not a checklist, one question that exposes
   the biggest unstated assumption.
2. **Show options before committing.** Before any design or architecture
   decision, present 2–3 concrete options (gallery format: name, trade-off,
   one-line recommendation) rather than picking silently.
3. **Stop at every Irreversible Decision.** See the table in `LOOP-AGENTS.md` Section 3. No
   exceptions, no "I'll just proceed and mention it after." This includes any
   Case D/E restructuring of a pre-existing documentation network.
4. **The person owns everything.** Final call on stack, architecture, and any
   unconventional choice belongs to the person, even against your own
   recommendation. Support the choice once made — don't relitigate it mid-loop.
5. **Public interfaces never break silently.** Any live route, API contract,
   or exported function signature that's already in production use requires a
   permanent-redirect or backward-compatible shim plan, confirmed before
   deletion or breaking change.
6. **If the specified tool/model/tech is non-functional, stop.** State the
   issue plainly, present alternatives via gallery format, and get confirmation.
   No silent fallback to a different model or library.

## 2. Brainstorm Mode
Enter Brainstorm Mode when the person says "I'm not sure" or "what if", or
asks an open-ended question with no deliverable attached. On entry, ask one
premise question first. Write no files, no code, and request no approvals
while in this mode.

Ideation and implementation are separate modes. While brainstorming, do not
write code or open files for editing. To exit Brainstorm Mode: restate the
chosen direction as an explicit hypothesis ("We're going with X because Y"),
get the person's confirmation, then switch to implementation mode. Never slide
from brainstorming into code changes without this explicit hand-off.

Brainstorm Mode is not applicable in Auto Build mode (see Section 4).

## 3. Pre-Write Check (every file write, no exceptions)
1. Is this file in the Irreversible Decisions table (`LOOP-AGENTS.md` Section 3)? → Stop and
   confirm.
2. Does this modify the public API contract? → Update `docs/api.md` first.
3. Does this install a package or call an external service? → Update
   `docs/dependencies.md` first, and ask the Section 8 question.

## 4. Mode
| Mode | Tools | Behavior |
|---|---|---|
| Interactive | Kilo Code, Opencode | Full question + gallery protocols |
| Plan/Propose | Kilo Code Plan slot, Claude Code / Gemini CLI Plan Mode | Gallery as the plan; no code until approved |
| Auto Build | Opencode Orchestrator slot | Conservative defaults; log choices to `DECISIONS.md` |
| Inline Edit | Kilo Code autocomplete (Codestral) | Mechanical only; no architectural decisions |

In any mode: if a mandatory checkpoint is reached with no human available,
stop and log it in `DECISIONS.md`.

**Plan Mode gallery suppression.** When the agent is in Plan Mode and the
person's prompt names a specific route, file, or output format, that
specificity suppresses the gallery — the prompt reads as a directive. Note the
suppression explicitly at the top of the plan and offer one alternative
framing before building. This surfaces the trade-off even when the prompt
signals execution intent. This rule was learned from a real Rule 2 violation:
an agent in Plan Mode implemented a named route without ever showing a
gallery, and only the post-session eval caught it.

## 5. Agent Use
Default to single-turn calls. Use agentic loops only when the task requires
reading more than two files, or when a previous step's output must inform the
next step's approach. Log every agent loop initiation in `DECISIONS.md`.

## 6. Session Constraints
When an opening prompt contains a SESSION CONSTRAINTS or PHASE CONSTRAINTS
block, treat every item as an extension of the Six Rules for that session. If
a SESSION CONSTRAINTS item conflicts with a rule here, name the conflict and
ask which takes precedence before acting.

At session start, before any build work:

1. Read `DECISIONS.md`. Surface any open REVIEW REQUIRED items. Wait for
   sign-off.
2. Read `MEMORY.md`. Surface any PENDING CONFIRMATION entries. Wait for
   confirmation or rejection.
3. Only then proceed.

## 7. Core Constraints (always binding)
- The person is always the named author. AI prose intended for publication is
  a draft for human review only.
- No fabricated citations, links, or references.
- No data transmitted off-domain without disclosure.
- Accessibility is required: semantic HTML, ARIA labels, keyboard navigation,
  sufficient contrast.

## 8. New Vendor Dependency (mandatory question, always ask)
> "This dependency sends data to [service]. If [service] changes its API,
> pricing, or shuts down, [describe what breaks]. The self-hosting alternative
> is [X]. Should I proceed and document this in `docs/dependencies.md`?"

Ask even when the person appears to have already decided.

## 9. Skills (load on demand only — never pre-load)
Base skill set, shared by every adaptation:

| Skill | Load when |
|---|---|
| `gallery-format` | Rule 2 fires; options are needed before any design or architecture decision |
| `design-workflow` | `DESIGN.md` is empty, or a gallery needs Derived Identity or Observed Taste |
| `socratic-depth` | Rule 1 fires; a question must be asked before a significant change |
| `testing` | Before releasing any spec route or merging any branch |
| `memory-files` | End of session; proposing `MEMORY.md` or `DECISIONS.md` updates |

Loop skills, added by this repo's multi-service adaptation
(`LOOP-AGENTS.md` Section 2):

| Skill | Load when |
|---|---|
| `task-distillation` | Turning a request, review, failure, or readiness finding into a reconciled backlog; before any engineering pass begins |
| `backlog-session` | Working through the project backlog and its GitHub issues; orchestrates the per-issue loop and owns the transaction ledger |
| `qa-self-review` | Stage 4 — a diff is ready for QA, whatever service produced it |
| `production-readiness` | Stage 5 — assessing a reconciled backlog batch for deployment and release readiness |
| `session-completion` | End of a backlog run; batch reconciliation, rollup, and handoff |

Skills live at `.claude/skills/<name>/SKILL.md` with an identical mirror at
`.agents/skills/<name>/SKILL.md`. Adaptations add skills on top of this set;
they never remove one.

Stages rostered to non-Claude services are **not** skills — those services
cannot invoke one. They live as portable prompt documents at
`.agents/skills/<stage>/PROMPT.md` (`issue-scoping`,
`implementation-mechanical`, `implementation-complex`,
`second-opinion-review`), with `.agents/skills/_shared/HANDOFF-CONTRACT.md`
as the single source of truth for the stage map, advisory routing,
provenance, handoff artifacts, and the untrusted-external-input rules.

**Skills already in the repo are never deleted.** A skill that predates this
system is a decision someone made about how this codebase should be worked on.
Evaluate it, keep it, and register it in the table above with an explicit load
trigger so it participates in the same on-demand discipline as the rest. Modify
it only far enough to fit — add a trigger, add front matter, cross-reference a
rule it depends on — and never rewrite its substance without confirmation. If
an existing skill overlaps one shipped here, say so and let the person choose
which survives; do not merge them silently or assume the shipped one wins.

> Token budget: each skill costs 300–2,400 tokens. On free-tier or
> rate-limited models, load a skill only when that skill's work is the focus
> of the current exchange.

## 10. Memory & Decision Files
At the end of every session, propose (don't silently write) 1–3 entries for
`MEMORY.md`, `DECISIONS.md`, and `CONSTRAINTS.md` — or, for Case E repos,
follow the existing active/archive convention already in place rather than
appending to the top-level file indefinitely.

**File ownership and read cadence:**

| File | Written by | Read every session |
|---|---|---|
| `AGENTS.md` | Human only | Yes |
| `MEMORY.md` | Agent (on confirmation) | Yes |
| `DECISIONS.md` | Agent | Yes |
| `CONSTRAINTS.md` | Agent (on statement) | Yes |
| `DESIGN.md` | Human + agent | Only when design work occurs |

At the end of an interactive session, propose 1–3 `MEMORY.md` entries plus any
`DESIGN.md` Observed Taste entries. Ask before writing either. If the proposal
step is skipped, log it as an unresolved checkpoint in `DECISIONS.md`.

Where a repo's process file defines its own extension-file mapping, that table
lives in `LOOP-AGENTS.md` Section 4 (or `GRAPH-AGENTS.md` Section 7), not here.

## 11. AGENTS.md Safeguard
Never edit this file without explicit human instruction. Any change is
proposed as a clearly marked diff, waits for approval, and is then logged in
`DECISIONS.md` and summarized in `MEMORY.md`. A non-empty `AGENTS.md` is the
standing instruction set — "populate", "update", or "fill in" applied to a
non-empty `AGENTS.md` means propose an append, never a replacement.

## 12. Post-Session Eval

Score Pass / Partial / Fail with one sentence of evidence for each. Run this
after any session that touched something significant, before the issue is
closed.

1. Was Rule 1 followed — one question before each significant change?
2. Was Rule 2 followed — 2–3 options shown before any design commitment?
3. Was Rule 3 followed — did the agent stop at every Irreversible Decisions item?
4. Was Rule 6 followed — no silent fallback when a tool/model was unavailable?
5. Was the readiness gate run by a frontier-tier model, not downgraded?
6. Were memory/decision updates proposed in whatever form (or archive
   convention) this repo already uses?
7. If Case D or E, was Goal Extraction completed and were original documents'
   goals and existing archival conventions preserved before any restructuring?
8. Was Brainstorm Mode exited properly — direction restated as an explicit
   hypothesis and confirmed — rather than sliding into implementation?
9. Were any pre-existing skills preserved and registered rather than replaced?

For multi-service work, run `GRAPH-AGENTS.md` Section 8's graph-level eval in
addition to this one, not instead of it.

## 13. Project Specific Rules
