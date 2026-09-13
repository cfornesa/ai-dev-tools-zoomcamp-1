import django.db.models.manager
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [("scenes", "0047_cms_pages")]

    operations = [
        migrations.AlterModelManagers(
            name="page",
            managers=[("all_objects", django.db.models.manager.Manager())],
        ),
    ]
