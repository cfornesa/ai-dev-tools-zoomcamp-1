# Offline AI quality corpus

This corpus is an offline replay set for issue #815. It is intentionally small
enough for CI while covering six create prompts and six three-step edit
sequences for each structured/generated 2D/3D family.

The structured families are based on the canonical scene fixtures in
`schema/fixtures/valid/blank.json` and `schema/fixtures3d/valid/feature_rich.json`.
The generated families follow the engine contracts and prompt sources in
`backend/ai_provider/prompts.py`, `backend/ai_provider/art_piece_provider.py`,
and `backend/scenes/art_piece_validation.py`. The fixture does not call the
external augment-humankind repositories or live vendors.

The test wraps recorded values in each vendor's real response shape: Mistral
chat choices, Gemini/DeepSeek generated text, and the generated-art adapter's
raw source/refine JSON. It then runs the repository provider adapters, validates
the resulting structure, and checks that named layers/objects survive all
three edits. `AI_CORPUS_LIVE=1` is deliberately not implemented here; live
vendor evaluation remains a separate authorized task.
