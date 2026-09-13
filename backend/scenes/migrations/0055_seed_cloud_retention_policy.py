from django.db import migrations


def seed_policy(apps, schema_editor):
    policy = apps.get_model("scenes", "CloudRetentionPolicy")
    policy.objects.get_or_create(
        pk=1,
        defaults={
            "deleted_grace_days": 30,
            "entitlement_grace_days": 30,
            "disabled_sync_grace_days": 30,
            "revision": 1,
        },
    )


class Migration(migrations.Migration):
    dependencies = [("scenes", "0054_cloud_retention_policy")]
    operations = [migrations.RunPython(seed_policy, migrations.RunPython.noop)]
