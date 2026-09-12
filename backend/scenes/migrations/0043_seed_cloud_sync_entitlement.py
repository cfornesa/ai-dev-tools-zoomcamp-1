from django.db import migrations


def add_cloud_sync_to_paid(apps, schema_editor):
    Plan = apps.get_model("scenes", "Plan")
    plan = Plan.objects.filter(plan_key="paid").first()
    if plan is not None:
        plan.feature_keys = sorted(set(plan.feature_keys or []) | {"cloud_project_sync"})
        plan.save(update_fields=["feature_keys"])


class Migration(migrations.Migration):
    dependencies = [("scenes", "0042_cloudbackupproject_paused")]
    operations = [migrations.RunPython(add_cloud_sync_to_paid, migrations.RunPython.noop)]
