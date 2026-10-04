from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scenes", "0107_cloud_sync_consent_source"),
    ]

    operations = [
        migrations.AddField(
            model_name="sceneversion3d",
            name="html_source",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="sceneversion3d",
            name="css_source",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="sceneversion3d",
            name="js_source",
            field=models.TextField(blank=True, default=""),
        ),
    ]
