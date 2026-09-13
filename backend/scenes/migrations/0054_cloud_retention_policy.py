from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):
    dependencies = [("scenes", "0053_theme_config")]

    operations = [
        migrations.CreateModel(
            name="CloudRetentionPolicy",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("deleted_grace_days", models.PositiveIntegerField(default=30, validators=[django.core.validators.MaxValueValidator(3650)])),
                ("entitlement_grace_days", models.PositiveIntegerField(default=30, validators=[django.core.validators.MaxValueValidator(3650)])),
                ("disabled_sync_grace_days", models.PositiveIntegerField(default=30, validators=[django.core.validators.MaxValueValidator(3650)])),
                ("revision", models.PositiveIntegerField(default=1)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("updated_by", models.ForeignKey(null=True, on_delete=models.deletion.SET_NULL, related_name="+", to="auth.user")),
            ],
        ),
        migrations.AddField(
            model_name="cloudbackupproject",
            name="retention_state",
            field=models.CharField(choices=[("active", "Active"), ("deleted", "Deleted"), ("entitlement_expired", "Entitlement expired"), ("sync_disabled", "Sync disabled")], default="active", max_length=24),
        ),
        migrations.AddField(
            model_name="cloudbackupproject",
            name="retain_until",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
