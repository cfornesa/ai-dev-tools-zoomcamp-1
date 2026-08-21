# Running Creatrweb Animation Studio on Replit

The `Start application` workflow runs the full development stack:

- Django serves the API on port 8000.
- Vite serves the React application and Replit preview on port 5000.
- Vite proxies `/api`, `/accounts`, and `/health` requests to Django, so
  browser requests stay same-origin.
- The publish-safe launcher is `scripts/start.sh`. It starts Django on port
  8000 and Vite on `PORT` (defaulting to 5000), and stops the companion
  process if either service exits.

The managed Replit PostgreSQL database is used through its automatically
supplied `DATABASE_URL`. Database migrations have been applied.

## Required secrets

Configure these through Replit Secrets:

- `DJANGO_SECRET_KEY`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `MISTRAL_API_KEY` (enables AI scene generation)
- `RECAPTCHA_SECRET_KEY` (only when signup protection is enabled)

Signup reCAPTCHA v3 is disabled by default for development. To enable it,
configure `RECAPTCHA_ENABLED`, `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`,
`RECAPTCHA_ACTION`, `RECAPTCHA_MIN_SCORE`, and
`RECAPTCHA_ALLOWED_HOSTNAMES`. Production refuses to start when protection is
enabled without the site key, secret, or allowed hostnames. Never expose the
secret to frontend code; only the public site key is rendered on signup.

For Google sign-in to work in the Replit preview, the OAuth client must allow
the current Replit development domain and its
`/accounts/google/login/callback/` redirect URL.

## Local checks

- Backend: `uv run python manage.py check`
- Backend tests: `uv run pytest`
- Frontend build: `cd frontend && npm run build`
- Frontend tests: `cd frontend && npm test`

## Startup commands

- Replit Run/Preview: use the `Start application` workflow, which runs
  `scripts/start.sh` and keeps the existing 8000/5000 development ports.
- Replit Publish: use `scripts/start.sh` as the run command. Replit's `PORT`
  value is forwarded to Vite so the externally exposed web port is reachable.
- Published routing smoke check: run
  `PUBLISHED_APP_URL=https://your-published-domain.example scripts/smoke-published.sh`.
  It checks `/`, `/health/`, anonymous `/api/whoami/`, and
  `/accounts/login/` without sending credentials. To enable the same check in
  GitHub Actions for an existing deployment, set the repository variable
  `PUBLISHED_APP_URL` to the published app URL. A successful GitHub deployment
  status automatically runs the same check against that event's environment or
  target URL; the event URL takes precedence over the repository variable.

## By Default
For all other items, defer to @AGENTS.md