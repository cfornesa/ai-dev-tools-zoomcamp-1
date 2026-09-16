from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("scenes", "0065_sync_receipt_applied_scene_version"),
    ]

    operations = [
        migrations.CreateModel(
            name="PublicProfileHandleRedirect",
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
                ("old_handle", models.CharField(max_length=32, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="handle_redirects",
                        to="scenes.publicprofile",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
