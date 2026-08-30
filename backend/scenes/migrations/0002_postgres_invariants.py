"""PostgreSQL-only triggers enforcing invariants Django's constraint API can't express.

`CheckConstraint`/`UniqueConstraint` (migration 0001) can't reference
another row or another table, so the two cross-row invariants from Task 8
are enforced with real PostgreSQL triggers instead of only in application
code:

1. `SceneVersion` snapshot fields (`project`, `sequence`, `scene_json`,
   `created_by`, `parent`, `fork_source_version`, `origin`,
   `change_label`) are immutable after creation — only `is_deleted`/
   `deleted_at` may change.
2. `Project.current_version` must reference a `SceneVersion` belonging to
   that same project and must not be soft-deleted; a `SceneVersion` that
   is currently a project's `current_version` cannot itself be
   soft-deleted.

A no-op on SQLite (used only for the offline test suite): SQLite has no
equivalent trigger/function syntax, and `docs/plan.md` treats PostgreSQL
as authoritative for this kind of behavior anyway, so the app-level
`SceneVersion.save()` guard (see scenes/models.py) is what protects the
offline suite, while this migration protects real deployments.
"""

from django.db import migrations

CREATE_SQL = """
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

CREATE TRIGGER scenes_sceneversion_prevent_snapshot_mutation_trigger
BEFORE UPDATE ON scenes_sceneversion
FOR EACH ROW EXECUTE FUNCTION scenes_sceneversion_prevent_snapshot_mutation();

CREATE OR REPLACE FUNCTION scenes_sceneversion_protect_current_from_soft_delete()
RETURNS trigger AS $$
BEGIN
    IF NEW.is_deleted AND NOT OLD.is_deleted THEN
        IF EXISTS (SELECT 1 FROM scenes_project WHERE current_version_id = NEW.id) THEN
            RAISE EXCEPTION
                'SceneVersion %% is a project current_version and cannot be soft-deleted', NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scenes_sceneversion_protect_current_from_soft_delete_trigger
BEFORE UPDATE ON scenes_sceneversion
FOR EACH ROW EXECUTE FUNCTION scenes_sceneversion_protect_current_from_soft_delete();

CREATE OR REPLACE FUNCTION scenes_project_check_current_version()
RETURNS trigger AS $$
DECLARE
    v_project_id BIGINT;
    v_is_deleted BOOLEAN;
BEGIN
    IF NEW.current_version_id IS NOT NULL THEN
        SELECT project_id, is_deleted INTO v_project_id, v_is_deleted
        FROM scenes_sceneversion WHERE id = NEW.current_version_id;

        IF v_project_id IS NULL THEN
            RAISE EXCEPTION
                'current_version_id %% does not reference an existing SceneVersion',
                NEW.current_version_id;
        END IF;
        IF v_project_id != NEW.id THEN
            RAISE EXCEPTION
                'current_version_id %% does not belong to project %%',
                NEW.current_version_id, NEW.id;
        END IF;
        IF v_is_deleted THEN
            RAISE EXCEPTION
                'current_version_id %% is soft-deleted and cannot be the current version',
                NEW.current_version_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scenes_project_check_current_version_trigger
BEFORE INSERT OR UPDATE ON scenes_project
FOR EACH ROW EXECUTE FUNCTION scenes_project_check_current_version();
"""

DROP_SQL = """
DROP TRIGGER IF EXISTS scenes_project_check_current_version_trigger ON scenes_project;
DROP FUNCTION IF EXISTS scenes_project_check_current_version();

DROP TRIGGER IF EXISTS scenes_sceneversion_protect_current_from_soft_delete_trigger
    ON scenes_sceneversion;
DROP FUNCTION IF EXISTS scenes_sceneversion_protect_current_from_soft_delete();

DROP TRIGGER IF EXISTS scenes_sceneversion_prevent_snapshot_mutation_trigger
    ON scenes_sceneversion;
DROP FUNCTION IF EXISTS scenes_sceneversion_prevent_snapshot_mutation();
"""


def create_triggers(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(CREATE_SQL)


def drop_triggers(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(DROP_SQL)


class Migration(migrations.Migration):
    dependencies = [
        ("scenes", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_triggers, drop_triggers),
    ]
