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

Prompt-to-source map (the six prompts in each row are the six `create_prompts`
entries in `corpus.json`):

| Family | Prompts | Source template |
|---|---|---|
| structured_2d | sunrise, garden, night sky, city grid, ocean, constellation | `schema/fixtures/valid/blank.json` |
| structured_3d | Hero Box, observatory, floating garden, museum, kinetic room, planetarium | `schema/fixtures3d/valid/feature_rich.json` |
| generated_2d | sunrise, garden, moon, city, ocean, constellation | `backend/ai_provider/prompts.py:ART_PIECE_2D_CREATE_PROMPTS` |
| generated_3d | Hero Box, observatory, floating garden, museum, kinetic room, planetarium | `backend/ai_provider/art_piece_provider.py` engine system prompts |

The test wraps recorded values in each vendor's real response shape: Mistral
chat choices, Gemini/DeepSeek generated text, and the generated-art adapter's
raw source/refine JSON. It then runs the repository provider adapters, validates
the resulting structure, and checks that named layers/objects survive all
three edits. `AI_CORPUS_LIVE=1` is deliberately not implemented here; live
vendor evaluation remains a separate authorized task.
