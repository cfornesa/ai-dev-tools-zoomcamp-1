from django.db import migrations


CAPABILITY_KEYS = [
    "editor_2d_local",
    "editor_3d_local",
    "generated_pieces",
    "ai_scene_create",
    "ai_scene_edit",
    "ai_art_generate",
    "publishing",
    "cloud_project_sync",
]


def seed_policy(apps, schema_editor):
    Role = apps.get_model("scenes", "EntitlementRole")
    Plan = apps.get_model("scenes", "Plan")
    Global = apps.get_model("scenes", "GlobalCapabilitySetting")
    free, _ = Role.objects.get_or_create(role_key="free", defaults={"label": "Free"})
    premium, _ = Role.objects.get_or_create(
        role_key="premium",
        defaults={
            "label": "Premium",
            "capabilities": {key: True for key in CAPABILITY_KEYS},
        },
    )
    Plan.objects.filter(plan_key="free").update(role=free)
    Plan.objects.filter(plan_key="paid").update(role=premium)
    for key in CAPABILITY_KEYS:
        Global.objects.get_or_create(
            capability_key=key,
            defaults={"enabled": key != "cloud_project_sync"},
        )


class Migration(migrations.Migration):
    dependencies = [("scenes", "0050_roles_global_capabilities")]
    operations = [migrations.RunPython(seed_policy, migrations.RunPython.noop)]
