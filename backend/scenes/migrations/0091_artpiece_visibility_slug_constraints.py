from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("scenes", "0090_artpieceversion_camera_placement"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="artpiece",
            name="unique_artpiece_public_slug_per_owner",
        ),
        migrations.AddConstraint(
            model_name="artpiece",
            constraint=models.UniqueConstraint(
                condition=models.Q(status="published"),
                fields=("owner", "public_slug"),
                name="unique_published_artpiece_slug_per_owner",
            ),
        ),
        migrations.AddConstraint(
            model_name="artpiece",
            constraint=models.UniqueConstraint(
                condition=~models.Q(status="published"),
                fields=("owner", "public_slug"),
                name="unique_private_artpiece_slug_per_owner",
            ),
        ),
    ]
