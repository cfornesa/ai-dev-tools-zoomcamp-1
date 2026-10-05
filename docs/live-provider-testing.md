# Live-provider testing with the persistent dev account

Use the persistent `dev_owner` account for manual local testing with a real
provider. The disposable `e2e_owner` account is recreated and deleted by the
browser fixture lifecycle, so a provider key saved there is expected to be
lost during `e2e_fixtures cleanup`.

## Create the account

From the repository root, with a local PostgreSQL database configured in
`backend/.env`, run:

```bash
(cd backend && uv run --env-file .env python manage.py dev_account create)
```

Set `DEV_ACCOUNT_PASSWORD` before the command when a known local password is
needed. If it is unset, the command generates a password and prints it once
to the local terminal. The password is never written to the repository or to
the command's status output.

The command is guarded by `DJANGO_DEBUG=true` and a database host of
`localhost`, `127.0.0.1`, or the Compose `postgres` service. It must never be
run against a published or shared production database.

## Save a provider key

1. Open `/accounts/login/` and sign in as `dev_owner`.
2. Open Account Settings.
3. Expand the AI provider credentials section.
4. Save the Mistral key through the provider-key form.

Use `dev_account status` to confirm only that the account exists and a
provider credential is configured; it never prints key material:

```bash
(cd backend && uv run --env-file .env python manage.py dev_account status)
```

The key is encrypted with `MISTRAL_CREDENTIAL_ENCRYPTION_KEY`. If that
encryption key changes, the saved provider key cannot be recovered and must
be replaced through Account Settings.

This account is intentionally outside `e2e_fixtures` and its cleanup scope.
The account and its local projects/credentials remain available across
disposable browser runs. Do not use it for production-data actions.
