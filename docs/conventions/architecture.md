# Architecture conventions

See [`CONVENTIONS.md`](../../CONVENTIONS.md) for the headline correction;
this page has the supporting evidence and the resulting rules.

## The real topology (not microservices)

- `compose.yaml` (repo root) defines exactly 3 services: `postgres`
  (postgres:16-alpine), `backend` (Django, built from `docker/
  backend.Dockerfile`), `frontend` (Vite, built from `docker/
  frontend.Dockerfile`, `depends_on: backend: condition: service_healthy`).
- `.replit` has one deployment target running `scripts/start.sh` as its
  `run` command. `scripts/start.sh` starts exactly 2 runtime processes —
  Django (`manage.py runserver` or `uvicorn` if `BACKEND_SERVE_MODE=asgi`)
  and, only after polling Django's `/health/` until healthy, Vite (dev or
  `preview` mode) — under one shared lifecycle: started together, torn down
  together by a single `cleanup()` trap on EXIT/INT/TERM.
- Vite proxies `/api`, `/accounts`, `/health` to Django on localhost in dev
  (`vite.config.ts`'s `server.proxy`, consumed by `frontend/src/api/
  client.ts`) and serves a static build in production
  (`FRONTEND_SERVE_MODE=preview`).
- The Django/Vite port split (`backend_port`/`frontend_port` in `scripts/
  start.sh`) is a Replit deployment-platform constraint (Replit's deploy
  `PORT` belongs to Vite), not a service-boundary decision.

**Rule:** describe this app as a two-process monolith with a frontend dev/
preview server, not as microservices, in any future architecture doc, issue,
or onboarding material. If a genuinely separate, independently-deployable
service is ever introduced, that's a real architecture change needing its
own `docs/plan.md`/`AGENTS.md` update and an explicit owner decision — not
something to describe retroactively as having "always been microservices."

## The external-adapter pattern

Mistral, Gemini, DeepSeek (`backend/ai_provider/{mistral,gemini,deepseek}_
provider.py`) and PayPal (`backend/scenes/paypal_adapter.py`) are external
third-party SaaS APIs called in-process from Django via `httpx`/`requests`
— not internal services. Each vendor gets its own `<vendor>_provider.py` or
`<vendor>_adapter.py` file; `paypal_adapter.py`'s own docstring frames this
explicitly: "kept as its own thin module so tests substitute the HTTP call
directly," contrasting it with in-process business logic.

**Rule:** a new third-party integration gets its own `<vendor>_provider.py`
(AI/generation-style vendors) or `<vendor>_adapter.py` (transactional/
webhook-style vendors) file, isolated from the domain logic that consumes
it, following the same naming split. `httpx`/`requests` calls to that
vendor's base URL originate only from that adapter module — not scattered
across `backend/scenes/*_api.py` view files.

## Env-var-driven service configuration

Every external integration is enabled/disabled by its env vars, not by a
code branch someone has to remember to flip: GitHub/LinkedIn OAuth and
PayPal are all documented as "optional, all-or-nothing" (missing one
required var in a group is a startup configuration error, not a valid
half-enabled state — see `backend/backend/settings.py`'s validation at
boot). See [`python.md`](python.md)'s env-var-discipline section for the
`.env.example`-sync rule this implies for any new integration.
