"""Canonical generated-art engine identifiers and surface capabilities.

This module intentionally has no Django model imports.  It is the shared
source for model choices, API validation, provider allowlisting, and the
human-facing capability projection.

`embed` is True for every engine (#762): the chrome-less ``/embed/art-pieces/<id>``
route and the Embed action serve all of them (delivered by #607/#615), so the
flag must never claim otherwise.
"""

from __future__ import annotations

from typing import Final, TypedDict, cast


class ArtPieceEngineCapability(TypedDict):
    label: str
    family: str
    regular: bool
    immersive: bool
    embed: bool
    download: bool
    editor_target: str
    generation: bool


ART_PIECE_ENGINE_CAPABILITIES: Final[dict[str, ArtPieceEngineCapability]] = {
    "canvas2d": {
        "label": "Canvas 2D",
        "family": "2d",
        "regular": True,
        "immersive": True,
        "embed": True,
        "download": True,
        "editor_target": "2d-ai",
        "generation": True,
    },
    "svg": {
        "label": "SVG",
        "family": "2d",
        "regular": True,
        "immersive": True,
        "embed": True,
        "download": True,
        "editor_target": "2d-ai",
        "generation": True,
    },
    "p5js": {
        "label": "p5.js",
        "family": "2d",
        "regular": True,
        "immersive": True,
        "embed": True,
        "download": True,
        "editor_target": "2d-ai",
        "generation": True,
    },
    "c2js": {
        "label": "C2.js",
        "family": "2d",
        "regular": True,
        "immersive": True,
        "embed": True,
        "download": True,
        "editor_target": "2d-ai",
        "generation": True,
    },
    "c2js-interactive": {
        "label": "C2.js Interactive",
        "family": "2d",
        "regular": True,
        "immersive": True,
        "embed": True,
        "download": True,
        "editor_target": "2d-ai",
        "generation": True,
    },
    "threejs": {
        "label": "Three.js",
        "family": "3d",
        "regular": True,
        "immersive": True,
        "embed": True,
        "download": True,
        "editor_target": "3d-ai",
        "generation": True,
    },
    "aframe": {
        "label": "A-Frame",
        "family": "3d",
        "regular": True,
        "immersive": True,
        "embed": True,
        "download": True,
        "editor_target": "3d-ai",
        "generation": True,
    },
}

ART_PIECE_ENGINE_CHOICES: Final[tuple[tuple[str, str], ...]] = tuple(
    (engine, capability["label"]) for engine, capability in ART_PIECE_ENGINE_CAPABILITIES.items()
)
SUPPORTED_ART_PIECE_ENGINES: Final[tuple[str, ...]] = tuple(ART_PIECE_ENGINE_CAPABILITIES)
GENERATABLE_ART_PIECE_ENGINES: Final[tuple[str, ...]] = tuple(
    engine
    for engine, capability in ART_PIECE_ENGINE_CAPABILITIES.items()
    if capability["generation"]
)


def art_piece_engine_capability(engine: str) -> ArtPieceEngineCapability:
    """Return a defensive copy of the canonical capability projection."""

    try:
        return cast(ArtPieceEngineCapability, dict(ART_PIECE_ENGINE_CAPABILITIES[engine]))
    except KeyError as exc:
        raise ValueError(f"Unknown art-piece engine: {engine!r}") from exc
