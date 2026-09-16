from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0071_public_piece_slugs")]
    operations = [
        migrations.AddField(
            model_name="page",
            name="seo_config",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
