## QA: PASS

Stage 2 engineering and Stage 4 QA were performed in this Codex task as owner-directed substitutions because the owner prohibited Opencode and other model delegation. Stage 3 independent review was not run.

Acceptance matrix:

- PASS — finite atomic capability registry, including local 2D/3D/generated pieces, AI create/edit/art, publishing, cloud sync, and role/global semantics.
- PASS — reusable Free/Premium/custom role sections, plan-to-role assignment, per-user override service, revision checks, and admin-only APIs/UI.
- PASS — global switches are atomic; cloud sync updates the global capability row and existing site switch in the same transaction. Global denial wins; local-first data is not deleted.
- PASS — application admins resolve to all capabilities unless an explicit global shutdown applies.
- PASS — account capability summary and responsive admin policy UI; unavailable optional controls are not advertised by this policy surface.
- PASS — public/private boundary recorded: gallery/profile APIs expose only explicitly public pieces; private pieces remain local-first unless permitted and opted into cloud backup.

Verification evidence:

- `UV_CACHE_DIR=/private/tmp/codex-uv-cache uv run pytest tests/test_admin_settings.py tests/test_entitlements.py -q` — 32 passed / 1 skipped.
- `E2E_BASE_URL=http://localhost:5000 npx playwright test e2e/capabilityConsistency.spec.ts --project=chromium` — 1 passed at 1280×900 and 375×812; screenshots inspected.
- `UV_CACHE_DIR=/private/tmp/codex-uv-cache make check` — backend 1,230 passed / 39 skipped; frontend 2,557 passed; lint, format, typecheck, mypy, and action-pin checks passed.
- Migrations 0050 and 0051 applied locally; Django `check` and `makemigrations --check --dry-run` passed.

No new dependencies or credentials were introduced. #519 is ready to close; #520 is the next issue.
