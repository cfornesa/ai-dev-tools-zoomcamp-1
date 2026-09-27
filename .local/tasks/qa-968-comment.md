# QA: PASS — #968 server-backed 3D piece package export

## Criterion matrix

| Criterion | Result | Evidence |
|---|---|---|
| Keyboard-operable sanitized ZIP after checksum validation; failure has no download or mutation | PASS | `buildServer3dPiecePackage` builds through the shared checksum-validating `buildPiecePackage`, reparses with `parsePiecePackage`, and the Playwright scenario activates the control with `Enter`; the follow-up API read confirmed current sequence remained 3. |
| Ordered 3D history and available media | PASS | Owner-scoped `GET /api/projects3d/<id>/versions/` returns ascending complete history; the ZIP manifest contained three ordered records. Server-backed `Project3D` has no browser media-asset store or media references, so the validated package correctly contains zero media assets and no fabricated media. |
| Missing-media/size boundary, responsive UI, accessible control | PASS | Shared package limits/checksums remain authoritative; the export control has an accessible name/title and is keyboard-operable. Exact Chromium passed at 1280x900 and 375x812; screenshots were inspected. No media was available to trigger a missing-media warning. |
| Canonical authorization/API contract and no public regression | PASS | Owner-only GET uses the canonical `PROJECT3D_READ` authorization path; non-owner returns 404; existing POST save route remains unchanged; no public route was changed. |
| Focused tests, browser scenario, repository checks | PASS | Focused backend: `uv run pytest tests/test_project3d_version_api.py` (10 passed). Focused frontend: 2 files/10 tests passed, `tsc -b`, oxlint. Browser: `E2E_DOCKER_COMPOSE=true npx playwright test e2e/project3dServerPackageExport.spec.ts --project=chromium` (2/2). Repository: `make check` exit 0, backend 1752 passed/39 skipped, frontend 288 files/3061 tests. |

## Provenance and boundary

- Local evidence: focused Vitest, backend pytest, TypeScript/lint, and `make check`.
- Compose/browser evidence: repository Compose stack rebuilt from commit `b7d5151d`; Chromium scenario passed at both required viewports and generated inspected artifacts under `frontend/test-results/`.
- Production evidence: none. This issue is explicitly out of production scope; no published URL or production database was used.
- Implementation/QA provenance: Codex/GPT-5 medium substitution for the rostered implementation and QA services; the independent stage-3 reviewer was unavailable.
