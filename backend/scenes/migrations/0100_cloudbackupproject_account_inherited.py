from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0099_cloud_sync_preference")]

    operations = [
        migrations.AddField(
            model_name="cloudbackupproject",
            name="account_inherited",
            field=models.BooleanField(default=False),
        ),
    ]
