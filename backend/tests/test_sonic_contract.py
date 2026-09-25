from scenes.sonic_contract import normalize_scene_sonic, normalize_sonic, sonic_from_feel
from scenes.validation import validate_scene
from scenes.validation3d import validate_scene3d


def test_normalize_sonic_clamps_and_drops_unknown_keys():
    scene = {
        "schemaVersion": 1,
        "id": "legacy",
        "sonic": {
            "tempo": 999,
            "scale": "major",
            "unknown": "ignored",
            "extras": {"default_volume": -2},
        },
    }
    normalized = normalize_scene_sonic(scene)
    assert normalized["sonic"]["tempo"] == 220
    assert normalized["sonic"]["extras"]["default_volume"] == 0
    assert "unknown" not in normalized["sonic"]


def test_malformed_sonic_is_absent_without_invalidating_legacy_scene():
    assert normalize_scene_sonic({"sonic": {"root": "H"}}) == {}


def test_both_authoritative_validators_accept_sonic_contract():
    # The complete fixtures prove the additive field is accepted by both
    # document families without changing their existing required fields.
    import json
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    scene = json.loads((root / "schema/fixtures/valid/blank.json").read_text())
    scene["sonic"] = {
        "tempo": 120,
        "root": "D",
        "scale": "dorian",
        "extras": {"synth": {"oscillator": "square"}},
    }
    assert validate_scene(scene).valid
    scene3d = json.loads((root / "schema/fixtures3d/valid/minimal.json").read_text())
    scene3d["sonic"] = scene["sonic"]
    assert validate_scene3d(scene3d).valid


def test_sonic_from_feel_matches_longest_scale_and_mood_tempo():
    value = sonic_from_feel("slow whole tone theremin drone")
    assert value["tempo"] == 72
    assert value["scale"] == "wholetone"
    assert value["instrument"] == "fmsynth"


def test_sonic_from_feel_prefers_explicit_bpm_and_maps_synonyms():
    value = sonic_from_feel("fast energetic 300 BPM bells and drums")
    assert value["tempo"] == 220
    assert value["instrument"] == "metalsynth"


def test_sonic_from_feel_defaults_to_conservative_values():
    value = sonic_from_feel("a calm texture")
    assert value["tempo"] == 90
    assert value["scale"] == "major"
    assert value["instrument"] == "synth"


def test_normalize_sonic_rejects_invalid_blocks():
    assert normalize_sonic({"scale": "not-a-scale"}) is None
