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
from scenes.models import AIRetryPreference, ArtPiece, ArtPieceVersion, ProjectActivity

SOURCE = '<canvas id="art-piece-canvas"></canvas>\n<script>const color = "red";</script>'
USAGE = AIUsageMetadata(prompt_tokens=3, completion_tokens=5, estimated_cost_usd=0.01)


class _Provider:
    def __init__(self, results):
        self.results = list(results)
        self.calls = 0
        # This mock's refine adapter issues exactly one model-operation call
        # per invocation, matching ArtPieceProvider.refine() -> _complete().
        self.model_operation_calls = 0
        self.instructions = []

    def refine(self, instruction, source, library, target_references, *, ink_document=None):
        self.calls += 1
        self.model_operation_calls += 1
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


def _ink_result(document):
    return ArtPieceRefineResult(usage=USAGE, ink=document)


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
    # #1157 keeps AI refine acceptance out of the bounded manual lifecycle log.
    assert not ProjectActivity.objects.filter(art_piece=piece).exists()
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
def test_ink_refine_preserves_source_and_updates_only_ink(monkeypatch, owner):
    source = '<svg><rect id="background" width="100" height="100" fill="teal"/></svg>'
    previous_ink = {"width": 16, "height": 16, "shapes": []}
    next_ink = {
        "width": 16,
        "height": 16,
        "shapes": [{"id": "ink-1", "type": "rect", "x": 1, "y": 1, "width": 4, "height": 4}],
    }
    piece = ArtPiece.objects.create(owner=owner, prompt="svg", engine=ArtPiece.Engine.SVG)
    version = ArtPieceVersion.objects.create(
        piece=piece,
        sequence=1,
        source=source,
        generation_metadata={"ink": previous_ink},
    )
    piece.current_version = version
    piece.save(update_fields=["current_version"])
    provider = _Provider([_ink_result(next_ink)])
    monkeypatch.setattr(art_piece_refine, "_provider_for_user", lambda *args: provider)

    client = APIClient()
    client.force_authenticate(owner)
    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {
            "instruction": "change the ink layer",
            "mentions": [{"kind": "ink", "id": "ink"}],
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["status"] == "accepted"
    piece.refresh_from_db()
    assert piece.current_version.source == source
    assert piece.current_version.generation_metadata["ink"] == next_ink
    assert piece.versions.count() == 2


@pytest.mark.django_db
def test_ink_refine_rejects_source_edits_without_creating_version(monkeypatch, owner):
    source = '<svg><rect id="background" width="100" height="100" fill="teal"/></svg>'
    piece = ArtPiece.objects.create(owner=owner, prompt="svg", engine=ArtPiece.Engine.SVG)
    version = ArtPieceVersion.objects.create(
        piece=piece,
        sequence=1,
        source=source,
        generation_metadata={"ink": {"width": 16, "height": 16, "shapes": []}},
    )
    piece.current_version = version
    piece.save(update_fields=["current_version"])
    provider = _Provider([_result("teal", "#e76f51")])
    monkeypatch.setattr(art_piece_refine, "_provider_for_user", lambda *args: provider)

    client = APIClient()
    client.force_authenticate(owner)
    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {
            "instruction": "change the ink color",
            "mentions": [{"kind": "ink", "id": "ink"}],
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["status"] == "failed"
    piece.refresh_from_db()
    assert piece.current_version.source == source
    assert piece.versions.count() == 1


def test_same_line_svg_elements_preserve_unmentioned_sibling():
    before = (
        '<svg><rect id="target" width="100" fill="teal"/>'
        '<circle id="other" cx="220" fill="blue"/></svg>'
    )
    after = before.replace('fill="teal"', 'fill="#e76f51"')

    art_piece_refine.enforce_preservation(
        engine="svg",
        before=before,
        after=after,
        instruction="make the selected element warmer",
        mentions=[{"kind": "element", "id": "target"}],
    )


def test_same_line_svg_unmentioned_sibling_change_is_rejected():
    before = (
        '<svg><rect id="target" width="100" fill="teal"/>'
        '<circle id="other" cx="220" fill="blue"/></svg>'
    )
    after = before.replace('fill="blue"', 'fill="#e76f51"')

    with pytest.raises(art_piece_refine.PreservationError, match="other"):
        art_piece_refine.enforce_preservation(
            engine="svg",
            before=before,
            after=after,
            instruction="make the selected element warmer",
            mentions=[{"kind": "element", "id": "target"}],
        )


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
    assert provider.model_operation_calls == 2
    assert piece.versions.count() == 2


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("preference", "expected_model_calls", "expected_retries"),
    [
        (None, 1, 0),
        ((False, 3), 1, 0),
        ((True, 1), 2, 1),
        ((True, 3), 3, 2),
    ],
)
def test_refine_retry_preference_call_accounting_characterization(
    monkeypatch, owner, piece, preference, expected_model_calls, expected_retries
):
    """Characterize adapter/model-operation calls before enforcing #1314.

    Baseline values were observed against adcb737e: an off preference with
    max_retries=3 currently invokes twice for one repairable failure, while
    enabled limits remain min(max_retries, 2)+1. The absent-row case defaults
    to one call. The persisted run attempts continue to count loop iterations.
    """
    results = [_result("not in source", "replacement")]
    if preference == (True, 3):
        # Exhaust the capped enabled budget so the observed count measures
        # the loop ceiling rather than an earlier successful repair.
        results.extend([_result("still not in source", "replacement")] * 3)
    else:
        results.append(_result('color = "red"', 'color = "blue"'))
    provider = _Provider(results)
    monkeypatch.setattr(art_piece_refine, "_provider_for_user", lambda *args: provider)
    if preference is not None:
        enabled, retries = preference
        AIRetryPreference.objects.create(
            owner=owner, auto_retry_enabled=enabled, max_retries=retries
        )
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "make it blue"},
        format="json",
    )

    run = piece.refine_runs.get()
    assert provider.model_operation_calls == expected_model_calls
    assert provider.calls == expected_model_calls
    assert run.max_retries == expected_retries
    assert run.attempts == expected_model_calls
    assert cache.get(art_piece_refine._quota_cache_key(owner.id)) == expected_model_calls
    assert cache.get(art_piece_refine._rate_limit_cache_key(owner.id)) == expected_model_calls
    assert response.status_code == 200


@pytest.mark.django_db
def test_refine_repairs_ambiguous_comment_search_with_unique_multiline_block(monkeypatch, owner):
    source = (
        'window.sketch = function (p) {\n'
        '  // Fireflies\n  const first = "dim";\n'
        '  // Fireflies\n  const second = "dim";\n};'
    )
    piece = ArtPiece.objects.create(owner=owner, prompt="p5", engine=ArtPiece.Engine.P5JS)
    version = ArtPieceVersion.objects.create(piece=piece, sequence=1, source=source)
    piece.current_version = version
    piece.save(update_fields=["current_version"])
    provider = _Provider(
        [
            _result("// Fireflies", "unused ambiguous replacement"),
            _result(
                '  // Fireflies\n  const second = "dim";',
                '  // Fireflies\n  const second = "bright";',
            ),
        ]
    )
    monkeypatch.setattr(art_piece_refine, "_provider_for_user", lambda *args: provider)
    AIRetryPreference.objects.create(owner=owner, auto_retry_enabled=True, max_retries=1)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "brighten the second firefly"},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["status"] == "accepted"
    assert response.json()["attempts"] == 2
    assert provider.calls == 2
    assert "2 matches on lines 2, 4" in provider.instructions[1]
    assert "unique multi-line block" in provider.instructions[1]
    piece.refresh_from_db()
    assert piece.current_version.sequence == 2
    assert 'const first = "dim"' in piece.current_version.source
    assert 'const second = "bright"' in piece.current_version.source
    assert piece.versions.count() == 2


@pytest.mark.django_db
def test_unrepairable_ambiguous_search_fails_without_changing_source_or_version(monkeypatch, owner):
    source = (
        'window.sketch = function (p) {\n'
        '  // Fireflies\n  const first = "dim";\n'
        '  // Fireflies\n  const second = "dim";\n};'
    )
    piece = ArtPiece.objects.create(owner=owner, prompt="p5", engine=ArtPiece.Engine.P5JS)
    version = ArtPieceVersion.objects.create(piece=piece, sequence=1, source=source)
    piece.current_version = version
    piece.save(update_fields=["current_version"])
    provider = _Provider([_result("// Fireflies", "// Bright fireflies")] * 3)
    monkeypatch.setattr(art_piece_refine, "_provider_for_user", lambda *args: provider)
    AIRetryPreference.objects.create(owner=owner, auto_retry_enabled=True, max_retries=2)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "brighten the fireflies"},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["status"] == "failed"
    assert response.json()["attempts"] == 3
    assert provider.calls == 3
    assert "2 matches on lines 2, 4" in provider.instructions[1]
    assert "2 matches on lines 2, 4" in provider.instructions[2]
    piece.refresh_from_db()
    assert piece.current_version.sequence == 1
    assert piece.current_version.source == source
    assert piece.versions.count() == 1


@pytest.mark.django_db
def test_refine_is_owner_only(monkeypatch, piece):
    other = get_user_model().objects.create_user(username="other-refine-owner")
    provider_calls = []
    monkeypatch.setattr(
        art_piece_refine,
        "_provider_for_user",
        lambda *args: provider_calls.append(args) or _Provider([]),
    )
    client = APIClient()
    client.force_authenticate(other)
    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "make it blue"},
        format="json",
    )
    assert response.status_code == 404
    assert provider_calls == []


@pytest.mark.django_db
def test_refine_rate_limit_rejects_before_provider_and_quota(monkeypatch, owner, piece):
    provider = _Provider([_result('color = "red"', 'color = "blue"')])
    monkeypatch.setattr(art_piece_refine, "_provider_for_user", lambda *args: provider)
    rate_checks = []

    def reject_rate_limit(cache_key, *, limit, window_seconds):
        rate_checks.append((cache_key, limit, window_seconds))
        return False

    monkeypatch.setattr(art_piece_refine, "_increment_and_check", reject_rate_limit)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "make it blue"},
        format="json",
    )

    run = piece.refine_runs.get()
    assert response.status_code == 200
    assert response.json()["error_reason"] == "rate_limited"
    assert run.attempts == 0
    assert rate_checks
    assert provider.calls == provider.model_operation_calls == 0
    assert cache.get(art_piece_refine._quota_cache_key(owner.id), 0) == 0


@pytest.mark.django_db
def test_refine_quota_rejection_prevents_provider_invocation(monkeypatch, owner, piece):
    provider = _Provider([_result('color = "red"', 'color = "blue"')])
    monkeypatch.setattr(art_piece_refine, "_provider_for_user", lambda *args: provider)
    monkeypatch.setattr(art_piece_refine, "get_effective_cap", lambda *args: 0)
    monkeypatch.setattr(art_piece_refine, "is_unlimited", lambda *args: False)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "make it blue"},
        format="json",
    )

    run = piece.refine_runs.get()
    assert response.status_code == 200
    assert response.json()["error_reason"] == "quota_exceeded"
    assert run.attempts == 0
    assert provider.calls == provider.model_operation_calls == 0
    assert cache.get(art_piece_refine._quota_cache_key(owner.id), 0) == 0


@pytest.mark.django_db
def test_refine_provider_construction_failure_is_a_loop_attempt_not_a_model_call(
    monkeypatch, owner, piece
):
    AIRetryPreference.objects.create(owner=owner, auto_retry_enabled=False, max_retries=3)
    provider_constructions = []

    def fail_provider(*args):
        provider_constructions.append(args)
        raise RuntimeError("provider construction failed")

    monkeypatch.setattr(art_piece_refine, "_provider_for_user", fail_provider)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "make it blue"},
        format="json",
    )

    run = piece.refine_runs.get()
    assert response.status_code == 200
    assert run.status == "failed"
    assert run.attempts == 1
    assert provider_constructions
    assert cache.get(art_piece_refine._rate_limit_cache_key(owner.id)) == 1
    assert cache.get(art_piece_refine._quota_cache_key(owner.id)) == 1


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
