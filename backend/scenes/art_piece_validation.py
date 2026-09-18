"""Cheap engine-shape validation for opaque generated art sources.

This is not an execution or security boundary.  The frontend sandbox remains
the only place arbitrary source is run; these checks make the persisted
engine/source contract explicit and prevent accidental cross-engine coercion.
"""

from __future__ import annotations

import re

from rest_framework import serializers

_ENGINE_MARKERS = {
    "canvas2d": (r"<canvas\b",),
    "svg": (r"<svg\b",),
    "p5js": (r"\bwindow\.sketch\s*=",),
    "c2js": (r"\bwindow\.sketch\s*=", r"\bstartFrame\b"),
    "c2js-interactive": (r"\bwindow\.sketch\s*=", r"\bstartFrame\b"),
    "threejs": (r"\bTHREE\b",),
    "aframe": (r"<a-scene\b",),
}


def validate_art_piece_source(engine: str, source: str) -> str:
    """Validate the minimum source shape required by the selected engine."""

    markers = _ENGINE_MARKERS.get(engine)
    if markers is None:
        raise serializers.ValidationError(f"Unsupported art-piece engine: {engine}")
    if not source.strip():
        raise serializers.ValidationError("source must not be blank")
    if any(re.search(marker, source, re.IGNORECASE) is None for marker in markers):
        raise serializers.ValidationError(
            f"source does not match the required {engine} art-piece runtime shape"
        )
    return source
