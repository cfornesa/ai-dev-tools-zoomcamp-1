"""Safety and round-trip contract tests for the supported draw.io subset."""

import copy
import json
from pathlib import Path

from scenes.validation import validate_scene


def _native_scene():
    with (Path(__file__).parents[2] / "schema/fixtures/valid/blank.json").open() as stream:
        return json.load(stream)


def _drawio_scene():
    scene = _native_scene()
    scene.update(
        {
            "documentType": "drawio",
            "drawio": {
                "formatVersion": 1,
                "layers": [
                    {"id": "layer-a", "name": "Main", "order": 0, "visible": True, "locked": False}
                ],
                "objects": [
                    {
                        "id": "object-a",
                        "type": "rect",
                        "layerId": "layer-a",
                        "parentId": None,
                        "x": 10,
                        "y": 20,
                        "width": 100,
                        "height": 50,
                    }
                ],
            },
        }
    )
    return scene


def test_supported_drawio_document_is_valid_and_round_trips_exactly():
    scene = _drawio_scene()
    assert validate_scene(scene).valid
    assert copy.deepcopy(scene)["drawio"] == scene["drawio"]


def test_drawio_rejects_duplicate_ids_dangling_parents_and_scripts():
    scene = _drawio_scene()
    scene["drawio"]["objects"][0]["parentId"] = "missing"
    scene["drawio"]["objects"].append(dict(scene["drawio"]["objects"][0]))
    scene["drawio"]["objects"][1]["id"] = "object-a"
    scene["drawio"]["objects"][1]["script"] = "alert(1)"
    result = validate_scene(scene)
    assert not result.valid
    assert any(error.rule == "unknownField" for error in result.errors)


def test_legacy_native_scene_remains_valid_without_discriminator():
    assert validate_scene(_native_scene()).valid
