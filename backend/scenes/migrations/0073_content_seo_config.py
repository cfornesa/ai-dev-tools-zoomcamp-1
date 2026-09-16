from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0072_page_seo_config")]
    operations = [
        migrations.AddField(
            model_name="collection",
            name="seo_config",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="artpiece",
            name="seo_config",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
