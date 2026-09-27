## QA: PASS

Criterion matrix:

| Criterion | Result | Evidence |
|---|---|---|
| Existing saved piece starts with prior history and named layers | PASS | The test seeds the canonical structured `Sky`/`Hills`/`Sun` fixture through the real API and captures the prior version/document. |
| Asset import and browser-local decode | PASS | The library imports `fixture-sun.svg`; its thumbnail has a non-zero decoded width. |
| Accept adds one asset layer without disturbing existing layers | PASS | API assertions verify the new version is exactly prior sequence + 1, the original layer list is an exact prefix, one image shape references the selected asset, and the prompt's `@Hills` request does not mutate the existing layer set. |
| Untouched canvas regions remain unchanged and the new asset is visible | PASS | Canvas pixel assertions compare sky/hills pixels before and after and scan the accepted live canvas for visible fixture-colored pixels. |
| Restore removes the accepted layer and restores the exact prior document | PASS | The real version restore endpoint returns a scene JSON deeply equal to the captured pre-run document. |
| Responsive browser evidence | PASS | `E2E_DOCKER_COMPOSE=true npx playwright test e2e/aiMediaAssetExistingPiece.spec.ts --project=chromium` — 2 passed at 1280px and 375px; accepted and restored screenshots were inspected. |

Exact repository checks:

```text
make check — PASS
npx prettier --write e2e/aiMediaAssetExistingPiece.spec.ts — PASS
npx oxlint e2e/aiMediaAssetExistingPiece.spec.ts — PASS
npx tsc -b — PASS
E2E_DOCKER_COMPOSE=true npx playwright test e2e/aiMediaAssetExistingPiece.spec.ts --project=chromium — 2 passed
```

Provenance/evidence boundary: local repository checks and approved host-level Chromium against the local disposable Compose stack only. No deployed URL or production database evidence is claimed. The browser scenario is implemented in commit `cfbeab2e`; the resolver behavior it exercises was fixed in `51105db8`.
