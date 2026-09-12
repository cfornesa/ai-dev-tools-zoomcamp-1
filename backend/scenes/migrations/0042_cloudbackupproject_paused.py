from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0041_plan_cloud_storage_bytes_plan_cloud_storage_files_and_more")]
    operations = [
        migrations.AddField(
            model_name="cloudbackupproject",
            name="paused",
            field=models.BooleanField(default=False),
        ),
    ]
