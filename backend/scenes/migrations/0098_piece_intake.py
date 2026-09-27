from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("scenes", "0097_plan_public_storage_quota"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PieceIntakeAsset",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("piece_kind", models.CharField(max_length=16)),
                ("piece_public_id", models.UUIDField()),
                ("filename", models.CharField(max_length=255)),
                ("alt_text", models.TextField(blank=True, default="")),
                ("mime_type", models.CharField(max_length=128)),
                ("byte_size", models.PositiveBigIntegerField()),
                ("checksum", models.CharField(max_length=64)),
                ("data", models.BinaryField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("owner", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="piece_intake_assets", to=settings.AUTH_USER_MODEL)),
            ],
            options={"indexes": [models.Index(fields=["owner", "piece_kind", "piece_public_id"], name="scenes_piec_owner_i_243e80_idx")]},
        ),
        migrations.CreateModel(
            name="PieceIntakeReceipt",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("idempotency_key", models.CharField(max_length=128)),
                ("kind", models.CharField(max_length=16)),
                ("public_id", models.UUIDField()),
                ("version", models.PositiveIntegerField()),
                ("response", models.JSONField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("owner", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="piece_intake_receipts", to=settings.AUTH_USER_MODEL)),
            ],
            options={"constraints": [models.UniqueConstraint(fields=("owner", "idempotency_key"), name="unique_piece_intake_idempotency")]},
        ),
    ]
