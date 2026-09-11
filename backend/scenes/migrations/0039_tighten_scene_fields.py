"""Issue #510: tighten `SceneVersion.scene` to NOT NULL and re-scope
per-project version sequence numbering to per-scene.

Safe to apply only after `0038_backfill_scenes.py` has run: every
`SceneVersion` row must already have a non-null `scene_id` before this
migration's `AlterField` can add the NOT NULL constraint, and the old
`unique_sequence_per_project` constraint can only be dropped in favor of
`unique_sequence_per_scene` once every project has exactly one scene owning
every one of its versions (which the backfill guarantees).

## What this does

1. `AlterField(SceneVersion.scene, null=False)` -- every `SceneVersion`
   must belong to a scene from this point on; new code can rely on
   `version.scene_id` always being set.
2. Drops `unique_sequence_per_project` (`UniqueConstraint` on
   `(project, sequence)`) and replaces it with `unique_sequence_per_scene`
   (`UniqueConstraint` on `(scene, sequence)`) -- version numbering is now
   scoped to the owning scene, not the whole project, which is what makes
   a second scene able to start its own `sequence` at 1 independent of any
   sibling scene's history.

## Deviation from issue #510's literal spec: `Project.active_scene` stays nullable

Issue #510 also asked this migration to `AlterField` `Project.active_scene`
to NOT NULL, mirroring `SceneVersion.scene`. That specific part is *not*
done here: Django's own model validation (check id E132) forbids
`on_delete=models.SET_NULL` on a non-nullable `ForeignKey` -- the ORM
cannot honor "set this to null when the referenced row is deleted" on a
column that rejects null values, so `manage.py check` fails immediately if
both are combined. `Project.active_scene` keeps `on_delete=SET_NULL` (see
that field's docstring in `scenes/models.py` for why: deleting the active
scene, which is never the *last* scene, must not delete or block-delete the
project itself), so it must also keep `null=True` at the schema level
permanently. "Always set in practice" for that field is enforced by
application invariants only (every scene-creating/deleting code path in
`scenes/api.py` keeps it pointed at a real scene), the same nullable-but-
always-set pattern this codebase already uses for `Project.current_version`
itself. Flagged here explicitly for the repo owner/QA reviewer to confirm,
per this migration's own "document rationale/rollback inline" convention
(see `0030_admin_settings.py`).

## Rollback safety window -- read before reversing

This migration is only safely reversible **while every project still has
exactly one scene**. Reversing means restoring `unique_sequence_per_project`
(`(project, sequence)`) and dropping `unique_sequence_per_scene`. That is
only guaranteed collision-free if each project's versions still all belong
to one scene, so their per-scene sequence numbers are trivially also unique
per project. The moment any project gets a second scene (via the create-scene
endpoint this issue also adds) and both scenes accumulate their own
`sequence` numbers starting at 1, reversing this migration would immediately
violate the restored `(project, sequence)` uniqueness the instant two
scenes in the same project both have a version with the same `sequence`
number -- a real, expected state once multi-scene projects exist, not an
edge case. Do not reverse this migration in an environment where any
project has more than one scene; recreate a fresh migration to re-widen the
scope instead of rolling this one back.

`AlterField(SceneVersion.scene, null=False)` itself is trivially reversible
either direction (no data implication -- it only loosens/tightens a
constraint), so the constraint swap above is the only part of this
migration's reversal that carries the caveat.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("scenes", "0038_backfill_scenes"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="sceneversion",
            name="unique_sequence_per_project",
        ),
        migrations.AlterField(
            model_name="sceneversion",
            name="scene",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="scene_versions",
                to="scenes.scene",
            ),
        ),
        migrations.AddConstraint(
            model_name="sceneversion",
            constraint=models.UniqueConstraint(
                fields=("scene", "sequence"), name="unique_sequence_per_scene"
            ),
        ),
        migrations.AlterModelOptions(
            name="sceneversion",
            options={"ordering": ["project", "scene", "sequence"]},
        ),
    ]
