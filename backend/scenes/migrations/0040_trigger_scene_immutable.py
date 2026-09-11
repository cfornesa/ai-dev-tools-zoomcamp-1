"""Extend the PostgreSQL snapshot-immutability trigger to cover `scene_id`.

Issue #514 (discovered during #510's QA): #510 added a `scene` FK to
`SceneVersion` and included `scene_id` in `SNAPSHOT_FIELDS`
(`scenes/models.py`), so the application-level `SceneVersion.save()` guard
already rejects any attempt to change an existing version's scene. But
`0002_postgres_invariants.py`'s `scenes_sceneversion_prevent_snapshot_mutation`
trigger function -- the authoritative enforcement against a raw SQL `UPDATE`
that bypasses the ORM entirely -- was not updated in #510's own scope, so a
direct `UPDATE ... SET scene_id = ...` on a real PostgreSQL deployment would
currently succeed where every other snapshot field is already blocked.

This migration replaces the trigger function (`CREATE OR REPLACE`, same
pattern #510 would have used) to add a `scene_id` comparison alongside the
existing seven fields. It is a pure function-body update: no column, no
table, no other trigger is touched, and its reverse restores the exact
`0002` function body -- both directions are no-ops on SQLite, matching every
migration in this file's family.
"""

from django.db import migrations

CREATE_SQL = """
CREATE OR REPLACE FUNCTION scenes_sceneversion_prevent_snapshot_mutation()
RETURNS trigger AS $$
BEGIN
    IF (NEW.project_id IS DISTINCT FROM OLD.project_id)
        OR (NEW.scene_id IS DISTINCT FROM OLD.scene_id)
        OR (NEW.sequence IS DISTINCT FROM OLD.sequence)
        OR (NEW.scene_json IS DISTINCT FROM OLD.scene_json)
        OR (NEW.created_by_id IS DISTINCT FROM OLD.created_by_id)
        OR (NEW.parent_id IS DISTINCT FROM OLD.parent_id)
        OR (NEW.fork_source_version_id IS DISTINCT FROM OLD.fork_source_version_id)
        OR (NEW.origin IS DISTINCT FROM OLD.origin)
        OR (NEW.change_label IS DISTINCT FROM OLD.change_label)
    THEN
        RAISE EXCEPTION 'SceneVersion snapshot fields are immutable (id=%%)', OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

REVERSE_SQL = """
CREATE OR REPLACE FUNCTION scenes_sceneversion_prevent_snapshot_mutation()
RETURNS trigger AS $$
BEGIN
    IF (NEW.project_id IS DISTINCT FROM OLD.project_id)
        OR (NEW.sequence IS DISTINCT FROM OLD.sequence)
        OR (NEW.scene_json IS DISTINCT FROM OLD.scene_json)
        OR (NEW.created_by_id IS DISTINCT FROM OLD.created_by_id)
        OR (NEW.parent_id IS DISTINCT FROM OLD.parent_id)
        OR (NEW.fork_source_version_id IS DISTINCT FROM OLD.fork_source_version_id)
        OR (NEW.origin IS DISTINCT FROM OLD.origin)
        OR (NEW.change_label IS DISTINCT FROM OLD.change_label)
    THEN
        RAISE EXCEPTION 'SceneVersion snapshot fields are immutable (id=%%)', OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""


def extend_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(CREATE_SQL)


def restore_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(REVERSE_SQL)


class Migration(migrations.Migration):
    dependencies = [
        ("scenes", "0039_tighten_scene_fields"),
    ]

    operations = [
        migrations.RunPython(extend_trigger, restore_trigger),
    ]
