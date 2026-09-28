from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0101_pieceintakeasset_source_asset_id")]

    operations = [
        migrations.AddField(
            model_name="collection",
            name="status",
            field=models.CharField(
                choices=[
                    ("active", "Active"),
                    ("draft", "Draft"),
                    ("archived", "Archived"),
                ],
                db_index=True,
                default="active",
                max_length=8,
            ),
        ),
    ]
