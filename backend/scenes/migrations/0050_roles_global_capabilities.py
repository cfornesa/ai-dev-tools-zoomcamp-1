from django.conf import settings
from django.db import migrations, models


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


def seed_roles_and_global_capabilities(apps, schema_editor):
    Role = apps.get_model("scenes", "EntitlementRole")
    Plan = apps.get_model("scenes", "Plan")
    Global = apps.get_model("scenes", "GlobalCapabilitySetting")
    free, _ = Role.objects.get_or_create(
        role_key="free", defaults={"label": "Free", "capabilities": {}}
    )
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


def unseed_roles_and_global_capabilities(apps, schema_editor):
    Role = apps.get_model("scenes", "EntitlementRole")
    Global = apps.get_model("scenes", "GlobalCapabilitySetting")
    Plan = apps.get_model("scenes", "Plan")
    Plan.objects.update(role=None)
    Role.objects.filter(role_key__in=["free", "premium"]).delete()
    Global.objects.filter(capability_key__in=CAPABILITY_KEYS).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("scenes", "0049_admin_content_audit_event"),
    ]

    operations = [
        migrations.CreateModel(
            name="EntitlementRole",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("role_key", models.CharField(max_length=32, unique=True)),
                ("label", models.CharField(max_length=100)),
                ("description", models.TextField(blank=True, default="", max_length=500)),
                ("capabilities", models.JSONField(default=dict)),
                ("active", models.BooleanField(default=True)),
                ("revision", models.PositiveIntegerField(default=1)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "updated_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="updated_roles",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["role_key"]},
        ),
        migrations.CreateModel(
            name="GlobalCapabilitySetting",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("capability_key", models.CharField(max_length=64, unique=True)),
                ("enabled", models.BooleanField(default=True)),
                ("revision", models.PositiveIntegerField(default=1)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "updated_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="updated_global_capabilities",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["capability_key"]},
        ),
        migrations.AddField(
            model_name="plan",
            name="role",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name="plans",
                to="scenes.entitlementrole",
            ),
        ),
        migrations.RunPython(seed_roles_and_global_capabilities, unseed_roles_and_global_capabilities),
    ]
