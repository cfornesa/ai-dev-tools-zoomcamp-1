## QA: PASS

Stage 2 engineering and Stage 4 QA were performed in this Codex task as owner-directed substitutions because the owner prohibited Opencode and other model delegation. Stage 3 independent review was not run.

Acceptance matrix:

- PASS — owner can create/update a unique user-selected handle, display name, bounded bio, website/social metadata, profile-photo metadata, and public visibility with optimistic revision checks.
- PASS — `/users/@handle` returns safe profile metadata and only eligible public 2D/3D/generated pieces; private, draft, deleted, prompt, credential, billing, and provider-identity data are excluded.
- PASS — reserved/taken handles, stale revisions, inactive/private profiles, CSRF, and non-owner edits fail safely through owner-scoped API behavior.
- PASS — existing project routes remain unchanged; profile lifecycle never deletes projects.
- PASS — responsive account/public profile UI verified at 1280×900 and 375×812 with inspected screenshots.

Verification evidence:

- `UV_CACHE_DIR=/private/tmp/codex-uv-cache uv run pytest tests/test_profiles.py -q` — 2 passed.
- `E2E_BASE_URL=http://localhost:5000 npx playwright test e2e/publicProfiles.spec.ts --project=chromium` — 1 passed at both viewports.
- `UV_CACHE_DIR=/private/tmp/codex-uv-cache make check` — backend 1,232 passed / 39 skipped; frontend 2,557 passed; lint, format, typecheck, mypy, and action-pin checks passed.
- Migration `0052_publicprofile` applied locally; Django `check` and `makemigrations --check --dry-run` passed.

No new dependencies or credentials were introduced. #520 is ready to close; #521 is the next issue.
