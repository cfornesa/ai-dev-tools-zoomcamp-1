from django.db import migrations


def seed_policy(apps, schema_editor):
    Plan = apps.get_model("scenes", "Plan")
    free = Plan.objects.filter(plan_key="free").first()
    if free is not None:
        # Issue #529's policy: free accounts now also get cloud sync,
        # as silent weekly snapshots with no archive (issue #530).
        free.feature_keys = sorted(set(free.feature_keys or []) | {"cloud_project_sync"})
        free.cloud_snapshot_cadence_days = 7
        free.cloud_snapshot_archive_enabled = False
        free.save(
            update_fields=[
                "feature_keys",
                "cloud_snapshot_cadence_days",
                "cloud_snapshot_archive_enabled",
            ]
        )
    paid = Plan.objects.filter(plan_key="paid").first()
    if paid is not None:
        # Paid/admin: more frequent snapshots, full archive retained per
        # the existing #522 retention grace periods.
        paid.cloud_snapshot_cadence_days = 1
        paid.cloud_snapshot_archive_enabled = True
        paid.save(update_fields=["cloud_snapshot_cadence_days", "cloud_snapshot_archive_enabled"])


def unseed_policy(apps, schema_editor):
    Plan = apps.get_model("scenes", "Plan")
    free = Plan.objects.filter(plan_key="free").first()
    if free is not None:
        free.feature_keys = sorted(set(free.feature_keys or []) - {"cloud_project_sync"})
        free.save(update_fields=["feature_keys"])


class Migration(migrations.Migration):
    dependencies = [("scenes", "0059_plan_snapshot_cadence")]
    operations = [migrations.RunPython(seed_policy, unseed_policy)]
