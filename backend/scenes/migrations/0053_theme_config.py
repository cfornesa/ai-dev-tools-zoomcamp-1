from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0052_publicprofile")]
    operations = [
        migrations.AddField(
            model_name="sitesettings",
            name="theme_config",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="publicprofile",
            name="theme_config",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
