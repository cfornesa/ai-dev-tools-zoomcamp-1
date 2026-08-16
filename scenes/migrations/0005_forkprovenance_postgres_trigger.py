"""PostgreSQL-only trigger enforcing ForkProvenance.source_version.project == source_project.

Same rationale as scenes/migrations/0002_postgres_invariants.py: Django's
`CheckConstraint` can't reference another table's column, so
`ForkProvenance.save()`'s application-level guard (scenes/models.py) is
backed here by a real trigger, so even a raw SQL INSERT/UPDATE that
bypasses the Django ORM is rejected. A no-op on SQLite.
"""

from django.db import migrations

CREATE_SQL = """
CREATE OR REPLACE FUNCTION scenes_forkprovenance_check_source()
RETURNS trigger AS $$
DECLARE
    v_source_version_project_id BIGINT;
BEGIN
    SELECT project_id INTO v_source_version_project_id
    FROM scenes_sceneversion WHERE id = NEW.source_version_id;

    IF v_source_version_project_id IS NULL THEN
        RAISE EXCEPTION
            'source_version_id % does not reference an existing SceneVersion',
            NEW.source_version_id;
    END IF;
    IF v_source_version_project_id != NEW.source_project_id THEN
        RAISE EXCEPTION
            'source_version_id % does not belong to source_project_id %',
            NEW.source_version_id, NEW.source_project_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scenes_forkprovenance_check_source_trigger
BEFORE INSERT OR UPDATE ON scenes_forkprovenance
FOR EACH ROW EXECUTE FUNCTION scenes_forkprovenance_check_source();
"""

DROP_SQL = """
DROP TRIGGER IF EXISTS scenes_forkprovenance_check_source_trigger ON scenes_forkprovenance;
DROP FUNCTION IF EXISTS scenes_forkprovenance_check_source();
"""


def create_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(CREATE_SQL)


def drop_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(DROP_SQL)


class Migration(migrations.Migration):
    dependencies = [
        ("scenes", "0004_forkprovenance_template"),
    ]

    operations = [
        migrations.RunPython(create_trigger, drop_trigger),
    ]
