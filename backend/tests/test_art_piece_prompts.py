from ai_provider.prompts import (
    ART_PIECE_2D_CREATE_PROMPTS,
    ART_PIECE_REFINE_SYSTEM_PROMPT,
    art_piece_2d_prompt,
)


def test_all_2d_engines_use_one_canonical_prompt_source():
    assert art_piece_2d_prompt("c2js-interactive") == ART_PIECE_2D_CREATE_PROMPTS["c2js"]
    assert set(ART_PIECE_2D_CREATE_PROMPTS) == {"canvas2d", "svg", "p5js", "c2js"}
    assert all(prompt for prompt in ART_PIECE_2D_CREATE_PROMPTS.values())


def test_refine_prompt_is_canonical_and_transport_neutral():
    assert '"edits"' in ART_PIECE_REFINE_SYSTEM_PROMPT
    assert "Mistral" not in ART_PIECE_REFINE_SYSTEM_PROMPT
    assert "Gemini" not in ART_PIECE_REFINE_SYSTEM_PROMPT
    assert "DeepSeek" not in ART_PIECE_REFINE_SYSTEM_PROMPT
