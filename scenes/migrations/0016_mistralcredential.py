from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("scenes", "0015_alter_project_allow_public_remix"),
    ]

    operations = [
        migrations.CreateModel(
            name="MistralCredential",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("encrypted_key", models.BinaryField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=models.deletion.CASCADE,
                        related_name="mistral_credential",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]