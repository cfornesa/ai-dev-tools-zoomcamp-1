from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0092_seed_art_piece_task_kind")]

    operations = [
        migrations.AddField(
            model_name="aiprovidermodel",
            name="native_schema",
            field=models.BooleanField(default=True),
        ),
    ]
