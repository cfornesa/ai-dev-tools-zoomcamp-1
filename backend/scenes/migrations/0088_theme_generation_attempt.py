import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("scenes", "0087_seed_original_style_catalog"),
    ]

    operations = [
        migrations.CreateModel(
            name="ThemeGenerationAttempt",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                (
                    "operation",
                    models.CharField(
                        choices=[("generate", "Generate"), ("refine", "Refine")], max_length=16
                    ),
                ),
                (
                    "state",
                    models.CharField(
                        choices=[
                            ("draft", "Draft"),
                            ("accepted", "Accepted"),
                            ("rejected", "Rejected"),
                        ],
                        default="draft",
                        max_length=16,
                    ),
                ),
                ("prompt", models.CharField(max_length=2000)),
                ("original_prompt", models.CharField(blank=True, default="", max_length=2000)),
                ("source", models.CharField(blank=True, default="fake", max_length=32)),
                ("revision", models.PositiveIntegerField(default=1)),
                ("attempt_number", models.PositiveIntegerField(default=1)),
                ("sequence_token", models.CharField(blank=True, default="", max_length=80)),
                ("definition", models.JSONField(default=dict)),
                ("previous_definition", models.JSONField(blank=True, default=dict)),
                ("error", models.CharField(blank=True, default="", max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "actor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL
                    ),
                ),
                (
                    "style",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="scenes.profilestyle",
                    ),
                ),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
    ]
