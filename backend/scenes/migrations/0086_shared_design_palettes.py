from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0085_artpiecerefinerun")]

    operations = [
        migrations.AddField(
            model_name="sitesettings",
            name="palette_key",
            field=models.SlugField(default="original", max_length=32),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="palette_overrides",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="presentation_overrides",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="publicprofile",
            name="palette_key",
            field=models.SlugField(default="original", max_length=32),
        ),
        migrations.AddField(
            model_name="publicprofile",
            name="palette_overrides",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="publicprofile",
            name="presentation_overrides",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
