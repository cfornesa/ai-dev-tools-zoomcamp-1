import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0098_piece_intake")]

    operations = [
        migrations.CreateModel(
            name="CloudSyncPreference",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("enabled", models.BooleanField(default=False)),
                ("consent_version", models.CharField(blank=True, max_length=64)),
                ("consent_text", models.TextField(blank=True)),
                ("consented_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "owner",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="cloud_sync_preference",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
