# Task 19: seed the eight built-in, read-only starter templates.
#
# Each fixture in scenes/fixtures/templates/ is a schema-valid scene
# document (see tests/test_template_catalog.py, which re-validates every
# fixture against scenes.validation.validate_scene independently of this
# migration). Loading raw JSON here rather than calling validate_scene
# keeps this migration stable even if validation logic changes later.

import json
from pathlib import Path

from django.db import migrations

from scenes.builtin_templates import BUILT_IN_TEMPLATES

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures" / "templates"


def seed_built_in_templates(apps, schema_editor):
    Template = apps.get_model("scenes", "Template")
    alias = schema_editor.connection.alias
    for filename, name, category, description in BUILT_IN_TEMPLATES:
        with (FIXTURES_DIR / filename).open() as f:
            scene_json = json.load(f)
        Template.objects.using(alias).create(
            source_type="built_in",
            owner=None,
            name=name,
            category=category,
            description=description,
            scene_json=scene_json,
        )


def remove_built_in_templates(apps, schema_editor):
    Template = apps.get_model("scenes", "Template")
    alias = schema_editor.connection.alias
    names = [name for _, name, _, _ in BUILT_IN_TEMPLATES]
    Template.objects.using(alias).filter(source_type="built_in", name__in=names).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("scenes", "0009_template_public_id"),
    ]

    operations = [
        migrations.RunPython(seed_built_in_templates, remove_built_in_templates),
    ]
