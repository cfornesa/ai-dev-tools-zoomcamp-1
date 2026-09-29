---
name: persistent-dev-account-for-live-provider-testing
description: The persistent local owner account is separate from disposable E2E fixtures for manual provider testing.
metadata:
  type: project
---

The repository deliberately separates `dev_owner` from the `e2e_*` fixture
users. `e2e_fixtures cleanup` removes `e2e_owner` and its owned data, so live
provider keys belong on `dev_owner` instead. `dev_account` is guarded to
debug/local or repository Compose databases, and status output never exposes
key material.

Use `docs/live-provider-testing.md` for account creation, sign-in, and key
replacement guidance. Never store a password, provider key, encryption key,
or connection string in this topic or in the repository.
