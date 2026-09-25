from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0094_publicprofile_image_data")]

    operations = [
        migrations.AlterField(
            model_name="aiprovidermodel",
            name="native_schema",
            field=models.BooleanField(db_default=True, default=True),
        ),
    ]
