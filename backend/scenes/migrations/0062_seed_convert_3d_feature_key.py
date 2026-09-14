# Issue #528: grant every existing active Plan the new
# "ai_scene_convert_3d" feature key, mirroring 0031_seed_default_plans.py's
# reasoning -- get_effective_cap fails closed (denies) any feature key a
# plan's feature_keys list doesn't already contain, so a fresh conversion
# feature would otherwise be silently unusable on every pre-existing plan
# (including the seeded "free"/"paid" rows) until an admin manually edited
# it.

from django.db import migrations

NEW_FEATURE_KEY = "ai_scene_convert_3d"


def add_convert_3d_feature_key(apps, schema_editor):
    Plan = apps.get_model("scenes", "Plan")
    for plan in Plan.objects.all():
        if NEW_FEATURE_KEY not in plan.feature_keys:
            plan.feature_keys = [*plan.feature_keys, NEW_FEATURE_KEY]
            plan.save(update_fields=["feature_keys"])


def remove_convert_3d_feature_key(apps, schema_editor):
    Plan = apps.get_model("scenes", "Plan")
    for plan in Plan.objects.all():
        if NEW_FEATURE_KEY in plan.feature_keys:
            plan.feature_keys = [k for k in plan.feature_keys if k != NEW_FEATURE_KEY]
            plan.save(update_fields=["feature_keys"])


class Migration(migrations.Migration):
    dependencies = [
        ("scenes", "0061_scene_conversion_run"),
    ]

    operations = [
        migrations.RunPython(add_convert_3d_feature_key, remove_convert_3d_feature_key),
    ]
