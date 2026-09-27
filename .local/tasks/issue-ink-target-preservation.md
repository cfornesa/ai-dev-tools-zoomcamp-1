# Generated art refine: ink targets must update ink metadata without editing source

Linked discovery: #921 (`https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/921`).

## Goal

When a generated art piece has an ink layer and the user selects `@ink`, the
refinement must update only the version's validated ink document. The generated
piece source must remain byte-identical. The current contract resolves the
mention but always applies provider find/replace edits to `source`, which was
reproduced in authenticated Chrome on `e2e-manual-ink-921`.

## Acceptance criteria

- [ ] An accepted `@ink` refinement persists a new version whose `source` is
  byte-identical to the prior version and whose `generation_metadata.ink` is
  the updated validated drawing document.
- [ ] A source-only refinement continues to inherit the prior ink document
  unchanged.
- [ ] An ink-targeted refinement cannot silently apply source edits; invalid
  or unavailable ink updates fail without creating a version.
- [ ] The provider/refinement response contract remains bounded and backward
  compatible for source-edit callers; no blob bytes or credentials are sent
  to providers.
- [ ] Focused backend tests cover source preservation, metadata update,
  invalid ink rejection, and inheritance. Active Chrome verifies the exact
  `@ink` flow at 1280x900 and 375x812 on disposable local fixtures.

## Verification

- `cd backend && uv run pytest tests/test_art_piece_refine.py tests/test_art_piece_vendor_matrix.py`
- `cd frontend && npm test -- --run src/pages/artPieceTargets.test.ts src/pages/ArtPieceEditor.test.tsx`
- `make check`
- Active Chrome, authenticated disposable fixture, normal clicks at 1280x900
  and 375x812; inspect version history and source editor after acceptance.

## Constraints / out of scope

- Preserve the existing `@region` and `@element` source-target contracts.
- No migration is expected: ink is already stored under
  `ArtPieceVersion.generation_metadata["ink"]`.
- No production data or provider credential changes.
- This is not the broader browser evidence in #921; #921 remains open until
  this implementation issue and its remaining criteria reconcile.

## Routing

Stage 2b complex implementation: the change crosses the provider result
contract, backend refinement transaction, validation, and version metadata.

## Duplicate audit

Closed #820 covers preservation of unmentioned source regions, and #882
covers frozen ink preview behavior. Neither changes the refinement result
contract or proves that `@ink` avoids source edits. This issue is new and is
linked to #921 rather than reopening either closed issue.
