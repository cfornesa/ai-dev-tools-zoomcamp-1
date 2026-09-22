from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0088_theme_generation_attempt")]

    operations = [
        migrations.AlterField(
            model_name="publicprofile",
            name="palette_key",
            field=models.SlugField(db_default="original", default="original", max_length=32),
        ),
        migrations.AlterField(
            model_name="publicprofile",
            name="palette_overrides",
            field=models.JSONField(blank=True, db_default={}, default=dict),
        ),
        migrations.AlterField(
            model_name="publicprofile",
            name="presentation_overrides",
            field=models.JSONField(blank=True, db_default={}, default=dict),
        ),
        migrations.AlterField(
            model_name="sitesettings",
            name="palette_key",
            field=models.SlugField(db_default="original", default="original", max_length=32),
        ),
        migrations.AlterField(
            model_name="sitesettings",
            name="palette_overrides",
            field=models.JSONField(blank=True, db_default={}, default=dict),
        ),
        migrations.AlterField(
            model_name="sitesettings",
            name="presentation_overrides",
            field=models.JSONField(blank=True, db_default={}, default=dict),
        ),
    ]
