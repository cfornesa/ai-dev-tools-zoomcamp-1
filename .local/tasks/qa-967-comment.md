# QA: #967 server-backed generated-art package export

Result: PASS for the available generated-art contract.

## Criterion matrix

| Criterion | Result | Evidence boundary |
|---|---|---|
| Authenticated generated editor exposes keyboard-operable package export | PASS | Rebuilt repository Compose Chromium at 1280x900 and 375x812. |
| Sanitized ZIP is offered only after package checksum validation | PASS | Builder calls `buildPiecePackage` then `parsePiecePackage` before `downloadBlob`; browser parsed the downloaded ZIP. |
| Source, ordered immutable versions, ink/sonic/capability metadata are preserved | PASS | Focused utility test and Chromium manifest assertions: kind `generated`, two ordered records, current source metadata, and no mutation after export. |
| Media and failure safety | PASS within current data model | Generated art pieces have no piece-scoped browser media store or media references; export reports no fabricated assets, and the package builder enforces the shared 52 MB/100-file limits. Missing-media warning is therefore not applicable to this entry point until a generated-piece media store exists. |
| Responsive UI | PASS | Chromium 2/2 at 1280x900 and 375x812; screenshots inspected from test artifacts. |
| Repository quality gate | PASS | `make check` exit 0: frontend 287 files / 3060 tests passed, backend and all lint/format/typecheck stages passed. |

## Exact commands

```text
cd frontend && npx vitest run src/storage/serverGeneratedPiecePackage.test.ts src/storage/piecePackage.test.ts
cd frontend && npx tsc -b
cd frontend && npx oxlint src/pages/ArtPieceEditor.tsx src/storage/serverGeneratedPiecePackage.ts src/storage/serverGeneratedPiecePackage.test.ts
docker compose --project-name ai-dev-tools-zoomcamp-1 --file compose.yaml up -d --build
cd frontend && E2E_DOCKER_COMPOSE=true npx playwright test e2e/artPieceGeneratedPackageExport.spec.ts --project=chromium
make check
```

## Provenance and limits

- Implementation is in the current uncommitted worktree pending commit.
- Browser evidence used this checkout's rebuilt repository Compose stack; it is not production evidence.
- No generated-piece production data, cloud sync, API key, or external provider was used.
- Stage-3 second-opinion review was unavailable; QA is a Codex/GPT-5 medium substitution for the rostered Claude Sonnet 5 Medium reviewer.
