from scenes.art_piece_contract import (
    ART_PIECE_ENGINE_CAPABILITIES,
    ART_PIECE_ENGINE_CHOICES,
    GENERATABLE_ART_PIECE_ENGINES,
    SUPPORTED_ART_PIECE_ENGINES,
)


def test_registry_has_stable_ids_labels_and_explicit_surface_values():
    assert SUPPORTED_ART_PIECE_ENGINES == (
        "canvas2d",
        "svg",
        "p5js",
        "c2js",
        "c2js-interactive",
        "threejs",
        "aframe",
    )
    assert dict(ART_PIECE_ENGINE_CHOICES)["c2js-interactive"] == "C2.js Interactive"
    assert ART_PIECE_ENGINE_CAPABILITIES["p5js"] == {
        "label": "p5.js",
        "family": "2d",
        "regular": True,
        "immersive": False,
        "embed": False,
        "download": False,
        "editor_target": "2d-ai",
        "generation": True,
    }
    assert GENERATABLE_ART_PIECE_ENGINES == (
        "canvas2d",
        "svg",
        "p5js",
        "c2js",
        "c2js-interactive",
        "threejs",
        "aframe",
    )
