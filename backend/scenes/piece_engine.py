"""Resolve the explicit rendering library (engine) of a structured piece (#770).

Every piece is tied to one rendering library. Generated art pieces store it in
`ArtPiece.engine`. Structured pieces carry it inside their scene document:

- 2D scenes declare `renderer.preferred` (`p5`, `canvas2d`, or `svg`), a required
  field, so it always resolves.
- 3D scenes gained an OPTIONAL top-level `renderer.preferred` (`threejs` or
  `aframe`). Documents written before it existed have none, and resolve to
  `threejs` (the only 3D builder that existed), so no stored scene needs to be
  rewritten and no migration is involved.

The resolved ids are the same registry ids `art_piece_contract` uses, so the
public gallery can show one consistent engine label across every kind.
"""

from __future__ import annotations

from typing import Any, Final

DEFAULT_SCENE3D_ENGINE: Final = "threejs"
SCENE3D_ENGINES: Final = ("threejs", "aframe")

_SCENE2D_RENDERER_TO_ENGINE: Final = {"p5": "p5js", "canvas2d": "canvas2d", "svg": "svg"}
DEFAULT_SCENE2D_ENGINE: Final = "p5js"


def resolve_scene3d_engine(scene: Any) -> str:
    """`threejs` or `aframe`; a missing or unrecognised declaration is `threejs`."""
    if isinstance(scene, dict):
        renderer = scene.get("renderer")
        if isinstance(renderer, dict):
            preferred = renderer.get("preferred")
            if preferred in SCENE3D_ENGINES:
                return str(preferred)
    return DEFAULT_SCENE3D_ENGINE


def resolve_scene2d_engine(scene: Any) -> str:
    """`p5js`, `canvas2d`, or `svg` from the required `renderer.preferred`."""
    if isinstance(scene, dict):
        renderer = scene.get("renderer")
        if isinstance(renderer, dict):
            mapped = _SCENE2D_RENDERER_TO_ENGINE.get(str(renderer.get("preferred")))
            if mapped:
                return mapped
    return DEFAULT_SCENE2D_ENGINE
