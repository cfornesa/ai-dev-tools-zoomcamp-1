from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0109_projectactivity_order_index")]

    operations = [
        migrations.AddField(
            model_name="project",
            name="brief",
            field=models.TextField(blank=True, default="", max_length=1500),
        ),
    ]
