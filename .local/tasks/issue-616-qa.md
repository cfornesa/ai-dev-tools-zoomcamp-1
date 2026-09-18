## QA: FAIL

### Criterion matrix

| Criterion | Verdict | Evidence |
|---|---|---|
| Custom slugs normalize, remain owner-scoped, and reject collisions | PASS | Focused backend suite `29 passed`; tests cover custom create normalization, slug update without a new version, and collision rejection. |
| Canonical regular route resolves the published current version without private leakage | PASS (API-level) | `tests/test_canonical_piece.py` covers canonical resolution, published gating, private/unknown profile behavior, and the canonical payload. Route-level browser rendering remains unverified. |
| UUID/public-id regular route remains a compatible shim and slug changes are reversible | PASS (API-level) | New canonical/legacy equivalence test passes; slug update preserves the current version ID and docs record the rollback behavior. |
| Anonymous/other-user/draft/archived/missing boundaries do not confirm private pieces | PASS (API-level) | Existing canonical privacy/status tests and the full backend suite pass. |
| Regular-surface serialization emits the canonical slug URL | PASS (API-level) | Existing profile/gallery canonical-link tests pass; generated piece payload retains `public_slug` and `canonical_url`. |
| Fixed 1280x900 and 375x812 Chromium route evidence plus full checks | FAIL | `UV_CACHE_DIR=/tmp/codex-uv-cache make check` passed (`1,432 passed, 39 skipped`; frontend `2,723 passed`; lint/format/typecheck passed), but `make compose-preflight` reported Docker unavailable and localhost `/health/` was unreachable. Playwright scenarios were listable (4) but not executable. |

### Commands and results

- `cd backend && UV_CACHE_DIR=/tmp/codex-uv-cache uv run pytest tests/test_canonical_piece.py tests/test_canonical_piece_slug_race.py tests/test_art_piece_persistence.py`: `29 passed`.
- `cd frontend && npm test -- --run src/pages/CanonicalPublicPiece.test.tsx`: `2 passed`.
- `UV_CACHE_DIR=/tmp/codex-uv-cache make check`: passed; backend `1,432 passed, 39 skipped`, frontend `2,723 passed`, lint/format/typecheck passed.
- `make compose-preflight`: blocked because the Docker daemon is unavailable.
- `curl -fsS --max-time 3 http://localhost:5000/health/`: blocked because no local stack was listening.
- `cd frontend && npx playwright test --list e2e/artPieces.spec.ts e2e/publicProfiles.spec.ts e2e/publicGalleryMixedPieces.spec.ts`: 4 Chromium scenarios listed; execution unavailable.

### Provenance and intake

- Implementation: Codex/GPT-5 substitution for the rostered Ollama Cloud `kimi-k3` stage 2b owner; commits `5eb5d62` and `c983d72`.
- Stage 3 independent-family review: not run.
- QA: Codex/GPT-5 substitution for the rostered Claude Sonnet 5 Medium QA stage.
- Intake: ACCEPTED-WITH-FIXES. The issue-scoping verification command was corrected from a nonexistent frontend test path to the existing `src/pages/CanonicalPublicPiece.test.tsx`; no product behavior was changed by that correction.

### Evidence boundary and next action

The unverified browser criterion is a `verification-boundary` on this host,
not evidence of a route defect. Keep #616 open. Run the named regular route
scenarios on a disposable PostgreSQL/Django/Vite stack or approved CI browser
runner at both fixed viewports, inspect rendered output, then return to QA.
