"""Tests for the built-in template catalog (Task 19).

Two things are checked independently: that every fixture in
scenes/fixtures/templates/ is itself a schema-valid scene document (so a
future validator change can't silently break a shipped template without
a test failing), and that migration 0010 actually seeded exactly those
fixtures into the database as read-only, ownerless built-in Templates.
"""

import json
from pathlib import Path

import pytest

from scenes.builtin_templates import BUILT_IN_TEMPLATES
from scenes.models import Template
from scenes.validation import validate_scene

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "scenes" / "fixtures" / "templates"


@pytest.mark.parametrize("filename,name,category,description", BUILT_IN_TEMPLATES)
def test_fixture_is_schema_valid(filename, name, category, description):
    scene_json = json.loads((FIXTURES_DIR / filename).read_text())
    result = validate_scene(scene_json)
    assert result.valid, [(e.path, e.rule, e.message) for e in result.errors]


def test_fixture_directory_has_no_extra_files():
    expected = {filename for filename, *_ in BUILT_IN_TEMPLATES}
    actual = {p.name for p in FIXTURES_DIR.glob("*.json")}
    assert actual == expected


@pytest.mark.django_db
def test_migration_seeded_exactly_eight_built_in_templates():
    built_in = Template.objects.built_in()
    assert built_in.count() == 8
    assert {t.name for t in built_in} == {name for _, name, _, _ in BUILT_IN_TEMPLATES}


@pytest.mark.django_db
def test_seeded_templates_are_ownerless_and_have_a_description():
    for template in Template.objects.built_in():
        assert template.owner is None
        assert template.description.strip() != ""
        assert template.category.strip() != ""


@pytest.mark.django_db
def test_seeded_scene_json_matches_fixture_and_is_still_valid():
    by_name = {name: filename for filename, name, _, _ in BUILT_IN_TEMPLATES}
    for template in Template.objects.built_in():
        expected = json.loads((FIXTURES_DIR / by_name[template.name]).read_text())
        assert template.scene_json == expected
        assert validate_scene(template.scene_json).valid
