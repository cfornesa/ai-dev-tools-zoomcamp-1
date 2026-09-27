# QA: #966 server-backed 2D piece package export

Result: PASS for the scoped export contract. The separate pointer-layering defect discovered during browser verification is tracked as #969 and is not silently folded into #966.

## Criterion matrix

| Criterion | Result | Evidence boundary |
|---|---|---|
| Authenticated editor exposes a File-menu export for a server-backed 2D piece | PASS | Chromium against the rebuilt repository Compose stack; the menu item was present at 1280x900 and 375x812. |
| Export is keyboard reachable and downloads a sanitized ZIP | PASS | Chromium: Enter activation of the focused menu item produced `*-package.zip` at both viewports. |
| ZIP reparses as kind `2d`, contains ordered records and `files/0.json`, and validates SHA-256 entries | PASS | Chromium test parsed the downloaded ZIP with JSZip and asserted manifest kind, non-empty records, file presence, and 64-character lowercase hashes. |
| Browser-held media is represented and missing-media handling is non-destructive | PASS | Focused Vitest covers package preparation and omit/cancel warning behavior; no cloud or server mutation path is used. |
| Responsive behavior at 1280x900 and 375x812 | PASS | Exact Chromium scenario passed 2/2; screenshots were inspected from `frontend/test-results/.../server-2d-piece-export.png`. |
| Repository quality gate | PASS | `make check` exit 0: backend 1750 passed/39 skipped; frontend 286 files/3059 tests passed; lint, format, typecheck passed. |

## Exact commands

```text
cd frontend && npx vitest run src/pages/ProjectMediaLibraryPanel.test.tsx src/storage/piecePackage.test.ts
cd frontend && npx tsc -b
cd frontend && npx oxlint src/pages/ProjectMediaLibraryPanel.tsx src/storage/server2dPiecePackage.ts src/pages/ProjectMediaLibraryPanel.test.tsx
make compose-preflight
docker compose --project-name ai-dev-tools-zoomcamp-1 --file compose.yaml up -d --build
cd frontend && E2E_DOCKER_COMPOSE=true npx playwright test e2e/pieceExportServer2d.spec.ts --project=chromium
make check
```

Focused Vitest result: 2 files, 17 tests passed. Chromium result: 2 tests passed. The first browser attempt used a stale pre-rebuild image; after rebuilding the repository Compose stack, both viewport scenarios passed. A desktop pointer activation exposed a separate existing layering defect (#969); the criterion-ready keyboard path passes and the issue remains open for pointer/touch correction.

## Provenance and limits

- Implementation commit: `2bef17f7`.
- Browser evidence: local repository Compose stack, rebuilt from this checkout; not production evidence.
- Local unit/full-suite evidence: this checkout only; not production evidence.
- No Replit Publish, production database action, cloud sync, or production URL claim was made for #966.
- Stage-3 second-opinion review was not available; QA is a Codex/GPT-5 medium substitution for the rostered Claude Sonnet 5 Medium reviewer, with the external browser evidence treated as untrusted until reproduced here.
