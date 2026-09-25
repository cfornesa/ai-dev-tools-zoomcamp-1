from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0093_aiprovidermodel_native_schema")]

    operations = [
        migrations.AddField(
            model_name="publicprofile",
            name="profile_image_content_type",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
        migrations.AddField(
            model_name="publicprofile",
            name="profile_image_data",
            field=models.BinaryField(blank=True, null=True),
        ),
    ]
