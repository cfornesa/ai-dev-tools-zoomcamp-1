---
name: Critical operational decisions
description: Structured overview of durable security, deployment, database, authentication, and verification decisions.
---

# Critical operational decisions

This page is a navigational summary of decisions that were made because the
default or most obvious implementation was unsafe, unreliable, or misleading.
The linked topic pages are the source of detail; this page should remain a
concise index rather than an implementation changelog.

## Deployment and database

- **Production schema ownership:** Replit Publish compares development and
  production schemas and applies the reviewed production diff. Do not run
  Django migrations in a deployment build or application startup.
  See [Replit production schema publishing](replit-production-schema-publishing.md).
- **Publish verification timing:** Checks that depend on the newly published
  deployment must run from deployment-status events, not immediately after a
  publish command.
  See [Replit publish verification](replit-publish-verification.md).
- **Database isolation:** Development and production PostgreSQL databases are
  separate; local testing uses an explicitly disposable database when real
  PostgreSQL semantics are required.
- **`[userenv]` is workspace-scoped, not deployment-authoritative:**
  `.replit`'s `[userenv.shared]` dev-unsafe `DEBUG`/`ALLOWED_HOSTS` values are
  not confirmed to reach the published deployment process; Replit Secrets
  configured separately in the Deployments pane are the actual production
  source. `[userenv.production]` is pinned to production-safe values as
  defense-in-depth regardless.
  See [Replit userenv scope](replit-userenv-scope.md).

## Authentication and secrets

- **Browser-facing origin:** Same-origin browser requests use the Vite origin,
  which must be included in trusted CSRF origins even though Django listens on
  a separate internal port.
  See [Browser-facing CSRF origin](browser-facing-csrf-origin.md).
- **OAuth dependency:** PyJWT is pinned explicitly because the installed
  allauth runtime imports it during OAuth callback validation.
  See [Allauth JWT runtime dependency](allauth-jwt-runtime-dependency.md).
- **Credential encryption:** Personal Mistral keys are encrypted per user;
  credential rotation retains prior Fernet roots during controlled
  re-encryption before old roots are retired.
  See [Mistral credential rotation](mistral-credential-rotation.md).

## Git and verification

- **Safe hosted pushes:** Refresh remote refs and use a temporary credential
  helper; classify equal, ahead, behind, and diverged histories without
  force-pushing or exposing credentials.
  See [GitHub HTTPS credential helper](github-https-credential-helper.md).
- **Browser test prerequisites:** Playwright browser tests require the
  project fixture environment and Chromium system libraries.
  See [Playwright runtime prerequisites](playwright-runtime-prerequisites.md).
- **Test file resolution:** Vitest shell fixtures resolve from the frontend
  process root rather than assuming transformed `import.meta` URLs are file
  URLs.
  See [Vitest shell file paths](vitest-shell-file-paths.md).

## Pending work capture

- **Discovery gate:** New actionable work found during exploration,
  implementation, QA, or review must be duplicate-checked, recorded as a
  proposed backlog task, and linked to a GitHub issue before it is continued
  or deferred. Ordinary pending work stays out of long-term memory.
  See the [pending-item capture loop](../../_docs/process.md).

## Maintenance rule

When a future change touches one of these boundaries, read the linked topic
before editing. Add or update a topic only for a non-obvious, durable lesson;
do not record routine commits, test counts, secrets, or details discoverable
from the current source tree.