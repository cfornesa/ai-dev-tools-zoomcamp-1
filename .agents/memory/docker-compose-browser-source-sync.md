# Disposable Docker browser verification

Docker Compose builds the Django and Vite images without bind-mounting the
working tree. Browser verification therefore needs both the disposable stack
and `E2E_DOCKER_COMPOSE=true`, which makes Playwright create fixtures inside
the same PostgreSQL-backed containers.

When image rebuilds are blocked by transient registry metadata/network
failures, copying the already-reviewed working-tree source into the
disposable frontend/backend containers and restarting them is a valid local
QA fallback. It is not production evidence and must never be used as a
substitute for a committed image or a Replit publish.
