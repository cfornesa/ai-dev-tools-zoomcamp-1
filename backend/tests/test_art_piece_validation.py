import pytest
from rest_framework import serializers

from scenes.art_piece_validation import validate_art_piece_source


@pytest.mark.parametrize(
    ("engine", "source"),
    [
        ("canvas2d", '<canvas id="art-piece-canvas"></canvas>'),
        ("svg", '<svg viewBox="0 0 10 10"></svg>'),
        ("p5js", "window.sketch = (p) => { p.setup = () => {}; };"),
        ("c2js", "window.sketch = (runtime) => { runtime.startFrame(() => {}); };"),
        (
            "c2js-interactive",
            "window.sketch = (runtime) => { runtime.startFrame(() => {}); };",
        ),
        ("threejs", "const scene = new THREE.Scene();"),
        ("aframe", '<a-scene><a-camera></a-camera></a-scene>'),
    ],
)
def test_each_engine_has_an_explicit_source_shape(engine, source):
    assert validate_art_piece_source(engine, source) == source


def test_source_from_a_different_engine_is_rejected():
    with pytest.raises(serializers.ValidationError, match="p5js"):
        validate_art_piece_source("p5js", '<svg viewBox="0 0 10 10"></svg>')
