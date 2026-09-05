from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0026_create_django_cache_table")]

    operations = [
        migrations.CreateModel(
            name="ProviderCredential",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("vendor", models.CharField(max_length=32)),
                ("encrypted_key", models.BinaryField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="provider_credentials",
                        to="auth.user",
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="providercredential",
            constraint=models.UniqueConstraint(
                fields=("owner", "vendor"), name="unique_provider_credential"
            ),
        ),
    ]
