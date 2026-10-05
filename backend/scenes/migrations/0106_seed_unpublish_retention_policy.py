from django.db import migrations


def seed_policy(apps, schema_editor):
    policy = apps.get_model("scenes", "UnpublishRetentionPolicy")
    policy.objects.get_or_create(
        pk=1,
        defaults={
            "unpublished_grace_days": 30,
            "revision": 1,
        },
    )


class Migration(migrations.Migration):
    dependencies = [("scenes", "0105_unpublish_retention")]
    operations = [migrations.RunPython(seed_policy, migrations.RunPython.noop)]
