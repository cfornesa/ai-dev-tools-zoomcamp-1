"""Canonical normalization for the optional authored ``sonic`` scene block.

The block is intentionally additive: scenes without it are returned unchanged,
while malformed blocks are omitted and unknown keys are discarded.  This keeps
old versions readable and makes the server the canonical persistence boundary.
"""

from __future__ import annotations

import re
from copy import deepcopy
from math import isfinite
from typing import Any

ROOTS = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"}
SCALES = {
    "major",
    "minor",
    "pentatonic",
    "chromatic",
    "dorian",
    "phrygian",
    "lydian",
    "mixolydian",
    "wholetone",
}
INSTRUMENTS = {
    "synth",
    "amsynth",
    "fmsynth",
    "membranesynth",
    "metalsynth",
    "plucksynth",
    "duosynth",
}
FILTERS = {"lowpass", "highpass", "bandpass"}
OSCILLATORS = {"sine", "square", "sawtooth", "triangle"}

_MOOD_TEMPOS = {
    "slow": 72,
    "ambient": 72,
    "drone": 72,
    "fast": 128,
    "urgent": 128,
    "energetic": 128,
}
_INSTRUMENT_SYNONYMS = {
    "theremin": "fmsynth",
    "bell": "metalsynth",
    "bells": "metalsynth",
    "drum": "membranesynth",
    "drums": "membranesynth",
}


def sonic_from_feel(feel: str) -> dict[str, Any]:
    """Derive a deterministic, bounded authored sonic block from a mood phrase."""
    text = feel.strip() if isinstance(feel, str) else ""
    lowered = text.casefold()
    explicit = re.search(r"\b(?:tempo\s*|bpm\s*)?(\d{2,3})\s*bpm\b", lowered)
    tempo = (
        int(explicit.group(1))
        if explicit
        else next(
            (value for mood, value in _MOOD_TEMPOS.items() if re.search(rf"\b{mood}\b", lowered)),
            90,
        )
    )
    scale = "major"
    for candidate in sorted(SCALES, key=len, reverse=True):
        display = candidate.replace("wholetone", "whole tone")
        if re.search(rf"\b{re.escape(display)}\b", lowered):
            scale = candidate
            break
    instrument = "synth"
    for word, candidate in _INSTRUMENT_SYNONYMS.items():
        if re.search(rf"\b{word}\b", lowered):
            instrument = candidate
            break
    return normalize_sonic(
        {"tempo": tempo, "scale": scale, "instrument": instrument, "feel": text}
    ) or {"tempo": 90, "scale": "major", "instrument": "synth", "feel": ""}


def _number(value: Any, *, integer: bool = False) -> int | float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if not isfinite(value):
        return None
    if integer and int(value) != value:
        return None
    return int(value) if integer else float(value)


def _bounded(
    value: Any,
    default: int | float,
    low: int | float,
    high: int | float,
    *,
    integer=False,
):
    parsed = _number(value, integer=integer)
    if parsed is None:
        return default
    return max(low, min(high, parsed))


def normalize_sonic(value: Any) -> dict[str, Any] | None:
    """Return the canonical authored defaults, or ``None`` for a bad block."""
    if not isinstance(value, dict):
        return None
    root = value.get("root", "C")
    if root not in ROOTS:
        return None
    scale = value.get("scale", "major")
    if scale not in SCALES:
        return None
    keyboard_scale = value.get("keyboard_scale", scale)
    if keyboard_scale not in SCALES:
        return None
    instrument = value.get("instrument", "synth")
    if instrument not in INSTRUMENTS:
        return None
    feel = value.get("feel", "")
    if not isinstance(feel, str) or len(feel) > 400:
        return None

    extras = value.get("extras", {})
    if not isinstance(extras, dict):
        return None
    voices = extras.get("voices", {})
    if not isinstance(voices, dict):
        return None
    voice_defaults = {"ambient": "synth", "movement": "synth", "melodic": instrument}
    voice_values: dict[str, str] = {}
    for voice, default in voice_defaults.items():
        candidate = voices.get(voice, default)
        if candidate not in INSTRUMENTS:
            return None
        voice_values[voice] = candidate

    synth = extras.get("synth", {})
    if not isinstance(synth, dict):
        return None
    oscillator = synth.get("oscillator", "sine")
    filter_type = synth.get("filter_type", "lowpass")
    if oscillator not in OSCILLATORS or filter_type not in FILTERS:
        return None
    envelope = synth.get("envelope", {})
    if not isinstance(envelope, dict):
        return None
    effects = synth.get("effects", {})
    if not isinstance(effects, dict):
        return None
    ambient_sample = extras.get("ambient_sample")
    if ambient_sample is not None and (
        not isinstance(ambient_sample, str)
        or not ambient_sample.strip()
        or len(ambient_sample) > 255
        or ambient_sample.startswith(("http://", "https://", "//"))
    ):
        ambient_sample = None

    octave_min = int(_bounded(synth.get("octave_min"), 3, -1, 7, integer=True))
    octave_max = int(_bounded(synth.get("octave_max"), 5, -1, 7, integer=True))
    if octave_min > octave_max:
        octave_min, octave_max = octave_max, octave_min

    return {
        "tempo": int(_bounded(value.get("tempo"), 90, 40, 220, integer=True)),
        "root": root,
        "scale": scale,
        "keyboard_scale": keyboard_scale,
        "transpose": int(_bounded(value.get("transpose"), 0, -12, 12, integer=True)),
        "instrument": instrument,
        "feel": feel,
        "extras": {
            "default_volume": _bounded(extras.get("default_volume"), 100, 0, 100),
            "voices": voice_values,
            "synth": {
                "oscillator": oscillator,
                "filter_type": filter_type,
                "filter_cutoff": _bounded(synth.get("filter_cutoff"), 2000, 20, 20000),
                "filter_resonance": _bounded(synth.get("filter_resonance"), 1, 0.1, 20),
                "octave_min": octave_min,
                "octave_max": octave_max,
                "envelope": {
                    "attack": _bounded(envelope.get("attack"), 0.01, 0, 10),
                    "decay": _bounded(envelope.get("decay"), 0.1, 0, 10),
                    "sustain": _bounded(envelope.get("sustain"), 0.7, 0, 1),
                    "release": _bounded(envelope.get("release"), 0.3, 0, 10),
                },
                "effects": {
                    key: _bounded(effects.get(key), 0, 0, 1)
                    for key in ("distortion", "chorus", "tremolo", "flanger")
                }
                | {
                    "pitch_shift": int(
                        _bounded(effects.get("pitch_shift"), 0, -24, 24, integer=True)
                    ),
                    "bitcrusher": int(_bounded(effects.get("bitcrusher"), 0, 0, 16, integer=True)),
                },
            },
        },
    } | ({"extras": {"ambient_sample": ambient_sample}} if ambient_sample is not None else {})


def normalize_scene_sonic(data: Any) -> Any:
    """Deep-copy a scene and canonicalize its optional authored sound block."""
    if not isinstance(data, dict) or "sonic" not in data:
        return deepcopy(data)
    normalized = deepcopy(data)
    sonic = normalize_sonic(data.get("sonic"))
    if sonic is None:
        normalized.pop("sonic", None)
    else:
        normalized["sonic"] = sonic
    return normalized
