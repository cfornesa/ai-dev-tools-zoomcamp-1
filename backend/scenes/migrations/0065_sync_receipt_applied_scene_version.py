import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0064_cloudbackupblobtransfer")]

    operations = [
        migrations.AddField(
            model_name="syncmutationreceipt",
            name="applied_scene_version",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="sync_resolution_receipts",
                to="scenes.sceneversion",
            ),
        ),
    ]
