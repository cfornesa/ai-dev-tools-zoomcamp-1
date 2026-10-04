from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scenes", "0108_sceneversion3d_source_fields")]

    operations = [
        migrations.AddIndex(
            model_name="projectactivity",
            index=models.Index(
                fields=["project", "-created_at", "-id"],
                name="sc_pa_project_created_id_idx",
            ),
        ),
    ]
