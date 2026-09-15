import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0063_sync_mutation_receipt")]

    operations = [
        migrations.CreateModel(
            name="CloudBackupBlobTransfer",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("asset_id", models.UUIDField()),
                ("checksum", models.CharField(max_length=128)),
                ("mime_type", models.CharField(max_length=128)),
                ("byte_length", models.PositiveBigIntegerField()),
                ("data", models.BinaryField(default=bytes)),
                ("acknowledged_ranges", models.JSONField(default=list)),
                ("idempotency_key", models.CharField(max_length=128)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "backup",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="blob_transfers",
                        to="scenes.cloudbackupproject",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("backup", "asset_id"), name="unique_cloud_blob_transfer_asset"
                    )
                ]
            },
        )
    ]
