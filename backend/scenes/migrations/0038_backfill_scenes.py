"""Issue #510: backfill exactly one `Scene` per pre-existing `Project`.

Data-only migration, deliberately separate from the additive schema change
in `0037_add_scene.py` and the NOT NULL tightening in
`0039_tighten_scene_fields.py`. Uses only the migration's own frozen
historical model classes (`apps.get_model(...)`, per Django's documented
`RunPython` convention) -- never the live `scenes.models` classes, so this
migration keeps working correctly even after the live models evolve
further in ways unrelated to this exact schema snapshot.

For every existing `Project` row (including soft-deleted ones -- deleting a
project must not make it lose data, and the migration has no way to know
which rows a future `objects` queryset would filter anyway, since a
historical model's default manager here is unfiltered):

1. Create one `Scene(name="Scene 1", position=0,
   current_version=project.current_version)`.
2. Point every one of that project's `SceneVersion` rows at the new scene
   (`scene_id = new_scene.id`) -- this is what makes
   `unique_sequence_per_scene` (added by 0039) trivially satisfied: a
   project's pre-existing sequence numbers were already unique per project,
   and every one of them now belongs to that project's single scene, so
   they're still unique per scene.
3. Set `project.active_scene = new_scene`.

Nothing here touches `scene_json`, `sequence`, or any other snapshot field
of any `SceneVersion` -- only the new `scene_id` foreign key, which did not
exist before `0037_add_scene.py` added it. No version, title, ownership,
or visibility data is read, copied, or modified.

## Reversibility

The reverse operation (`unlink_scenes`) is safe here specifically because
this is migration 0038, run before 0039 tightens anything: reversing means
deleting every backfilled `Scene` row and nulling `SceneVersion.scene` /
`Project.active_scene` back to `NULL`, which the *not-yet-tightened* nullable
columns from 0037 accept without a constraint violation. This is exactly
"safe to reverse *now*" the way `0030_admin_settings.py`'s own convention
in this repo documents -- reversibility is a property of the migration
sequence's current state, not a permanent guarantee. Once `0039` makes
these columns NOT NULL, this migration can no longer be reversed on its own
(the forward NOT NULL migration must be reversed first); see that
migration's own docstring for why *it* is only safely reversible while every
project still has exactly one scene.
"""

from django.db import migrations


def backfill_scenes(apps, schema_editor):
    # Bind every queryset to the migration's own target database
    # (`schema_editor.connection.alias`) rather than letting the default
    # router pick one. Without this, a `migrate --database=<non-default>`
    # call (exactly what this repo's own multi-database test suite does
    # for `POSTGRES_TEST_DATABASE_URL`-gated migration tests, and what
    # `tests/test_scene_migration.py` exercises directly) would silently
    # run every one of this function's ORM queries against the "default"
    # alias instead of the database actually being migrated -- backfilling
    # zero rows there while leaving the real target database's
    # `SceneVersion.scene`/`Project.active_scene` untouched, which then
    # fails migration 0039's NOT NULL tightening with a confusing
    # "contains null values" error that has nothing to do with the data
    # migration's own logic.
    db_alias = schema_editor.connection.alias
    Project = apps.get_model("scenes", "Project")
    Scene = apps.get_model("scenes", "Scene")
    SceneVersion = apps.get_model("scenes", "SceneVersion")

    for project in Project.objects.using(db_alias).all().iterator():
        scene = Scene.objects.using(db_alias).create(
            project=project,
            name="Scene 1",
            position=0,
            current_version=project.current_version,
        )
        SceneVersion.objects.using(db_alias).filter(project=project).update(scene=scene)
        project.active_scene = scene
        project.save(using=db_alias, update_fields=["active_scene"])


def unlink_scenes(apps, schema_editor):
    db_alias = schema_editor.connection.alias
    Project = apps.get_model("scenes", "Project")
    Scene = apps.get_model("scenes", "Scene")
    SceneVersion = apps.get_model("scenes", "SceneVersion")

    Project.objects.using(db_alias).update(active_scene=None)
    SceneVersion.objects.using(db_alias).update(scene=None)
    Scene.objects.using(db_alias).all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("scenes", "0037_add_scene"),
    ]

    operations = [
        migrations.RunPython(backfill_scenes, unlink_scenes),
    ]
