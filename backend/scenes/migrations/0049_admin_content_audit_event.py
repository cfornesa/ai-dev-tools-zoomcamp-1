from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("scenes", "0048_alter_page_managers"),
    ]

    operations = [
        migrations.CreateModel(
            name="AdminContentAuditEvent",
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
                ("resource_type", models.CharField(max_length=32)),
                ("resource_id", models.CharField(max_length=128)),
                ("action", models.CharField(max_length=32)),
                ("detail", models.CharField(blank=True, default="", max_length=240)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="admin_content_audit_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
                "indexes": [
                    models.Index(
                        fields=["resource_type", "resource_id", "-created_at"],
                        name="admin_content_resource_idx",
                    )
                ],
            },
        ),
    ]
