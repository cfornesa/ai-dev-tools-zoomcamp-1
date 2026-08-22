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
- `MISTRAL_CREDENTIAL_ENCRYPTION_KEY` (Fernet root for encrypted personal Mistral keys)
- `RECAPTCHA_SECRET_KEY` (only when signup protection is enabled)

Set `CSRF_TRUSTED_ORIGINS` to a comma-separated list of the exact fully
qualified origins that serve the app, including scheme and any development
port. For example:
`https://animate.creatrweb.com,https://YOUR-REPLIT-DEV-DOMAIN.replit.dev`.
Never use `*` or a path. This controls Django's unsafe-request protection and
is separate from Google's Authorized JavaScript origins and OAuth callback
redirect URI settings.

Signup reCAPTCHA v3 is disabled by default for development. To enable it,
configure `RECAPTCHA_ENABLED`, `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`,
`RECAPTCHA_ACTION`, `RECAPTCHA_MIN_SCORE`, and
`RECAPTCHA_ALLOWED_HOSTNAMES`. Production refuses to start when protection is
enabled without the site key, secret, or allowed hostnames. Never expose the
secret to frontend code; only the public site key is rendered on signup.

For Google sign-in, configure the exact browser-visible origin in
`CSRF_TRUSTED_ORIGINS`. In Google Cloud Console, add the exact HTTPS callback
URI for each domain a user can sign in through. For the published custom
domain, this is
`https://animate.creatrweb.com/accounts/google/login/callback/` — not HTTP and
not the internal Django `localhost:8000` address. If users also sign in through
the Replit domain, add its matching HTTPS callback URI separately.

Each signed-in user configures their own Mistral API key at `/account/settings`.
Only the encrypted value is stored. Keep the encryption root stable; changing
it requires a controlled rotation: set the new
`MISTRAL_CREDENTIAL_ENCRYPTION_KEY`, place the old value in
`MISTRAL_CREDENTIAL_PREVIOUS_ENCRYPTION_KEYS`, re-save credentials to
re-encrypt them by running `uv run python manage.py reencrypt_mistral_credentials`,
then remove the old value. Losing every applicable key makes existing
credentials unusable, but never reveals their plaintext.

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
  The deployment build runs `uv sync --locked`, `npm ci`, `manage.py
  check --deploy`, and `manage.py migrate --noinput` before the frontend
  build. Development and published environments receive separate
  Replit-managed `DATABASE_URL` values.
  The launcher waits for Django's `/health/` endpoint before starting Vite,
  preventing the proxy from attempting backend requests during startup.
- Published routing smoke check: run
  `PUBLISHED_APP_URL=https://your-published-domain.example scripts/smoke-published.sh`.
  It waits for a healthy `/health/` response, then checks `/`, anonymous
  `/api/whoami/`, and `/accounts/login/` without sending credentials. To
  enable the same check in GitHub Actions for an existing deployment, set the repository variable
  `PUBLISHED_APP_URL` to the published app URL. A successful GitHub deployment
  status automatically runs the same check against that event's environment or
  target URL; the event URL takes precedence over the repository variable.
- External local deployment: keep a separate non-production `.env` and
  PostgreSQL database, then run `make deploy-check`, `make migrate`, and
  `BASE_URL=http://localhost:5000 make smoke-local`. The local smoke command
  uses disposable fixture users and cleans them up; never point it at a
  published or shared database. `POSTGRES_TEST_DATABASE_URL` is optional and
  must remain a separate disposable test database.

## By Default
For all other items, defer to @AGENTS.md