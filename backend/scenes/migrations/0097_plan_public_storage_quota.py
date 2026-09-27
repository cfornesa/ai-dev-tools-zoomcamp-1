from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("scenes", "0096_airun_assets_alter_airun_scope"),
    ]

    operations = [
        migrations.AddField(
            model_name="plan",
            name="public_storage_bytes",
            field=models.PositiveBigIntegerField(default=524288000),
        ),
        migrations.AddField(
            model_name="plan",
            name="public_storage_files",
            field=models.PositiveIntegerField(default=1000),
        ),
    ]
