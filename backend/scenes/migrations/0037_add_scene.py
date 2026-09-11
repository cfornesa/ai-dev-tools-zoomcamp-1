"""Issue #510: additive schema for ordered scenes within a 2D project.

Introduces the `Scene` model and two nullable foreign keys
(`SceneVersion.scene`, `Project.active_scene`) that will connect it to the
existing `Project`/`SceneVersion` tables. This migration is deliberately
schema-only and fully additive/backward compatible:

- `Scene` is a brand-new table; nothing existing references it yet.
- `SceneVersion.scene` and `Project.active_scene` are added `null=True`, so
  every existing row is valid the instant this migration applies (they
  default to `NULL`) and every pre-#510 code path that doesn't know about
  scenes yet keeps working unchanged.

No data is populated here on purpose -- that is
`0038_backfill_scenes.py`'s job, kept in its own migration so this one
stays a pure, instantly-reversible schema change (`migrate scenes 0036`
undoes exactly this, nothing more) and the data migration can be re-run,
inspected, or rolled back independently of the schema.

Rollback: `python manage.py migrate scenes 0036`. Safe unconditionally --
this migration adds nothing that any other migration or application code
depends on yet (the tightening in `0039_tighten_scene_fields.py` hasn't
happened), so reversing it just drops the new table/columns.
"""

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("scenes", "0036_mistral_to_provider_credential"),
    ]

    operations = [
        migrations.CreateModel(
            name="Scene",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("public_id", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("name", models.CharField(default="Scene", max_length=200)),
                ("position", models.PositiveIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="scenes",
                        to="scenes.project",
                    ),
                ),
                (
                    "current_version",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="current_for_scenes",
                        to="scenes.sceneversion",
                    ),
                ),
            ],
            options={
                "ordering": ["position"],
            },
        ),
        migrations.AddConstraint(
            model_name="scene",
            constraint=models.UniqueConstraint(
                fields=("project", "position"), name="unique_scene_position_per_project"
            ),
        ),
        migrations.AddField(
            model_name="sceneversion",
            name="scene",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="scene_versions",
                to="scenes.scene",
            ),
        ),
        migrations.AddField(
            model_name="project",
            name="active_scene",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="active_for_projects",
                to="scenes.scene",
            ),
        ),
    ]
