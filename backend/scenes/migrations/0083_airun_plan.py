from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('scenes', '0082_seed_celestial_style'),
    ]

    operations = [
        migrations.AddField(
            model_name='airun',
            name='plan',
            field=models.JSONField(blank=True, null=True),
        ),
    ]
