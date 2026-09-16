from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0073_content_seo_config")]

    operations = [
        migrations.AddField(
            model_name="sitesettings",
            name="site_description",
            field=models.TextField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="metadata_tags",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
