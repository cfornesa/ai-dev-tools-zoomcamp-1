"""Acceptance coverage for issue #658's bounded art-piece refine route."""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

import scenes.art_piece_api as art_piece_api
from ai_provider.art_piece_provider import ArtPieceRefineResult
from ai_provider.interface import AIUsageMetadata
from scenes import art_piece_refine
from scenes.models import AIRetryPreference, ArtPiece, ArtPieceVersion

SOURCE = '<canvas id="art-piece-canvas"></canvas>\n<script>const color = "red";</script>'
USAGE = AIUsageMetadata(prompt_tokens=3, completion_tokens=5, estimated_cost_usd=0.01)


class _Provider:
    def __init__(self, results):
        self.results = list(results)
        self.calls = 0
        self.instructions = []

    def refine(self, instruction, source, library, target_references):
        self.calls += 1
        self.instructions.append(instruction)
        return self.results.pop(0)


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="refine-owner")


@pytest.fixture
def piece(owner):
    art_piece = ArtPiece.objects.create(
        owner=owner,
        prompt="a red canvas",
        engine=ArtPiece.Engine.CANVAS2D,
        title="Red",
        description="A red piece",
    )
    version = ArtPieceVersion.objects.create(piece=art_piece, sequence=1, source=SOURCE)
    art_piece.current_version = version
    art_piece.save(update_fields=["current_version"])
    return art_piece


def _result(search, replace):
    return ArtPieceRefineResult(usage=USAGE, edits=[{"search": search, "replace": replace}])


@pytest.mark.django_db
def test_refine_applies_all_edits_and_creates_immutable_current_version(monkeypatch, owner, piece):
    provider = _Provider([_result('color = "red"', 'color = "blue"')])
    monkeypatch.setattr(art_piece_refine, "_provider_for_user", lambda *args: provider)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "make it blue", "target_references": ["canvas"]},
        format="json",
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "accepted"
    assert body["attempts"] == 1
    piece.refresh_from_db()
    assert piece.current_version.sequence == 2
    assert 'color = "blue"' in piece.current_version.source
    assert piece.versions.count() == 2
    assert provider.calls == 1


@pytest.mark.django_db
def test_refine_resolves_region_and_ink_mentions_before_provider_call(monkeypatch, owner):
    source = '<svg><g id="Sky"><circle /></g></svg>'
    piece = ArtPiece.objects.create(owner=owner, prompt="svg", engine=ArtPiece.Engine.SVG)
    version = ArtPieceVersion.objects.create(
        piece=piece,
        sequence=1,
        source=source,
        generation_metadata={"ink": {"width": 16, "height": 16, "shapes": []}},
    )
    piece.current_version = version
    piece.save(update_fields=["current_version"])
    provider = _Provider([_result("<circle />", "<rect />")])
    monkeypatch.setattr(art_piece_refine, "_provider_for_user", lambda *args: provider)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {
            "instruction": "make targets warmer",
            "mentions": [{"kind": "region", "id": "Sky"}, {"kind": "ink", "id": "ink"}],
        },
        format="json",
    )

    assert response.status_code == 200
    assert provider.calls == 1
    assert '"kind": "region"' in provider.instructions[0]
    assert '"kind": "ink"' in provider.instructions[0]


@pytest.mark.django_db
def test_unresolved_mention_returns_422_without_creating_run_or_call(monkeypatch, owner, piece):
    provider = _Provider([_result('color = "red"', 'color = "blue"')])
    monkeypatch.setattr(art_piece_refine, "_provider_for_user", lambda *args: provider)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "change it", "mentions": [{"kind": "region", "id": "Missing"}]},
        format="json",
    )

    assert response.status_code == 422
    assert response.json() == {"error": "unresolved_mention", "detail": "region:Missing"}
    assert provider.calls == 0
    assert piece.refine_runs.count() == 0


@pytest.mark.django_db
def test_refine_rejects_unmentioned_region_change(monkeypatch, owner):
    source = (
        "window.sketch = function (p) {\n// @layer Sky\nconst sky = 'blue';\n"
        "// @layer Hills\nconst hills = 'green';\n};"
    )
    piece = ArtPiece.objects.create(owner=owner, prompt="p5", engine=ArtPiece.Engine.P5JS)
    version = ArtPieceVersion.objects.create(piece=piece, sequence=1, source=source)
    piece.current_version = version
    piece.save(update_fields=["current_version"])
    provider = _Provider([_result("const hills = 'green';", "const hills = 'red';")])
    monkeypatch.setattr(art_piece_refine, "_provider_for_user", lambda *args: provider)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "change Hills", "mentions": [{"kind": "region", "id": "Sky"}]},
        format="json",
    )

    assert response.json()["status"] == "failed"
    assert "unmentioned_region_changed:Hills" in response.json()["validation_summary"]


@pytest.mark.django_db
def test_refine_allows_explicit_region_delete(monkeypatch, owner):
    source = (
        "window.sketch = function (p) {\n// @layer Sky\nconst sky = 'blue';\n"
        "// @layer Hills\nconst hills = 'green';\n};"
    )
    piece = ArtPiece.objects.create(owner=owner, prompt="p5", engine=ArtPiece.Engine.P5JS)
    version = ArtPieceVersion.objects.create(piece=piece, sequence=1, source=source)
    piece.current_version = version
    piece.save(update_fields=["current_version"])
    provider = _Provider([_result("\n// @layer Hills\nconst hills = 'green';", "")])
    monkeypatch.setattr(art_piece_refine, "_provider_for_user", lambda *args: provider)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "delete Hills region"},
        format="json",
    )

    assert response.json()["status"] == "accepted"


@pytest.mark.parametrize(
    ("engine", "before", "after"),
    [
        (
            "p5js",
            "// @layer Sky\nconst sky = 1;\n// @layer Hills\nconst hills = 1;",
            "// @layer Sky\nconst sky = 1;\n// @layer Hills\nconst hills = 2;",
        ),
        (
            "canvas2d",
            "// @layer Sky\nctx.fillStyle = 'blue';\n// @layer Hills\nctx.fillStyle = 'green';",
            "// @layer Sky\nctx.fillStyle = 'blue';\n// @layer Hills\nctx.fillStyle = 'red';",
        ),
        (
            "c2js",
            "// @layer Sky\nctx.fillStyle = 'blue';\n// @layer Hills\nctx.fillStyle = 'green';",
            "// @layer Sky\nctx.fillStyle = 'blue';\n// @layer Hills\nctx.fillStyle = 'red';",
        ),
        (
            "svg",
            '<svg>\n<g id="Sky"><rect /></g>\n<g id="Hills"><circle /></g>\n</svg>',
            '<svg>\n<g id="Sky"><rect /></g>\n<g id="Hills"><path /></g>\n</svg>',
        ),
        (
            "threejs",
            "// @layer Sky\nscene.add(sky);\n// @layer Hills\nscene.add(hills);",
            "// @layer Sky\nscene.add(sky);\n// @layer Hills\nscene.remove(hills);",
        ),
        (
            "aframe",
            "<!-- @layer Sky -->\n<a-sky></a-sky>\n<!-- @layer Hills -->\n<a-box></a-box>",
            "<!-- @layer Sky -->\n<a-sky></a-sky>\n<!-- @layer Hills -->\n<a-sphere></a-sphere>",
        ),
    ],
)
def test_preservation_detects_unmentioned_changes_for_each_engine_family(engine, before, after):
    with pytest.raises(art_piece_refine.PreservationError, match="Hills"):
        art_piece_refine.enforce_preservation(
            engine=engine, before=before, after=after, instruction="make Sky brighter", mentions=[]
        )


@pytest.mark.django_db
def test_unmatched_edit_is_all_or_none_and_disabled_retry_stops_once(monkeypatch, owner, piece):
    provider = _Provider([_result("not in source", "replacement")])
    monkeypatch.setattr(art_piece_refine, "_provider_for_user", lambda *args: provider)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "make it impossible"},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["status"] == "failed"
    assert response.json()["attempts"] == 1
    piece.refresh_from_db()
    assert piece.current_version.sequence == 1
    assert piece.current_version.source == SOURCE
    assert provider.calls == 1


@pytest.mark.django_db
def test_refine_retries_with_real_source_and_preference_budget(monkeypatch, owner, piece):
    provider = _Provider(
        [
            _result("missing", "replacement"),
            _result("color = \"red\"", "color = \"green\""),
        ]
    )
    monkeypatch.setattr(art_piece_refine, "_provider_for_user", lambda *args: provider)
    AIRetryPreference.objects.create(owner=owner, auto_retry_enabled=True, max_retries=1)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "make it green"},
        format="json",
    )

    assert response.json()["status"] == "accepted"
    assert response.json()["attempts"] == 2
    assert response.json()["repairs"] == 1
    assert provider.calls == 2
    assert piece.versions.count() == 2


@pytest.mark.django_db
def test_refine_is_owner_only(monkeypatch, piece):
    other = get_user_model().objects.create_user(username="other-refine-owner")
    client = APIClient()
    client.force_authenticate(other)
    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "make it blue"},
        format="json",
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_fake_provider_reports_a_failed_refinement_when_its_fixture_token_is_absent(
    monkeypatch, owner, piece
):
    monkeypatch.setattr(art_piece_api, "use_fake_ai_provider", lambda: True)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "make the accent warmer"},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["status"] == "failed"
    assert response.json()["attempts"] == 1
    piece.refresh_from_db()
    assert piece.current_version.sequence == 1
