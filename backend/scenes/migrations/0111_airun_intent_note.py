from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0110_project_brief")]

    operations = [
        migrations.AddField(
            model_name="airun",
            name="intent_note",
            field=models.TextField(blank=True, default="", max_length=1500),
        ),
    ]
