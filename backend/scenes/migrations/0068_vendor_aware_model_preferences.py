from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0067_profile_style_catalog")]

    operations = [
        migrations.AddField(
            model_name="mistralmodelpreference",
            name="vendor",
            field=models.CharField(
                blank=True,
                default="mistral",
                max_length=32,
                null=True,
            ),
        ),
        migrations.AddConstraint(
            model_name="mistralmodelpreference",
            constraint=models.UniqueConstraint(
                fields=("owner", "vendor", "slug"), name="unique_saved_ai_model_preference"
            ),
        ),
    ]
